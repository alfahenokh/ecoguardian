"""
EcoGuardian - Agent Orchestrator (CrewAI)
Pipeline: Monitor -> Predict -> Social -> Ethics -> Report
Fitur:
- Jawaban relevan dengan pertanyaan user
- Rencana aksi terstruktur (prioritas, pelaku, dampak)
- Ethical guardrails
- Reasoning transparency
- Rate limit safe (delay antar task + dual model)
"""

import json
import os
import re
import time
import asyncio
from crewai import Agent, Task, Crew, Process
from crewai import LLM

from memory.db import save_message, save_analysis, get_analysis_history

# Import Supabase wrappers dengan fallback ke SQLite
try:
    from memory.supabase_db import (
        save_message as _save_message,
        save_analysis as _save_analysis,
        get_analysis_history as _get_history,
    )
except Exception:
    _save_message = save_message
    _save_analysis = save_analysis
    _get_history = get_analysis_history
from tools.env_tools import (
    get_air_quality, get_weather, get_forecast,
    get_social_data, get_city_coordinates, get_earthquake_data
)
from tools.notification_tools import generate_report_text, save_report_file

# ---------------------------------------------------------------------------
# Sumber referensi resmi per negara
# ---------------------------------------------------------------------------

OFFICIAL_SOURCES = {
    "ID": [
        {"name": "BMKG", "url": "https://www.bmkg.go.id", "desc": "Badan Meteorologi, Klimatologi, dan Geofisika"},
        {"name": "KLHK", "url": "https://www.menlhk.go.id", "desc": "Kementerian Lingkungan Hidup dan Kehutanan"},
        {"name": "ISPU KLHK", "url": "https://iku.menlhk.go.id", "desc": "Indeks Standar Pencemar Udara resmi Indonesia"},
        {"name": "BPS Indonesia", "url": "https://www.bps.go.id", "desc": "Badan Pusat Statistik"},
        {"name": "BNPB", "url": "https://www.bnpb.go.id", "desc": "Badan Nasional Penanggulangan Bencana"},
    ],
    "SG": [
        {"name": "NEA Singapore", "url": "https://www.nea.gov.sg", "desc": "National Environment Agency"},
        {"name": "MSS Singapore", "url": "https://www.weather.gov.sg", "desc": "Meteorological Service Singapore"},
    ],
    "MY": [
        {"name": "JMM Malaysia", "url": "https://www.met.gov.my", "desc": "Jabatan Meteorologi Malaysia"},
        {"name": "DOE Malaysia", "url": "https://www.doe.gov.my", "desc": "Department of Environment Malaysia"},
    ],
    "TH": [
        {"name": "TMD Thailand", "url": "https://www.tmd.go.th", "desc": "Thai Meteorological Department"},
        {"name": "PCD Thailand", "url": "https://www.pcd.go.th", "desc": "Pollution Control Department"},
    ],
    "JP": [
        {"name": "JMA Japan", "url": "https://www.jma.go.jp", "desc": "Japan Meteorological Agency"},
        {"name": "MOE Japan", "url": "https://www.env.go.jp", "desc": "Ministry of the Environment Japan"},
    ],
}

GLOBAL_SOURCES = [
    {"name": "WAQI", "url": "https://aqicn.org", "desc": "World Air Quality Index"},
    {"name": "Open-Meteo", "url": "https://open-meteo.com", "desc": "Free Weather API"},
    {"name": "World Bank Data", "url": "https://data.worldbank.org", "desc": "Data sosial & ekonomi global"},
    {"name": "WHO Air Quality", "url": "https://www.who.int/health-topics/air-pollution", "desc": "Panduan kualitas udara WHO"},
]

def get_official_sources(country_code: str) -> list:
    return OFFICIAL_SOURCES.get(country_code.upper(), []) + GLOBAL_SOURCES


