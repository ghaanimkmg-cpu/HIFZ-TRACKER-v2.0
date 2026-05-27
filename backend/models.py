"""
models.py — HIFZ TRACKER 2.0
Raw SQLite query helpers (CRUD layer).

This module contains the actual SQL operations.
It MUST only be imported by main.py (or route modules in later phases).
It MUST NEVER contain Pydantic logic (that lives in schemas.py).
It MUST NEVER contain FastAPI logic.

All queries use parameterized statements — no f-string SQL allowed.
"""

from datetime import datetime, timezone
from typing import Any

from database import get_connection

def get_all_students() -> list[dict[str, Any]]:
    """
    Return every student row as a list of plain dicts.
    Ordered by batch_year ASC, then full_name ASC.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM students ORDER BY batch_year ASC, full_name ASC"
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_student_by_id(student_id: int) -> dict[str, Any] | None:
    """Return a single student dict or None if not found."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM students WHERE id = ?",
        (student_id,)
    )
    row = cursor.fetchone()
    conn.close()
    if row is None:
        return None
    return dict(row)

def create_student(
    full_name: str,
    batch_year: int,
    current_juz: int,
    current_surah: str,
    current_ayah: str,
    previous_juz: str = "",
) -> dict[str, Any]:
    """
    Insert a new student row and return the complete record.
    Timestamps are stored as ISO-8601 UTC strings.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO students
            (full_name, batch_year, current_juz, current_surah, current_ayah,
             previous_juz, last_updated, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (full_name, batch_year, current_juz, current_surah, current_ayah,
         previous_juz, now_iso, now_iso),
    )
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    if new_id is None:
        raise RuntimeError("Database insert failed.")
    student = get_student_by_id(new_id)
    if student is None:
        raise RuntimeError("Failed to fetch newly created student.")
    return student

def update_student_progress(
    student_id: int,
    current_juz: int,
    current_surah: str,
    current_ayah: str,
    update_date: str,
) -> dict[str, Any] | None:
    """
    Update Juz / Surah / Ayah for a student and log to progress_history.
    Returns the updated student dict, or None if the id does not exist.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        UPDATE students
           SET current_juz   = ?,
               current_surah = ?,
               current_ayah  = ?,
               last_updated  = ?
         WHERE id = ?
        """,
        (current_juz, current_surah, current_ayah, now_iso, student_id),
    )
    affected = cursor.rowcount
    if affected > 0:
        cursor.execute(
            """
            INSERT INTO progress_history
                (student_id, juz, surah, ayah, update_date, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (student_id, current_juz, current_surah, current_ayah, update_date, now_iso),
        )
    conn.commit()
    conn.close()
    if affected == 0:
        return None
    return get_student_by_id(student_id)

def get_student_history(student_id: int) -> list[dict[str, Any]]:
    """Fetch all history records for a specific student."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM progress_history WHERE student_id = ? ORDER BY created_at DESC",
        (student_id,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def delete_student(student_id: int) -> bool:
    """
    Delete a student by id.
    Returns True if a row was deleted, False if no such id existed.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "DELETE FROM students WHERE id = ?",
        (student_id,)
    )
    conn.commit()
    affected = cursor.rowcount
    conn.close()
    return affected > 0

def get_memorized_juz(student_id: int) -> list[int]:
    """
    Return a list of all unique Juz numbers the student has ever interacted with,
    including their current_juz and any juz found in progress_history and daily_progress_records.
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT current_juz, previous_juz FROM students WHERE id = ?", (student_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return []
    
    juz_set = {row["current_juz"]}
    if row["previous_juz"]:
        for j in row["previous_juz"].split(","):
            try:
                juz_set.add(int(j.strip()))
            except ValueError:
                pass
    
    cursor.execute("SELECT DISTINCT juz FROM progress_history WHERE student_id = ?", (student_id,))
    for r in cursor.fetchall():
        if r["juz"] is not None:
            juz_set.add(r["juz"])
            
    cursor.execute("SELECT DISTINCT juz FROM daily_progress_records WHERE student_id = ? AND juz IS NOT NULL", (student_id,))
    for r in cursor.fetchall():
        juz_set.add(r["juz"])
        
    conn.close()
    return sorted(list(juz_set))

def create_daily_progress(student_id: int, date: str, records: list[dict], comment: str | None = None) -> None:
    now_iso = datetime.now(timezone.utc).isoformat()
    conn = get_connection()
    cursor = conn.cursor()
    
    for rec in records:
        cursor.execute(
            """
            INSERT INTO daily_progress_records
                (student_id, date, type, juz, surah, start_ayah, end_ayah, comment, not_recited, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                student_id,
                date,
                rec["type"],
                rec.get("juz"),
                rec.get("surah"),
                rec.get("start_ayah"),
                rec.get("end_ayah"),
                comment,
                1 if rec.get("not_recited") else 0,
                now_iso
            )
        )
    conn.commit()
    conn.close()

def get_student_daily_progress(student_id: int) -> list[dict]:
    """Fetch all daily progress records for a student."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM daily_progress_records 
        WHERE student_id = ? 
        ORDER BY date DESC, id DESC
    """, (student_id,))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [{"not_recited": bool(row["not_recited"]), **dict(row)} for row in rows]
