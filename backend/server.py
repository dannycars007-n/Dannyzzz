from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import bcrypt
import jwt
import requests
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
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
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
    category: Literal["refacciones", "autos"]
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
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": ADMIN_EMAIL,
            "password_hash": hash_password(ADMIN_PASSWORD),
            "name": ADMIN_NAME,
            "role": "admin",
            "whatsapp": ADMIN_WHATSAPP,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Admin seeded: {ADMIN_EMAIL}")
    else:
        if not verify_password(ADMIN_PASSWORD, existing.get("password_hash", "")):
            await db.users.update_one(
                {"email": ADMIN_EMAIL},
                {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}}
            )
            logger.info("Admin password updated")

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
        "role": user.get("role", "admin"), "token": token,
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
