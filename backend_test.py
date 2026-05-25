"""
DannyZCars Marketplace - Backend API Tests for NEW endpoints
Tests: Admin profile, password change, security questions, forgot password flow, messages
"""
import requests
import os

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://display-page-3.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

ADMIN_EMAIL = "admin@dannyzcars.com"
ADMIN_PASSWORD = "16dontwanna"

print(f"\n{'='*80}")
print(f"DannyZCars Backend API Tests - NEW Endpoints")
print(f"Base URL: {BASE}")
print(f"API URL: {API}")
print(f"{'='*80}\n")

# Global state
admin_token = None
auth_headers = {}
test_results = []

def log_test(name, passed, details=""):
    status = "✅ PASS" if passed else "❌ FAIL"
    test_results.append({"name": name, "passed": passed, "details": details})
    print(f"{status} | {name}")
    if details and not passed:
        print(f"    Details: {details}")

def login():
    global admin_token, auth_headers
    print("\n--- Login ---")
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    if r.status_code == 200:
        data = r.json()
        admin_token = data.get("token")
        auth_headers = {"Authorization": f"Bearer {admin_token}"}
        log_test("Login with correct credentials", True, f"Token: {admin_token[:20]}...")
        # Check whatsapp field is included
        has_whatsapp = "whatsapp" in data
        log_test("Login response includes whatsapp field", has_whatsapp, f"whatsapp: {data.get('whatsapp', 'MISSING')}")
        return True
    else:
        log_test("Login with correct credentials", False, f"Status: {r.status_code}, Body: {r.text}")
        return False

def test_auth_me():
    print("\n--- Test /api/auth/me ---")
    r = requests.get(f"{API}/auth/me", headers=auth_headers, timeout=15)
    if r.status_code == 200:
        data = r.json()
        has_security_questions = "security_questions" in data
        has_password_hash = "password_hash" in data
        log_test("GET /api/auth/me returns 200", True)
        log_test("GET /api/auth/me does NOT leak security_questions", not has_security_questions, 
                 f"security_questions in response: {has_security_questions}")
        log_test("GET /api/auth/me does NOT leak password_hash", not has_password_hash,
                 f"password_hash in response: {has_password_hash}")
    else:
        log_test("GET /api/auth/me returns 200", False, f"Status: {r.status_code}, Body: {r.text}")

def test_categories():
    print("\n--- Test /api/categories ---")
    r = requests.get(f"{API}/categories", timeout=15)
    if r.status_code == 200:
        data = r.json()
        has_refacciones = "refacciones" in data
        has_rines = "rines" in data
        has_autos = "autos" in data
        log_test("GET /api/categories returns 200", True)
        log_test("Categories include 'refacciones'", has_refacciones)
        log_test("Categories include 'rines'", has_rines)
        log_test("Categories include 'autos'", has_autos)
    else:
        log_test("GET /api/categories returns 200", False, f"Status: {r.status_code}, Body: {r.text}")

def test_admin_profile():
    print("\n--- Test PUT /api/admin/profile ---")
    
    # Test with valid name change
    r = requests.put(f"{API}/admin/profile", json={"name": "Danny Test"}, headers=auth_headers, timeout=15)
    if r.status_code == 200:
        log_test("PUT /api/admin/profile with valid name returns 200", True)
    else:
        log_test("PUT /api/admin/profile with valid name returns 200", False, f"Status: {r.status_code}, Body: {r.text}")
    
    # Test with empty name (should still work)
    r = requests.put(f"{API}/admin/profile", json={"name": ""}, headers=auth_headers, timeout=15)
    if r.status_code == 200:
        log_test("PUT /api/admin/profile with empty name returns 200", True)
    else:
        log_test("PUT /api/admin/profile with empty name returns 200", False, f"Status: {r.status_code}, Body: {r.text}")
    
    # Test with empty body (should return 400)
    r = requests.put(f"{API}/admin/profile", json={}, headers=auth_headers, timeout=15)
    if r.status_code == 400 and "No hay cambios" in r.text:
        log_test("PUT /api/admin/profile with empty body returns 400", True)
    else:
        log_test("PUT /api/admin/profile with empty body returns 400", False, f"Status: {r.status_code}, Body: {r.text}")
    
    # Test without auth (should return 401)
    r = requests.put(f"{API}/admin/profile", json={"name": "Test"}, timeout=15)
    if r.status_code == 401:
        log_test("PUT /api/admin/profile without auth returns 401", True)
    else:
        log_test("PUT /api/admin/profile without auth returns 401", False, f"Status: {r.status_code}, Body: {r.text}")

