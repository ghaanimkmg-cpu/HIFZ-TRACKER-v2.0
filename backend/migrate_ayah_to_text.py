"""
migrate_ayah_to_text.py — One-time migration script.
Converts the ayah columns from INTEGER to TEXT to support ranges like '2-7'.
Already executed; kept for reference only.
"""

import sqlite3
import os


DB_PATH = os.path.join(os.path.dirname(__file__), "hifz_tracker.db")


def migrate() -> None:
    """Migrate ayah columns from INTEGER to TEXT."""
    print("Starting database migration...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. Rename old tables
    cursor.execute("ALTER TABLE students RENAME TO students_old")
    cursor.execute("ALTER TABLE progress_history RENAME TO progress_history_old")

    # 2. Create new tables
    cursor.execute('''
        CREATE TABLE students (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name    TEXT    NOT NULL,
            batch_year   INTEGER NOT NULL,
            current_juz  INTEGER NOT NULL CHECK(current_juz BETWEEN 1 AND 30),
            current_surah TEXT   NOT NULL,
            current_ayah TEXT    NOT NULL,
            last_updated TEXT    NOT NULL,
            created_at   TEXT    NOT NULL
        )
    ''')

    cursor.execute('''
        CREATE TABLE progress_history (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id   INTEGER NOT NULL,
            juz          INTEGER NOT NULL,
            surah        TEXT    NOT NULL,
            ayah         TEXT    NOT NULL,
            update_date  TEXT    NOT NULL,
            created_at   TEXT    NOT NULL,
            FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
        )
    ''')

    # 3. Copy data and cast INTEGER to TEXT
    cursor.execute('''
        INSERT INTO students (id, full_name, batch_year, current_juz, current_surah, current_ayah, last_updated, created_at)
        SELECT id, full_name, batch_year, current_juz, current_surah, CAST(current_ayah AS TEXT), last_updated, created_at
        FROM students_old
    ''')

    cursor.execute('''
        INSERT INTO progress_history (id, student_id, juz, surah, ayah, update_date, created_at)
        SELECT id, student_id, juz, surah, CAST(ayah AS TEXT), update_date, created_at
        FROM progress_history_old
    ''')

    # 4. Drop old tables
    cursor.execute("DROP TABLE students_old")
    cursor.execute("DROP TABLE progress_history_old")

    conn.commit()
    conn.close()
    print("Migration completed successfully.")


if __name__ == "__main__":
    migrate()