def compute_ikl(metrics: dict, social: dict, risk_level: str) -> dict:
    """
    Indeks Kesehatan Lingkungan (IKL) — skor 0-100 gabungan semua metrik.
    Semakin tinggi = semakin sehat.
    """
    scores = []

    # AQI score (0-100, makin rendah AQI makin bagus)
    aqi = metrics.get("aqi", "N/A")
    try:
        aqi_val = float(aqi)
        aqi_score = max(0, 100 - (aqi_val / 3))
        scores.append(("Kualitas Udara", round(aqi_score), 0.35))
    except (ValueError, TypeError):
        pass

    # Risk level score
    risk_scores = {"rendah": 90, "sedang": 60, "tinggi": 30, "kritis": 10}
    scores.append(("Tingkat Risiko", risk_scores.get(risk_level, 60), 0.25))

    # Social vulnerability (makin rendah kerentanan makin bagus)
    soc_score = social.get("skor_kerentanan_sosial", 50)
    try:
        social_ikl = max(0, 100 - float(soc_score))
        scores.append(("Kesejahteraan Sosial", round(social_ikl), 0.25))
    except (ValueError, TypeError):
        scores.append(("Kesejahteraan Sosial", 50, 0.25))

    # Temperature comfort (optimal 20-28°C)
    temp = metrics.get("temperature", "N/A")
    try:
        t = float(temp)
        temp_score = max(0, 100 - abs(t - 24) * 5)
        scores.append(("Kenyamanan Suhu", round(temp_score), 0.15))
    except (ValueError, TypeError):
        pass

    if not scores:
        return {"score": 50, "label": "Sedang", "components": []}

    total_weight = sum(w for _, _, w in scores)
    ikl = sum(s * w for _, s, w in scores) / total_weight
    ikl = round(ikl)

    label = "Sangat Baik" if ikl >= 80 else "Baik" if ikl >= 60 else "Sedang" if ikl >= 40 else "Buruk" if ikl >= 20 else "Kritis"
    color = "#22c55e" if ikl >= 80 else "#16a34a" if ikl >= 60 else "#f59e0b" if ikl >= 40 else "#ef4444"

    return {
        "score": ikl,
        "label": label,
        "color": color,
        "components": [{"name": n, "score": s} for n, s, _ in scores],
    }


# ---------------------------------------------------------------------------
# Fetch semua data lingkungan
# ---------------------------------------------------------------------------

async def fetch_all_env_data(city: str, country_code: str) -> dict:
    coords = await get_city_coordinates(city)
    tasks = [get_air_quality(city), get_weather(city), get_social_data(country_code), get_earthquake_data()]
    if coords:
        tasks.append(get_forecast(coords["lat"], coords["lon"]))
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return {
        "air_quality": results[0] if not isinstance(results[0], Exception) else {"status": "error"},
        "weather":     results[1] if not isinstance(results[1], Exception) else {"status": "error"},
        "social":      results[2] if not isinstance(results[2], Exception) else {"status": "error"},
        "earthquake":  results[3] if not isinstance(results[3], Exception) else {"status": "error"},
        "forecast":    results[4] if len(results) > 4 and not isinstance(results[4], Exception) else {"status": "error"},
        "coords":      coords or {},
    }


# ---------------------------------------------------------------------------
# Parse rencana aksi dari teks laporan
# ---------------------------------------------------------------------------

