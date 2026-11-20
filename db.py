"""Small helper layer over SQLite so the rest of the code stays short."""
import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "canarytrap.db"
SCHEMA_PATH = BASE_DIR / "schema.sql"


def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # lets us read columns by name
    return conn


def init_db():
    """Create the tables the first time the app starts (safe to run again)."""
    conn = _connect()
    try:
        conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
        conn.commit()
    finally:
        conn.close()


def run(sql, params=()):
    """For INSERT / UPDATE / DELETE."""
    conn = _connect()
    try:
        cur = conn.execute(sql, params)
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def fetch_all(sql, params=()):
    """For SELECT: returns a list of dictionaries."""
    conn = _connect()
    try:
        return [dict(row) for row in conn.execute(sql, params).fetchall()]
    finally:
        conn.close()


def fetch_one(sql, params=()):
    """For SELECT: returns one dictionary, or None."""
    rows = fetch_all(sql, params)
    return rows[0] if rows else None
