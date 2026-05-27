import urllib.request
import json
import urllib.error

def request(url, method="GET", payload=None):
    req = urllib.request.Request(url, method=method)
    if payload:
        data = json.dumps(payload).encode("utf-8")
        req.add_header("Content-Type", "application/json")
        req.add_header("Content-Length", len(data))
    else:
        data = None
    try:
        with urllib.request.urlopen(req, data=data) as response:
            return response.status, json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

# 1. Create Student
print("Creating student...")
status, resp = request("http://127.0.0.1:8081/students", method="POST", payload={
    "full_name": "Test Student 1",
    "batch_year": 2025,
    "current_juz": 8,
    "current_surah": "Al-An'am",
    "current_ayah": "1-1",
    "previous_juz": [1, 7]
})
print("Create Student Status:", status)
print("Create Student Response:", resp)
student_id = resp.get("id")

if not student_id:
    exit(1)

# 2. Submit Daily Progress
print("\nSubmitting Daily Progress...")
payload = {
    "date": "2026-05-27",
    "comment": "Good test progress",
    "records": [
        {
            "type": "SABAQ",
            "juz": 8,
            "surah": "Al-An'am",
            "start_ayah": 1,
            "end_ayah": 5,
            "not_recited": False
        },
        {
            "type": "SABAQ PARA",
            "juz": 8,
            "surah": "Al-Ma'idah",
            "start_ayah": 10,
            "end_ayah": 20,
            "not_recited": False
        },
        {
            "type": "PARA",
            "juz": 1,
            "surah": "Al-Baqarah",
            "start_ayah": 1,
            "end_ayah": 141,
            "not_recited": False
        }
    ]
}

status, resp = request(f"http://127.0.0.1:8081/students/{student_id}/daily-progress", method="POST", payload=payload)
print("Submit Progress Status:", status)
if status != 200:
    print("Submit Error:", resp)

# 3. Get Daily Progress History
print("\nGetting Daily Progress History...")
status, resp = request(f"http://127.0.0.1:8081/students/{student_id}/daily-progress")
print("Progress History Records:", len(resp))
for r in resp:
    print(f"  - {r['type']}: Juz {r['juz']} | {r['surah']} {r['start_ayah']}-{r['end_ayah']} | {r['comment']}")
