import urllib.request
import urllib.error
import urllib.parse
import json
import time
from http.cookiejar import CookieJar

BASE_URL = "http://127.0.0.1:8081"

def print_result(name, condition, status=None, data=None):
    print(f"[{'PASS' if condition else 'FAIL'}] {name}")
    if not condition:
        print(f"       -> Status: {status}, Data: {data}")

def request(method, path, data=None, cj=None):
    url = f"{BASE_URL}{path}"
    headers = {'Content-Type': 'application/json'}
    req_data = json.dumps(data).encode('utf-8') if data else None
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj)) if cj else urllib.request.build_opener()
    
    try:
        with opener.open(req) as response:
            body = response.read().decode('utf-8')
            return response.status, json.loads(body) if body else None
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        return e.code, json.loads(body) if body else None
    except Exception as e:
        return 500, None

def run_tests():
    print("--- Starting Regression Tests ---")
    
    # 1. Signup
    username = f"test_user_{int(time.time())}"
    password = "old_password"
    status, data = request("POST", "/auth/register", {"username": username, "password": password})
    print_result("Signup still works", status == 200, status, data)
    
    # 2. Login
    cj = CookieJar()
    status, data = request("POST", "/auth/login", {"username": username, "password": password}, cj)
    print_result("Login still works", status == 200, status, data)
    
    # 3. Private tracker works
    status, data = request("GET", "/students/", cj=cj)
    print_result("Private tracker isolation still works", status == 200, status, data)
    
    # 4. Logout works
    status, data = request("POST", "/auth/logout", cj=cj)
    print_result("Logout still works", status == 200, status, data)
    
    # 5. Protected route returns 401 without login
    status, data = request("GET", "/students/")
    print_result("Protected routes still return 401 without login", status == 401, status, data)
    
    # 6. Forgot password request works
    status, data = request("POST", "/auth/forgot-password", {"username": username})
    print_result("Forgot password request works", status == 200 and data and "reset_token" in data, status, data)
    token = data.get("reset_token") if data else None
    
    # 7. Invalid token fails
    status, data = request("POST", "/auth/reset-password", {"token": "invalid_token", "new_password": "new_password"})
    print_result("Invalid token fails", status == 400, status, data)
    
    # 8. Reset token works
    new_password = "new_password123"
    status, data = request("POST", "/auth/reset-password", {"token": token, "new_password": new_password})
    print_result("Reset token works", status == 200, status, data)
    
    # 9. Used token cannot be reused
    status, data = request("POST", "/auth/reset-password", {"token": token, "new_password": "another_password"})
    print_result("Used token cannot be reused", status == 400, status, data)
    
    # 10. Old password no longer works
    status, data = request("POST", "/auth/login", {"username": username, "password": password})
    print_result("Old password no longer works", status == 401, status, data)
    
    # 11. New password works
    cj2 = CookieJar()
    status, data = request("POST", "/auth/login", {"username": username, "password": new_password}, cj2)
    print_result("New password works", status == 200, status, data)

if __name__ == "__main__":
    run_tests()