def test_password_change():
    global admin_token, auth_headers
    print("\n--- Test PUT /api/admin/password ---")
    
    # Test with wrong current password
    r = requests.put(f"{API}/admin/password", 
                     json={"current_password": "wrongpassword", "new_password": "newpass1234"}, 
                     headers=auth_headers, timeout=15)
    if r.status_code == 400 and "Contraseña actual incorrecta" in r.text:
        log_test("PUT /api/admin/password with wrong current_password returns 400", True)
    else:
        log_test("PUT /api/admin/password with wrong current_password returns 400", False, 
                 f"Status: {r.status_code}, Body: {r.text}")
    
    # Test with correct current password and new password
    r = requests.put(f"{API}/admin/password", 
                     json={"current_password": "16dontwanna", "new_password": "newpass1234"}, 
                     headers=auth_headers, timeout=15)
    if r.status_code == 200:
        data = r.json()
        has_token = "token" in data
        log_test("PUT /api/admin/password with correct credentials returns 200", True)
        log_test("Password change returns new token", has_token)
        if has_token:
            admin_token = data["token"]
            auth_headers = {"Authorization": f"Bearer {admin_token}"}
    else:
        log_test("PUT /api/admin/password with correct credentials returns 200", False, 
                 f"Status: {r.status_code}, Body: {r.text}")
        return
    
    # Verify login works with new password
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "newpass1234"}, timeout=30)
    if r.status_code == 200:
        log_test("Login works with new password 'newpass1234'", True)
        admin_token = r.json().get("token")
        auth_headers = {"Authorization": f"Bearer {admin_token}"}
    else:
        log_test("Login works with new password 'newpass1234'", False, f"Status: {r.status_code}, Body: {r.text}")
    
    # Change password back to original
    r = requests.put(f"{API}/admin/password", 
                     json={"current_password": "newpass1234", "new_password": "16dontwanna"}, 
                     headers=auth_headers, timeout=15)
    if r.status_code == 200:
        log_test("Password changed back to '16dontwanna'", True)
        admin_token = r.json().get("token")
        auth_headers = {"Authorization": f"Bearer {admin_token}"}
    else:
        log_test("Password changed back to '16dontwanna'", False, f"Status: {r.status_code}, Body: {r.text}")

def test_security_questions():
    print("\n--- Test GET /api/admin/security-questions ---")
    
    r = requests.get(f"{API}/admin/security-questions", headers=auth_headers, timeout=15)
    if r.status_code == 200:
        data = r.json()
        log_test("GET /api/admin/security-questions returns 200", True)
        
        # Check if it's an array
        is_array = isinstance(data, list)
        log_test("Response is an array", is_array)
        
        if is_array:
            # Check for expected questions
            questions = [q.get("question", "") for q in data]
            has_dog_question = "¿Cuál fue el nombre de tu primer perro?" in questions
            has_birthplace_question = "¿Dónde naciste?" in questions
            log_test("Includes '¿Cuál fue el nombre de tu primer perro?'", has_dog_question)
            log_test("Includes '¿Dónde naciste?'", has_birthplace_question)
            
            # Check has_answer field
            for q in data:
                if "has_answer" not in q:
                    log_test("Each question has 'has_answer' field", False, f"Missing in: {q}")
                    break
            else:
                log_test("Each question has 'has_answer' field", True)
    else:
        log_test("GET /api/admin/security-questions returns 200", False, f"Status: {r.status_code}, Body: {r.text}")
    
    print("\n--- Test PUT /api/admin/security-questions ---")
    
    # Test with only 1 question (should fail)
    r = requests.put(f"{API}/admin/security-questions", 
                     json={"questions": [{"question": "Test?", "answer": "Test"}]}, 
                     headers=auth_headers, timeout=15)
    if r.status_code == 400 and "Mínimo 2 preguntas" in r.text:
        log_test("PUT with 1 question returns 400 'Mínimo 2 preguntas'", True)
    else:
        log_test("PUT with 1 question returns 400 'Mínimo 2 preguntas'", False, 
                 f"Status: {r.status_code}, Body: {r.text}")
    
    # Test with valid 3 questions including new answers
    r = requests.put(f"{API}/admin/security-questions", 
                     json={"questions": [
                         {"question": "¿Cuál fue el nombre de tu primer perro?", "answer": "Boby"},
                         {"question": "¿Dónde naciste?", "answer": "Monterrey"},
                         {"question": "¿Cuál es tu color favorito?", "answer": "Azul"}
                     ]}, 
                     headers=auth_headers, timeout=15)
    if r.status_code == 200:
        log_test("PUT with 3 valid questions returns 200", True)
    else:
        log_test("PUT with 3 valid questions returns 200", False, f"Status: {r.status_code}, Body: {r.text}")
    
    # Test with empty question text (should fail)
    r = requests.put(f"{API}/admin/security-questions", 
                     json={"questions": [
                         {"question": "", "answer": "Test"},
                         {"question": "Valid?", "answer": "Yes"}
                     ]}, 
                     headers=auth_headers, timeout=15)
    if r.status_code == 400:
        log_test("PUT with empty question text returns 400", True)
    else:
        log_test("PUT with empty question text returns 400", False, f"Status: {r.status_code}, Body: {r.text}")
    
    # Restore original security questions
    r = requests.put(f"{API}/admin/security-questions", 
                     json={"questions": [
                         {"question": "¿Cuál fue el nombre de tu primer perro?", "answer": "Boby"},
                         {"question": "¿Dónde naciste?", "answer": "Monterrey"}
                     ]}, 
                     headers=auth_headers, timeout=15)
    if r.status_code == 200:
        log_test("Security questions restored to original", True)
    else:
        log_test("Security questions restored to original", False, f"Status: {r.status_code}, Body: {r.text}")

