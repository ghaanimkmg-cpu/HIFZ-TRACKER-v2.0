"""
main.py — HIFZ TRACKER 2.0
FastAPI application entry point.

Responsibilities:
  - Initialize the FastAPI app.
  - Register the lifespan context (database init on startup).
  - Mount CORS so the frontend (served from file:// or a separate port) can
    reach the API.
  - Declare all API routes (delegating logic to models.py / schemas.py).

STRICTLY FORBIDDEN in this file:
  - Any HTML rendering.
  - Any SQLite connection code (use database.py / models.py).
  - Hardcoded student data.

PHASE 2 AUTH EXTENSION (2026-06-02):
  - Added import of create_user from auth.py.
  - Added import of RegisterRequest, RegisterResponse from schemas.py.
  - Added POST /auth/register route.

PHASE 3 AUTH EXTENSION (2026-06-02):
  - Added Response import from fastapi (needed to set cookies).
  - Added import of create_session, get_session_user_id, delete_session from auth.py.
  - Added import of LoginRequest, LoginResponse from schemas.py.
  - Added POST /auth/login route.

PHASE 4 AUTH EXTENSION (2026-06-02):
  - Added import of require_auth from auth.py.
  - Added request: Request param + require_auth(request) call to all 7 tracker routes.
  - Public routes unchanged: GET /, POST /auth/register, POST /auth/login.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, Request, Response, status, Depends
from fastapi.middleware.cors import CORSMiddleware

from database import initialize_database
from models import (
    create_student,
    delete_student,
    get_all_students,
    update_student_progress,
    get_student_history,
    get_student_by_id,
    get_memorized_juz,
    create_daily_progress,
    get_student_daily_progress,
)
from schemas import (
    StudentCreate,
    StudentResponse,
    StudentUpdate,
    HistoryResponse,
    DailyProgressCreate,
    DailyProgressRecordResponse,
    RegisterRequest,
    RegisterResponse,
    LoginRequest,
    LoginResponse,
)
from auth import (
    create_user,
    create_session,
    get_session_user_id,
    delete_session,
    verify_password,
    get_user_by_username,
    require_auth,
)
from constants import SURAH_AYAHS, JUZ_SURAHS, SURAH_ORDER

@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Create the database/tables before the server accepts requests."""
    initialize_database()
    yield
    # Shutdown hook (nothing needed for SQLite, but kept for future use)

