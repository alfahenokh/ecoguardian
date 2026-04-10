"""
EcoGuardian - FastAPI Backend
Orkestrasi API untuk sistem multi-agent lingkungan dan dampak sosial.
"""

import os
import uuid
import asyncio
import logging
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel

load_dotenv()

from memory.db import init_db
from agents.orchestrator import run_ecoguardian_agents

init_db()

app = FastAPI(
    title="EcoGuardian AI",
    description="Multi-Agent AI untuk Pemantauan Lingkungan dan Dampak Sosial",
    version="1.0.0"
)

BASE_DIR = Path(__file__).parent
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

# ── Alert thresholds (standar WHO/ISPU) ──────────────────────────────────────
ALERT_THRESHOLDS = {
    "aqi":           {"sedang": 100, "tinggi": 150, "kritis": 200},
    "pm25":          {"sedang": 25,  "tinggi": 55,  "kritis": 150},
    "precipitation": {"sedang": 10,  "tinggi": 20,  "kritis": 50},
    "wind_speed":    {"sedang": 10,  "tinggi": 20,  "kritis": 30},
}

def evaluate_alert_level(metrics: dict, forecast: list) -> dict:
    """Evaluasi level alert berdasarkan data real-time."""
    alerts = []
    max_level = "aman"

    level_order = {"aman": 0, "sedang": 1, "tinggi": 2, "kritis": 3}

    aqi = metrics.get("aqi")
    if aqi and aqi != "N/A":
        try:
            aqi_val = float(aqi)
            if aqi_val >= ALERT_THRESHOLDS["aqi"]["kritis"]:
                alerts.append({"type": "Kualitas Udara", "value": f"AQI {aqi_val}", "level": "kritis", "action": "Hindari aktivitas luar ruangan"})
                max_level = "kritis"
            elif aqi_val >= ALERT_THRESHOLDS["aqi"]["tinggi"]:
                alerts.append({"type": "Kualitas Udara", "value": f"AQI {aqi_val}", "level": "tinggi", "action": "Gunakan masker N95"})
                if level_order[max_level] < level_order["tinggi"]: max_level = "tinggi"
            elif aqi_val >= ALERT_THRESHOLDS["aqi"]["sedang"]:
                alerts.append({"type": "Kualitas Udara", "value": f"AQI {aqi_val}", "level": "sedang", "action": "Batasi aktivitas luar"})
                if level_order[max_level] < level_order["sedang"]: max_level = "sedang"
        except (ValueError, TypeError):
            pass

    if forecast:
        max_rain = max((float(d.get("precipitation") or 0) for d in forecast[:3]), default=0)
        if max_rain >= ALERT_THRESHOLDS["precipitation"]["kritis"]:
            alerts.append({"type": "Curah Hujan", "value": f"{max_rain}mm", "level": "kritis", "action": "Waspada banjir — evakuasi dini"})
            max_level = "kritis"
        elif max_rain >= ALERT_THRESHOLDS["precipitation"]["tinggi"]:
            alerts.append({"type": "Curah Hujan", "value": f"{max_rain}mm", "level": "tinggi", "action": "Siapkan rencana evakuasi"})
            if level_order[max_level] < level_order["tinggi"]: max_level = "tinggi"

    return {
        "alerts": alerts,
        "max_level": max_level,
        "has_alert": len(alerts) > 0,
        "auto_triggered": True,
    }


class QueryRequest(BaseModel):
    query: str
    city: str = "Jakarta"
    country_code: str = "ID"
    session_id: str = ""


class QueryResponse(BaseModel):
    success: bool
    response: str
    risk_level: str = "sedang"
    city: str = "Jakarta"
    metrics: dict = {}
    forecast: list = []
    monitor: dict = {}
    predict: dict = {}
    social: dict = {}
    ethics: dict = {}
    actions: list = []
    notifications: dict = {}
    report_file: str = ""
    sources: list = []
    history: list = []
    ikl: dict = {}
    session_id: str = ""