def test_forgot_password_flow():
    global admin_token, auth_headers
    print("\n--- Test POST /api/auth/forgot-password/questions ---")
    
    # Test with valid admin email
    r = requests.post(f"{API}/auth/forgot-password/questions", 
                      json={"email": "admin@dannyzcars.com"}, timeout=15)
    if r.status_code == 200:
        data = r.json()
        log_test("POST /api/auth/forgot-password/questions with valid email returns 200", True)
        questions = data.get("questions", [])
        is_array = isinstance(questions, list)
        log_test("Response contains 'questions' array", is_array)
        if is_array and len(questions) > 0:
            log_test("Questions array is not empty", True, f"Questions: {questions}")
        else:
            log_test("Questions array is not empty", False, f"Questions: {questions}")
    else:
        log_test("POST /api/auth/forgot-password/questions with valid email returns 200", False, 
                 f"Status: {r.status_code}, Body: {r.text}")
    
    # Test with fake email (should return 200 with empty array for privacy)
    r = requests.post(f"{API}/auth/forgot-password/questions", 
                      json={"email": "fake@nope.com"}, timeout=15)
    if r.status_code == 200:
        data = r.json()
        questions = data.get("questions", [])
        is_empty = len(questions) == 0
        log_test("POST /api/auth/forgot-password/questions with fake email returns 200 with empty array", is_empty,
                 f"Questions: {questions}")
    else:
        log_test("POST /api/auth/forgot-password/questions with fake email returns 200", False, 
                 f"Status: {r.status_code}, Body: {r.text}")
    
    print("\n--- Test POST /api/auth/forgot-password/verify ---")
    
    # Test with wrong answers
    r = requests.post(f"{API}/auth/forgot-password/verify", 
                      json={
                          "email": "admin@dannyzcars.com",
                          "answers": ["WrongDog", "WrongCity"],
                          "new_password": "tempPass123"
                      }, timeout=15)
    if r.status_code == 400 and "Respuestas incorrectas" in r.text:
        log_test("POST /api/auth/forgot-password/verify with wrong answers returns 400", True)
    else:
        log_test("POST /api/auth/forgot-password/verify with wrong answers returns 400", False, 
                 f"Status: {r.status_code}, Body: {r.text}")
    
    # Test with correct answers
    r = requests.post(f"{API}/auth/forgot-password/verify", 
                      json={
                          "email": "admin@dannyzcars.com",
                          "answers": ["Boby", "Monterrey"],
                          "new_password": "tempPass123"
                      }, timeout=15)
    if r.status_code == 200:
        data = r.json()
        has_token = "token" in data
        log_test("POST /api/auth/forgot-password/verify with correct answers returns 200", True)
        log_test("Forgot password verify returns token", has_token)
        if has_token:
            admin_token = data["token"]
            auth_headers = {"Authorization": f"Bearer {admin_token}"}
    else:
        log_test("POST /api/auth/forgot-password/verify with correct answers returns 200", False, 
                 f"Status: {r.status_code}, Body: {r.text}")
        return
    
    # Verify login works with new password
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "tempPass123"}, timeout=30)
    if r.status_code == 200:
        log_test("Login works with new password 'tempPass123'", True)
        admin_token = r.json().get("token")
        auth_headers = {"Authorization": f"Bearer {admin_token}"}
    else:
        log_test("Login works with new password 'tempPass123'", False, f"Status: {r.status_code}, Body: {r.text}")
    
    # Reset password back to original using forgot-password endpoint
    r = requests.post(f"{API}/auth/forgot-password/verify", 
                      json={
                          "email": "admin@dannyzcars.com",
                          "answers": ["Boby", "Monterrey"],
                          "new_password": "16dontwanna"
                      }, timeout=15)
    if r.status_code == 200:
        log_test("Password reset back to '16dontwanna' via forgot-password", True)
        admin_token = r.json().get("token")
        auth_headers = {"Authorization": f"Bearer {admin_token}"}
    else:
        log_test("Password reset back to '16dontwanna' via forgot-password", False, 
                 f"Status: {r.status_code}, Body: {r.text}")

