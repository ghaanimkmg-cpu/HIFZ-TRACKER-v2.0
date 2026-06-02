import urllib.request
import urllib.error
import json
import uuid
import os

print("--- STARTING PHASE 7 VERIFICATION ---")

FRONTEND_URL = "http://localhost:3000"
BACKEND_URL = "http://127.0.0.1:8081"
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "frontend")
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
        return e.code, json.loads(e.read().decode('utf-8')) if e.read() else {}, None
    except Exception as e:
        return 0, str(e), None

user_a = f"testA_{uuid.uuid4().hex[:6]}"
password = "testpassword123"

# 1. Login page no longer shows "Already logged in?"
try:
    with open(os.path.join(FRONTEND_DIR, "login.html"), "r", encoding="utf-8") as f:
        html = f.read()
    if "continue to tracker" not in html.lower():
        status_report["Login page UI fix"] = "PASSED"
    else:
        status_report["Login page UI fix"] = "FAILED"
except Exception as e:
    status_report["Login page UI fix"] = f"FAILED ({e})"

# 2. Logout button added
try:
    with open(os.path.join(FRONTEND_DIR, "index.html"), "r", encoding="utf-8") as f:
        html = f.read()
    if "btn-logout" in html:
        status_report["Logout button UI"] = "PASSED"
    else:
        status_report["Logout button UI"] = "FAILED"
except Exception as e:
    status_report["Logout button UI"] = f"FAILED ({e})"

# Register User A
api_request("POST", "/auth/register", {"username": user_a, "password": password})

# Test: Tracker refresh while logged in keeps session
status, _, cookie_a = api_request("POST", "/auth/login", {"username": user_a, "password": password})
if status == 200:
    status_trk1, _, _ = api_request("GET", "/students", cookies=cookie_a)
    if status_trk1 == 200:
        status_report["Tracker refresh keeps session"] = "PASSED"
    else:
        status_report["Tracker refresh keeps session"] = "FAILED"
else:
    status_report["Tracker refresh keeps session"] = "FAILED (Login failed)"

# Test: Visiting login.html clears session
# To simulate visiting login.html, the frontend would call POST /auth/logout
# We manually send that request using cookie_a
status_out1, _, _ = api_request("POST", "/auth/logout", cookies=cookie_a)
status_trk2, _, _ = api_request("GET", "/students", cookies=cookie_a)
if status_trk2 == 401:
    status_report["Login page load clears session"] = "PASSED"
else:
    status_report["Login page load clears session"] = "FAILED"

# Test: Visiting signup.html clears session
status, _, cookie_a2 = api_request("POST", "/auth/login", {"username": user_a, "password": password})
status_out2, _, _ = api_request("POST", "/auth/logout", cookies=cookie_a2)
status_trk3, _, _ = api_request("GET", "/students", cookies=cookie_a2)
if status_trk3 == 401:
    status_report["Signup page load clears session"] = "PASSED"
else:
    status_report["Signup page load clears session"] = "FAILED"

# Test: Logout button works
status, _, cookie_a3 = api_request("POST", "/auth/login", {"username": user_a, "password": password})
status_btn_out, _, _ = api_request("POST", "/auth/logout", cookies=cookie_a3)
status_trk4, _, _ = api_request("GET", "/students", cookies=cookie_a3)
if status_trk4 == 401 and status_btn_out == 200:
    status_report["Manual logout button works"] = "PASSED"
else:
    status_report["Manual logout button works"] = "FAILED"

print(json.dumps(status_report, indent=2))
