"""
EcoGuardian - Supabase Database Layer
Menggantikan SQLite dengan Supabase (PostgreSQL cloud).
"""

import os
import json
from datetime import datetime

_supabase_client = None

def get_supabase():
    global _supabase_client
    if _supabase_client is None:
        url = os.getenv("SUPABASE_URL", "")
        key = os.getenv("SUPABASE_KEY", "")
        if url and key:
            try:
                from supabase import create_client
                _supabase_client = create_client(url, key)
            except Exception as e:
                print(f"[Supabase] Gagal connect: {e}")
    return _supabase_client


def save_message(session_id: str, role: str, content: str):
    sb = get_supabase()
    now = datetime.utcnow().isoformat()
    if not sb:
        from memory.db import save_message as sqlite_save
        return sqlite_save(session_id, role, content)
    try:
        # Cek apakah sesi sudah ada
        res = sb.table("sessions").select("messages").eq("id", session_id).execute()
        new_msg = {"role": role, "content": content, "timestamp": now}
        if res.data:
            messages = res.data[0].get("messages", [])
            if isinstance(messages, str):
                messages = json.loads(messages)
            messages.append(new_msg)
            sb.table("sessions").update({
                "messages": messages,
                "updated_at": now
            }).eq("id", session_id).execute()
        else:
            sb.table("sessions").insert({
                "id": session_id,
                "created_at": now,
                "updated_at": now,
                "messages": [new_msg]
            }).execute()
    except Exception as e:
        print(f"[Supabase] save_message error: {e}")
        from memory.db import save_message as sqlite_save
        sqlite_save(session_id, role, content)


def save_analysis(session_id: str, query: str, city: str, summary: str, risk_level: str):
    sb = get_supabase()
    if not sb:
        from memory.db import save_analysis as sqlite_save
        return sqlite_save(session_id, query, city, summary, risk_level)
    try:
        sb.table("analysis_history").insert({
            "session_id": session_id,
            "query": query,
            "city": city,
            "result_summary": summary,
            "risk_level": risk_level,
            "created_at": datetime.utcnow().isoformat()
        }).execute()
    except Exception as e:
        print(f"[Supabase] save_analysis error: {e}")
        from memory.db import save_analysis as sqlite_save
        sqlite_save(session_id, query, city, summary, risk_level)


def get_analysis_history(session_id: str, limit: int = 5) -> list:
    sb = get_supabase()
    if not sb:
        from memory.db import get_analysis_history as sqlite_get
        return sqlite_get(session_id, limit)
    try:
        res = sb.table("analysis_history")\
            .select("query,city,result_summary,risk_level,created_at")\
            .eq("session_id", session_id)\
            .order("created_at", desc=True)\
            .limit(limit)\
            .execute()
        return [
            {"query": r["query"], "city": r["city"], "summary": r["result_summary"],
             "risk_level": r["risk_level"], "at": r["created_at"]}
            for r in (res.data or [])
        ]
    except Exception as e:
        print(f"[Supabase] get_analysis_history error: {e}")
        from memory.db import get_analysis_history as sqlite_get
        return sqlite_get(session_id, limit)
