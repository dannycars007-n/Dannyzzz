from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import asyncio
import bcrypt
import jwt
import requests
import resend
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import (
    FastAPI, APIRouter, HTTPException, Depends, Request, Response,
    UploadFile, File, Header, Query
)
from fastapi.responses import Response as FastAPIResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'admin@dannyzcars.com').lower()
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')
ADMIN_NAME = os.environ.get('ADMIN_NAME', 'Admin')
ADMIN_WHATSAPP = os.environ.get('ADMIN_WHATSAPP', '')

EMERGENT_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
APP_NAME = os.environ.get('APP_NAME', 'dannyzcars')
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"

# Email notifications (Resend)
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '').strip()
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev').strip()
NOTIFY_EMAIL = os.environ.get('NOTIFY_EMAIL', '').strip()
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

# Default security questions seeded for admin (admin can change later)
DEFAULT_SECURITY_QUESTIONS = [
    {"question": "¿Cuál fue el nombre de tu primer perro?", "answer": "Boby"},
    {"question": "¿Dónde naciste?", "answer": "Monterrey"},
    {"question": "¿Cuál es el nombre de tu mamá?", "answer": ""},
]

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Storage
# ---------------------------------------------------------------------------
storage_key: Optional[str] = None


def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    if not EMERGENT_KEY:
        raise RuntimeError("EMERGENT_LLM_KEY missing")
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60,
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id, "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesión expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")
    user = await db.users.find_one(
        {"id": payload["sub"]},
        {"_id": 0, "password_hash": 0, "security_questions": 0},
    )
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo administradores")
    return user


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class LoginInput(BaseModel):
    email: EmailStr
    password: str


class ListingBase(BaseModel):
    title: str
    description: str
    price: float
    currency: str = "MXN"
    category: Literal["refacciones", "rines", "autos"]
    subcategory: Optional[str] = None
    condition: Literal["nuevo", "seminuevo", "usado"] = "usado"
    location: str = ""
    brand: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    images: List[str] = []  # list of storage paths
    whatsapp: Optional[str] = None
    is_active: bool = True


class ListingCreate(ListingBase):
    pass


class ListingOut(ListingBase):
    id: str
    created_at: str
    updated_at: str


class MessageInput(BaseModel):
    listing_id: Optional[str] = None
    name: str
    email: EmailStr
    phone: Optional[str] = None
    message: str


class AdminReplyInput(BaseModel):
    message: str


