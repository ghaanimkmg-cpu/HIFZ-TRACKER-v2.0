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
"""

import re
from typing import Any

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
    last_updated: str
    created_at: str

    model_config = {"from_attributes": True}

class ErrorResponse(BaseModel):
    """Standard error envelope returned on failures."""

    error: str
