"""
schemas.py — HIFZ TRACKER 2.0
Pydantic v2 request / response models.

Responsibilities:
  - Validate all incoming API request bodies.
  - Define the shape of API responses.

Rules:
  - No database logic here.
  - No FastAPI routing logic here.
  - All validation errors surface as 422 Unprocessable Entity automatically.

PHASE 2 AUTH EXTENSION (2026-06-02):
  - Added RegisterRequest  — validates POST /auth/register body.
  - Added RegisterResponse — safe response shape (never exposes hash/salt).
"""

import re
from datetime import date
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator

def _validate_ayah_range(v: Any) -> str:
    """Ensure ayah is a strict range like '2-7'. Single numbers not allowed."""
    if not isinstance(v, str):
        v = str(v)
    v = v.strip()
    if not re.match(r"^\d+-\d+$", v):
        raise ValueError("Ayah must be a range (e.g. '2-7'). Single numbers are not allowed.")

    parts = v.split("-")
    start = int(parts[0])
    end = int(parts[1])
    if start > end:
        raise ValueError("Invalid range: start ayah cannot be greater than end ayah.")
    if start < 1:
        raise ValueError("Ayah must be >= 1.")
    return v

class StudentCreate(BaseModel):
    """Schema for POST /students request body."""

    full_name: str = Field(
        ...,
        min_length=1,
        max_length=120,
        description="Student's full name — cannot be empty.",
    )
    batch_year: int = Field(
        ...,
        ge=2000,
        le=2100,
        description="Academic batch year (e.g. 2025, 2026).",
    )
    current_juz: int = Field(
        ...,
        ge=1,
        le=30,
        description="Current Juz number, 1–30.",
    )
    current_surah: str = Field(
        ...,
        min_length=1,
        max_length=80,
        description="Current Surah name — cannot be empty.",
    )
    current_ayah: str = Field(
        ...,
        description="Ayah range (e.g. '2-7').",
    )
    previous_juz: list[int] = Field(
        default_factory=list,
        description="List of previously memorized juz numbers.",
    )

    @field_validator("full_name", mode="before")
    @classmethod
    def name_must_not_be_whitespace(cls, v: Any) -> str:
        s = str(v)
        if not s.strip():
            raise ValueError("full_name cannot be blank or whitespace only.")
        return s.strip()

    @field_validator("current_surah", mode="before")
    @classmethod
    def surah_must_not_be_whitespace(cls, v: Any) -> str:
        s = str(v)
        if not s.strip():
            raise ValueError("current_surah cannot be blank or whitespace only.")
        return s.strip()

    @field_validator("current_ayah", mode="before")
    @classmethod
    def ayah_must_be_valid_range(cls, v: Any) -> str:
        return _validate_ayah_range(v)

class StudentUpdate(BaseModel):
    """Schema for PUT /students/{id} request body."""

    current_juz: int = Field(
        ...,
        ge=1,
        le=30,
        description="Updated Juz number, 1–30.",
    )
    current_surah: str = Field(
        ...,
        min_length=1,
        max_length=80,
        description="Updated Surah name.",
    )
    current_ayah: str = Field(
        ...,
        description="Ayah range (e.g. '2-7').",
    )
    update_date: str = Field(
        ...,
        description="Date of this progress update (e.g., YYYY-MM-DD)",
    )

    @field_validator("current_surah", mode="before")
    @classmethod
    def surah_must_not_be_whitespace(cls, v: Any) -> str:
        s = str(v)
        if not s.strip():
            raise ValueError("current_surah cannot be blank or whitespace only.")
        return s.strip()

    @field_validator("current_ayah", mode="before")
    @classmethod
    def ayah_must_be_valid_range(cls, v: Any) -> str:
        return _validate_ayah_range(v)

class HistoryResponse(BaseModel):
    """Shape of a progress history record."""
    id: int
    student_id: int
    juz: int
    surah: str
    ayah: str
    update_date: str
    created_at: str

    model_config = {"from_attributes": True}

class StudentResponse(BaseModel):
    """Shape of a student object returned by the API."""

    id: int
    full_name: str
    batch_year: int
    current_juz: int
    current_surah: str
    current_ayah: str
    previous_juz: str | None = None
    last_updated: str
    created_at: str

    model_config = {"from_attributes": True}

class ErrorResponse(BaseModel):
    """Standard error envelope returned on failures."""

    error: str