# --- Profile / Security ---
class ProfileUpdate(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    whatsapp: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class SecurityQA(BaseModel):
    question: str
    # answer is optional on read — if None on update means "keep existing"
    answer: Optional[str] = None


class SecurityQuestionsUpdate(BaseModel):
    questions: List[SecurityQA]


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetVerify(BaseModel):
    email: EmailStr
    answers: List[str]
    new_password: str = Field(min_length=8)


# ---------------------------------------------------------------------------
# Email helper
# ---------------------------------------------------------------------------
def _normalize_answer(s: str) -> str:
    return (s or "").strip().lower()


async def send_notification_email(subject: str, html: str) -> bool:
    """Send notification email to the admin's NOTIFY_EMAIL. Non-blocking and
    silently no-op when Resend is not configured."""
    if not RESEND_API_KEY or not NOTIFY_EMAIL:
        logger.info("Email skipped (RESEND_API_KEY or NOTIFY_EMAIL not set)")
        return False
    try:
        params = {
            "from": SENDER_EMAIL,
            "to": [NOTIFY_EMAIL],
            "subject": subject,
            "html": html,
        }
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email sent: {result.get('id') if isinstance(result, dict) else result}")
        return True
    except Exception as e:
        logger.exception(f"Failed to send notification email: {e}")
        return False


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(title="DannyZCars Marketplace API")
api = APIRouter(prefix="/api")


@app.on_event("startup")
async def on_startup():
    # Indexes
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("id", unique=True)
        await db.listings.create_index("id", unique=True)
        await db.listings.create_index([("category", 1), ("created_at", -1)])
        await db.listings.create_index([("title", "text"), ("description", "text"), ("brand", "text"), ("model", "text")])
        await db.threads.create_index("id", unique=True)
        await db.threads.create_index("updated_at")
    except Exception as e:
        logger.warning(f"Index init: {e}")

    # Seed admin
    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    if not existing:
        seeded_questions = [
            {"question": q["question"], "answer_hash": hash_password(_normalize_answer(q["answer"]))}
            for q in DEFAULT_SECURITY_QUESTIONS if q.get("answer")
        ]
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": ADMIN_EMAIL,
            "password_hash": hash_password(ADMIN_PASSWORD),
            "name": ADMIN_NAME,
            "role": "admin",
            "whatsapp": ADMIN_WHATSAPP,
            "security_questions": seeded_questions,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Admin seeded: {ADMIN_EMAIL}")
    else:
        # Backfill security questions for legacy admin records (only if missing)
        if "security_questions" not in existing or not existing.get("security_questions"):
            seeded_questions = [
                {"question": q["question"], "answer_hash": hash_password(_normalize_answer(q["answer"]))}
                for q in DEFAULT_SECURITY_QUESTIONS if q.get("answer")
            ]
            await db.users.update_one(
                {"email": ADMIN_EMAIL},
                {"$set": {"security_questions": seeded_questions}},
            )
            logger.info("Admin security questions seeded")

    # Initialize storage (best-effort)
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.warning(f"Storage init failed: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


# ---------------------------------------------------------------------------
# Routes — Health
# ---------------------------------------------------------------------------
@api.get("/")
async def root():
    return {"message": "DannyZCars Marketplace API", "status": "ok"}


# ---------------------------------------------------------------------------
# Routes — Auth
# ---------------------------------------------------------------------------
def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key="access_token", value=token, httponly=True,
        secure=True, samesite="none", max_age=60 * 60 * 12, path="/",
    )


@api.post("/auth/login")
async def login(data: LoginInput, response: Response):
    email = data.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    token = create_access_token(user["id"], user["email"])
    set_auth_cookie(response, token)
    return {
        "id": user["id"], "email": user["email"], "name": user.get("name", ""),
        "role": user.get("role", "admin"), "whatsapp": user.get("whatsapp", ""),
        "token": token,
    }


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ---------------------------------------------------------------------------
# Routes — Categories
# ---------------------------------------------------------------------------
CATEGORIES = {
    "refacciones": {
        "name": "Refacciones",
        "subcategories": [
            "Motor", "Suspensión", "Sistema Eléctrico", "Frenos",
            "Transmisión & Embrague", "Escape", "Carrocería & Luces",
            "Enfriamiento", "Dirección", "Filtros & Bandas",
            "Interiores & Accesorios", "Combustible & Admisión",
        ],
    },
    "rines": {"name": "Rines", "subcategories": ["17\"", "18\"", "19\"", "20\"", "22\""]},
    "autos": {"name": "Autos", "subcategories": ["Sedán", "Hatchback", "SUV", "Pickup", "Deportivo"]},
}


@api.get("/categories")
async def get_categories():
    return CATEGORIES


# ---------------------------------------------------------------------------
# Routes — Listings (public read, admin write)
# ---------------------------------------------------------------------------
def listing_doc_to_out(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


@api.get("/listings")
async def list_listings(
    q: Optional[str] = None,
    category: Optional[str] = None,
    subcategory: Optional[str] = None,
    condition: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    limit: int = 60,
    sort: str = "newest",
):
    query: dict = {"is_active": True}
    if category:
        query["category"] = category
    if subcategory:
        query["subcategory"] = subcategory
    if condition:
        query["condition"] = condition
    if min_price is not None or max_price is not None:
        rng = {}
        if min_price is not None:
            rng["$gte"] = min_price
        if max_price is not None:
            rng["$lte"] = max_price
        query["price"] = rng
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"brand": {"$regex": q, "$options": "i"}},
            {"model": {"$regex": q, "$options": "i"}},
        ]

    sort_field = "created_at"
    sort_dir = -1
    if sort == "price_asc":
        sort_field, sort_dir = "price", 1
    elif sort == "price_desc":
        sort_field, sort_dir = "price", -1

    cursor = db.listings.find(query, {"_id": 0}).sort(sort_field, sort_dir).limit(min(limit, 200))
    return [listing_doc_to_out(d) async for d in cursor]