def test_messages_and_email():
    print("\n--- Test POST /api/messages ---")
    
    # Create a message
    r = requests.post(f"{API}/messages", 
                      json={
                          "name": "Test User",
                          "email": "test@example.com",
                          "message": "Hello, I'm interested in your listings!"
                      }, timeout=15)
    if r.status_code == 200:
        data = r.json()
        has_id = "id" in data
        has_ok = data.get("ok") is True
        log_test("POST /api/messages returns 200", True)
        log_test("Response includes 'id' field", has_id)
        log_test("Response includes 'ok: true'", has_ok)
        
        if has_id:
            thread_id = data["id"]
            
            # Verify thread was created
            r2 = requests.get(f"{API}/admin/threads", headers=auth_headers, timeout=15)
            if r2.status_code == 200:
                threads = r2.json()
                thread_exists = any(t.get("id") == thread_id for t in threads)
                log_test("Thread was created in admin threads", thread_exists)
            else:
                log_test("Thread was created in admin threads", False, f"Status: {r2.status_code}")
    else:
        log_test("POST /api/messages returns 200", False, f"Status: {r.status_code}, Body: {r.text}")
    
    # Note: Email sending will be skipped because RESEND_API_KEY is empty
    print("    Note: Email notification skipped (RESEND_API_KEY is empty) - this is expected and non-blocking")

def test_listings_with_rines():
    print("\n--- Test Listings with 'rines' category ---")
    
    # Test GET with rines category
    r = requests.get(f"{API}/listings", params={"category": "rines"}, timeout=15)
    if r.status_code == 200:
        log_test("GET /api/listings?category=rines returns 200", True)
    else:
        log_test("GET /api/listings?category=rines returns 200", False, f"Status: {r.status_code}, Body: {r.text}")
    
    # Test POST with rines category
    r = requests.post(f"{API}/listings", 
                      json={
                          "title": "TEST Rines 20 pulgadas",
                          "description": "Rines deportivos de prueba",
                          "price": 8500.0,
                          "currency": "MXN",
                          "category": "rines",
                          "subcategory": "20\"",
                          "condition": "nuevo",
                          "location": "Guadalajara",
                          "brand": "TestBrand",
                          "images": [],
                          "is_active": True
                      }, 
                      headers=auth_headers, timeout=15)
    if r.status_code == 200:
        data = r.json()
        log_test("POST /api/listings with category='rines' returns 200", True)
        
        # Clean up - delete the test listing
        if "id" in data:
            listing_id = data["id"]
            r2 = requests.delete(f"{API}/listings/{listing_id}", headers=auth_headers, timeout=15)
            if r2.status_code == 200:
                log_test("Test listing cleaned up", True)
    else:
        log_test("POST /api/listings with category='rines' returns 200", False, f"Status: {r.status_code}, Body: {r.text}")

def print_summary():
    print(f"\n{'='*80}")
    print("TEST SUMMARY")
    print(f"{'='*80}")
    
    passed = sum(1 for t in test_results if t["passed"])
    failed = sum(1 for t in test_results if not t["passed"])
    total = len(test_results)
    
    print(f"\nTotal: {total} | Passed: {passed} | Failed: {failed}")
    
    if failed > 0:
        print(f"\n❌ FAILED TESTS ({failed}):")
        for t in test_results:
            if not t["passed"]:
                print(f"  - {t['name']}")
                if t["details"]:
                    print(f"    {t['details']}")
    
    print(f"\n{'='*80}\n")

if __name__ == "__main__":
    try:
        # Run all tests
        if login():
            test_auth_me()
            test_categories()
            test_admin_profile()
            test_password_change()
            test_security_questions()
            test_forgot_password_flow()
            test_messages_and_email()
            test_listings_with_rines()
        
        print_summary()
        
        # Exit with appropriate code
        failed = sum(1 for t in test_results if not t["passed"])
        exit(0 if failed == 0 else 1)
    except Exception as e:
        print(f"\n❌ CRITICAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