@app.get("/", response_class=HTMLResponse)
async def root():
    html_path = BASE_DIR / "templates" / "index.html"
    return HTMLResponse(content=html_path.read_text(encoding="utf-8"))


@app.post("/api/analyze", response_model=QueryResponse)
async def analyze(req: QueryRequest):
    session_id = req.session_id or str(uuid.uuid4())

    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query tidak boleh kosong")

    result = await run_ecoguardian_agents(
        user_query=req.query,
        city=req.city or "Jakarta",
        country_code=req.country_code or "ID",
        session_id=session_id,
    )

    result["session_id"] = session_id
    return result


@app.get("/api/auto-monitor/{city}")
async def auto_monitor(city: str, country_code: str = "ID"):
    """
    Auto-monitoring: cek kondisi berbahaya tanpa analisis AI penuh.
    Bisa dipanggil secara periodik dari frontend (setiap 30 menit).
    Mengembalikan alert jika ada kondisi yang melampaui threshold.
    """
    from tools.env_tools import get_air_quality, get_weather, get_forecast, get_city_coordinates
    coords = await get_city_coordinates(city)
    aq, weather = await asyncio.gather(get_air_quality(city), get_weather(city))
    forecast_data = {"status": "error"}
    if coords:
        forecast_data = await get_forecast(coords["lat"], coords["lon"])

    metrics = {
        "aqi": aq.get("aqi", "N/A"),
        "pm25": aq.get("pm25", "N/A"),
        "temperature": weather.get("temperature", "N/A"),
        "humidity": weather.get("humidity", "N/A"),
        "wind_speed": weather.get("wind_speed", "N/A"),
        "weather_desc": weather.get("description", "N/A"),
    }
    forecast_list = forecast_data.get("forecast", [])[:3] if forecast_data.get("status") == "ok" else []
    alert_result = evaluate_alert_level(metrics, forecast_list)

    return {
        "city": city,
        "metrics": metrics,
        "forecast": forecast_list,
        **alert_result,
        "thresholds": ALERT_THRESHOLDS,
        "sources": ["WAQI API", "OpenWeatherMap", "Open-Meteo"],
    }


@app.get("/api/download-report")
async def download_report(file: str):
    """Download laporan yang sudah digenerate."""
    from fastapi.responses import FileResponse as FR
    import urllib.parse
    decoded = urllib.parse.unquote(file)
    path = Path(decoded)
    # Normalisasi path untuk validasi (support Windows backslash)
    normalized = str(path).replace("\\", "/")
    if not path.exists() or not normalized.startswith("data/reports"):
        raise HTTPException(status_code=404, detail="File tidak ditemukan")
    return FR(
        path=str(path),
        filename=path.name,
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{path.name}"'},
    )


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    favicon_path = BASE_DIR / "static" / "favicon.ico"
    if favicon_path.exists():
        return FileResponse(str(favicon_path))
    from fastapi.responses import Response
    return Response(status_code=204)


