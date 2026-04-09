# EcoGuardian AI
## Multi-Agent AI untuk Pemantauan Lingkungan & Dampak Sosial

---

### Deskripsi Proyek

EcoGuardian AI adalah sistem multi-agent berbasis kecerdasan buatan yang dirancang untuk:
1. **Memantau** kondisi lingkungan secara real-time (polusi udara, cuaca, kualitas udara)
2. **Memprediksi** risiko lingkungan 7 hari ke depan menggunakan data cuaca dan tren historis
3. **Menganalisis** dampak sosial terhadap kelompok rentan berdasarkan data indikator sosial
4. **Merekomendasikan** aksi konkret yang inklusif, adil, dan dapat diterapkan

---

### Arsitektur Sistem

```
User (Web Browser)
       ↓
FastAPI Backend (main.py)
       ↓
EcoGuardian Orchestrator (agents/orchestrator.py)
       ↓ ↓ ↓ ↓
  Monitor   Predict   Social   Report
  Agent     Agent     Agent    Agent
       ↓
  Free APIs (WAQI, OpenWeatherMap, Open-Meteo, World Bank)
       ↓
  Gemini 2.5 Flash (LLM backbone)
       ↓
  SQLite Database (memory/db.py)
```

---

### Teknologi dan Referensi Lengkap

Sesuai ketentuan lomba, berikut daftar lengkap perangkat lunak, API, dan layanan yang digunakan:

#### Bahasa Pemrograman
- **Python 3.11+** — bahasa utama backend
- **JavaScript (ES2022)** — frontend interaktif
- **HTML5 / CSS3** — antarmuka pengguna

#### Framework Backend
- **FastAPI** oleh Sebastián Ramírez / Tiangolo
  - Tautan: https://fastapi.tiangolo.com/
  - Digunakan untuk: REST API, routing, orkestrasi request/response

- **Uvicorn** oleh Encode
  - Tautan: https://www.uvicorn.org/
  - Digunakan untuk: ASGI server untuk menjalankan FastAPI

#### Framework Agen AI
- **CrewAI** oleh João Moura / CrewAI Inc.
  - Tautan: https://docs.crewai.com/
  - Digunakan untuk: orkestrasi multi-agent (Monitor, Predict, Social, Report Agent)

#### Model AI / LLM
- **Gemini 2.5 Flash API** oleh Google DeepMind
  - Tautan: https://ai.google.dev/gemini-api/docs
  - Digunakan untuk: reasoning, analisis data lingkungan, pembuatan laporan
  - Free tier: 1.500 request/hari via Google AI Studio
  - SDK: `google-generativeai` (pip)

#### API Data Lingkungan (Gratis)
- **World Air Quality Index (WAQI) API** oleh aqicn.org
  - Tautan: https://aqicn.org/json-api/doc/
  - Digunakan untuk: data kualitas udara real-time (AQI, PM2.5, PM10, O3, NO2)
  - Free tier: token gratis tersedia

- **OpenWeatherMap Current Weather API** oleh OpenWeather Ltd.
  - Tautan: https://openweathermap.org/api/one-call-3
  - Digunakan untuk: data cuaca real-time (suhu, kelembaban, angin, kondisi)
  - Free tier: 1.000 calls/hari

- **Open-Meteo Weather Forecast API** oleh Open-Meteo.com
  - Tautan: https://open-meteo.com/en/docs
  - Digunakan untuk: prakiraan cuaca 7 hari (suhu, presipitasi, UV index)
  - **100% gratis, tanpa API key**

#### API Data Sosial (Gratis)
- **World Bank Open Data API** oleh The World Bank Group
  - Tautan: https://datahelpdesk.worldbank.org/knowledgebase/articles/889392
  - Digunakan untuk: indikator sosial (poverty rate, Gini index, akses listrik, air bersih)
  - **100% gratis, tanpa API key**

#### Database / Storage
- **SQLite** (built-in Python)
  - Tautan: https://docs.python.org/3/library/sqlite3.html
  - Digunakan untuk: penyimpanan lokal riwayat sesi, cache data API, riwayat analisis
  - **100% gratis, tanpa biaya**

#### Library Python Lainnya
- **httpx** — HTTP client async untuk memanggil API
- **python-dotenv** — manajemen environment variables
- **pydantic** — validasi data request/response

---

### Cara Menjalankan

#### 1. Persiapan Environment
```bash
cd ecoguardian
python -m venv venv
source venv/bin/activate        # Linux/Mac
venv\Scripts\activate           # Windows

pip install -r requirements.txt
```

#### 2. Konfigurasi API Keys
```bash
cp .env.example .env
# Edit .env dan isi nilai berikut:
```

File `.env`:
```
GEMINI_API_KEY=     # Dari https://aistudio.google.com/
OPENWEATHER_API_KEY= # Dari https://openweathermap.org/api
WAQI_TOKEN=          # Dari https://aqicn.org/data-platform/token/
```

**Catatan**: Open-Meteo dan World Bank tidak memerlukan API key.

#### 3. Jalankan Server
```bash
python main.py
# Server berjalan di http://localhost:8000
```

---

### Endpoint API

| Method | URL | Deskripsi |
|--------|-----|-----------|
| GET | / | Antarmuka web utama |
| POST | /api/analyze | Jalankan analisis multi-agent |
| GET | /api/health | Status sistem |
| GET | /api/cities | Daftar kota yang didukung |
| GET | /docs | Dokumentasi API otomatis (FastAPI) |

#### Contoh Request `/api/analyze`:
```json
{
  "query": "Bagaimana kualitas udara hari ini?",
  "city": "Jakarta",
  "country_code": "ID",
  "session_id": ""
}
```

---

### Alur Multi-Agent

1. **Monitor Agent** — Mengambil data real-time dari WAQI dan OpenWeatherMap, menganalisis kondisi kritis, mengidentifikasi kelompok rentan, memberikan rekomendasi segera.

2. **Predict Agent** — Menggunakan data prakiraan Open-Meteo untuk memprediksi tren suhu, risiko banjir, risiko kekeringan, dan skor risiko iklim 7 hari ke depan.

3. **Social Agent** — Menggunakan data World Bank untuk menilai kerentanan sosial, mengidentifikasi kelompok paling terdampak, dan merekomendasikan program inklusif.

4. **Report Agent** — Mengintegrasikan semua hasil analisis menjadi laporan komprehensif yang menjawab pertanyaan pengguna secara spesifik, dengan bahasa yang ramah dan inklusif.

---

### Prinsip Etika & Transparansi

- Semua sumber data ditampilkan secara eksplisit di antarmuka
- Model tidak membuat klaim tanpa data pendukung
- Kelompok rentan (anak-anak, lansia, disabilitas, masyarakat miskin) selalu dipertimbangkan
- Cache data 20 menit untuk mengurangi beban API
- Tidak ada biaya tersembunyi, semua layanan menggunakan free tier

---

### Struktur Direktori

```
ecoguardian/
├── main.py                    # FastAPI entrypoint
├── requirements.txt
├── .env.example
├── README.md
├── agents/
│   └── orchestrator.py        # Multi-agent logic
├── tools/
│   └── env_tools.py           # API fetching tools
├── memory/
│   └── db.py                  # SQLite memory layer
├── templates/
│   └── index.html             # Frontend HTML
├── static/
│   ├── css/style.css          # Stylesheet
│   └── js/app.js              # Frontend JS
└── data/
    └── ecoguardian.db         # SQLite database (auto-created)
```

---

*EcoGuardian AI — Dibangun untuk lomba Environmental & Social Impact: Building a Sustainable and Equitable Future*