@api.get("/listings/{listing_id}")
async def get_listing(listing_id: str):
    doc = await db.listings.find_one({"id": listing_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")
    return doc


@api.post("/listings")
async def create_listing(data: ListingCreate, admin: dict = Depends(require_admin)):
    if data.category not in CATEGORIES:
        raise HTTPException(status_code=400, detail="Categoría inválida")
    now = datetime.now(timezone.utc).isoformat()
    doc = data.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = now
    doc["updated_at"] = now
    doc["whatsapp"] = doc.get("whatsapp") or admin.get("whatsapp", "")
    await db.listings.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/listings/{listing_id}")
async def update_listing(listing_id: str, data: ListingCreate, admin: dict = Depends(require_admin)):
    update = data.model_dump()
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.listings.update_one({"id": listing_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")
    doc = await db.listings.find_one({"id": listing_id}, {"_id": 0})
    return doc


@api.delete("/listings/{listing_id}")
async def delete_listing(listing_id: str, admin: dict = Depends(require_admin)):
    res = await db.listings.delete_one({"id": listing_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Routes — Upload & Files
# ---------------------------------------------------------------------------
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_SIZE = 5 * 1024 * 1024  # 5MB


@api.post("/upload")
async def upload_image(file: UploadFile = File(...), admin: dict = Depends(require_admin)):
    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="Archivo > 5MB")
    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_MIME:
        raise HTTPException(status_code=400, detail="Solo imágenes (jpg, png, webp, gif)")
    ext = file.filename.split(".")[-1].lower() if file.filename and "." in file.filename else "bin"
    path = f"{APP_NAME}/listings/{admin['id']}/{uuid.uuid4()}.{ext}"
    try:
        result = put_object(path, data, content_type)
    except Exception as e:
        logger.exception("Upload failed")
        raise HTTPException(status_code=500, detail=f"Upload failed: {e}")
    await db.files.insert_one({
        "id": str(uuid.uuid4()),
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": content_type,
        "size": result.get("size", len(data)),
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"path": result["path"]}


@api.get("/files/{path:path}")
async def serve_file(path: str):
    try:
        data, content_type = get_object(path)
    except requests.HTTPError as e:
        raise HTTPException(status_code=404, detail="Archivo no encontrado") from e
    return FastAPIResponse(content=data, media_type=content_type)


# ---------------------------------------------------------------------------
# Routes — Messages (buyer -> admin and admin reply)
# ---------------------------------------------------------------------------
@api.post("/messages")
async def create_message(data: MessageInput):
    """Public endpoint: buyer sends a message about a listing or general inquiry."""
    now = datetime.now(timezone.utc).isoformat()
    thread_id = str(uuid.uuid4())
    listing_title = None
    if data.listing_id:
        listing = await db.listings.find_one({"id": data.listing_id}, {"_id": 0, "title": 1})
        if listing:
            listing_title = listing.get("title")
    thread = {
        "id": thread_id,
        "buyer_name": data.name,
        "buyer_email": data.email,
        "buyer_phone": data.phone or "",
        "listing_id": data.listing_id,
        "listing_title": listing_title,
        "messages": [{
            "id": str(uuid.uuid4()),
            "from": "buyer",
            "text": data.message,
            "at": now,
        }],
        "unread_for_admin": True,
        "created_at": now,
        "updated_at": now,
    }
    await db.threads.insert_one(thread)
    thread.pop("_id", None)

    # Notify admin by email (best-effort, doesn't block on failure)
    try:
        listing_line = f"<p><strong>Publicación:</strong> {listing_title}</p>" if listing_title else ""
        phone_line = f"<p><strong>Teléfono:</strong> {data.phone}</p>" if data.phone else ""
        html_body = f"""
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0b0b0d; color: #fff;">
  <div style="border-bottom: 2px solid #ff3d00; padding-bottom: 12px; margin-bottom: 20px;">
    <h2 style="color: #ff3d00; margin: 0;">Nuevo mensaje en DannyZCars</h2>
  </div>
  <p><strong>De:</strong> {data.name} &lt;{data.email}&gt;</p>
  {phone_line}
  {listing_line}
  <p style="margin-top: 16px;"><strong>Mensaje:</strong></p>
  <div style="background: #18181f; border-left: 3px solid #ff3d00; padding: 12px 16px; border-radius: 4px; white-space: pre-wrap;">{data.message}</div>
  <p style="margin-top: 24px; font-size: 12px; color: #888;">Responde desde el panel admin de DannyZCars.</p>
</div>
""".strip()
        subject_listing = f" — {listing_title}" if listing_title else ""
        await send_notification_email(
            subject=f"DannyZCars · Nuevo mensaje de {data.name}{subject_listing}",
            html=html_body,
        )
    except Exception as e:
        logger.warning(f"Email notify failed (non-blocking): {e}")

    return {"id": thread_id, "ok": True}


@api.get("/admin/threads")
async def list_threads(admin: dict = Depends(require_admin)):
    cursor = db.threads.find({}, {"_id": 0}).sort("updated_at", -1).limit(200)
    return [doc async for doc in cursor]


@api.get("/admin/threads/{thread_id}")
async def get_thread(thread_id: str, admin: dict = Depends(require_admin)):
    doc = await db.threads.find_one({"id": thread_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Hilo no encontrado")
    await db.threads.update_one({"id": thread_id}, {"$set": {"unread_for_admin": False}})
    doc["unread_for_admin"] = False
    return doc


@api.post("/admin/threads/{thread_id}/reply")
async def reply_thread(thread_id: str, data: AdminReplyInput, admin: dict = Depends(require_admin)):
    now = datetime.now(timezone.utc).isoformat()
    msg = {"id": str(uuid.uuid4()), "from": "admin", "text": data.message, "at": now}
    res = await db.threads.update_one(
        {"id": thread_id},
        {"$push": {"messages": msg}, "$set": {"updated_at": now}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Hilo no encontrado")
    return {"ok": True, "message": msg}


@api.delete("/admin/threads/{thread_id}")
async def delete_thread(thread_id: str, admin: dict = Depends(require_admin)):
    await db.threads.delete_one({"id": thread_id})
    return {"ok": True}


@api.get("/admin/stats")
async def admin_stats(admin: dict = Depends(require_admin)):
    total = await db.listings.count_documents({})
    active = await db.listings.count_documents({"is_active": True})
    threads = await db.threads.count_documents({})
    unread = await db.threads.count_documents({"unread_for_admin": True})
    return {"total_listings": total, "active_listings": active, "total_threads": threads, "unread_threads": unread}


# ---------------------------------------------------------------------------
# Routes — Admin profile / password / security questions
# ---------------------------------------------------------------------------
@api.put("/admin/profile")
async def update_profile(data: ProfileUpdate, admin: dict = Depends(require_admin)):
    update = {}
    if data.email is not None:
        new_email = data.email.lower()
        if new_email != admin["email"]:
            exists = await db.users.find_one({"email": new_email, "id": {"$ne": admin["id"]}})
            if exists:
                raise HTTPException(status_code=400, detail="Ese correo ya está en uso")
            update["email"] = new_email
    if data.name is not None:
        update["name"] = data.name.strip()
    if data.whatsapp is not None:
        update["whatsapp"] = data.whatsapp.strip()
    if not update:
        raise HTTPException(status_code=400, detail="No hay cambios")
    await db.users.update_one({"id": admin["id"]}, {"$set": update})
    user = await db.users.find_one({"id": admin["id"]}, {"_id": 0, "password_hash": 0, "security_questions": 0})
    return user


@api.put("/admin/password")
async def change_password(data: PasswordChange, response: Response, admin: dict = Depends(require_admin)):
    full = await db.users.find_one({"id": admin["id"]})
    if not full or not verify_password(data.current_password, full.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Contraseña actual incorrecta")
    await db.users.update_one(
        {"id": admin["id"]},
        {"$set": {"password_hash": hash_password(data.new_password)}},
    )
    # Refresh token so the new session is consistent
    token = create_access_token(admin["id"], admin["email"])
    set_auth_cookie(response, token)
    return {"ok": True, "token": token}


@api.get("/admin/security-questions")
async def get_security_questions(admin: dict = Depends(require_admin)):
    full = await db.users.find_one({"id": admin["id"]}, {"_id": 0, "security_questions": 1})
    items = (full or {}).get("security_questions", []) or []
    # Return only the questions (no hashed answers) — frontend can re-enter
    return [{"question": q.get("question", ""), "has_answer": bool(q.get("answer_hash"))} for q in items]


@api.put("/admin/security-questions")
async def set_security_questions(data: SecurityQuestionsUpdate, admin: dict = Depends(require_admin)):
    if not data.questions or len(data.questions) < 2:
        raise HTTPException(status_code=400, detail="Mínimo 2 preguntas")
    full = await db.users.find_one({"id": admin["id"]}, {"security_questions": 1})
    existing = (full or {}).get("security_questions", []) or []
    new_items = []
    for idx, q in enumerate(data.questions):
        question_text = (q.question or "").strip()
        if not question_text:
            raise HTTPException(status_code=400, detail=f"Pregunta {idx + 1} vacía")
        # If answer provided → hash it. If not provided but existing has one → keep existing hash.
        answer_hash = None
        if q.answer is not None and q.answer.strip():
            answer_hash = hash_password(_normalize_answer(q.answer))
        elif idx < len(existing):
            answer_hash = existing[idx].get("answer_hash")
        if not answer_hash:
            raise HTTPException(status_code=400, detail=f"Falta respuesta para la pregunta {idx + 1}")
        new_items.append({"question": question_text, "answer_hash": answer_hash})
    await db.users.update_one(
        {"id": admin["id"]},
        {"$set": {"security_questions": new_items}},
    )
    return {"ok": True, "count": len(new_items)}


# ---------------------------------------------------------------------------
# Routes — Public password reset via security questions
# ---------------------------------------------------------------------------
@api.post("/auth/forgot-password/questions")
async def get_reset_questions(data: PasswordResetRequest):
    """Public: returns the security questions for a given admin email.
    For privacy, always returns 200 with at least the questions array (empty if not found)."""
    user = await db.users.find_one({"email": data.email.lower()}, {"security_questions": 1})
    questions = (user or {}).get("security_questions", []) or []
    return {"questions": [q.get("question", "") for q in questions]}


@api.post("/auth/forgot-password/verify")
async def reset_password_verify(data: PasswordResetVerify, response: Response):
    user = await db.users.find_one({"email": data.email.lower()})
    if not user:
        raise HTTPException(status_code=400, detail="Datos incorrectos")
    questions = user.get("security_questions") or []
    if not questions or len(questions) != len(data.answers):
        raise HTTPException(status_code=400, detail="Número de respuestas incorrecto")
    for q, ans in zip(questions, data.answers):
        if not verify_password(_normalize_answer(ans), q.get("answer_hash", "")):
            raise HTTPException(status_code=400, detail="Respuestas incorrectas")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"password_hash": hash_password(data.new_password)}},
    )
    token = create_access_token(user["id"], user["email"])
    set_auth_cookie(response, token)
    return {"ok": True, "token": token}


# ---------------------------------------------------------------------------
# Mount router & CORS
# ---------------------------------------------------------------------------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
