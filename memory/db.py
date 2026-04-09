"""
EcoGuardian - Memory Layer
Menggunakan SQLite (gratis, lokal) untuk menyimpan riwayat sesi dan cache data.
"""

import sqlite3
import json
import os
from datetime import datetime
from pathlib import Path


DB_PATH = Path(__file__).parent.parent / "data" / "ecoguardian.db"


def init_db():
    """Inisialisasi database SQLite."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            created_at TEXT,
            updated_at TEXT,
            messages TEXT DEFAULT '[]'
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS env_cache (
            cache_key TEXT PRIMARY KEY,
            data TEXT,
            fetched_at TEXT
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS analysis_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            query TEXT,
            city TEXT,
            result_summary TEXT,
            risk_level TEXT,
            created_at TEXT
        )
    """)

    conn.commit()
    conn.close()


def save_message(session_id: str, role: str, content: str):
    """Simpan pesan ke riwayat sesi."""
    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.cursor()

    cur.execute("SELECT messages FROM sessions WHERE id = ?", (session_id,))
    row = cur.fetchone()
    now = datetime.utcnow().isoformat()

    if row:
        messages = json.loads(row[0])
        messages.append({"role": role, "content": content, "timestamp": now})
        cur.execute(
            "UPDATE sessions SET messages = ?, updated_at = ? WHERE id = ?",
            (json.dumps(messages), now, session_id)
        )
    else:
        messages = [{"role": role, "content": content, "timestamp": now}]
        cur.execute(
            "INSERT INTO sessions (id, created_at, updated_at, messages) VALUES (?, ?, ?, ?)",
            (session_id, now, now, json.dumps(messages))
        )

    conn.commit()
    conn.close()


def get_session_messages(session_id: str, last_n: int = 10) -> list:
    """Ambil pesan terakhir dari sesi."""
    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.cursor()
    cur.execute("SELECT messages FROM sessions WHERE id = ?", (session_id,))
    row = cur.fetchone()
    conn.close()

    if row:
        messages = json.loads(row[0])
        return messages[-last_n:]
    return []


def cache_env_data(cache_key: str, data: dict):
    """Cache data lingkungan untuk mengurangi API calls."""
    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.cursor()
    now = datetime.utcnow().isoformat()
    cur.execute(
        "INSERT OR REPLACE INTO env_cache (cache_key, data, fetched_at) VALUES (?, ?, ?)",
        (cache_key, json.dumps(data), now)
    )
    conn.commit()
    conn.close()


def get_cached_env_data(cache_key: str, max_age_minutes: int = 30) -> dict | None:
    """Ambil cache data lingkungan jika masih fresh."""
    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.cursor()
    cur.execute("SELECT data, fetched_at FROM env_cache WHERE cache_key = ?", (cache_key,))
    row = cur.fetchone()
    conn.close()

    if row:
        data, fetched_at = row
        fetched_time = datetime.fromisoformat(fetched_at)
        age_minutes = (datetime.utcnow() - fetched_time).total_seconds() / 60
        if age_minutes < max_age_minutes:
            return json.loads(data)
    return None


def save_analysis(session_id: str, query: str, city: str, summary: str, risk_level: str):
    """Simpan riwayat analisis."""
    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO analysis_history (session_id, query, city, result_summary, risk_level, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (session_id, query, city, summary, risk_level, datetime.utcnow().isoformat())
    )
    conn.commit()
    conn.close()


def get_analysis_history(session_id: str, limit: int = 5) -> list:
    """Ambil riwayat analisis untuk sesi tertentu."""
    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.cursor()
    cur.execute(
        "SELECT query, city, result_summary, risk_level, created_at FROM analysis_history WHERE session_id = ? ORDER BY created_at DESC LIMIT ?",
        (session_id, limit)
    )
    rows = cur.fetchall()
    conn.close()
    return [{"query": r[0], "city": r[1], "summary": r[2], "risk_level": r[3], "at": r[4]} for r in rows]
