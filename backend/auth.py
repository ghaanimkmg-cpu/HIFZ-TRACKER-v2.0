"""
auth.py — HIFZ TRACKER 2.0
Authentication helpers: password hashing, user account CRUD, session management.

PHASE 2 — PASSWORD HASHING + REGISTER BACKEND
PHASE 3 — LOGIN BACKEND + SESSION TOKENS (2026-06-02)
PHASE 4 — PROTECT TRACKER ROUTES (2026-06-02)

Rules enforced here:
  - NEVER store or log plain-text passwords.
  - Every password gets its own unique salt (generated with `secrets`).
  - Hashing is done with Python built-in `hashlib` (SHA-256).
  - Session tokens are generated with `secrets.token_hex()` — never `random`.
  - No external authentication libraries (no bcrypt, passlib, JWT, OAuth).

Responsibilities:
  - hash_password()        — generate salt + hash for a new password.
  - verify_password()      — re-hash a candidate password and compare safely.
  - create_user()          — insert a new user row into the `users` table.
  - get_user_by_username() — look up a user row by username.
  - create_session()       — generate a secure token and store user_id in memory.
  - get_session_user_id()  — resolve a token back to a user_id (or None).
  - delete_session()       — remove a token from memory on logout.
  - require_auth()         — read cookie, validate session, return user_id or raise 401.

Session store design (per spec):
    sessions: dict[str, int] = {
        "token_hex_string": user_id,
        ...
    }
  - Stored in this module's global namespace (server memory only).
  - Sessions do NOT survive a server restart — this is intentional.
  - No database table is used for sessions.

This module MUST NOT contain FastAPI routing logic.
This module MUST NOT contain Pydantic schemas.
All SQL uses parameterized statements — no f-string SQL ever.
"""

import hashlib
import secrets
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, Request, status

from database import get_connection


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

def hash_password(plain_password: str) -> tuple[str, str]:
    """
    Hash a plain-text password with a freshly generated salt.

    Flow:
        plain password
            ↓
        generate 32-byte random salt using secrets.token_hex()
            ↓
        combine: salt + plain_password  (salt prepended)
            ↓
        hash the combined string with SHA-256 via hashlib
            ↓
        return (salt, hex_digest)

    Returns:
        (salt, hashed_password) — both are plain hex strings safe to store
        in the database. The plain password is never returned or stored.

    Why salt?
        A salt is a random string added to the password before hashing.
        Two users with the same password will produce different hashes
        because their salts differ. This defeats precomputed "rainbow table"
        attacks where an attacker looks up a hash in a dictionary of
        pre-hashed common passwords.

    Why hashlib?
        It is a Python built-in module — no third-party packages required.
        SHA-256 produces a 64-character hex string that is one-way: you
        cannot reverse a hash back to the original password.

    Why secrets.token_hex()?
        `secrets` is the Python built-in cryptographic random number module.
        It is safe for security-sensitive tokens and salts.
        `random` must NOT be used here — it is not cryptographically secure.
    """
    # Generate a 32-byte (64 hex chars) cryptographically random salt
    salt: str = secrets.token_hex(32)

    # Combine salt + plain password, then encode to bytes for hashlib
    salted: str = salt + plain_password
    hashed: str = hashlib.sha256(salted.encode("utf-8")).hexdigest()

    # plain_password is discarded here — only salt and hashed are returned
    return salt, hashed


def verify_password(plain_password: str, stored_salt: str, stored_hash: str) -> bool:
    """
    Re-hash the candidate password with the stored salt and compare.

    Flow:
        user enters password
            ↓
        retrieve stored salt and stored hash from database
            ↓
        combine: stored_salt + entered_password
            ↓
        hash with SHA-256 (same algorithm as hash_password)
            ↓
        compare result with stored_hash using secrets.compare_digest()
            ↓
        True if match, False otherwise

    Why secrets.compare_digest()?
        Regular == comparison can leak timing information (it short-circuits
        on the first mismatch). secrets.compare_digest() always takes the
        same time regardless of where the strings differ, preventing
        timing-based attacks.
    """
    salted: str = stored_salt + plain_password
    candidate_hash: str = hashlib.sha256(salted.encode("utf-8")).hexdigest()
    return secrets.compare_digest(candidate_hash, stored_hash)


