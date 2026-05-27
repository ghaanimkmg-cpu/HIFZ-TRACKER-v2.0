"""
database.py — HIFZ TRACKER 2.0
SQLite connection and table initialization.

This module is the ONLY place that touches the database connection.
It is imported by main.py and models.py — never by the frontend.
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
    Create the students table if it does not already exist.
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
    conn.commit()
    conn.close()