@app.get("/api/indonesia-weather-map")
async def get_indonesia_weather_map():
    """
    Ambil data cuaca untuk kota-kota besar di setiap provinsi Indonesia.
    Digunakan untuk choropleth map.
    """
    from tools.env_tools import get_forecast, get_city_coordinates
    # Representasi kota per provinsi
    province_cities = {
        "Aceh": ("Banda Aceh", 5.5577, 95.3222),
        "Sumatera Utara": ("Medan", 3.5952, 98.6722),
        "Sumatera Barat": ("Padang", -0.9471, 100.4172),
        "Riau": ("Pekanbaru", 0.5071, 101.4478),
        "Jambi": ("Jambi", -1.6101, 103.6131),
        "Sumatera Selatan": ("Palembang", -2.9761, 104.7754),
        "Bengkulu": ("Bengkulu", -3.7928, 102.2608),
        "Lampung": ("Bandar Lampung", -5.4292, 105.2613),
        "Kepulauan Bangka Belitung": ("Pangkalpinang", -2.1316, 106.1169),
        "Kepulauan Riau": ("Tanjungpinang", 0.9189, 104.4603),
        "DKI Jakarta": ("Jakarta", -6.2088, 106.8456),
        "Jawa Barat": ("Bandung", -6.9175, 107.6191),
        "Jawa Tengah": ("Semarang", -6.9932, 110.4203),
        "DI Yogyakarta": ("Yogyakarta", -7.7956, 110.3695),
        "Jawa Timur": ("Surabaya", -7.2575, 112.7521),
        "Banten": ("Serang", -6.1201, 106.1503),
        "Bali": ("Denpasar", -8.6705, 115.2126),
        "Nusa Tenggara Barat": ("Mataram", -8.5833, 116.1167),
        "Nusa Tenggara Timur": ("Kupang", -10.1772, 123.6070),
        "Kalimantan Barat": ("Pontianak", -0.0263, 109.3425),
        "Kalimantan Tengah": ("Palangka Raya", -2.2161, 113.9135),
        "Kalimantan Selatan": ("Banjarmasin", -3.3194, 114.5908),
        "Kalimantan Timur": ("Samarinda", -0.5022, 117.1536),
        "Kalimantan Utara": ("Tanjung Selor", 2.8370, 117.3740),
        "Sulawesi Utara": ("Manado", 1.4748, 124.8421),
        "Sulawesi Tengah": ("Palu", -0.8917, 119.8707),
        "Sulawesi Selatan": ("Makassar", -5.1477, 119.4327),
        "Sulawesi Tenggara": ("Kendari", -3.9985, 122.5129),
        "Gorontalo": ("Gorontalo", 0.5435, 123.0568),
        "Sulawesi Barat": ("Mamuju", -2.6762, 118.8886),
        "Maluku": ("Ambon", -3.6954, 128.1814),
        "Maluku Utara": ("Ternate", 0.7833, 127.3667),
        "Papua Barat": ("Manokwari", -0.8615, 134.0622),
        "Papua": ("Jayapura", -2.5337, 140.7181),
    }

    async def fetch_province(name, city, lat, lon):
        try:
            fc = await get_forecast(lat, lon)
            if fc.get("status") == "ok" and fc.get("forecast"):
                d = fc["forecast"][0]
                return {
                    "province": name,
                    "city": city,
                    "lat": lat, "lon": lon,
                    "temp_max": d.get("temp_max"),
                    "temp_min": d.get("temp_min"),
                    "precipitation": d.get("precipitation", 0),
                    "wind_max": d.get("wind_max"),
                    "uv_index": d.get("uv_index"),
                }
        except Exception:
            pass
        return {"province": name, "city": city, "lat": lat, "lon": lon, "precipitation": 0}

    tasks = [fetch_province(n, c, la, lo) for n, (c, la, lo) in province_cities.items()]
    results = await asyncio.gather(*tasks)
    return {"provinces": [r for r in results if r]}


@app.get("/api/owm-key")
async def get_owm_key():
    """Expose OWM key untuk weather tile layers."""
    return {"key": os.getenv("OPENWEATHER_API_KEY", "")}


@app.get("/api/weather/{city}")
async def get_weather_forecast(city: str, country_code: str = "ID"):
    """Ambil data cuaca & forecast tanpa analisis AI."""
    from tools.env_tools import get_weather, get_forecast, get_city_coordinates, get_air_quality
    coords = await get_city_coordinates(city)
    weather, aq = await asyncio.gather(get_weather(city), get_air_quality(city))
    forecast = {"status": "error"}
    if coords:
        forecast = await get_forecast(coords["lat"], coords["lon"])
    return {
        "city": city,
        "coords": coords,
        "weather": weather,
        "air_quality": aq,
        "forecast": forecast.get("forecast", [])[:5] if forecast.get("status") == "ok" else [],
    }