# ---------------------------------------------------------------------------
# User CRUD — follows same pattern as models.py
# ---------------------------------------------------------------------------

def create_user(username: str, plain_password: str) -> dict[str, Any]:
    """
    Insert a new coordinator account into the `users` table.

    Steps:
        1. Generate salt and hash using hash_password().
        2. Insert (username, salt, hashed_password, created_at) into users.
        3. Return the newly created user record (WITHOUT salt or hash —
           callers must never see hashed credentials in API responses).

    Raises:
        ValueError — if the username already exists (UNIQUE constraint).
        RuntimeError — if the insert fails for any other reason.

    The plain password is passed in but immediately discarded after hashing.
    It is NEVER written to the database, logged, or returned.
    """
    salt, hashed_password = hash_password(plain_password)
    now_iso = datetime.now(timezone.utc).isoformat()

    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO users (username, salt, hashed_password, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (username.strip(), salt, hashed_password, now_iso),
        )
        conn.commit()
        new_id = cursor.lastrowid
    except Exception as exc:
        conn.close()
        # SQLite raises an IntegrityError when the UNIQUE constraint on
        # `username` is violated. We convert it to a clear ValueError so
        # the calling route can return a proper 409 response.
        if "UNIQUE constraint failed" in str(exc):
            raise ValueError(f"Username '{username}' is already taken.") from exc
        raise RuntimeError(f"Failed to create user: {exc}") from exc

    conn.close()

    if new_id is None:
        raise RuntimeError("Database insert returned no row id.")

    # Fetch and return the new row (without exposing salt/hash to callers)
    user = get_user_by_username(username.strip())
    if user is None:
        raise RuntimeError("Failed to fetch newly created user.")
    return user


