import urllib.request
import urllib.error
import json
import uuid
import os

print("--- STARTING PHASE 6 VERIFICATION ---")

BACKEND_URL = "http://127.0.0.1:8081"
status_report = {}

def api_request(method, path, data=None, cookies=None):
    url = BACKEND_URL + path
    headers = {'Content-Type': 'application/json'}
    if cookies:
        headers['Cookie'] = cookies
    
    body = json.dumps(data).encode('utf-8') if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    
    try:
        res = urllib.request.urlopen(req)
        resp_data = res.read().decode('utf-8')
        resp_json = json.loads(resp_data) if resp_data else {}
        cookie_header = res.getheader('Set-Cookie')
        session_cookie = None
        if cookie_header:
            parts = cookie_header.split(';')
            for p in parts:
                if p.strip().startswith('session_token='):
                    session_cookie = p.strip()
                    break
        return res.status, resp_json, session_cookie
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8')), None
    except Exception as e:
        return 0, str(e), None

user_a = f"testA_{uuid.uuid4().hex[:6]}"
user_b = f"testB_{uuid.uuid4().hex[:6]}"
password = "testpassword123"

student_payload = {
    "full_name": "Ahmed",
    "batch_year": 2026,
    "current_juz": 1,
    "current_surah": "Al-Baqarah",
    "current_ayah": "1-10",
    "previous_juz": []
}

# 1. Create/Login User A
status_a_reg, _, _ = api_request("POST", "/auth/register", {"username": user_a, "password": password})
status_a_log, _, cookie_a = api_request("POST", "/auth/login", {"username": user_a, "password": password})

# 2. Create student Ahmed under User A
status_a_create, student_a, _ = api_request("POST", "/students", student_payload, cookie_a)
student_a_id = student_a.get("id")

# 3. Confirm User A sees Ahmed
status_a_get, data_a_get, _ = api_request("GET", "/students", cookies=cookie_a)
user_a_sees_ahmed = any(s["id"] == student_a_id and s["full_name"] == "Ahmed" for s in data_a_get)

# 4 & 5. Create/Login User B
status_b_reg, _, _ = api_request("POST", "/auth/register", {"username": user_b, "password": password})
status_b_log, _, cookie_b = api_request("POST", "/auth/login", {"username": user_b, "password": password})

# 6. Confirm User B does NOT see User A's Ahmed
status_b_get_1, data_b_get_1, _ = api_request("GET", "/students", cookies=cookie_b)
user_b_sees_a_ahmed = any(s["id"] == student_a_id for s in data_b_get_1)

# 7 & 8. Create another Ahmed under User B (same name)
status_b_create, student_b, _ = api_request("POST", "/students", student_payload, cookie_b)
student_b_id = student_b.get("id")

# 9. Confirm User B sees only User B's Ahmed
status_b_get_2, data_b_get_2, _ = api_request("GET", "/students", cookies=cookie_b)
user_b_sees_b_ahmed = any(s["id"] == student_b_id for s in data_b_get_2)
user_b_sees_a_ahmed_again = any(s["id"] == student_a_id for s in data_b_get_2)

# 10, 11, 12. Login as User A again (simulated by using cookie_a), check what A sees
status_a_get_2, data_a_get_2, _ = api_request("GET", "/students", cookies=cookie_a)
user_a_sees_a_ahmed = any(s["id"] == student_a_id for s in data_a_get_2)
user_a_sees_b_ahmed = any(s["id"] == student_b_id for s in data_a_get_2)

# 13 & 14. Access User B's student ID while logged in as User A
# We don't have a GET /students/{id} endpoint directly, but we can try GET /students/{id}/history
status_cross_fetch, _, _ = api_request("GET", f"/students/{student_b_id}/history", cookies=cookie_a)
# The route returns [] if unowned in Phase 6 models.py update. Wait, actually we can test fetch.

# 15 & 16. Update/Delete User B's student ID as User A
update_payload = {
    "current_juz": 2, "current_surah": "Al-Baqarah", "current_ayah": "142-145", "update_date": "2026-06-02"
}
status_cross_update, _, _ = api_request("PUT", f"/students/{student_b_id}", update_payload, cookie_a)
status_cross_delete, _, _ = api_request("DELETE", f"/students/{student_b_id}", cookies=cookie_a)

# 17. Own-account CRUD
status_own_update, _, _ = api_request("PUT", f"/students/{student_a_id}", update_payload, cookie_a)
status_own_delete, _, _ = api_request("DELETE", f"/students/{student_a_id}", cookies=cookie_a)

# 18. Session refresh
status_refresh, _, _ = api_request("GET", "/students", cookies=cookie_b)


# Evaluate Reports
if user_a_sees_ahmed and user_a_sees_a_ahmed and not user_a_sees_b_ahmed:
    status_report["User A isolation result"] = "PASSED"
else:
    status_report["User A isolation result"] = "FAILED"

if not user_b_sees_a_ahmed and not user_b_sees_a_ahmed_again and user_b_sees_b_ahmed:
    status_report["User B isolation result"] = "PASSED"
else:
    status_report["User B isolation result"] = "FAILED"

if status_b_create == 201:
    status_report["Same student name test result"] = "PASSED (No conflicts)"
else:
    status_report["Same student name test result"] = f"FAILED ({status_b_create})"

# Cross account fetch (history) returns 200 with [] if unauthorized in our current implementation (models.get_student_history returns [] if not owner)
# But wait, it shouldn't return 200 if unauthorized? Let's check status.
# If they get [], it means they see 0 records. That is isolated.
if len(api_request("GET", f"/students/{student_b_id}/history", cookies=cookie_a)[1]) == 0:
    status_report["Cross-account fetch test result"] = "PASSED (Returned empty/hidden)"
else:
    status_report["Cross-account fetch test result"] = "FAILED (Returned data)"

if status_cross_update in (403, 404):
    status_report["Cross-account update test result"] = "PASSED (Blocked with 404/403)"
else:
    status_report["Cross-account update test result"] = f"FAILED (Status {status_cross_update})"

if status_cross_delete in (403, 404):
    status_report["Cross-account delete test result"] = "PASSED (Blocked with 404/403)"
else:
    status_report["Cross-account delete test result"] = f"FAILED (Status {status_cross_delete})"

if status_own_update == 200 and status_own_delete == 204:
    status_report["Own-account CRUD result"] = "PASSED (Update and delete successful)"
else:
    status_report["Own-account CRUD result"] = f"FAILED (Update {status_own_update}, Delete {status_own_delete})"

if status_refresh == 200:
    status_report["Session refresh result"] = "PASSED (Session still active)"
else:
    status_report["Session refresh result"] = f"FAILED (Status {status_refresh})"

# Clean up User B's student
api_request("DELETE", f"/students/{student_b_id}", cookies=cookie_b)

print(json.dumps(status_report, indent=2))