def parse_action_plan(text: str) -> list:
    """
    Ekstrak rencana aksi terstruktur dari teks laporan.
    Support berbagai format output LLM.
    """
    import re as _re
    actions = []

    # Format 1: [PRIORITAS: x] [PELAKU: x] [AKSI: x] [DAMPAK: x]
    pattern = r'\[PRIORITAS:\s*(\w+)\]\s*\[PELAKU:\s*([^\]]+)\]\s*\[AKSI:\s*([^\]]+)\]\s*\[DAMPAK:\s*([^\]]+)\]'
    matches = _re.findall(pattern, text, _re.IGNORECASE)
    for m in matches:
        actions.append({
            "prioritas": m[0].strip().lower(),
            "pelaku": m[1].strip(),
            "aksi": m[2].strip(),
            "dampak": m[3].strip(),
        })
    if actions:
        return actions[:6]

    # Format 2: PRIORITAS: x PELAKU: x AKSI: x DAMPAK: x (tanpa kurung siku)
    pattern2 = r'PRIORITAS:\s*(\w+)\s+PELAKU:\s*([^A-Z\n]+?)\s+(?:\*\*)?AKSI:\s*([^D\n]+?)\s+(?:\*\*)?DAMPAK:\s*([^\n\[]+)'
    matches2 = _re.findall(pattern2, text, _re.IGNORECASE)
    for m in matches2:
        aksi = m[2].strip().rstrip('*').strip()
        dampak = m[3].strip().rstrip('*').strip()
        actions.append({
            "prioritas": m[0].strip().lower(),
            "pelaku": m[1].strip().rstrip('*').strip(),
            "aksi": aksi,
            "dampak": dampak,
        })
    if actions:
        return actions[:6]

    # Format 3: baris bernomor di bagian Rencana Aksi
    lines = text.split("\n")
    in_aksi = False
    for line in lines:
        line = line.strip()
        if _re.search(r'rencana aksi|action plan', line, _re.IGNORECASE):
            in_aksi = True
            continue
        if in_aksi and _re.match(r'^[\d\-\*\•]+[\.\)]\s+.{10,}', line):
            prio = "sedang"
            if any(w in line.lower() for w in ["segera", "kritis", "darurat", "tinggi"]):
                prio = "tinggi"
            elif any(w in line.lower() for w in ["jangka panjang", "rendah", "opsional"]):
                prio = "rendah"
            clean_line = _re.sub(r'^[\d\-\*\•]+[\.\)]\s+', '', line)
            clean_line = _re.sub(r'\*\*', '', clean_line).strip()
            actions.append({
                "prioritas": prio,
                "pelaku": "Pemerintah & Masyarakat",
                "aksi": clean_line,
                "dampak": "Peningkatan kondisi lingkungan dan sosial",
            })

    return actions[:6]


# ---------------------------------------------------------------------------
# CrewAI Crew Builder
# ---------------------------------------------------------------------------