@app.post("/api/guardian-chat")
async def guardian_chat(req: dict):
    """Guardian AI Chat — tanya jawab seputar lingkungan dan analisis."""
    from groq import Groq
    message = req.get("message", "").strip()
    context = req.get("context", "")  # data analisis terakhir
    history = req.get("history", [])  # riwayat chat

    if not message:
        raise HTTPException(status_code=400, detail="Pesan tidak boleh kosong")

    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY tidak ditemukan")

    client = Groq(api_key=api_key)

    system_prompt = """Kamu adalah Guardian, asisten AI EcoGuardian yang cerdas, responsif, dan peduli lingkungan.
Kamu seperti JARVIS — pintar, to the point, dan selalu siap membantu.
Kamu ahli dalam: kualitas udara, cuaca, dampak sosial lingkungan, perubahan iklim, dan kebijakan lingkungan Indonesia.
Jawab dalam Bahasa Indonesia yang natural dan informatif. Maksimal 3 paragraf per jawaban.
Jika ada data analisis terbaru, gunakan sebagai konteks jawaban."""

    if context:
        system_prompt += f"\n\nData analisis terbaru:\n{context[:800]}"

    messages = [{"role": "system", "content": system_prompt}]
    for h in history[-6:]:  # max 6 pesan terakhir
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": message})

    try:
        chat = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=messages,
            max_tokens=400,
            temperature=0.7,
        )
        reply = chat.choices[0].message.content.strip()
        return {"reply": reply, "success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/stats")
async def get_stats():
    """Statistik global dari Supabase — total analisis, kota terpopuler, distribusi risiko."""
    from memory.supabase_db import get_supabase
    sb = get_supabase()
    if not sb:
        return {"error": "Supabase tidak tersedia"}
    try:
        res = sb.table("analysis_history").select("city,risk_level,created_at").execute()
        rows = res.data or []

        total = len(rows)

        # Distribusi risiko — normalize dulu (lowercase, strip whitespace)
        risk_dist = {"rendah": 0, "sedang": 0, "tinggi": 0, "kritis": 0}
        for r in rows:
            rl = (r.get("risk_level") or "sedang").strip().lower()
            # Normalisasi nilai yang mungkin berbeda format
            if rl in ("low", "rendah"):
                rl = "rendah"
            elif rl in ("medium", "moderate", "sedang"):
                rl = "sedang"
            elif rl in ("high", "tinggi"):
                rl = "tinggi"
            elif rl in ("critical", "kritis"):
                rl = "kritis"
            if rl in risk_dist:
                risk_dist[rl] += 1
            else:
                risk_dist["sedang"] += 1  # fallback ke sedang jika tidak dikenal

        # Top kota
        city_count = {}
        for r in rows:
            c = r.get("city", "")
            if c:
                city_count[c] = city_count.get(c, 0) + 1
        top_cities = sorted(city_count.items(), key=lambda x: x[1], reverse=True)[:5]

        # Analisis per jam (heatmap)
        hour_dist = [0] * 24
        for r in rows:
            try:
                from datetime import datetime
                dt = datetime.fromisoformat(r["created_at"].replace("Z", ""))
                hour_dist[dt.hour] += 1
            except Exception:
                pass

        return {
            "total": total,
            "risk_distribution": risk_dist,
            "top_cities": [{"city": c, "count": n} for c, n in top_cities],
            "hour_distribution": hour_dist,
        }
    except Exception as e:
        return {"error": str(e)}


@app.post("/api/share-report")
async def share_report(req: dict):
    """Simpan laporan ke Supabase dan return link unik."""
    import uuid
    from memory.supabase_db import get_supabase
    sb = get_supabase()
    if not sb:
        raise HTTPException(status_code=500, detail="Supabase tidak tersedia")

    share_id = str(uuid.uuid4())[:8]
    try:
        sb.table("shared_reports").insert({
            "share_id": share_id,
            "city": req.get("city", ""),
            "risk_level": req.get("risk_level", ""),
            "response": req.get("response", "")[:2000],
            "metrics": req.get("metrics", {}),
            "created_at": __import__("datetime").datetime.utcnow().isoformat(),
        }).execute()
        return {"share_id": share_id, "url": f"/share/{share_id}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/share/{share_id}", response_class=HTMLResponse)