class DailyRecordItem(BaseModel):
    """A single progress update record in a daily submission."""
    type: str = Field(..., description="SABAQ, SABAQ PARA, or PARA")
    juz: int | None = None
    surah: str | None = None
    start_ayah: int | None = None
    end_ayah: int | None = None
    not_recited: bool = False

class DailyProgressCreate(BaseModel):
    """Payload for submitting a daily progress update."""
    date: str = Field(..., description="ISO Date string")
    records: list[DailyRecordItem] = Field(..., min_length=1)
    comment: str | None = None

class DailyProgressRecordResponse(BaseModel):
    """A single daily progress record returned by the API."""
    id: int
    date: str
    type: str
    juz: int | None
    surah: str | None
    start_ayah: int | None
    end_ayah: int | None
    comment: str | None
    not_recited: bool
    created_at: str

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# PHASE 2 AUTH — Register schemas
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    """
    Schema for POST /auth/register request body.

    Validates that:
      - username is 3–40 characters, stripped of whitespace
      - username contains only alphanumeric chars, underscores, hyphens
      - password is at least 6 characters (basic security floor)
      - password is not blank or whitespace-only

    The plain password is accepted here for transport validation only.
    It is immediately handed to auth.hash_password() and discarded —
    it is NEVER stored, logged, or returned to the client.
    """

    username: str = Field(
        ...,
        min_length=3,
        max_length=40,
        description="Coordinator username — 3 to 40 characters.",
    )
    password: str = Field(
        ...,
        min_length=6,
        description="Account password — minimum 6 characters.",
    )

    @field_validator("username", mode="before")
    @classmethod
    def username_must_be_clean(cls, v: Any) -> str:
        s = str(v).strip()
        if not s:
            raise ValueError("Username cannot be blank.")
        import re as _re
        if not _re.match(r"^[A-Za-z0-9_\-\.@]+$", s):
            raise ValueError(
                "Username may only contain letters, numbers, underscores, hyphens, @, and dots."
            )
        return s

    @field_validator("password", mode="before")
    @classmethod
    def password_must_not_be_blank(cls, v: Any) -> str:
        s = str(v)
        if not s.strip():
            raise ValueError("Password cannot be blank or whitespace only.")
        return s


class RegisterResponse(BaseModel):
    """
    Safe response returned after successful registration.

    IMPORTANT: This schema intentionally EXCLUDES salt and hashed_password.
    Those fields exist in the database row but must NEVER be sent to clients.
    Only non-sensitive metadata is returned.
    """

    id: int
    username: str
    created_at: str

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# PHASE 3 AUTH — Login schemas
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    """
    Schema for POST /auth/login request body.

    Accepts username and password for verification.
    The password is used only to re-hash and compare against the stored hash.
    It is NEVER stored, logged, echoed, or returned.
    """

    username: str = Field(
        ...,
        min_length=1,
        max_length=40,
        description="Coordinator username.",
    )
    password: str = Field(
        ...,
        min_length=1,
        description="Account password.",
    )

    @field_validator("username", mode="before")
    @classmethod
    def username_must_not_be_blank(cls, v: Any) -> str:
        s = str(v).strip()
        if not s:
            raise ValueError("Username cannot be blank.")
        return s

    @field_validator("password", mode="before")
    @classmethod
    def password_must_not_be_blank(cls, v: Any) -> str:
        s = str(v)
        if not s.strip():
            raise ValueError("Password cannot be blank.")
        return s


class LoginResponse(BaseModel):
    """
    Safe response returned after a successful login.

    IMPORTANT: The session token is NOT in this response body.
    It is sent exclusively as an HTTP-only cookie by the login route.
    This schema returns only the non-sensitive user identity fields so the
    frontend knows which account is now active.

    Fields intentionally excluded: salt, hashed_password, session token.
    """

    id: int
    username: str

    model_config = {"from_attributes": True}


# -----------------------------------------------------------------------------
# POST-FINAL ENHANCEMENT: FORGOT PASSWORD SCHEMAS
# -----------------------------------------------------------------------------

class ForgotPasswordRequest(BaseModel):
    username: str = Field(..., description="Username to request password reset for")

class ForgotPasswordResponse(BaseModel):
    message: str = Field(..., description="Status message")
    reset_token: Optional[str] = Field(None, description="The reset token (only included for prototype testing)")

class ResetPasswordRequest(BaseModel):
    token: str = Field(..., description="The single-use reset token")
    new_password: str = Field(..., description="The new password")

class ResetPasswordResponse(BaseModel):
    message: str = Field(..., description="Status message")