app = FastAPI(
    title="HIFZ TRACKER 2.0",
    description=(
        "Internal coordinator API for managing Hifz student progress. "
        "Built for ZaryahPlus."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tightened in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/", tags=["Health"])
def health_check() -> dict[str, str]:
    """Confirm the server is running."""
    return {"status": "ok", "app": "HIFZ TRACKER 2.0", "version": "2.0.0"}

@app.get("/students", response_model=list[StudentResponse], tags=["Students"])
def list_students(user_id: int = Depends(require_auth)) -> list[dict[str, Any]]:
    """
    GET /students
    Return all students ordered by batch_year ASC, full_name ASC.
    Used by the frontend to populate batch-year columns.
    PROTECTED: valid session cookie required (Phase 4).
    Phase 6 will filter by user_id to return only the logged-in user's students.
    """
    return get_all_students()

@app.post(
    "/students",
    response_model=StudentResponse,
    status_code=201,
    tags=["Students"],
)
def add_student(payload: StudentCreate, user_id: int = Depends(require_auth)) -> dict[str, Any]:
    """
    POST /students
    Create a new student.
    Pydantic validates the body; models.py writes to SQLite.
    Returns the newly created student record.
    PROTECTED: valid session cookie required (Phase 4).
    Phase 6 will attach user_id automatically when inserting.
    """
    student = create_student(
        full_name=payload.full_name,
        batch_year=payload.batch_year,
        current_juz=payload.current_juz,
        current_surah=payload.current_surah,
        current_ayah=payload.current_ayah,
        previous_juz=",".join(map(str, payload.previous_juz))
    )
    return student

@app.put(
    "/students/{student_id}",
    response_model=StudentResponse,
    tags=["Students"],
)
def update_student(student_id: int, payload: StudentUpdate, user_id: int = Depends(require_auth)) -> dict[str, Any]:
    """
    PUT /students/{student_id}
    Update Juz / Surah / Ayah for an existing student.
    Returns the updated student record.
    Raises 404 if the student id is not found.
    PROTECTED: valid session cookie required (Phase 4).
    Phase 6 will verify the student belongs to the logged-in user.
    """
    updated = update_student_progress(
        student_id=student_id,
        current_juz=payload.current_juz,
        current_surah=payload.current_surah,
        current_ayah=payload.current_ayah,
        update_date=payload.update_date,
    )
    if updated is None:
        raise HTTPException(
            status_code=404,
            detail=f"Student with id {student_id} not found.",
        )
    return updated

@app.get(
    "/students/{student_id}/history",
    response_model=list[HistoryResponse],
    tags=["Students"],
)
def get_history(student_id: int, user_id: int = Depends(require_auth)) -> list[dict[str, Any]]:
    """
    GET /students/{student_id}/history
    Return the update history for a specific student.
    PROTECTED: valid session cookie required (Phase 4).
    """
    return get_student_history(student_id)

@app.delete(
    "/students/{student_id}",
    status_code=204,
    tags=["Students"],
)
def remove_student(student_id: int, user_id: int = Depends(require_auth)) -> None:
    """
    DELETE /students/{student_id}
    Permanently delete a student from the database.
    Returns 204 No Content on success.
    Raises 404 if the student id is not found.
    PROTECTED: valid session cookie required (Phase 4).
    Phase 6 will verify the student belongs to the logged-in user.
    """
    deleted = delete_student(student_id)
    if not deleted:
        raise HTTPException(
            status_code=404,
            detail=f"Student with id {student_id} not found.",
        )
    # 204 — no response body

@app.get(
    "/students/{student_id}/daily-progress",
    response_model=list[DailyProgressRecordResponse],
    tags=["Students"],
)
def get_daily_progress(student_id: int, user_id: int = Depends(require_auth)) -> list[dict[str, Any]]:
    """
    GET /students/{student_id}/daily-progress
    Return all comprehensive daily progress records for a student.
    PROTECTED: valid session cookie required (Phase 4).
    """
    student = get_student_by_id(student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return get_student_daily_progress(student_id)

@app.post(
    "/students/{student_id}/daily-progress",
    status_code=201,
    tags=["Daily Progress"],
)
def add_daily_progress(student_id: int, payload: DailyProgressCreate, user_id: int = Depends(require_auth)) -> dict[str, Any]:
    """
    POST /students/{student_id}/daily-progress
    Submit a daily progress update (SABAQ, SABAQ PARA, PARA).
    PROTECTED: valid session cookie required (Phase 4).
    """
    student = get_student_by_id(student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
        
    memorized_juz = get_memorized_juz(student_id)
    
    # Parse the student's current_ayah bounds
    try:
        parts = student["current_ayah"].split("-")
        student_current_ayah_upper = int(parts[1])
    except:
        student_current_ayah_upper = 286

    for rec in payload.records:
        if rec.not_recited:
            continue
            
        if not rec.juz or not rec.surah or not rec.start_ayah or not rec.end_ayah:
            raise HTTPException(status_code=422, detail="Missing fields for recited record.")
            
        if rec.surah not in SURAH_AYAHS:
            raise HTTPException(status_code=422, detail=f"Invalid surah {rec.surah}.")
            
        max_ayahs = SURAH_AYAHS[rec.surah]
        if rec.start_ayah < 1 or rec.end_ayah > max_ayahs or rec.start_ayah > rec.end_ayah:
            raise HTTPException(status_code=422, detail=f"Invalid ayah bounds for {rec.surah}. Max is {max_ayahs}.")

        if rec.type == "SABAQ":
            pass # SABAQ logic is just bounds validation
            
        elif rec.type == "SABAQ PARA":
            if rec.juz != student["current_juz"]:
                raise HTTPException(status_code=422, detail="SABAQ PARA juz must match current juz.")
            
            target_order = SURAH_ORDER.get(rec.surah, 999)
            current_order = SURAH_ORDER.get(student["current_surah"], 999)
            
            if target_order > current_order:
                raise HTTPException(status_code=422, detail=f"Cannot revise future surah {rec.surah}.")
            elif target_order == current_order:
                if rec.end_ayah > student_current_ayah_upper:
                    raise HTTPException(status_code=422, detail=f"Cannot exceed memorized ayah {student_current_ayah_upper}.")
                
        elif rec.type == "PARA":
            if rec.juz not in memorized_juz:
                raise HTTPException(status_code=422, detail=f"Juz {rec.juz} not in memorized history.")
                
        else:
            raise HTTPException(status_code=422, detail=f"Unknown record type {rec.type}")

    # Convert Pydantic models to dicts and save
    dicts = [r.model_dump() for r in payload.records]
    create_daily_progress(student_id, payload.date, dicts, payload.comment)
    
    return {"status": "ok", "message": "Records saved successfully."}


# =============================================================================
# PHASE 2 AUTH — Register endpoint
# =============================================================================

@app.post(
    "/auth/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Auth"],
)
def register(payload: RegisterRequest) -> dict:
    """
    POST /auth/register
    Create a new coordinator account.

    Flow:
        1. Pydantic validates username and password via RegisterRequest.
        2. auth.create_user() generates a salt, hashes the password with
           hashlib SHA-256, and inserts the row into the `users` table.
        3. Returns RegisterResponse — id, username, created_at only.
           The salt and hashed_password are NEVER returned to the client.

    Errors:
        409 Conflict  — username already exists.
        422 Unprocessable Entity — validation failure (blank fields, etc.).
    """
    try:
        user = create_user(
            username=payload.username,
            plain_password=payload.password,
        )
    except ValueError as exc:
        # Username already taken — 409 Conflict is the correct HTTP status.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    # Return only the safe, non-sensitive fields.
    # Pydantic's RegisterResponse model enforces this — it has no salt/hash fields.
    return {
        "id": user["id"],
        "username": user["username"],
        "created_at": user["created_at"],
    }


# =============================================================================
# PHASE 3 AUTH — Login endpoint
# =============================================================================

@app.post(
    "/auth/login",
    response_model=LoginResponse,
    status_code=status.HTTP_200_OK,
    tags=["Auth"],
)
def login(payload: LoginRequest, response: Response) -> dict:
    """
    POST /auth/login
    Verify coordinator credentials and issue a session cookie.

    Flow:
        1. Pydantic validates the request body via LoginRequest.
        2. Look up the user row by username (get_user_by_username).
           If not found -> 401 Unauthorized.
        3. Re-hash the submitted password with the stored salt using
           verify_password() which calls secrets.compare_digest() internally.
           If hashes do not match -> 401 Unauthorized.
        4. Generate a 64-char hex session token with secrets.token_hex(32)
           via create_session() and store it in the in-memory sessions dict:
               sessions[token] = user_id
        5. Send the token to the browser as an HTTP-only cookie named
           'session_token'. The browser will automatically attach this
           cookie to every future request to this API.
        6. Return LoginResponse (id + username only).

    Cookie flags:
        httponly=True  — JavaScript cannot read the cookie value.
                         This prevents session theft via XSS attacks.
        samesite='lax' — The cookie is sent on same-site requests and
                         top-level navigations, balancing security and usability.

    Security notes:
        - Salt and hashed_password are fetched from the DB internally but
          are NEVER returned in the API response.
        - The session token is in the cookie only — not in the response body.
        - A generic 'Invalid credentials' message is used for both wrong
          username and wrong password to prevent username enumeration.

    Errors:
        401 Unauthorized — username not found OR password incorrect.
        422 Unprocessable Entity — blank username or password.
    """
    # Step 1 — look up the user (full row including salt + hash for verification)
    user = get_user_by_username(payload.username)
    if user is None:
        # Username does not exist.
        # Deliberately use the same error message as wrong-password so that
        # an attacker cannot tell which usernames are registered.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
        )

    # Step 2 — verify password using the stored salt + hash
    password_ok = verify_password(
        plain_password=payload.password,
        stored_salt=user["salt"],
        stored_hash=user["hashed_password"],
    )
    if not password_ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
        )

    # Step 3 — create a session token and store it in memory
    token = create_session(user_id=user["id"])

    # Step 4 — send the token as an HTTP-only cookie
    # httponly=True means JavaScript (and XSS scripts) cannot read this value.
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        samesite="lax",
        # secure=True would enforce HTTPS — left False for local development
    )

    # Step 5 — return only safe, non-sensitive identity information
    return {
        "id": user["id"],
        "username": user["username"],
    }
