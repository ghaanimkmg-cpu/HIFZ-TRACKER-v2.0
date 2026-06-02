"""
database.py — HIFZ TRACKER 2.0
SQLite connection and table initialization.

This module is the ONLY place that touches the database connection.
It is imported by main.py and models.py — never by the frontend.

PHASE 1 AUTH EXTENSION (2026-06-02):
  - Added `users` table for coordinator account storage.
  - Added `user_id` column to `students` table (safe migration — never drops
    existing data; existing rows receive NULL for user_id).
"""

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "hifz_tracker.db")

def get_connection() -> sqlite3.Connection:
    """
    Return a new SQLite connection with row_factory set to sqlite3.Row
    so that rows behave like dictionaries (column-name access).
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def initialize_database() -> None:
    """
    Create all required tables if they do not already exist, and apply
    any safe column migrations needed for the current version.
    Called once at application startup from main.py lifespan.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS students (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name    TEXT    NOT NULL,
            batch_year   INTEGER NOT NULL,
            current_juz  INTEGER NOT NULL CHECK(current_juz BETWEEN 1 AND 30),
            current_surah TEXT   NOT NULL,
            current_ayah TEXT    NOT NULL,
            previous_juz TEXT    DEFAULT '',
            last_updated TEXT    NOT NULL,
            created_at   TEXT    NOT NULL
        )
        """
    )
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS progress_history (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id   INTEGER NOT NULL,
            juz          INTEGER NOT NULL,
            surah        TEXT    NOT NULL,
            ayah         TEXT    NOT NULL,
            update_date  TEXT    NOT NULL,
            created_at   TEXT    NOT NULL,
            FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
        )
        """
    )
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS daily_progress_records (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id   INTEGER NOT NULL,
            date         TEXT    NOT NULL,
            type         TEXT    NOT NULL,
            juz          INTEGER,
            surah        TEXT,
            start_ayah   INTEGER,
            end_ayah     INTEGER,
            comment      TEXT,
            not_recited  INTEGER DEFAULT 0,
            created_at   TEXT    NOT NULL,
            FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
        )
        """
    )

    # -------------------------------------------------------------------------
    # PHASE 1 AUTH EXTENSION — users table
    # -------------------------------------------------------------------------
    # Stores coordinator accounts. username is UNIQUE — no duplicate logins.
    # salt is generated per-user with Python `secrets` (added in Phase 2).
    # hashed_password stores only the salted SHA-256 hash — never plain text.
    # created_at is a UTC ISO-8601 timestamp.
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            username        TEXT    NOT NULL UNIQUE,
            salt            TEXT    NOT NULL,
            hashed_password TEXT    NOT NULL,
            created_at      TEXT    NOT NULL
        )
        """
    )

    # -------------------------------------------------------------------------
    # PHASE 1 AUTH EXTENSION — add user_id to students (safe migration)
    # -------------------------------------------------------------------------
    # SQLite does not support "ADD COLUMN IF NOT EXISTS", so we inspect
    # PRAGMA table_info first and only run ALTER TABLE when the column is
    # genuinely absent. This means:
    #   - Existing student rows are kept intact (user_id = NULL for old rows).
    #   - Running initialize_database() again on server restart is fully safe.
    #   - Zero data is dropped or corrupted.
    cursor.execute("PRAGMA table_info(students)")
    existing_columns = {row[1] for row in cursor.fetchall()}
    if "user_id" not in existing_columns:
        cursor.execute(
            """
            ALTER TABLE students
            ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
            """
        )

    conn.commit()
    conn.close()
