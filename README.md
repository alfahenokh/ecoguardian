# 🌿 EcoGuardian AI
### Sistem Multi-Agent AI untuk Pemantauan Lingkungan dan Dampak Sosial Secara Real-Time

---

## 📋 Deskripsi Proyek

EcoGuardian AI adalah sistem AI agentik berbasis **CrewAI** yang dirancang untuk memantau, memprediksi, dan mengurangi risiko lingkungan serta dampak sosial secara otonom. Sistem ini menggunakan 5 agen AI yang bekerja secara kolaboratif:

| Agen | Peran |
|------|-------|
| 🌫️ **Monitor Agent** | Menganalisis kualitas udara (AQI, PM2.5) dan cuaca real-time berbasis standar WHO/ISPU |
| 📈 **Predict Agent** | Memprediksi risiko banjir dan polusi dari prakiraan cuaca 7 hari ke depan |
| 👥 **Social Agent** | Menilai dampak lingkungan pada kelompok rentan dengan perspektif keadilan sosial |
| 🛡️ **Ethics Auditor** | Memvalidasi output semua agen: bias, transparansi, keadilan, akurasi data |
| 📋 **Report Agent** | Menyusun laporan komprehensif dengan rencana aksi terukur |

---

## 🎯 Kesesuaian dengan Kriteria Lomba

### ✅ Memantau, memprediksi, dan mengurangi risiko lingkungan
- Monitor Agent menganalisis AQI, PM2.5, suhu, kelembaban secara real-time
- Predict Agent memprediksi risiko banjir dan polusi dari data Open-Meteo
- Data gempa terbaru dari BMKG diintegrasikan ke analisis

### ✅ Mendukung inisiatif kebaikan sosial
- Social Agent mengidentifikasi kelompok rentan (anak-anak, lansia, masyarakat miskin)
- Data kemiskinan, akses air bersih, sanitasi dari World Bank
- Rekomendasi inklusif yang mempertimbangkan semua lapisan masyarakat

### ✅ Bertindak secara otonom
- 5 agen bekerja paralel + sequential tanpa intervensi manual
- Generate laporan otomatis yang bisa diunduh
- Guardian AI Chat untuk tanya jawab lanjutan

### ✅ Etika, transparansi, dan AI bertanggung jawab
- Ethics Auditor Agent memvalidasi setiap output
- Semua sumber data ditampilkan dengan link resmi
- Disclaimer keterbatasan data ditampilkan secara eksplisit

---

## 🛠️ Teknologi yang Digunakan

### Bahasa Pemrograman
- **Python 3.11+** — Backend, orkestrasi agen
- **JavaScript (ES2022)** — Frontend interaktif
- **HTML5 / CSS3** — Antarmuka pengguna

### Kerangka Kerja Agen
- **CrewAI ≥0.80.0** oleh CrewAI Inc.
  - Tautan: https://docs.crewai.com
  - Digunakan untuk: orkestrasi multi-agent paralel + sequential (Monitor & Predict & Social → Ethics → Report)

### LLM / AI
- **Groq API — llama-3.1-8b-instant** oleh Groq Inc.
  - Tautan: https://console.groq.com/docs
  - Digunakan untuk: reasoning setiap agen, pembuatan laporan, Guardian AI Chat
  - Free tier: tersedia

### Backend Framework
- **FastAPI 0.115.0** oleh Sebastián Ramírez
  - Tautan: https://fastapi.tiangolo.com
  - Digunakan untuk: REST API, orkestrasi request, endpoint analisis

### Database
- **Supabase (PostgreSQL)** — Database utama cloud
  - Tautan: https://supabase.com
  - Digunakan untuk: menyimpan riwayat analisis semua sesi, statistik global, share laporan
  - Free tier: tersedia
- **SQLite** — Fallback lokal jika Supabase tidak tersedia
  - Digunakan untuk: cache data lingkungan, riwayat sesi lokal

### Deployment & Server
- **Uvicorn 0.30.6** — ASGI server untuk FastAPI
  - Tautan: https://www.uvicorn.org

---

## 🌐 API Publik yang Digunakan

| API | Penyedia | Tautan | Penggunaan |
|-----|----------|--------|------------|
| **WAQI API** | World Air Quality Index | https://aqicn.org/json-api/doc/ | Data AQI, PM2.5, polutan udara real-time |
| **OpenWeatherMap API** | OpenWeather Ltd | https://openweathermap.org/api | Cuaca real-time, geocoding kota |
| **Open-Meteo API** | Open-Meteo.com | https://open-meteo.com/en/docs | Prakiraan cuaca 7 hari (gratis, tanpa API key) |
| **World Bank API** | World Bank Group | https://datahelpdesk.worldbank.org | Data sosial: kemiskinan, sanitasi, air bersih |
| **BMKG API** | Badan Meteorologi, Klimatologi, dan Geofisika | https://data.bmkg.go.id | Data gempa bumi terbaru Indonesia |
| **OpenStreetMap / Leaflet** | OpenStreetMap Foundation | https://leafletjs.com | Peta interaktif dan choropleth cuaca |
| **GeoJSON Provinsi Indonesia** | rifani/geojson-political-indonesia | https://github.com/rifani/geojson-political-indonesia | Batas wilayah provinsi untuk peta choropleth |