def get_user_by_username(username: str) -> dict[str, Any] | None:
    """
    Look up a user row by username.

    Returns the full row as a dict (including salt and hashed_password) so
    that verify_password() can be called by the login route in Phase 3.

    Returns None if the username does not exist.

    IMPORTANT: This function returns the salt and hashed_password columns.
    The calling route in main.py must NEVER forward those fields to the
    client. They are internal authentication data only.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM users WHERE username = ?",
        (username.strip(),),
    )
    row = cursor.fetchone()
    conn.close()
    if row is None:
        return None
    return dict(row)


# ---------------------------------------------------------------------------
# PHASE 3 — In-memory session store
# ---------------------------------------------------------------------------
#
# sessions maps a session token (hex string) to the integer user_id of the
# logged-in coordinator.
#
# Example after two users log in:
#   sessions = {
#       "a3f9bc...": 1,   # token for user id 1
#       "d72e01...": 2,   # token for user id 2
#   }
#
# Why module-level?
#   Python module state is process-global. The FastAPI server process loads
#   this module once and keeps it in memory. All requests share the same
#   `sessions` dict for the lifetime of the server process.
#
# Why not a database table?
#   The spec explicitly requires in-memory sessions. This means:
#     - Sessions are fast to read/write (no disk I/O).
#     - Sessions are automatically cleared when the server restarts.
#     - This is intentional and acceptable for this task.
#
# Session token format:
#   64 hex characters produced by secrets.token_hex(32).
#   Cryptographically random — cannot be guessed or predicted.

sessions: dict[str, int] = {}


def create_session(user_id: int) -> str:
    """
    Generate a secure session token and store it in the in-memory sessions dict.

    Flow:
        successful login
            |
        secrets.token_hex(32)  — generates 64 random hex chars
            |
        sessions[token] = user_id  — store in memory
            |
        return token  — caller will set this as an HTTP-only cookie

    Why secrets.token_hex() and NOT random?
        Python's `random` module uses a predictable pseudo-random algorithm.
        An attacker who knows a few tokens can potentially predict the next
        one. `secrets` uses the OS cryptographic random source (e.g.,
        /dev/urandom on Linux, CryptGenRandom on Windows), which is
        impossible to predict. Session tokens MUST be unpredictable.

    Returns:
        The session token string (64 hex characters).
        The caller is responsible for sending it as an HTTP-only cookie.
    """
    token: str = secrets.token_hex(32)
    sessions[token] = user_id
    return token


def get_session_user_id(token: str) -> int | None:
    """
    Resolve a session token to the user_id it belongs to.

    Called by every protected route (Phase 4) to verify the request
    carries a valid session cookie.

    Returns:
        int  — the user_id if the token exists in the sessions dict.
        None — if the token is missing, expired (server restart), or invalid.

    Why sessions.get() and not sessions[token]?
        sessions[token] would raise a KeyError for invalid tokens.
        sessions.get(token) returns None safely — the calling route then
        returns 401 Unauthorized without crashing.
    """
    return sessions.get(token)


def delete_session(token: str) -> None:
    """
    Remove a session token from memory (used by the logout endpoint in Phase 7).

    After this call, any future request with the same token will receive
    None from get_session_user_id() and be treated as unauthenticated.

    Safe to call even if the token does not exist (pop with default None).
    """
    sessions.pop(token, None)


# ---------------------------------------------------------------------------
# PHASE 4 — Session validation guard (used by all protected routes)
# ---------------------------------------------------------------------------

def require_auth(request: Request) -> int:
    """
    Read and validate the session cookie from an incoming FastAPI Request.

    How it works:
        1. Read the 'session_token' value from request.cookies.
           The browser automatically includes this cookie on every request
           after a successful login (because it was set with httponly=True).
        2. If the cookie is absent (empty string or not present at all),
           raise 401 Unauthorized immediately — no session, no access.
        3. Call get_session_user_id(token) to look up the token in the
           in-memory sessions dict.
           - If found: return the associated user_id to the calling route.
           - If not found (server restarted, token tampered, expired):
             raise 401 Unauthorized.

    Why a helper instead of repeating this logic in every route?
        Single responsibility: the session check lives in one place.
        If the logic ever changes (e.g. adding expiry times in a future
        phase), only this function needs to be updated.

    Design note for Phase 6:
        This function returns user_id so that every protected route
        automatically knows WHO is making the request. Phase 6 will use
        that user_id to filter students by ownership. The return value
        is already wired in — Phase 6 just needs to use it.

    Args:
        request: The FastAPI Request object passed into each route handler.

    Returns:
        int — the user_id of the authenticated coordinator.

    Raises:
        HTTPException(401) — if no valid session cookie is present.
    """
    token: str = request.cookies.get("session_token", "")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
        )
    user_id = get_session_user_id(token)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid. Please log in again.",
        )
    return user_id


# ---------------------------------------------------------------------------
# POST-FINAL ENHANCEMENT: FORGOT PASSWORD HELPERS
# ---------------------------------------------------------------------------

def create_password_reset_token(username: str) -> str | None:
    """
    Generate a secure, single-use token for a given username.
    Returns the raw token (to be sent via email/SMS, or displayed in prototype).
    Returns None if the user does not exist.
    Token expires in 15 minutes.
    """
    user = get_user_by_username(username)
    if not user:
        return None
        
    token: str = secrets.token_hex(32)
    
    # 15 minute expiry
    expires_at = datetime.now(timezone.utc).timestamp() + (15 * 60)
    
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO password_reset_tokens (user_id, token, expires_at, used, created_at)
        VALUES (?, ?, ?, 0, ?)
        """,
        (user["id"], token, expires_at, datetime.now(timezone.utc).isoformat())
    )
    conn.commit()
    conn.close()
    
    return token

def reset_user_password(token: str, new_password: str) -> bool:
    """
    Validates the token, ensures it's unused and not expired,
    and resets the user's password using a new salt.
    Returns True if successful, raises HTTPException if invalid.
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute(
        "SELECT id, user_id, expires_at, used FROM password_reset_tokens WHERE token = ?",
        (token,)
    )
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")
        
    if row["used"] == 1:
        conn.close()
        raise HTTPException(status_code=400, detail="Reset token has already been used.")
        
    if float(row["expires_at"]) < datetime.now(timezone.utc).timestamp():
        conn.close()
        raise HTTPException(status_code=400, detail="Reset token has expired.")
        
    user_id = row["user_id"]
    token_id = row["id"]
    
    # Generate new salt and hash for the new password
    salt, hashed = hash_password(new_password)
    
    # Update password and invalidate token
    cursor.execute(
        "UPDATE users SET salt = ?, hashed_password = ? WHERE id = ?",
        (salt, hashed, user_id)
    )
    cursor.execute(
        "UPDATE password_reset_tokens SET used = 1 WHERE id = ?",
        (token_id,)
    )
    conn.commit()
    conn.close()
    
    return True
