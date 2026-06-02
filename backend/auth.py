"""
auth.py — HIFZ TRACKER 2.0
Authentication helpers: password hashing and user account CRUD.

PHASE 2 — PASSWORD HASHING + REGISTER BACKEND

Rules enforced here:
  - NEVER store or log plain-text passwords.
  - Every password gets its own unique salt (generated with `secrets`).
  - Hashing is done with Python built-in `hashlib` (SHA-256).
  - No external authentication libraries (no bcrypt, passlib, JWT, OAuth).

Responsibilities:
  - hash_password()     — generate salt + hash for a new password.
  - verify_password()   — re-hash a candidate password and compare.
  - create_user()       — insert a new user row into the `users` table.
  - get_user_by_username() — look up a user row by username.

This module MUST NOT contain FastAPI routing logic.
This module MUST NOT contain Pydantic schemas.
All SQL uses parameterized statements — no f-string SQL ever.
"""

import hashlib
import secrets
from datetime import datetime, timezone
from typing import Any

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