async def view_shared_report(share_id: str):
    """Tampilkan laporan yang di-share."""
    from memory.supabase_db import get_supabase
    sb = get_supabase()
    if not sb:
        return HTMLResponse("<h1>Laporan tidak tersedia</h1>")
    try:
        res = sb.table("shared_reports").select("*").eq("share_id", share_id).execute()
        if not res.data:
            return HTMLResponse("<h1>Laporan tidak ditemukan</h1>")
        d = res.data[0]
        m = d.get("metrics") or {}
        response_html = (d.get("response") or "").replace("\n", "<br>")
        return HTMLResponse(f"""<!DOCTYPE html><html lang="id"><head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <title>EcoGuardian — {d['city']}</title>
        <style>body{{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:20px;color:#1a2e1a}}
        .header{{background:linear-gradient(135deg,#16a34a,#0d9488);color:#fff;padding:24px;border-radius:12px;margin-bottom:24px}}
        .metric{{display:inline-block;background:#f0f4f0;border-radius:8px;padding:12px 20px;margin:6px;text-align:center}}
        .mv{{font-size:1.5rem;font-weight:700;color:#16a34a}}.ml{{font-size:11px;color:#7a967a}}
        .body{{line-height:1.8;color:#4a6a4a}}</style></head><body>
        <div class="header"><h1>🌿 EcoGuardian AI</h1>
        <h2>{d['city']} — Risiko {d['risk_level'].upper()}</h2>
        <p style="opacity:.8">{d['created_at'][:10]}</p></div>
        <div style="margin-bottom:20px">
        <div class="metric"><div class="mv">{m.get('aqi','—')}</div><div class="ml">AQI</div></div>
        <div class="metric"><div class="mv">{m.get('temperature','—')}°C</div><div class="ml">Suhu</div></div>
        <div class="metric"><div class="mv">{m.get('humidity','—')}%</div><div class="ml">Kelembaban</div></div>
        </div>
        <div class="body">{response_html}</div>
        <p style="margin-top:40px;color:#7a967a;font-size:12px;text-align:center">
        Dibuat oleh EcoGuardian AI — <a href="/" style="color:#16a34a">Buka Dashboard</a></p>
        </body></html>""")
    except Exception as e:
        return HTMLResponse(f"<h1>Error: {e}</h1>")


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "service": "EcoGuardian AI",
        "version": "1.0.0",
        "ai": {
            "groq": {
                "active": True,
                "model": "llama-3.1-8b-instant"
            }
        }
    }


@app.get("/api/cities")
async def get_cities():
    return {
        "cities": [
            {"name": "Jakarta", "country": "ID", "label": "Jakarta, Indonesia"},
            {"name": "Surabaya", "country": "ID", "label": "Surabaya, Indonesia"},
            {"name": "Bandung", "country": "ID", "label": "Bandung, Indonesia"},
            {"name": "Medan", "country": "ID", "label": "Medan, Indonesia"},
            {"name": "Semarang", "country": "ID", "label": "Semarang, Indonesia"},
            {"name": "Makassar", "country": "ID", "label": "Makassar, Indonesia"},
            {"name": "Singapore", "country": "SG", "label": "Singapura"},
            {"name": "Kuala Lumpur", "country": "MY", "label": "Kuala Lumpur, Malaysia"},
            {"name": "Bangkok", "country": "TH", "label": "Bangkok, Thailand"},
            {"name": "Tokyo", "country": "JP", "label": "Tokyo, Jepang"},
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", 8000)),
        reload=os.getenv("DEBUG", "false").lower() == "true",
    )