def build_crew(env_data: dict, user_query: str, city: str):
    fast_llm = LLM(
        model="groq/llama-3.1-8b-instant",
        api_key=os.getenv("GROQ_API_KEY", ""),
        temperature=0.2,
    )
    report_llm = LLM(
        model="groq/llama-3.1-8b-instant",
        api_key=os.getenv("GROQ_API_KEY", ""),
        temperature=0.3,
    )

    aq            = env_data.get("air_quality", {})
    weather       = env_data.get("weather", {})
    social        = env_data.get("social", {}).get("data", {})

    def fmt(key: str) -> str:
        """Bulatkan nilai sosial jadi angka bulat tanpa desimal."""
        val = social.get(key, {}).get("value")
        if val is None:
            return "N/A"
        try:
            return str(round(float(val)))
        except Exception:
            return str(val)
    forecast_days = env_data.get("forecast", {}).get("forecast", [])[:2]
    eq            = env_data.get("earthquake", {})

    # ── Agents ────────────────────────────────────────────────────────────

    monitor_agent = Agent(
        role="Agen Pemantau Lingkungan",
        goal="Analisis kualitas udara dan cuaca berbasis standar WHO/ISPU, jawab relevan dengan pertanyaan user.",
        backstory="Ilmuwan lingkungan transparan yang selalu menyebut standar ilmiah.",
        llm=fast_llm, verbose=False, allow_delegation=False,
    )
    predict_agent = Agent(
        role="Agen Prediksi Risiko Iklim",
        goal="Prediksi risiko banjir dan polusi dari prakiraan cuaca dengan tingkat kepercayaan.",
        backstory="Ahli klimatologi yang tidak melebih-lebihkan risiko tanpa data.",
        llm=fast_llm, verbose=False, allow_delegation=False,
    )
    social_agent = Agent(
        role="Agen Dampak Sosial & Keadilan",
        goal="Nilai dampak pada kelompok rentan, fokus keadilan sosial dan inklusi.",
        backstory="Sosiolog yang mengadvokasi solusi inklusif untuk semua lapisan masyarakat.",
        llm=fast_llm, verbose=False, allow_delegation=False,
    )
    ethics_agent = Agent(
        role="Agen Audit Etika AI",
        goal="Validasi output: periksa bias, transparansi, keadilan, akurasi data.",
        backstory="Auditor etika AI yang menerapkan prinsip fairness, accountability, transparency.",
        llm=fast_llm, verbose=False, allow_delegation=False,
    )
    report_agent = Agent(
        role="Agen Pelaporan & Rencana Aksi",
        goal="Buat laporan yang menjawab pertanyaan user secara spesifik dengan rencana aksi terukur.",
        backstory="Analis kebijakan yang mengubah data menjadi aksi konkret dan terukur.",
        llm=report_llm, verbose=False, allow_delegation=False,
    )

    # ── Tasks ─────────────────────────────────────────────────────────────

    task_monitor = Task(
        description=(
            f"Analisis lingkungan {city} untuk menjawab: '{user_query[:100]}'\n"
            f"Data tersedia: AQI={aq.get('aqi','TIDAK ADA')} PM2.5={aq.get('pm25','TIDAK ADA')} "
            f"Suhu={weather.get('temperature','N/A')}°C Kelembaban={weather.get('humidity','N/A')}%.\n"
            f"Gempa terbaru BMKG: M{eq.get('magnitude','N/A')} {eq.get('tanggal','N/A')} - {eq.get('wilayah','N/A')}.\n"
            "PENTING: Jika AQI/PM2.5 'TIDAK ADA', nyatakan data tidak tersedia — jangan mengarang.\n"
            "Jawab singkat: status udara, kondisi relevan dengan pertanyaan, 2 rekomendasi."
        ),
        expected_output="Status udara berbasis data nyata, kondisi relevan, 2 rekomendasi spesifik.",
        agent=monitor_agent,
        callback=lambda _: time.sleep(15),
    )
    task_predict = Task(
        description=(
            f"Prediksi risiko {city} terkait: '{user_query[:100]}'\n"
            f"Prakiraan: {json.dumps(forecast_days, ensure_ascii=False) if forecast_days else 'N/A'}\n"
            "Fokus pada risiko yang relevan dengan pertanyaan user. Jawab singkat."
        ),
        expected_output="Risiko spesifik sesuai pertanyaan, tingkat kepercayaan, 2 saran.",
        agent=predict_agent,
        context=[task_monitor],
        callback=lambda _: time.sleep(15),
    )
    task_social = Task(
        description=(
            f"Dampak sosial {city} terkait: '{user_query[:100]}'\n"
            f"Data: kemiskinan={fmt('poverty_rate')}% air_bersih={fmt('clean_water_access')}% "
            f"sanitasi={fmt('basic_sanitation')}%\n"
            "Fokus pada dampak yang relevan dengan pertanyaan. Skor kerentanan 0-100. Jawab singkat."
        ),
        expected_output="Skor kerentanan, kelompok rentan relevan, 2 rekomendasi inklusif.",
        agent=social_agent,
        context=[task_monitor],
        callback=lambda _: time.sleep(15),
    )
    task_ethics = Task(
        description=(
            f"Audit etika analisis {city} terkait: '{user_query[:80]}'\n"
            "Periksa: apakah data valid, apakah ada klaim tanpa data, apakah rekomendasi realistis.\n"
            "Skor etika 0-100, 3 temuan singkat (✅/⚠️)."
        ),
        expected_output="Skor etika, 3 temuan, catatan validitas data.",
        agent=ethics_agent,
        context=[task_monitor, task_predict, task_social],
        callback=lambda _: time.sleep(15),
    )
    task_report = Task(
        description=(
            f"Buat laporan EcoGuardian untuk {city} yang MENJAWAB LANGSUNG: \"{user_query[:150]}\"\n\n"
            "PENTING: Kamu HANYA boleh menjawab berdasarkan data yang tersedia:\n"
            "- Kualitas udara (AQI, PM2.5) dari WAQI\n"
            "- Cuaca real-time dari OpenWeatherMap\n"
            "- Prakiraan cuaca dari Open-Meteo\n"
            "- Data sosial dari World Bank\n"
            "Jika pertanyaan di luar data tersebut (gempa, banjir historis, dll), "
            "nyatakan dengan jelas bahwa data tidak tersedia dan sarankan sumber resmi.\n\n"
            "Format wajib:\n"
            "1. KONDISI SAAT INI — jelaskan MENGAPA kondisi ini terjadi (reasoning eksplisit)\n"
            "2. PREDIKSI RISIKO — sertakan tingkat kepercayaan prediksi\n"
            "3. DAMPAK SOSIAL — fokus pada kelompok rentan dan ketidaksetaraan\n"
            "4. CATATAN ETIKA — transparansi keterbatasan data\n"
            "5. RENCANA AKSI — 3 aksi dengan format:\n"
            "   [PRIORITAS: tinggi/sedang/rendah] [PELAKU: siapa] [AKSI: apa] [DAMPAK: dampak terukur dalam angka/persentase]\n\n"
            "Setiap rekomendasi HARUS menyertakan alasan berbasis data mengapa aksi itu dipilih.\n"
            "Baris terakhir: RISK_LEVEL: rendah/sedang/tinggi/kritis"
        ),
        expected_output="Laporan 5 bagian dengan reasoning eksplisit dan dampak terukur, diakhiri RISK_LEVEL.",
        agent=report_agent,
        context=[task_monitor, task_predict, task_social, task_ethics],
    )

    crew = Crew(
        agents=[monitor_agent, predict_agent, social_agent, ethics_agent, report_agent],
        tasks=[task_monitor, task_predict, task_social, task_ethics, task_report],
        process=Process.sequential,
        verbose=False,
    )
    return crew, (task_monitor, task_predict, task_social, task_ethics, task_report)

