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
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from database import initialize_database
from models import (
    create_student,
    delete_student,
    get_all_students,
    update_student_progress,
    get_student_history,
)
from schemas import StudentCreate, StudentResponse, StudentUpdate, HistoryResponse

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
def list_students() -> list[dict[str, Any]]:
    """
    GET /students
    Return all students ordered by batch_year ASC, full_name ASC.
    Used by the frontend to populate batch-year columns.
    """
    return get_all_students()

@app.post(
    "/students",
    response_model=StudentResponse,
    status_code=201,
    tags=["Students"],
)
def add_student(payload: StudentCreate) -> dict[str, Any]:
    """
    POST /students
    Create a new student.
    Pydantic validates the body; models.py writes to SQLite.
    Returns the newly created student record.
    """
    student = create_student(
        full_name=payload.full_name,
        batch_year=payload.batch_year,
        current_juz=payload.current_juz,
        current_surah=payload.current_surah,
        current_ayah=payload.current_ayah,
    )
    return student

@app.put(
    "/students/{student_id}",
    response_model=StudentResponse,
    tags=["Students"],
)
def update_student(student_id: int, payload: StudentUpdate) -> dict[str, Any]:
    """
    PUT /students/{student_id}
    Update Juz / Surah / Ayah for an existing student.
    Returns the updated student record.
    Raises 404 if the student id is not found.
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
def get_history(student_id: int) -> list[dict[str, Any]]:
    """
    GET /students/{student_id}/history
    Return the update history for a specific student.
    """
    return get_student_history(student_id)

@app.delete(
    "/students/{student_id}",
    status_code=204,
    tags=["Students"],
)
def remove_student(student_id: int) -> None:
    """
    DELETE /students/{student_id}
    Permanently delete a student from the database.
    Returns 204 No Content on success.
    Raises 404 if the student id is not found.
    """
    deleted = delete_student(student_id)
    if not deleted:
        raise HTTPException(
            status_code=404,
            detail=f"Student with id {student_id} not found.",
        )
    # 204 — no response body