---

## 📦 Instalasi & Menjalankan

### Prasyarat
- Python 3.11+
- API Keys: Groq, OpenWeatherMap, WAQI
- Supabase project (opsional, ada fallback SQLite)

### Langkah Instalasi

```bash
# 1. Clone repository
git clone https://github.com/alfahenokh/ecoguardian.git
cd ecoguardian

# 2. Buat virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# 3. Install dependencies
pip install -r requirements.txt

# 4. Konfigurasi API keys
# Buat file .env dengan isi:
GROQ_API_KEY=your_groq_key
OPENWEATHER_API_KEY=your_openweather_key
WAQI_TOKEN=your_waqi_token

# Supabase (opsional tapi direkomendasikan untuk statistik global)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key

# 5. Jalankan server
python main.py
```

Buka browser: `http://localhost:8000`

### Setup Supabase (Opsional)

Buat dua tabel berikut di Supabase SQL Editor:

```sql
-- Tabel riwayat analisis
CREATE TABLE analysis_history (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT,
  query TEXT,
  city TEXT,
  result_summary TEXT,
  risk_level TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel laporan yang di-share
CREATE TABLE shared_reports (
  id BIGSERIAL PRIMARY KEY,
  share_id TEXT UNIQUE,
  city TEXT,
  risk_level TEXT,
  response TEXT,
  metrics JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel sesi chat
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  messages JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🏗️ Arsitektur Sistem

```
User Query
    ↓
FastAPI Backend
    ↓
fetch_all_env_data() — parallel async
├── WAQI API (kualitas udara)
├── OpenWeatherMap (cuaca real-time)
├── Open-Meteo (prakiraan 7 hari)
├── World Bank (data sosial)
└── BMKG (data gempa)
    ↓
CrewAI Pipeline (Paralel + Sequential)
├── [Paralel] Monitor Agent  → analisis kondisi saat ini
├── [Paralel] Predict Agent  → prediksi risiko 7 hari
├── [Paralel] Social Agent   → dampak sosial & kerentanan
├── [Sequential] Ethics Agent → audit etika semua output
└── [Sequential] Report Agent → laporan final + rencana aksi
    ↓
Supabase — simpan riwayat & statistik global
    ↓
Response → Frontend (bubble cards, peta, download)
    ↓
Guardian AI Chat (tanya jawab lanjutan via Groq)
```

---

## 📊 Fitur Utama

- 🌍 **Analisis Multi-Kota** — Semua kota di Indonesia dan beberapa kota Asia
- 🗺️ **Peta Cuaca Choropleth** — Visualisasi curah hujan/suhu/angin per provinsi Indonesia
- 🤖 **Guardian AI Chat** — Asisten AI untuk tanya jawab seputar analisis
- 📄 **Download Laporan** — Export laporan lengkap dalam format `.txt`
- 🔗 **Share Laporan** — Bagikan hasil analisis via link unik
- 📊 **Statistik Global** — Dashboard statistik semua analisis dari Supabase
- 🌙 **Dark/Light Mode** — Tema yang bisa disesuaikan
- 📱 **Responsive Design** — Tampil baik di berbagai ukuran layar
- 🚨 **Auto-Monitor** — Cek kondisi berbahaya secara periodik tanpa analisis penuh

---

## 📝 Kutipan Perangkat Lunak

> "Proyek ini menggunakan **CrewAI** untuk orkestrasi multi-agent, **Groq API (llama-3.1-8b-instant)** sebagai LLM backbone untuk reasoning dan pembuatan laporan, **FastAPI** sebagai backend framework, **Supabase (PostgreSQL)** sebagai database cloud untuk statistik global dan riwayat analisis, **SQLite** sebagai fallback database lokal, **WAQI API** untuk data kualitas udara real-time, **OpenWeatherMap API** untuk cuaca dan geocoding, **Open-Meteo** untuk prakiraan cuaca 7 hari, **World Bank API** untuk data sosial-ekonomi, **BMKG API** untuk data gempa bumi, dan **Leaflet.js** dengan data GeoJSON untuk visualisasi peta interaktif."

---

## 👨‍💻 Tim Pengembang

EcoGuardian AI — Dikembangkan untuk kompetisi AI Agentik

---

*Semua API yang digunakan adalah layanan publik gratis atau memiliki free tier.*
