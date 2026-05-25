"""
DannyZCars Marketplace - Backend API Tests
Covers: Auth, Listings CRUD + filters, Categories, Messages, Admin Threads,
Upload + File serving, Admin Stats, 401/403 guard checks.
"""
import io
import os
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://display-page-3.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

ADMIN_EMAIL = "admin@dannyzcars.com"
ADMIN_PASSWORD = "DannyZ2026!"


# --------------------------- Fixtures ---------------------------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and data.get("role") == "admin"
    # Verify httpOnly cookie is set
    set_cookie = r.headers.get("set-cookie", "")
    assert "access_token=" in set_cookie and "HttpOnly" in set_cookie, f"Cookie missing httpOnly: {set_cookie}"
    return data["token"]


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# --------------------------- Health ---------------------------
class TestHealth:
    def test_root(self):
        r = requests.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"


# --------------------------- Auth ---------------------------
class TestAuth:
    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_me_no_auth(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_me_with_token(self, auth_headers):
        r = requests.get(f"{API}/auth/me", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["email"] == ADMIN_EMAIL
        assert body["role"] == "admin"
        assert "password_hash" not in body  # security

    def test_logout(self, auth_headers):
        r = requests.post(f"{API}/auth/logout", headers=auth_headers, timeout=15)
        assert r.status_code == 200


# --------------------------- Categories ---------------------------
class TestCategories:
    def test_categories(self):
        r = requests.get(f"{API}/categories", timeout=15)
        assert r.status_code == 200
        data = r.json()
        for slug in ["refacciones", "rines", "autos"]:
            assert slug in data
            assert isinstance(data[slug]["subcategories"], list)
            assert len(data[slug]["subcategories"]) > 0


# --------------------------- Listings (read + filters) ---------------------------
class TestListingsRead:
    def test_list_all(self):
        r = requests.get(f"{API}/listings", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_filter_by_category(self):
        for cat in ["refacciones", "rines", "autos"]:
            r = requests.get(f"{API}/listings", params={"category": cat}, timeout=15)
            assert r.status_code == 200
            for item in r.json():
                assert item["category"] == cat

    def test_sort_price_asc(self):
        r = requests.get(f"{API}/listings", params={"sort": "price_asc"}, timeout=15)
        assert r.status_code == 200
        prices = [item["price"] for item in r.json()]
        assert prices == sorted(prices)

    def test_sort_price_desc(self):
        r = requests.get(f"{API}/listings", params={"sort": "price_desc"}, timeout=15)
        assert r.status_code == 200
        prices = [item["price"] for item in r.json()]
        assert prices == sorted(prices, reverse=True)

    def test_price_range(self):
        r = requests.get(f"{API}/listings", params={"min_price": 1000, "max_price": 100000}, timeout=15)
        assert r.status_code == 200
        for item in r.json():
            assert 1000 <= item["price"] <= 100000

    def test_q_search(self):
        r = requests.get(f"{API}/listings", params={"q": "BMW"}, timeout=15)
        assert r.status_code == 200

    def test_condition_filter(self):
        r = requests.get(f"{API}/listings", params={"condition": "usado"}, timeout=15)
        assert r.status_code == 200
        for item in r.json():
            assert item["condition"] == "usado"

    def test_get_missing(self):
        r = requests.get(f"{API}/listings/nonexistent-id-12345", timeout=15)
        assert r.status_code == 404


# --------------------------- Listings (CRUD) ---------------------------
class TestListingsCRUD:
    payload = {
        "title": "TEST_Listing Pytest",
        "description": "Auto generated test listing",
        "price": 12345.67,
        "currency": "MXN",
        "category": "refacciones",
        "subcategory": "Motor",
        "condition": "nuevo",
        "location": "CDMX",
        "brand": "TestBrand",
        "model": "TestModel",
        "year": 2024,
        "images": [],
        "whatsapp": "+525551112233",
        "is_active": True,
    }

    def test_create_no_auth(self):
        r = requests.post(f"{API}/listings", json=self.payload, timeout=15)
        assert r.status_code == 401

    def test_create_update_delete(self, auth_headers):
        # Create
        r = requests.post(f"{API}/listings", json=self.payload, headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["title"] == self.payload["title"]
        assert "id" in created
        lid = created["id"]

        # GET by id
        r = requests.get(f"{API}/listings/{lid}", timeout=15)
        assert r.status_code == 200
        assert r.json()["title"] == self.payload["title"]

        # Update
        upd = {**self.payload, "title": "TEST_Listing Updated", "price": 9999.0}
        r = requests.put(f"{API}/listings/{lid}", json=upd, headers=auth_headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["title"] == "TEST_Listing Updated"

        # Verify persisted
        r = requests.get(f"{API}/listings/{lid}", timeout=15)
        assert r.json()["price"] == 9999.0

        # Delete
        r = requests.delete(f"{API}/listings/{lid}", headers=auth_headers, timeout=15)
        assert r.status_code == 200

        # Verify gone
        r = requests.get(f"{API}/listings/{lid}", timeout=15)
        assert r.status_code == 404

    def test_delete_missing(self, auth_headers):
        r = requests.delete(f"{API}/listings/does-not-exist-zzz", headers=auth_headers, timeout=15)
        assert r.status_code == 404


# --------------------------- Messages / Threads ---------------------------
class TestMessages:
    def test_public_create_message(self):
        # Get an existing listing id first
        listings = requests.get(f"{API}/listings", timeout=15).json()
        lid = listings[0]["id"] if listings else None
        payload = {
            "listing_id": lid,
            "name": "TEST_Buyer",
            "email": "test_buyer@example.com",
            "phone": "5551234567",
            "message": "Hola, ¿está disponible?",
        }
        r = requests.post(f"{API}/messages", json=payload, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "id" in body and body.get("ok") is True
        # save for cleanup via class attr
        TestMessages.thread_id = body["id"]

    def test_admin_threads_no_auth(self):
        r = requests.get(f"{API}/admin/threads", timeout=15)
        assert r.status_code == 401

    def test_admin_list_threads(self, auth_headers):
        r = requests.get(f"{API}/admin/threads", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        threads = r.json()
        assert isinstance(threads, list)
        assert any(t["id"] == TestMessages.thread_id for t in threads)

    def test_admin_get_thread_marks_read(self, auth_headers):
        tid = TestMessages.thread_id
        r = requests.get(f"{API}/admin/threads/{tid}", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["unread_for_admin"] is False

    def test_admin_reply(self, auth_headers):
        tid = TestMessages.thread_id
        r = requests.post(
            f"{API}/admin/threads/{tid}/reply",
            json={"message": "Sí, disponible"},
            headers=auth_headers, timeout=15,
        )
        assert r.status_code == 200
        # Verify message appended
        r2 = requests.get(f"{API}/admin/threads/{tid}", headers=auth_headers, timeout=15)
        msgs = r2.json()["messages"]
        assert any(m["from"] == "admin" and m["text"] == "Sí, disponible" for m in msgs)

    def test_admin_delete_thread(self, auth_headers):
        tid = TestMessages.thread_id
        r = requests.delete(f"{API}/admin/threads/{tid}", headers=auth_headers, timeout=15)
        assert r.status_code == 200


# --------------------------- Upload + Files ---------------------------
class TestUpload:
    def test_upload_no_auth(self):
        files = {"file": ("test.png", b"fake", "image/png")}
        r = requests.post(f"{API}/upload", files=files, timeout=30)
        assert r.status_code == 401

    def test_upload_reject_non_image(self, auth_headers):
        files = {"file": ("test.txt", b"hello", "text/plain")}
        r = requests.post(f"{API}/upload", files=files, headers=auth_headers, timeout=30)
        assert r.status_code == 400

    def test_upload_reject_oversize(self, auth_headers):
        # 6 MB blob
        big = b"\x00" * (6 * 1024 * 1024)
        files = {"file": ("big.png", big, "image/png")}
        r = requests.post(f"{API}/upload", files=files, headers=auth_headers, timeout=60)
        assert r.status_code == 400

    def test_upload_and_serve(self, auth_headers):
        # 1x1 png
        png = (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
            b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\xff\xff?"
            b"\x00\x05\xfe\x02\xfe\xdc\xccY\xe7\x00\x00\x00\x00IEND\xaeB`\x82"
        )
        files = {"file": ("pixel.png", png, "image/png")}
        r = requests.post(f"{API}/upload", files=files, headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text
        path = r.json()["path"]
        # Serve back
        r2 = requests.get(f"{API}/files/{path}", timeout=30)
        assert r2.status_code == 200
        assert r2.headers.get("content-type", "").startswith("image/")


# --------------------------- Admin Stats ---------------------------
class TestStats:
    def test_stats_no_auth(self):
        r = requests.get(f"{API}/admin/stats", timeout=15)
        assert r.status_code == 401

    def test_stats(self, auth_headers):
        r = requests.get(f"{API}/admin/stats", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        body = r.json()
        for k in ["total_listings", "active_listings", "total_threads", "unread_threads"]:
            assert k in body
            assert isinstance(body[k], int)