# ---------------------------------------------------------------------------
# Orchestrator utama
# ---------------------------------------------------------------------------

async def run_ecoguardian_agents(
    user_query: str,
    city: str = "Jakarta",
    country_code: str = "ID",
    session_id: str = "default"
) -> dict:

    if not os.getenv("GROQ_API_KEY"):
        return {
            "success": False,
            "response": "GROQ_API_KEY tidak ditemukan.",
            "risk_level": "sedang", "city": city, "metrics": {},
            "forecast": [], "monitor": {}, "predict": {}, "social": {},
            "ethics": {}, "actions": [], "sources": [], "history": [],
        }

    _save_message(session_id, "user", user_query)
    env_data = await fetch_all_env_data(city, country_code)

    def _run_crew():
        # Fase 1: Monitor, Predict, Social paralel (hemat ~30 detik)
        import concurrent.futures

        def run_single_agent(agent, task):
            """Jalankan satu agen secara independen."""
            mini_crew = Crew(
                agents=[agent],
                tasks=[task],
                process=Process.sequential,
                verbose=False,
            )
            result = mini_crew.kickoff()
            time.sleep(8)  # jeda setelah tiap agen
            return str(result).strip()

        crew, tasks = build_crew(env_data, user_query, city)
        task_monitor, task_predict, task_social, task_ethics, task_report = tasks

        # Ambil agen dari crew
        monitor_ag, predict_ag, social_ag, ethics_ag, report_ag = crew.agents

        # Jalankan 3 agen pertama paralel di thread pool
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            f_monitor = executor.submit(run_single_agent, monitor_ag, task_monitor)
            f_predict  = executor.submit(run_single_agent, predict_ag, task_predict)
            f_social   = executor.submit(run_single_agent, social_ag, task_social)
            out_monitor = f_monitor.result()
            out_predict  = f_predict.result()
            out_social   = f_social.result()

        time.sleep(8)

        # Fase 2: Ethics lalu Report (butuh konteks dari fase 1)
        out_ethics = run_single_agent(ethics_ag, task_ethics)
        time.sleep(8)

        # Report agent — jalankan dengan full crew untuk dapat konteks
        final_crew = Crew(
            agents=[report_ag],
            tasks=[task_report],
            process=Process.sequential,
            verbose=False,
        )
        final_result = final_crew.kickoff()
        final_text = str(final_result).strip()

        outputs = [out_monitor, out_predict, out_social, out_ethics, final_text]
        return final_text, outputs

    loop = asyncio.get_event_loop()
    task_outputs = [""] * 5
    final_text = ""

    for attempt in range(3):
        try:
            final_text, task_outputs = await loop.run_in_executor(None, _run_crew)
            break
        except Exception as e:
            err = str(e)
            if "rate_limit" in err.lower() and attempt < 2:
                wait = (attempt + 1) * 25  # 25s, 50s
                await asyncio.sleep(wait)
                continue
            final_text = f"Terjadi kesalahan pada agen: {err}"
            break

    # Extract risk level
    risk_level = "sedang"
    clean_lines = []
    for line in final_text.split("\n"):
        if "RISK_LEVEL:" in line:
            val = line.split("RISK_LEVEL:")[-1].strip().lower()
            if val in ("rendah", "sedang", "tinggi", "kritis"):
                risk_level = val
        else:
            clean_lines.append(line)
    final_text = "\n".join(clean_lines).strip()

    _save_message(session_id, "assistant", final_text)
    _save_analysis(session_id, user_query, city, final_text[:500], risk_level)

    # Parse output tiap agen — fleksibel, support JSON dan teks bebas
    def parse_output(text: str, fallback_key: str) -> dict:
        if not text:
            return {}
        try:
            start, end = text.find("{"), text.rfind("}") + 1
            if start != -1 and end > start:
                return json.loads(text[start:end])
        except Exception:
            pass
        return {fallback_key: text}  # teks penuh tanpa dipotong

    monitor_result = parse_output(task_outputs[0], "ringkasan")
    predict_result = parse_output(task_outputs[1], "prediksi")
    social_result  = parse_output(task_outputs[2], "dampak")
    ethics_result  = parse_output(task_outputs[3], "catatan_etika")

    # Ekstrak skor sosial dari teks jika tidak ada di JSON
    if "skor_kerentanan_sosial" not in social_result:
        import re as _re
        raw_social = task_outputs[2] if len(task_outputs) > 2 else ""
        m = _re.search(r'[Ss]kor[^\d]*(\d{1,3})', raw_social)
        social_result["skor_kerentanan_sosial"] = int(m.group(1)) if m else 0

    # Parse rencana aksi dari laporan final
    action_plan = parse_action_plan(final_text)

    # Metrics dengan fallback WAQI
    aq           = env_data.get("air_quality", {})
    weather      = env_data.get("weather", {})
    temperature  = weather.get("temperature", aq.get("temperature", "N/A"))
    humidity     = weather.get("humidity", aq.get("humidity", "N/A"))
    wind_speed   = weather.get("wind_speed", "N/A")
    weather_desc = weather.get("description", "N/A")

    forecast_data = env_data.get("forecast", {})
    forecast_list = (
        forecast_data.get("forecast", [])[:5]
        if forecast_data.get("status") == "ok" else []
    )

    # Generate laporan file untuk download
    metrics_out = {
        "aqi": aq.get("aqi", "N/A"),
        "pm25": aq.get("pm25", "N/A"),
        "temperature": temperature,
        "humidity": humidity,
        "wind_speed": wind_speed,
        "dominant_pollutant": aq.get("dominant_pollutant", "N/A"),
        "weather_desc": weather_desc,
    }

    report_text = generate_report_text(city, risk_level, final_text, metrics_out, action_plan, get_official_sources(country_code))
    report_path = save_report_file(report_text, city)

    return {
        "success": True,
        "response": final_text,
        "risk_level": risk_level,
        "city": city,
        "metrics": metrics_out,
        "forecast": forecast_list,
        "monitor": monitor_result,
        "predict": predict_result,
        "social": social_result,
        "ethics": ethics_result,
        "actions": action_plan,
        "notifications": {},
        "report_file": str(report_path),
        "sources": get_official_sources(country_code),
        "history": _get_history(session_id, limit=3),
        "ikl": compute_ikl(metrics_out, social_result, risk_level),
    }
