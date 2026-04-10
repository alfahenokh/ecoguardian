/* EcoGuardian AI — main.js (inline + overrides) */

// Definisikan enterDashboard di paling atas agar selalu tersedia
function enterDashboard() {
  const landing = document.getElementById('eco-landing');
  const dash    = document.getElementById('eco-dashboard');
  if (!landing || !dash) return;
  landing.classList.add('hide');
  setTimeout(() => {
    landing.style.display = 'none';
    dash.style.display = 'block';
    document.querySelectorAll('.kpi, .stat-card').forEach((c, i) => {
      setTimeout(() => c.classList.add('on'), 80 + i * 100);
    });
    const savedCity = localStorage.getItem('eco_last_city') || 'Jakarta';
    setTimeout(() => { if (typeof loadWeatherForCity === 'function') loadWeatherForCity(savedCity); }, 300);
  }, 1000);
}

let sessionId = localStorage.getItem("eco_session") || "";
let isLoading = false;
let analysisCount = 0;
let aksiChecked = 0;
let aksiTotal = 0;
let lastResult = null;

const pageMeta = {
  ringkasan: [
    "Ringkasan Dashboard",
    "Gambaran umum kondisi lingkungan dan sosial",
  ],
  pemantauan: [
    "Pemantauan Data Real-Time",
    "Data lingkungan langsung dari API terpercaya",
  ],
  analisis: [
    "Analisis Dampak",
    "Jalankan analisis multi-agent AI untuk wilayah pilihan",
  ],
  aksi: [
    "Rencana Aksi",
    "Rekomendasi tindakan konkret berdasarkan analisis",
  ],
  etika: [
    "Audit Etika & Transparansi",
    "Standar etika, keadilan, dan kualitas sistem AI",
  ],
  kemajuan: [
    "Lacak Kemajuan",
    "Monitor perkembangan analisis dan aksi yang dilakukan",
  ],
};

function showPage(name, btn) {
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.remove("active"));
  document.getElementById("page-" + name).classList.add("active");
  if (btn) btn.classList.add("active");
  const meta = pageMeta[name] || ["", ""];
  document.getElementById("pageTitle").textContent = meta[0];
  document.getElementById("pageSub").textContent = meta[1];
}

function setQuery(el, text) {
  document
    .querySelectorAll(".q-tag")
    .forEach((t) => t.classList.remove("active"));
  el.classList.add("active");
  document.getElementById("queryInput").value = text;
}

function showNotif(msg) {
  const n = document.getElementById("notif");
  document.getElementById("notifText").textContent = msg;
  n.classList.add("show");
  setTimeout(() => n.classList.remove("show"), 2500);
}

function setCityQuick(name) {
  document.getElementById("cityInput").value = name;
  document
    .querySelectorAll("#cityQuickBtns .q-tag")
    .forEach((b) => b.classList.remove("active"));
  event.target.classList.add("active");
}

async function runAnalysis() {
  if (isLoading) return;
  const query = document.getElementById("queryInput").value.trim();
  const city = (
    document.getElementById("cityInput").value || "Jakarta"
  ).trim();
  // Auto-detect country from city name (basic heuristic)
  const countryMap = {
    singapore: "SG",
    "kuala lumpur": "MY",
    bangkok: "TH",
    tokyo: "JP",
    manila: "PH",
  };
  const country = countryMap[city.toLowerCase()] || "ID";

  if (!query) {
    document.getElementById("queryInput").style.borderColor =
      "var(--red)";
    setTimeout(
      () =>
        (document.getElementById("queryInput").style.borderColor = ""),
      1500
    );
    showNotif("Masukkan pertanyaan analisis terlebih dahulu");
    return;
  }
  if (!city) {
    document.getElementById("cityInput").style.borderColor = "var(--red)";
    setTimeout(
      () => (document.getElementById("cityInput").style.borderColor = ""),
      1500
    );
    showNotif("Masukkan nama wilayah terlebih dahulu");
    return;
  }

  isLoading = true;
  document.getElementById("analyzeBtn").disabled = true;
  document.getElementById("btnText").textContent = "Menganalisis...";
  document.getElementById("loadingPanel").style.display = "block";
  document.getElementById("resultPanel").style.display = "none";

  const steps = ["step1", "step2", "step3", "step4"];
  const labels = [
    "Mengambil data lingkungan...",
    "Menganalisis tren & risiko...",
    "Menilai dampak sosial...",
    "Menyusun laporan...",
  ];
  steps.forEach((s, i) => {
    setTimeout(() => {
      steps.slice(0, i).forEach((prev) => {
        document.getElementById(prev).className = "step-card done";
        document
          .getElementById(prev)
          .querySelector(".step-status").textContent = "Selesai ✓";
      });
      const el = document.getElementById(s);
      el.className = "step-card running";
      el.querySelector(".step-status").textContent = labels[i];
    }, i * 2200);
  });

  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        city,
        country_code: country,
        session_id: sessionId,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.session_id) {
      sessionId = data.session_id;
      localStorage.setItem("eco_session", sessionId);
    }

    steps.forEach((s) => {
      document.getElementById(s).className = "step-card done";
      document
        .getElementById(s)
        .querySelector(".step-status").textContent = "Selesai ✓";
    });

    setTimeout(() => {
      document.getElementById("loadingPanel").style.display = "none";
      renderResult(data);
      analysisCount++;
      document.getElementById("heroAnalysisCount").textContent =
        analysisCount;
      document.getElementById("navBadge").style.display = "inline";
      showNotif(
        "Analisis selesai! " + data.city + " · Risiko " + data.risk_level
      );
    }, 500);
  } catch (err) {
    document.getElementById("loadingPanel").style.display = "none";
    document.getElementById("resultPanel").style.display = "block";
    document.getElementById("responseText").textContent =
      "Error: " +
      err.message +
      "\n\nPastikan API keys sudah dikonfigurasi di file .env dan server berjalan.";
    document.getElementById("resultPanel").style.display = "block";
    showNotif("Terjadi kesalahan: " + err.message);
  } finally {
    isLoading = false;
    document.getElementById("analyzeBtn").disabled = false;
    document.getElementById("btnText").textContent =
      "Jalankan Analisis Multi-Agent";
  }
}

function renderResult(data) {
  lastResult = data;
  try {
    if (data.city) localStorage.setItem("eco_last_city", data.city);
  } catch(e) {}
  const m = data.metrics || {};

  // Update prakiraan cuaca sesuai kota yang dianalisis
  if (data.city && typeof loadWeatherForCity === "function") {
    setTimeout(() => loadWeatherForCity(data.city), 1000);
  }

  // Render forecast langsung dari data analisis (tidak perlu fetch ulang)
  if (data.forecast && data.forecast.length > 0) {
    const resultGrid  = document.getElementById("resultForecastGrid");
    const resultLabel = document.getElementById("result-forecast-label");
    const resultWrap  = document.getElementById("resultForecastWrap");
    if (resultGrid && resultWrap) {
      resultGrid.innerHTML = data.forecast.slice(0,5).map((d, i) => {
        const dt = new Date(d.date);
        const lbl = i === 0 ? "Hari Ini" : dt.toLocaleDateString("id-ID", { weekday: "short" });
        const rain = parseFloat(d.precipitation) || 0;
        const icon = rain > 15 ? "⛈️" : rain > 5 ? "🌧️" : rain > 1 ? "🌤️" : "☀️";
        return `<div class="fc-day${i===0?" today":""}">
          <div class="fc-date">${lbl}</div>
          <div class="fc-icon">${icon}</div>
          <div class="fc-max">${d.temp_max ?? "—"}°</div>
          <div class="fc-min">${d.temp_min ?? "—"}°</div>
          <div class="fc-rain">${rain}mm</div>
        </div>`;
      }).join("");
      if (resultLabel) resultLabel.textContent = data.city + " — 5 hari ke depan";
      resultWrap.style.display = "block";
    }
  }

  // Result header
  document.getElementById("resultCity").textContent =
    data.city + ", " + (data.metrics?.country || "");
  document.getElementById("resultTime").textContent =
    new Date().toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const riskEl = document.getElementById("riskBadge");
  const riskMap = {
    rendah: "badge-green",
    sedang: "badge-amber",
    tinggi: "badge-red",
    kritis: "badge-red",
  };
  riskEl.className =
    "risk-badge " + (riskMap[data.risk_level] || "badge-amber");
  riskEl.textContent = "Risiko " + (data.risk_level || "Sedang");

  // Render laporan sebagai bubble cards per section
  const rawText = (data.response || "—")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/#{1,6}\s/g, "")
    .trim();

  const sections = [
    { key: "KONDISI SAAT INI",  emoji: "🌍", color: "var(--green-d)", bg: "var(--green-l)",  border: "var(--green-m)" },
    { key: "PREDIKSI RISIKO",   emoji: "📈", color: "var(--amber)",   bg: "var(--amber-l)",  border: "#fcd34d" },
    { key: "DAMPAK SOSIAL",     emoji: "👥", color: "var(--blue)",    bg: "var(--blue-l)",   border: "#93c5fd" },
    { key: "CATATAN ETIKA",     emoji: "🛡️", color: "var(--teal)",    bg: "var(--teal-l)",   border: "#5eead4" },
    { key: "RENCANA AKSI",      emoji: "✅", color: "#7c3aed",        bg: "var(--surface2)", border: "var(--border2)" },
  ];

  // Parse teks jadi sections
  function parseSections(text) {
    const result = {};
    const lines = text.split("\n");
    let current = null;
    let buf = [];
    for (const line of lines) {
      const trimmed = line.trim();
      const found = sections.find(s => trimmed.toUpperCase().includes(s.key));
      if (found) {
        if (current) result[current] = buf.join("\n").trim();
        current = found.key;
        buf = [];
      } else if (current) {
        buf.push(line);
      }
    }
    if (current) result[current] = buf.join("\n").trim();
    return result;
  }

  const parsed = parseSections(rawText);
  const hasAny = Object.keys(parsed).length > 0;

  if (hasAny) {
    const bubbles = sections.map(s => {
      const content = parsed[s.key] || "";
      if (!content) return "";
      // Format rencana aksi jadi list
      let body = content;
      if (s.key === "RENCANA AKSI") {
        const items = content.split(/\n(?=\d+\.)/).filter(Boolean);
        if (items.length > 1) {
          body = items.map(item => {
            const clean = item.replace(/^\d+\.\s*/, "").trim();
            return `<div style="display:flex;gap:8px;margin-bottom:6px;align-items:flex-start">
              <span style="color:${s.color};font-weight:700;flex-shrink:0">→</span>
              <span>${clean}</span>
            </div>`;
          }).join("");
        }
      }
      return `<div style="
        background:${s.bg};
        border:1.5px solid ${s.border};
        border-radius:12px;
        padding:14px 16px;
        margin-bottom:10px;
      ">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="font-size:1.1rem">${s.emoji}</span>
          <span style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${s.color}">${s.key}</span>
        </div>
        <div style="font-size:0.84rem;line-height:1.7;color:var(--text2)">${body}</div>
      </div>`;
    }).join("");
    document.getElementById("responseText").innerHTML = bubbles;
  } else {
    document.getElementById("responseText").textContent = rawText;
  }

  // Metrics
  const aqi = m.aqi;
  const temp = m.temperature;
  const pm25 = m.pm25;
  const hum = m.humidity;
  document.getElementById("r-aqi").textContent =
    aqi !== "N/A" ? aqi : "—";
  document.getElementById("r-aqi-lbl").textContent = getAqiLabel(aqi);
  document.getElementById("r-temp").textContent =
    temp !== "N/A" ? temp + "°C" : "—";
  document.getElementById("r-weather").textContent =
    m.weather_desc || "—";
  document.getElementById("r-pm25").textContent =
    pm25 !== "N/A" ? pm25 : "—";
  document.getElementById("r-humidity").textContent =
    hum !== "N/A" ? hum + "%" : "—";

  // Update summary page metrics
  document.getElementById("s-aqi").textContent =
    aqi !== "N/A" ? aqi : "—";
  document.getElementById("s-aqi-lbl").textContent = getAqiLabel(aqi);
  document.getElementById("s-temp").textContent =
    temp !== "N/A" ? temp + "°C" : "—";
  document.getElementById("s-temp-lbl").textContent =
    m.weather_desc || "°C";
  document.getElementById("s-risk").textContent = capitalize(
    data.risk_level || "—"
  );
  document.getElementById("s-risk-lbl").textContent =
    "Level risiko lingkungan";
  const socialScore = data.social?.skor_kerentanan_sosial;
  document.getElementById("s-social").textContent =
    socialScore !== undefined ? socialScore : "—";

  // IKL — Indeks Kesehatan Lingkungan
  if (data.ikl && data.ikl.score !== undefined) {
    const ikl = data.ikl;
    const iklEl = document.getElementById("s-ikl");
    const iklLabel = document.getElementById("s-ikl-label");
    const iklBadge = document.getElementById("s-ikl-badge");
    if (iklEl) {
      iklEl.textContent = ikl.score + "/100";
      iklEl.style.color = ikl.color || "var(--green-d)";
    }
    if (iklLabel) iklLabel.textContent = ikl.label + " — skor gabungan";
    if (iklBadge) {
      iklBadge.textContent = ikl.label;
      iklBadge.className = "sc-badge " + (
        ikl.score >= 80 ? "badge-green" :
        ikl.score >= 60 ? "badge-teal" :
        ikl.score >= 40 ? "badge-amber" : "badge-red"
      );
    }
  }

  const badgeEl = document.getElementById("s-aqi-badge");
  const aqiNum = parseInt(aqi);
  if (!isNaN(aqiNum)) {
    if (aqiNum <= 50) {
      badgeEl.className = "sc-badge badge-green";
      badgeEl.textContent = "Baik";
    } else if (aqiNum <= 100) {
      badgeEl.className = "sc-badge badge-amber";
      badgeEl.textContent = "Sedang";
    } else {
      badgeEl.className = "sc-badge badge-red";
      badgeEl.textContent = "Tidak Sehat";
    }
  }
  const riskBadgeEl = document.getElementById("s-risk-badge");
  const riskColorMap = {
    rendah: "badge-green",
    sedang: "badge-amber",
    tinggi: "badge-red",
    kritis: "badge-red",
  };
  riskBadgeEl.className =
    "sc-badge " + (riskColorMap[data.risk_level] || "badge-amber");
  riskBadgeEl.textContent = capitalize(data.risk_level || "—");

  // Monitor metrics
  document.getElementById("m-aqi").textContent =
    aqi !== "N/A" ? aqi : "—";
  document.getElementById("m-aqi-desc").textContent = getAqiLabel(aqi);
  document.getElementById("m-pm25").textContent =
    pm25 !== "N/A" ? pm25 + " μg/m³" : "—";
  document.getElementById("m-temp").textContent =
    temp !== "N/A" ? temp + "°C" : "—";
  document.getElementById("m-temp-desc").textContent =
    m.weather_desc || "—";
  document.getElementById("m-humidity").textContent =
    hum !== "N/A" ? hum + "%" : "—";
  document.getElementById("m-wind").textContent =
    m.wind_speed !== "N/A" ? m.wind_speed + " m/s" : "—";
  document.getElementById("m-pollutant").textContent =
    m.dominant_pollutant || "—";

  // Tambah nilai konsentrasi di deskripsi polutan dominan
  const pollDesc = document.querySelector("#monitorGrid .monitor-card:last-child .mc-desc");
  if (pollDesc && m.dominant_pollutant) {
    const pollVal = m.dominant_pollutant === "pm25" ? (m.pm25 !== "N/A" ? m.pm25 + " μg/m³" : "") :
                    m.dominant_pollutant === "pm10" ? "" :
                    m.dominant_pollutant === "o3"   ? "" : "";
    pollDesc.textContent = pollVal ? `Konsentrasi: ${pollVal} — Senyawa paling berbahaya` : "Senyawa paling berbahaya";
  }

  // Progress bars pemantauan
  const aqiPct = !isNaN(aqiNum) ? Math.min((aqiNum / 300) * 100, 100) : 0;
  const pm25Num = parseFloat(pm25);
  const pm25Pct = !isNaN(pm25Num)
    ? Math.min((pm25Num / 75) * 100, 100)
    : 0;
  const tempNum = parseFloat(temp);
  const tempPct = !isNaN(tempNum)
    ? Math.min(((tempNum - 15) / 25) * 100, 100)
    : 0;
  const humNum = parseFloat(hum);
  const humPct = !isNaN(humNum) ? humNum : 0;
  document.getElementById("m-aqi-bar").style.width = aqiPct + "%";
  document.getElementById("m-aqi-bar").className =
    "progress-fill " +
    (aqiPct < 33
      ? "fill-green"
      : aqiPct < 66
      ? "fill-amber"
      : "fill-red");
  document.getElementById("m-pm25-bar").style.width = pm25Pct + "%";
  document.getElementById("m-temp-bar").style.width =
    Math.max(0, tempPct) + "%";
  document.getElementById("m-humidity-bar").style.width = humPct + "%";

  // Wind speed progress bar dengan warna
  const windNum = parseFloat(m.wind_speed);
  if (!isNaN(windNum)) {
    const windPct = Math.min((windNum / 30) * 100, 100); // max 30 m/s
    const windBar = document.getElementById("m-wind-bar");
    const windVal = document.getElementById("m-wind");
    if (windBar) {
      windBar.style.width = windPct + "%";
      windBar.className = "progress-fill " + (
        windNum >= 20 ? "fill-red" :
        windNum >= 10 ? "fill-amber" :
        "fill-teal"
      );
    }
    if (windVal) {
      windVal.style.color = (
        windNum >= 20 ? "var(--red)" :
        windNum >= 10 ? "var(--amber)" :
        "var(--teal)"
      );
    }
  }

  // Simpan raw data untuk modal detail
  storeAgentRaw(data);

  // Agent insights
  renderMonitorInsight(data.monitor || {});
  renderPredictInsight(data.predict || {});
  renderSocialInsight(data.social || {});
  renderEthicsInsight(data.ethics || {});

  // Sources / referensi resmi
  if (data.sources && data.sources.length > 0) {
    const sourcesEl = document.getElementById("responseSources");
    sourcesEl.innerHTML = data.sources.map(s =>
      `<a class="src-tag src-link" href="${s.url}" target="_blank" title="${s.desc}">${s.name}</a>`
    ).join("");
    renderSourcesPanel(data.sources);
  }

  // Forecast
  if (data.forecast && data.forecast.length > 0) {
    renderForecast(data.forecast, data.city);
  }

  // Rencana aksi
  if (data.actions && data.actions.length > 0) {
    renderAksiTerstruktur(data.actions, data.city);
  } else {
    renderAksi(data.monitor || {}, data.predict || {}, data.social || {}, data.city);
  }

  // Notifikasi & download
  renderNotifications(data.notifications || {}, data.report_file || "", data.city);

  // Inject skor sosial jika belum ada (dari teks agen)
  if (data.social && data.social.skor_kerentanan_sosial === undefined) {
    const rawSoc = data.social.dampak || data.social.raw || "";
    const mSoc = rawSoc.match(/[Ss]kor[^\d]*(\d{1,3})|(\d{1,3})\s*\/\s*100/);
    data.social.skor_kerentanan_sosial = mSoc ? parseInt(mSoc[1] || mSoc[2]) : 0;
  }

  // Kemajuan
  updateKemajuan(data);

  // History di ringkasan
  renderHistory(data);

  document.getElementById("resultPanel").style.display = "block";

  // Peta
  if (data.coordinates && data.coordinates.lat && data.coordinates.lon) {
    showMapForLocation(
      data.coordinates.lat,
      data.coordinates.lon,
      data.city,
      data.risk_level,
      data.metrics
    );
  }
  // Groq panel
  if (data.groq && Object.keys(data.groq).length > 0) {
    renderGroqPanel(data.groq);
  }
  // Sources panel
  if (data.sources && data.sources.length > 0) {
    renderSourcesPanel(data.sources);
  }
  // Update response-sources chips
  if (data.sources) {
    const srcDiv = document.querySelector(".response-sources");
    if (srcDiv) {
      srcDiv.innerHTML = data.sources
        .map(
          (s) =>
            `<span class="src-tag" title="${s.type}">${
              s.name.split(" (")[0]
            }</span>`
        )
        .join("");
    }
  }
}

// ── MAP ──────────────────────────────────────────────────────────────
let ecoMap = null,
  ecoMarker = null;
function initMap() {
  if (ecoMap) return;
  ecoMap = L.map("ecoMap").setView([-6.2, 106.8], 10);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
    maxZoom: 18,
  }).addTo(ecoMap);
}
function showMapForLocation(lat, lon, cityName, riskLevel, metrics) {
  const panel = document.getElementById("mapPanel");
  if (!panel) return;
  panel.style.display = "block";
  initMap();
  ecoMap.setView([lat, lon], 11);
  if (ecoMarker) {
    ecoMarker.remove();
    ecoMarker = null;
  }
  const riskColors = {
    rendah: "#22c55e",
    sedang: "#f59e0b",
    tinggi: "#ef4444",
    kritis: "#7c3aed",
  };
  const color = riskColors[riskLevel] || "#6b7280";
  const icon = L.divIcon({
    className: "",
    html: `<div style="background:${color};width:42px;height:42px;border-radius:50%;border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font-size:18px;">🌿</div>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
  });
  const aqi = metrics?.aqi ?? "N/A";
  const temp = metrics?.temperature ?? "N/A";
  const hum = metrics?.humidity ?? "N/A";
  const comfort = metrics?.groq_comfort_index ?? null;
  ecoMarker = L.marker([lat, lon], { icon }).addTo(ecoMap);
  ecoMarker
    .bindPopup(
      `
    <div style="font-family:sans-serif;min-width:190px;padding:4px 0">
      <b style="font-size:13px">📍 ${cityName}</b><br/>
      <span style="color:${color};font-weight:700;font-size:11px;text-transform:uppercase">● Risiko: ${riskLevel}</span>
      <hr style="margin:6px 0;border-color:#e5e7eb"/>
      <table style="font-size:11px;width:100%;border-collapse:collapse">
        <tr><td style="padding:2px 0;color:#6b7280">💨 AQI</td><td style="font-weight:600">${aqi}</td></tr>
        <tr><td style="padding:2px 0;color:#6b7280">🌡️ Suhu</td><td style="font-weight:600">${temp}°C</td></tr>
        <tr><td style="padding:2px 0;color:#6b7280">💧 Kelembaban</td><td style="font-weight:600">${hum}%</td></tr>
        ${
          comfort !== null
            ? `<tr><td style="padding:2px 0;color:#6b7280">😊 Kenyamanan</td><td style="font-weight:600">${comfort}/100</td></tr>`
            : ""
        }
      </table>
    </div>`
    )
    .openPopup();
  // Fix map render in initially hidden container
  setTimeout(() => ecoMap.invalidateSize(), 150);
  // Update subtitle
  document.getElementById(
    "mapSubtitle"
  ).textContent = `${cityName} · ${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
  const rb = document.getElementById("mapRiskBadge");
  const riskBadgeMap = {
    rendah: "badge-green",
    sedang: "badge-amber",
    tinggi: "badge-red",
    kritis: "badge-red",
  };
  rb.className = "sc-badge " + (riskBadgeMap[riskLevel] || "badge-amber");
  rb.textContent = "Risiko " + riskLevel;
}

// ── GROQ PANEL ───────────────────────────────────────────────────────
function renderGroqPanel(groq) {
  const panel = document.getElementById("groqPanel");
  if (!panel) return;
  const ci = groq.indeks_kenyamanan ?? null;
  const ciColor = ci >= 70 ? "#16a34a" : ci >= 40 ? "#d97706" : "#dc2626";
  const ciBorder =
    ci >= 70 ? "#22c55e" : ci >= 40 ? "#f59e0b" : "#ef4444";
  let html = "";
  if (ci !== null) {
    html += `<div style="display:flex;align-items:center;gap:10px;grid-column:1/-1">
      <div class="comfort-ring" style="color:${ciColor};border-color:${ciBorder}">${ci}</div>
      <div><div style="font-size:0.75rem;font-weight:600;color:var(--text)">Indeks Kenyamanan</div>
      <div style="font-size:0.7rem;color:var(--text3)">${
        ci >= 70 ? "Nyaman" : "Kurang nyaman untuk aktivitas luar"
      }</div></div>
    </div>`;
  }
  if (groq.risiko_cuaca_ekstrem)
    html += `<div><span style="font-size:0.68rem;color:var(--text3)">Risiko Cuaca Ekstrem</span><br/><strong>${groq.risiko_cuaca_ekstrem}</strong></div>`;
  if (groq.trend_suhu || groq.risiko_angin_kencang)
    html += `<div><span style="font-size:0.68rem;color:var(--text3)">Angin Kencang</span><br/><strong>${
      groq.risiko_angin_kencang || "—"
    }</strong></div>`;
  if (groq.saran_aktivitas_luar)
    html += `<div style="grid-column:1/-1"><span style="font-size:0.68rem;color:var(--text3)">Saran Aktivitas Luar</span><br/>${groq.saran_aktivitas_luar}</div>`;
  if (groq.analisis_kondisi_saat_ini)
    html += `<div style="grid-column:1/-1"><span style="font-size:0.68rem;color:var(--text3)">Kondisi Saat Ini</span><br/>${groq.analisis_kondisi_saat_ini}</div>`;
  if (groq.peringatan_khusus)
    html += `<div class="groq-warn">⚠️ <strong>Peringatan:</strong> ${groq.peringatan_khusus}</div>`;
  document.getElementById("groqBody").innerHTML =
    html || '<div style="color:var(--text3)">Tidak ada data Groq</div>';
  panel.style.display = "block";
}

// ── SOURCES PANEL ────────────────────────────────────────────────────
function renderSourcesPanel(sources) {
  const grid = document.getElementById("sourcesGrid");
  const panel = document.getElementById("sourcesPanel");
  if (!grid || !panel) return;
  const typeIcons = {
    "Cuaca Resmi Indonesia": "🏛️",
    "Kualitas Udara": "💨",
    "Cuaca Real-time": "⛅",
    "Prakiraan 7 Hari": "📅",
    "Sensor Udara": "🔬",
    "Data Sosial": "👥",
    Geocoding: "🗺️",
    "Analisis AI Cuaca": "🤖",
  };
  grid.innerHTML = sources
    .map((s) => {
      const isBMKG = s.name.includes("BMKG");
      const isUnavail = s.name.includes("tidak tersedia");
      return `<a href="${s.url}" target="_blank" rel="noopener"
      class="src-pill${isBMKG && !isUnavail ? " bmkg" : ""}"
      title="${s.type}${
        isUnavail ? " — tidak tersedia untuk wilayah ini" : ""
      }"
      style="${isUnavail ? "opacity:0.5;" : ""}">
      ${typeIcons[s.type] || "🔗"} ${s.name.replace(
        " (tidak tersedia untuk wilayah ini)",
        ""
      )}
    </a>`;
    })
    .join("");
  panel.style.display = "block";
}

function renderMonitorInsight(m) {
  const temuan = (m.temuan_utama || []).slice(0, 3);
  const recs = (m.rekomendasi_segera || []).slice(0, 2);
  let html = "";
  if (m.ringkasan)
    html += `<div style="margin-bottom:8px">${m.ringkasan}</div>`;
  if (temuan.length)
    html +=
      '<div class="ic-tags">' +
      temuan.map((t) => `<span class="ic-tag">${t}</span>`).join("") +
      "</div>";
  if (recs.length)
    html +=
      '<div style="margin-top:8px;font-weight:600;font-size:0.72rem;color:var(--text)">Aksi Segera:</div><div class="ic-tags">' +
      recs.map((r) => `<span class="ic-tag">${r}</span>`).join("") +
      "</div>";
  document.getElementById("monitorInsight").innerHTML = html || "—";
}

function renderPredictInsight(p) {
  let html = "";
  if (p.skor_risiko_iklim !== undefined)
    html += `<div style="margin-bottom:6px">Skor Risiko Iklim: <strong style="font-family:var(--mono);font-size:1rem;color:var(--amber)">${p.skor_risiko_iklim}/100</strong></div>`;
  if (p.risiko_banjir)
    html += `<div>Banjir: <strong>${p.risiko_banjir}</strong></div>`;
  if (p.risiko_kekeringan)
    html += `<div>Kekeringan: <strong>${p.risiko_kekeringan}</strong></div>`;
  if (p.prediksi_mingguan)
    html += `<div style="margin-top:8px">${p.prediksi_mingguan}</div>`;
  document.getElementById("predictInsight").innerHTML = html || "—";
}

function renderSocialInsight(s) {
  let html = "";
  if (s.skor_kerentanan_sosial !== undefined)
    html += `<div style="margin-bottom:6px">Kerentanan Sosial: <strong style="font-family:var(--mono);font-size:1rem;color:var(--blue)">${s.skor_kerentanan_sosial}/100</strong></div>`;
  const k = (s.kelompok_paling_terdampak || s.kelompok_rentan || []).slice(0, 3);
  if (k.length)
    html += '<div class="ic-tags">' + k.map((x) => `<span class="ic-tag">${x}</span>`).join("") + "</div>";
  const dampak = s.ringkasan_sosial || s.dampak || s.raw || "";
  if (dampak) html += `<div style="margin-top:8px">${dampak.slice(0,300)}</div>`;
  document.getElementById("socialInsight").innerHTML = html || "—";
}

function renderEthicsInsight(e) {
  const el = document.getElementById("ethicsInsight");
  if (!el) return;
  let html = "";
  const skor = e.skor_etika || e.ethics_score;
  const catatan = e.catatan_etika || e.catatan || e.raw || "";
  const temuan = e.temuan || e.findings || [];
  if (skor !== undefined)
    html += `<div style="margin-bottom:6px">Skor Etika: <strong style="font-family:var(--mono);font-size:1rem;color:var(--green-d)">${skor}/100</strong></div>`;
  if (temuan.length)
    html += '<div class="ic-tags" style="margin-bottom:6px">' + temuan.slice(0,3).map((t) => `<span class="ic-tag">${t}</span>`).join("") + "</div>";
  if (catatan) html += `<div style="font-size:0.78rem;color:var(--text2)">${catatan.slice(0,300)}</div>`;
  el.innerHTML = html || "—";
}

function renderForecast(days, city) {
  document.getElementById("forecast-city-label").textContent =
    city + " — 5 hari ke depan";
  const icons = ["☀️", "🌤️", "⛅", "🌧️", "⛈️", "🌫️", "🌡️"];
  const grid = document.getElementById("forecastGrid");
  grid.innerHTML = days
    .slice(0, 5)
    .map((d, i) => {
      const dt = new Date(d.date);
      const label =
        i === 0
          ? "Hari Ini"
          : dt.toLocaleDateString("id-ID", { weekday: "short" });
      const rain = parseFloat(d.precipitation) || 0;
      const icon = rain > 10 ? "🌧️" : rain > 3 ? "🌤️" : "☀️";
      return `<div class="fc-day${
        i === 0 ? " today" : ""
      }" onclick="showNotif('${label}: ${d.temp_max}°/${
        d.temp_min
      }° · ${rain}mm hujan')">
<div class="fc-date">${label}</div>
<div class="fc-icon">${icon}</div>
<div class="fc-max">${d.temp_max ?? "—"}°</div>
<div class="fc-min">${d.temp_min ?? "—"}°</div>
<div class="fc-rain">${rain}mm</div>
    </div>`;
    })
    .join("");
}

function renderAksi(monitor, predict, social, city) {
  const recs = [
    ...(monitor.rekomendasi_segera || []),
    ...(social.rekomendasi_inklusif || []),
    ...(predict.hari_terbaik_aktivitas_luar
      ? ["Aktivitas luar: " + predict.hari_terbaik_aktivitas_luar]
      : []),
    ...(social.program_prioritas || []),
  ].slice(0, 8);

  if (recs.length === 0) return;
  aksiTotal = recs.length;
  aksiChecked = 0;

  const colors = [
    "badge-red",
    "badge-amber",
    "badge-teal",
    "badge-blue",
    "badge-green",
  ];
  const tags = [
    "Kritis",
    "Prioritas",
    "Sosial",
    "Lingkungan",
    "Jangka Panjang",
  ];

  document.getElementById(
    "aksiSub"
  ).textContent = `Berdasarkan analisis ${city} — klik untuk menandai selesai`;
  document.getElementById("aksiCount").textContent =
    recs.length + " Aksi";

  document.getElementById("aksiList").innerHTML = recs
    .map(
      (rec, i) => `
    <div class="aksi-item" id="aksi-${i}">
<div class="aksi-num" style="background:var(--green-l);color:var(--green-d)">${
  i + 1
}</div>
<div class="aksi-content">
  <div class="aksi-title">${rec}</div>
  <div class="aksi-meta">
    <span class="aksi-tag ${colors[i % colors.length]}">${
        tags[i % tags.length]
      }</span>
  </div>
</div>
<div class="aksi-check" id="check-${i}" onclick="toggleAksi(${i})"></div>
    </div>
  `
    )
    .join("");

  updateKemajuanAksi();
}

function toggleAksi(i) {
  const el = document.getElementById("check-" + i);
  const item = document.getElementById("aksi-" + i);
  if (el.classList.contains("checked")) {
    el.classList.remove("checked");
    el.textContent = "";
    item.style.opacity = "1";
    aksiChecked = Math.max(0, aksiChecked - 1);
  } else {
    el.classList.add("checked");
    el.textContent = "✓";
    item.style.opacity = "0.6";
    aksiChecked++;
  }
  updateKemajuanAksi();
  showNotif(
    "Rencana aksi " +
      (el.classList.contains("checked") ? "selesai!" : "dibatalkan")
  );
}

function updateKemajuanAksi() {
  const pct =
    aksiTotal > 0 ? Math.round((aksiChecked / aksiTotal) * 100) : 0;
  document.getElementById("kj-aksi-pct").textContent = pct + "%";
  document.getElementById("kj-aksi-fill").style.width = pct + "%";
  document.getElementById("kj-aksi-meta").textContent =
    aksiChecked + " dari " + aksiTotal + " aksi selesai.";
}

function updateKemajuan(data) {
  const m = data.metrics || {};
  const aqi = parseInt(m.aqi) || 0;
  const aqiScore = aqi > 0 ? Math.max(0, 100 - Math.round(aqi / 3)) : 0;
  document.getElementById("kj-aqi-pct").textContent = aqiScore + "%";
  document.getElementById("kj-aqi-fill").style.width = aqiScore + "%";
  document.getElementById(
    "kj-aqi-meta"
  ).textContent = `AQI ${aqi} — ${getAqiLabel(
    aqi
  )}. Semakin rendah AQI, semakin baik.`;

  const riskScore =
    { rendah: 80, sedang: 50, tinggi: 25, kritis: 10 }[data.risk_level] ||
    50;
  document.getElementById("kj-risk-pct").textContent =
    100 - riskScore + "%";
  document.getElementById("kj-risk-fill").style.width =
    100 - riskScore + "%";
  document.getElementById(
    "kj-risk-meta"
  ).textContent = `Tingkat risiko: ${data.risk_level}. Skor semakin tinggi berarti risiko semakin besar.`;

  const soc = data.social?.skor_kerentanan_sosial || 0;
  document.getElementById("kj-social-pct").textContent = soc + "%";
  document.getElementById("kj-social-fill").style.width = soc + "%";
  document.getElementById(
    "kj-social-meta"
  ).textContent = `Skor kerentanan sosial ${soc}/100. Semakin tinggi berarti semakin rentan.`;

  document.getElementById("kj-total-pct").textContent = analysisCount + 1;
  document.getElementById("kj-total-fill").style.width =
    Math.min((analysisCount + 1) * 10, 100) + "%";
  document.getElementById("kj-total-meta").textContent =
    analysisCount +
    1 +
    " analisis dilakukan. Kota terakhir: " +
    data.city;
}

function renderHistory(data) {
  const container = document.getElementById("historyCards");
  const existing = container.querySelectorAll(".history-entry");
  const riskColorMap = {
    rendah: "badge-green",
    sedang: "badge-amber",
    tinggi: "badge-red",
    kritis: "badge-red",
  };
  const card = document.createElement("div");
  card.className = "history-entry";
  card.style.cssText =
    "padding:14px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:8px;cursor:pointer;transition:all 0.15s;";
  card.onmouseover = () => (card.style.borderColor = "var(--border2)");
  card.onmouseout = () => (card.style.borderColor = "var(--border)");
  card.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
<div style="font-size:0.82rem;font-weight:600;color:var(--text)">${
  data.city
}</div>
<span class="sc-badge ${
  riskColorMap[data.risk_level] || "badge-amber"
}" style="margin:0">Risiko ${data.risk_level}</span>
    </div>
    <div style="font-size:0.75rem;color:var(--text2);margin-bottom:2px">${document
.getElementById("queryInput")
.value.slice(0, 80)}...</div>
    <div style="font-size:0.68rem;color:var(--text3);font-family:var(--mono)">${new Date().toLocaleString(
"id-ID"
    )}</div>
  `;
  if (container.querySelector(".empty-state")) container.innerHTML = "";
  container.prepend(card);
}

function getAqiLabel(aqi) {
  const n = parseInt(aqi);
  if (isNaN(n)) return "Belum ada data";
  if (n <= 50) return "Baik";
  if (n <= 100) return "Sedang";
  if (n <= 150) return "Tidak Sehat (Sensitif)";
  if (n <= 200) return "Tidak Sehat";
  if (n <= 300) return "Sangat Tidak Sehat";
  return "Berbahaya";
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "—";
}

// Health check
fetch("/api/health")
  .then((r) => {
    if (r.ok) showNotif("EcoGuardian AI siap digunakan");
  })
  .catch(() => {});


/* EcoGuardian AI — app.js */

// Raw output penuh dari backend — diisi saat renderResult dipanggil
const _agentRaw = { monitor: "", predict: "", social: "", ethics: "" };

// Strip markdown dan potong teks di akhir kalimat
function clean(text, maxLen = 200) {
  if (!text) return "";
  let t = text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/#{1,6}\s/g, "")
    .replace(/\n+/g, " ")
    .trim();
  if (t.length <= maxLen) return t;
  const cut = t.slice(0, maxLen);
  const lastDot = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return lastDot > maxLen * 0.5 ? cut.slice(0, lastDot + 1) : cut.slice(0, cut.lastIndexOf(" ")) + "…";
}

function extractFullText(obj) {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  return Object.values(obj)
    .filter(v => typeof v === "string" && v.length > 3)
    .join("\n\n");
}

// ── Insight Renderers ────────────────────────────────────────────────────

function renderMonitorInsight(m) {
  const el = document.getElementById("monitorInsight");
  if (!el) return;
  const status    = clean(m.status_udara || m.status || "", 80);
  const ringkasan = clean(m.ringkasan || m.raw || m.summary || "", 220);
  const recs      = m.rekomendasi || m.rekomendasi_segera || [];
  el.innerHTML = [
    status    ? `<div style="margin-bottom:4px"><strong>Status:</strong> ${status}</div>` : "",
    ringkasan ? `<div style="margin-bottom:6px;line-height:1.6;color:var(--text2)">${ringkasan}</div>` : "",
    recs.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px">${recs.slice(0,2).map(r=>`<span class="ic-tag">${clean(r,80)}</span>`).join("")}</div>` : "",
  ].join("") || "—";
}

function renderPredictInsight(p) {
  const el = document.getElementById("predictInsight");
  if (!el) return;
  const banjir   = clean(p.risiko_banjir || "", 30);
  const polusi   = clean(p.risiko_polusi || "", 30);
  const prediksi = clean(p.prediksi || p.raw || "", 220);
  const saran    = p.saran || [];
  const riskColor = (v) => v === "tinggi" ? "var(--red)" : v === "sedang" ? "var(--amber)" : "var(--green-d)";
  el.innerHTML = [
    banjir  ? `<div style="margin-bottom:3px">🌊 Banjir: <strong style="color:${riskColor(banjir)}">${banjir}</strong></div>` : "",
    polusi  ? `<div style="margin-bottom:6px">💨 Polusi: <strong style="color:${riskColor(polusi)}">${polusi}</strong></div>` : "",
    prediksi ? `<div style="margin-bottom:6px;line-height:1.6;color:var(--text2)">${prediksi}</div>` : "",
    saran.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px">${saran.slice(0,2).map(s=>`<span class="ic-tag">${clean(s,80)}</span>`).join("")}</div>` : "",
  ].join("") || "—";
}

function renderSocialInsight(s) {
  const el = document.getElementById("socialInsight");
  if (!el) return;
  const skor     = s.skor_kerentanan_sosial;
  const level    = clean(s.kerentanan_sosial || "", 40);
  const kelompok = s.kelompok_rentan || s.kelompok_paling_terdampak || [];
  const dampak   = clean(s.dampak || s.raw || "", 220);
  el.innerHTML = [
    skor !== undefined
      ? `<div style="margin-bottom:4px">Kerentanan: <strong style="color:var(--amber)">${skor}/100</strong></div>`
      : level ? `<div style="margin-bottom:4px">Kerentanan: <strong>${level}</strong></div>` : "",
    dampak ? `<div style="margin-bottom:6px;line-height:1.6;color:var(--text2)">${dampak}</div>` : "",
    kelompok.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px">${kelompok.slice(0,3).map(k=>`<span class="ic-tag">${clean(k,50)}</span>`).join("")}</div>` : "",
  ].join("") || "—";
}

function renderEthicsInsight(e) {
  const el = document.getElementById("ethicsInsight");
  if (!el) return;
  const skor    = e.skor_etika || e.ethics_score;
  const catatan = clean(e.catatan_etika || e.catatan || e.raw || "", 220);
  const temuan  = e.temuan || e.findings || [];
  const color   = skor >= 80 ? "var(--green-d)" : skor >= 60 ? "var(--amber)" : "var(--red)";
  el.innerHTML = [
    skor !== undefined ? `<div style="margin-bottom:4px">Skor Etika: <strong style="color:${color}">${skor}/100</strong></div>` : "",
    temuan.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px">${temuan.slice(0,3).map(t=>`<span class="ic-tag">${clean(t,60)}</span>`).join("")}</div>` : "",
    catatan ? `<div style="line-height:1.6;color:var(--text2)">${catatan}</div>` : "",
  ].join("") || "—";
}

// ── Rencana Aksi Terstruktur ─────────────────────────────────────────────

// Simpan aksi lengkap untuk modal
let _aksiData = [];

function renderAksiTerstruktur(actions, city) {
  const list = document.getElementById("aksiList");
  const sub  = document.getElementById("aksiSub");
  const cnt  = document.getElementById("aksiCount");
  if (!list || !actions || actions.length === 0) return;

  _aksiData = actions;

  const prioConfig = {
    tinggi:  { color: "badge-red",   icon: "🔴", label: "Tinggi" },
    sedang:  { color: "badge-amber", icon: "🟡", label: "Sedang" },
    rendah:  { color: "badge-green", icon: "🟢", label: "Rendah" },
  };

  if (sub) sub.textContent = `Rencana aksi untuk ${city} — klik untuk detail, ✓ untuk tandai selesai`;
  if (cnt) cnt.textContent = actions.length + " Aksi";

  list.innerHTML = actions.map((a, i) => {
    const prio = prioConfig[a.prioritas] || prioConfig.sedang;
    // Tampilkan aksi singkat — potong di akhir kata
    const aksiShort = a.aksi.length > 80
      ? a.aksi.slice(0, 80).replace(/\s\S+$/, '') + '…'
      : a.aksi;
    return `
    <div class="aksi-item" id="aksi-${i}" onclick="openAksiModal(${i})" style="cursor:pointer">
      <div class="aksi-num" style="background:var(--green-l);color:var(--green-d)">${i + 1}</div>
      <div class="aksi-content">
        <div class="aksi-title">${aksiShort}</div>
        <div class="aksi-meta" style="margin-top:6px">
          <span class="aksi-tag ${prio.color}">${prio.icon} ${prio.label}</span>
          <span class="aksi-tag badge-blue">👤 ${a.pelaku.length > 30 ? a.pelaku.slice(0,30)+'…' : a.pelaku}</span>
        </div>
        <div style="font-size:0.68rem;color:var(--text3);margin-top:4px">🔍 Klik untuk detail lengkap</div>
      </div>
      <div class="aksi-check" id="check-${i}" onclick="event.stopPropagation();toggleAksi(${i})" title="Tandai selesai"></div>
    </div>`;
  }).join("");

  if (typeof updateKemajuanAksi === "function") updateKemajuanAksi();
}

function openAksiModal(i) {
  const a = _aksiData[i];
  if (!a) return;
  const prioLabel = { tinggi: "🔴 Tinggi", sedang: "🟡 Sedang", rendah: "🟢 Rendah" }[a.prioritas] || "🟡 Sedang";
  document.getElementById("modalTitle").textContent = `Rencana Aksi ${i + 1}`;
  document.getElementById("modalDot").style.background = a.prioritas === "tinggi" ? "var(--red)" : a.prioritas === "rendah" ? "var(--green-d)" : "var(--amber)";
  document.getElementById("modalBody").innerHTML = `
    <div style="margin-bottom:12px">
      <div style="font-size:0.7rem;color:#7a967a;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Prioritas</div>
      <div style="font-weight:600">${prioLabel}</div>
    </div>
    <div style="margin-bottom:12px">
      <div style="font-size:0.7rem;color:#7a967a;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Pelaku</div>
      <div style="font-weight:600">👤 ${a.pelaku}</div>
    </div>
    <div style="margin-bottom:12px">
      <div style="font-size:0.7rem;color:#7a967a;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Rencana Aksi</div>
      <div style="line-height:1.7">${a.aksi}</div>
    </div>
    <div style="padding-top:12px;border-top:1px solid #e2e8e2">
      <div style="font-size:0.7rem;color:#7a967a;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Dampak yang Diharapkan</div>
      <div style="line-height:1.7;color:#4a6a4a">📊 ${a.dampak}</div>
    </div>
  `;
  const modal = document.getElementById("agentModal");
  modal.style.display = "flex";
}

// ── Download Laporan ─────────────────────────────────────────────────────

function renderNotifications(notifications, reportFile, city) {
  let panel = document.getElementById("notifPanel");
  if (!panel) {
    const sources = document.getElementById("responseSources");
    if (!sources) return;
    panel = document.createElement("div");
    panel.id = "notifPanel";
    panel.style.cssText = "margin-top:12px";
    sources.parentNode.insertBefore(panel, sources.nextSibling);
  }
  if (!reportFile) { panel.innerHTML = ""; return; }
  panel.innerHTML = `
    <a href="/api/download-report?file=${encodeURIComponent(reportFile)}"
       download
       style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;
              background:var(--green-l);color:var(--green-d);border:1.5px solid var(--green-m);
              border-radius:8px;font-size:0.8rem;font-weight:600;text-decoration:none;transition:all 0.2s"
       onmouseover="this.style.background='var(--green-m)'"
       onmouseout="this.style.background='var(--green-l)'">
      📄 Unduh Laporan ${city}
    </a>
    <button onclick="exportToPDF()"
      style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;
             background:var(--blue-l);color:var(--blue);border:1.5px solid #93c5fd;
             border-radius:8px;font-size:0.8rem;font-weight:600;cursor:pointer;transition:all 0.2s"
      onmouseover="this.style.background='#bfdbfe'"
      onmouseout="this.style.background='var(--blue-l)'">
      🖨️ Export PDF
    </button>`;
}

// ── Agent Detail Modal ───────────────────────────────────────────────────

const _agentConfig = {
  monitor: { title: "Monitor Agent",  color: "var(--teal)",  emoji: "🌫️" },
  predict: { title: "Predict Agent",  color: "var(--amber)", emoji: "📈" },
  social:  { title: "Social Agent",   color: "var(--blue)",  emoji: "👥" },
  ethics:  { title: "Ethics Auditor", color: "var(--green)", emoji: "🛡️" },
};

// Dipanggil dari renderResult di index.html — simpan raw data sebelum diproses
function storeAgentRaw(data) {
  // Simpan teks penuh tanpa dipotong untuk modal detail
  function fullText(obj) {
    if (!obj) return "";
    if (typeof obj === "string") return obj.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").trim();
    return Object.values(obj)
      .filter(v => typeof v === "string" && v.length > 3)
      .join("\n\n")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .trim();
  }
  _agentRaw.monitor = fullText(data.monitor);
  _agentRaw.predict = fullText(data.predict);
  _agentRaw.social  = fullText(data.social);
  _agentRaw.ethics  = fullText(data.ethics);
}

function openAgentModal(key) {
  const cfg  = _agentConfig[key];
  const raw  = _agentRaw[key];
  const card = document.getElementById(key === "ethics" ? "ethicsInsight" : key + "Insight");
  const text = raw || (card ? card.innerText : "") || "Data belum tersedia.";
  const cleaned = text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/#{1,6}\s/g, "")
    .trim();
  document.getElementById("modalTitle").textContent = cfg.emoji + " " + cfg.title;
  document.getElementById("modalDot").style.background = cfg.color;
  document.getElementById("modalBody").textContent = cleaned;
  const modal = document.getElementById("agentModal");
  modal.style.display = "flex";
}

function closeAgentModal(e) {
  if (e.target.id === "agentModal") {
    document.getElementById("agentModal").style.display = "none";
  }
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const m = document.getElementById("agentModal");
    if (m) m.style.display = "none";
  }
});

// ── Fix updateKemajuan & aksiTotal ──────────────────────────────────────

// Patch renderAksiTerstruktur agar sync aksiTotal setelah render
const _origRenderAksiTerstruktur = renderAksiTerstruktur;
renderAksiTerstruktur = function(actions, city) {
  _origRenderAksiTerstruktur(actions, city);
  if (typeof aksiTotal !== "undefined") {
    aksiTotal = actions ? actions.length : 0;
    aksiChecked = 0;
    if (typeof updateKemajuanAksi === "function") updateKemajuanAksi();
  }
};

// Inject skor sosial ke data sebelum updateKemajuan dipanggil
// Dipanggil dari storeAgentRaw yang sudah ada di atas
const _origStoreAgentRaw = storeAgentRaw;
storeAgentRaw = function(data) {
  _origStoreAgentRaw(data);
  // Ekstrak skor sosial dari teks jika belum ada
  if (data.social && data.social.skor_kerentanan_sosial === undefined) {
    const raw = data.social.dampak || data.social.raw || "";
    const match = raw.match(/[Ss]kor[^\d]*(\d{1,3})|(\d{1,3})\s*\/\s*100/);
    data.social.skor_kerentanan_sosial = match ? parseInt(match[1] || match[2]) : 0;
  }
};

// ── Auto Weather Forecast ────────────────────────────────────────────────

window.loadWeatherForCity = async function loadWeatherForCity(city) {
  if (!city || city.length < 2) return;
  const grid  = document.getElementById("forecastGrid");
  const label = document.getElementById("forecast-city-label");
  if (!grid) return;

  if (label) label.textContent = city + " — memuat...";
  grid.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3);font-size:0.78rem;width:100%">⏳ Memuat data ' + city + '...</div>';

  const inp = document.getElementById("weatherCityInput");
  if (inp && inp.value !== city) inp.value = city;

  try {
    const res  = await fetch(`/api/weather/${encodeURIComponent(city)}`);
    const data = await res.json();

    if (data.forecast && data.forecast.length > 0) {
      const forecastHtml = data.forecast.slice(0,5).map((d, i) => {
        const dt = new Date(d.date);
        const lbl = i === 0 ? "Hari Ini" : dt.toLocaleDateString("id-ID", { weekday: "short" });
        const rain = parseFloat(d.precipitation) || 0;
        const icon = rain > 15 ? "⛈️" : rain > 5 ? "🌧️" : rain > 1 ? "🌤️" : "☀️";
        return `<div class="fc-day${i===0?" today":""}">
          <div class="fc-date">${lbl}</div>
          <div class="fc-icon">${icon}</div>
          <div class="fc-max">${d.temp_max ?? "—"}°</div>
          <div class="fc-min">${d.temp_min ?? "—"}°</div>
          <div class="fc-rain">${rain}mm</div>
        </div>`;
      }).join("");

      grid.innerHTML = forecastHtml;
      if (label) label.textContent = city + " — 5 hari ke depan";

      // Juga render di result panel (halaman Analisis)
      const resultGrid = document.getElementById("resultForecastGrid");
      const resultLabel = document.getElementById("result-forecast-label");
      const resultWrap = document.getElementById("resultForecastWrap");
      if (resultGrid) {
        resultGrid.innerHTML = forecastHtml;
        if (resultLabel) resultLabel.textContent = city + " — 5 hari ke depan";
        if (resultWrap) resultWrap.style.display = "block";
      }
    } else {
      grid.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text3);font-size:0.78rem;width:100%">⚠️ Data tidak tersedia untuk "${city}". Coba nama kota lain.</div>`;
      if (label) label.textContent = city + " — data tidak tersedia";
    }

    const w  = data.weather  || {};
    const aq = data.air_quality || {};
    if (w.temperature && document.getElementById("s-temp")) {
      document.getElementById("s-temp").textContent = w.temperature + "°C";
      document.getElementById("s-temp-lbl").textContent = w.description || "°C";
    }
    if (aq.aqi && document.getElementById("s-aqi")) {
      document.getElementById("s-aqi").textContent = aq.aqi;
      if (typeof getAqiLabel === "function")
        document.getElementById("s-aqi-lbl").textContent = getAqiLabel(aq.aqi);
    }

    // Weather Map dengan OWM tile layers
    if (data.coords && data.coords.lat && typeof L !== "undefined") {
      const mapWrap = document.getElementById("weatherMapWrap");
      if (mapWrap) {
        mapWrap.style.display = "block";
        window._weatherData = data;
        // Pastikan key sudah ada
        if (!window._owmKey) {
          try {
            const kr = await fetch("/api/owm-key");
            const kd = await kr.json();
            if (kd.key) window._owmKey = kd.key;
          } catch(e) {}
        }
        initWeatherMap(data.coords.lat, data.coords.lon, city, w, aq);
      }
    }

  } catch (err) {
    grid.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text3);font-size:0.78rem;width:100%">❌ Gagal memuat data. Periksa koneksi internet.</div>`;
  }
};

// Auto-load saat enterDashboard dipanggil — sudah diintegrasikan langsung di enterDashboard()

function enterDashboard() {
  const landing = document.getElementById('eco-landing');
  const dash    = document.getElementById('eco-dashboard');
  if (!landing || !dash) return;
  landing.classList.add('hide');
  setTimeout(() => {
    landing.style.display = 'none';
    dash.style.display = 'block';
    document.querySelectorAll('.kpi, .stat-card').forEach((c, i) => {
      setTimeout(() => c.classList.add('on'), 80 + i * 100);
    });
    // Auto-load cuaca saat masuk dashboard
    const savedCity = localStorage.getItem('eco_last_city') || 'Jakarta';
    setTimeout(() => loadWeatherForCity(savedCity), 300);
  }, 1000);
}
// ── Dark / Light Mode ────────────────────────────────────────────────────

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const btn = document.getElementById("themeToggle");
  if (btn) btn.textContent = theme === "dark" ? "☀️" : "🌙";
  localStorage.setItem("eco_theme", theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  applyTheme(current === "dark" ? "light" : "dark");
}

// Apply saved theme on load
document.addEventListener("DOMContentLoaded", function() {
  const saved = localStorage.getItem("eco_theme") || "light";
  applyTheme(saved);
});

// ── Weather Map dengan OWM Tile Layers ───────────────────────────────────

const OWM_LAYERS = {
  precipitation_new: {
    label: "Curah Hujan",
    legend: [
      { color: "#40a0ff", label: "< 0.1 mm/h" },
      { color: "#2070d0", label: "0.1–1 mm/h" },
      { color: "#1040a0", label: "1–10 mm/h" },
      { color: "#800080", label: "> 10 mm/h (lebat)" },
    ],
    note: "Merah/ungu = risiko banjir tinggi"
  },
  clouds_new: {
    label: "Tutupan Awan",
    legend: [
      { color: "#f7fbff", label: "Cerah (0–25%)" },
      { color: "#9ecae1", label: "Berawan (25–75%)" },
      { color: "#2171b5", label: "Mendung (75–100%)" },
    ],
    note: ""
  },
  temp_new: {
    label: "Suhu Udara",
    legend: [
      { color: "#4040ff", label: "< 10°C" },
      { color: "#40c0ff", label: "10–20°C" },
      { color: "#40ff40", label: "20–25°C" },
      { color: "#ffff00", label: "25–30°C" },
      { color: "#ff8000", label: "30–35°C" },
      { color: "#ff0000", label: "> 35°C" },
    ],
    note: ""
  },
  wind_new: {
    label: "Kecepatan Angin",
    legend: [
      { color: "#ffffd4", label: "< 5 m/s" },
      { color: "#fed98e", label: "5–15 m/s" },
      { color: "#fe9929", label: "15–25 m/s" },
      { color: "#993404", label: "> 25 m/s (kencang)" },
    ],
    note: "Coklat tua = angin kencang berbahaya"
  },
  pressure_new: {
    label: "Tekanan Udara",
    legend: [
      { color: "#ff4040", label: "< 980 hPa (rendah)" },
      { color: "#ffff40", label: "980–1010 hPa" },
      { color: "#40ff40", label: "1010–1030 hPa" },
      { color: "#4040ff", label: "> 1030 hPa (tinggi)" },
    ],
    note: "Tekanan rendah = potensi hujan/badai"
  },
};

let _currentWeatherLayer = null;
let _currentLayerName = "precipitation_new";

function initWeatherMap(lat, lon, city, w, aq) {
  if (!window._weatherMap) {
    window._weatherMap = L.map("weatherMap", {
      zoomControl: true,
      attributionControl: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 13, opacity: 0.75,
    }).addTo(window._weatherMap);
  }

  window._weatherMap.setView([lat, lon], 9);

  // Hapus semua layer kecuali base tile
  window._weatherMap.eachLayer(l => {
    if (!(l instanceof L.TileLayer)) window._weatherMap.removeLayer(l);
  });

  // Coba OWM tile layer dulu
  const owmKey = window._owmKey || "";
  if (owmKey) {
    _currentWeatherLayer = L.tileLayer(
      `https://tile.openweathermap.org/map/${_currentLayerName}/{z}/{x}/{y}.png?appid=${owmKey}`,
      { maxZoom: 13, opacity: 0.85, zIndex: 10 }
    ).addTo(window._weatherMap);
  }

  // Overlay data sendiri berdasarkan data cuaca nyata
  const forecast = (window._weatherData || {}).forecast || [];
  const rain = forecast.length > 0 ? parseFloat(forecast[0].precipitation) || 0 : 0;
  const temp = parseFloat((w || {}).temperature) || 0;
  const aqiNum = parseInt((aq || {}).aqi) || 0;

  // Warna berdasarkan layer aktif
  let circleColor, circleOpacity, radius;
  if (_currentLayerName === "precipitation_new") {
    circleColor = rain > 15 ? "#7c3aed" : rain > 5 ? "#2563eb" : rain > 1 ? "#60a5fa" : "#bfdbfe";
    circleOpacity = Math.min(0.5 + rain * 0.02, 0.85);
    radius = 15000 + rain * 2000;
  } else if (_currentLayerName === "temp_new") {
    circleColor = temp > 35 ? "#dc2626" : temp > 30 ? "#f97316" : temp > 25 ? "#fbbf24" : temp > 20 ? "#4ade80" : "#60a5fa";
    circleOpacity = 0.55;
    radius = 18000;
  } else if (_currentLayerName === "clouds_new") {
    const clouds = (w || {}).clouds || 50;
    circleColor = clouds > 75 ? "#2171b5" : clouds > 25 ? "#9ecae1" : "#deebf7";
    circleOpacity = 0.45;
    radius = 18000;
  } else if (_currentLayerName === "wind_new") {
    const wind = parseFloat((w || {}).wind_speed) || 0;
    circleColor = wind > 20 ? "#993404" : wind > 10 ? "#d95f0e" : wind > 5 ? "#fe9929" : "#fed98e";
    circleOpacity = 0.5;
    radius = 16000 + wind * 500;
  } else {
    circleColor = aqiNum > 150 ? "#dc2626" : aqiNum > 100 ? "#f59e0b" : "#22c55e";
    circleOpacity = 0.45;
    radius = 18000;
  }

  // Ring tebal — fill transparan agar peta tetap keliatan, border solid tebal
  L.circle([lat, lon], {
    radius: 12000,
    color: circleColor,
    fillColor: circleColor,
    fillOpacity: 0.08,
    weight: 6,
    opacity: 1,
  }).addTo(window._weatherMap);

  // Ring luar — border saja, tidak ada fill
  L.circle([lat, lon], {
    radius: 20000,
    color: circleColor,
    fillColor: "transparent",
    fillOpacity: 0,
    weight: 3,
    opacity: 0.7,
    dashArray: "8,5",
  }).addTo(window._weatherMap);

  // Ring terdalam — kecil solid
  L.circle([lat, lon], {
    radius: 5000,
    color: circleColor,
    fillColor: circleColor,
    fillOpacity: 0.25,
    weight: 4,
    opacity: 1,
  }).addTo(window._weatherMap);

    // City marker
  const pinColor = aqiNum > 150 ? "#ef4444" : aqiNum > 100 ? "#f59e0b" : "#22c55e";
  const icon = L.divIcon({
    className: "",
    html: `<div style="background:${pinColor};width:40px;height:40px;border-radius:50%;border:3px solid white;
           box-shadow:0 2px 10px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:16px;z-index:999">🌿</div>`,
    iconSize: [40, 40], iconAnchor: [20, 20],
  });
  const tmpStr = (w || {}).temperature || "N/A";
  const desc = (w || {}).description || "";
  L.marker([lat, lon], { icon })
    .addTo(window._weatherMap)
    .bindPopup(`<div style="font-family:sans-serif;min-width:160px;padding:4px">
      <b>📍 ${city}</b><br>
      🌡️ ${tmpStr}°C | 💨 AQI: ${(aq||{}).aqi || "N/A"}<br>
      🌧️ Hujan: ${rain}mm/h<br>
      ${desc}
    </div>`)
    .openPopup();

  setTimeout(() => window._weatherMap.invalidateSize(), 150);
  updateWeatherLegend(_currentLayerName, { rain, temp, aqiNum, wind: parseFloat((w||{}).wind_speed)||0 });
}

function setWeatherLayer(layerName, btn) {
  document.querySelectorAll(".wmap-btn").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  _currentLayerName = layerName;

  if (!window._weatherMap || !window._weatherData) return;
  const d = window._weatherData;
  const coords = d.coords || {};
  if (coords.lat) {
    initWeatherMap(coords.lat, coords.lon,
      document.getElementById("weatherCityInput")?.value || "",
      d.weather || {}, d.air_quality || {});
  }
}


function updateWeatherLegend(layerName, data) {
  const el = document.getElementById("weatherLegend");
  if (!el) return;
  const info = OWM_LAYERS[layerName];
  if (!info) return;

  // Highlight nilai aktual
  let actualNote = "";
  if (data) {
    if (layerName === "precipitation_new") actualNote = ` | Saat ini: <strong>${data.rain}mm/h</strong>`;
    else if (layerName === "temp_new") actualNote = ` | Saat ini: <strong>${data.temp}°C</strong>`;
    else if (layerName === "wind_new") actualNote = ` | Saat ini: <strong>${data.wind}m/s</strong>`;
    else if (layerName === "clouds_new") actualNote = "";
  }

  const items = info.legend.map(l =>
    `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:10px">
      <span style="width:14px;height:14px;border-radius:3px;background:${l.color};display:inline-block;border:1px solid rgba(0,0,0,.1)"></span>
      ${l.label}
    </span>`
  ).join("");
  el.innerHTML = `<strong>${info.label}:</strong>${actualNote} &nbsp; ${items}${info.note ? `<br><span style="color:var(--amber)">⚠️ ${info.note}</span>` : ""}`;
}

// Fetch OWM key saat startup
(async function loadOwmKey() {
  try {
    const r = await fetch("/api/owm-key");
    const k = await r.json();
    if (k.key) window._owmKey = k.key;
  } catch(e) {}
})();

// ── Indonesia Choropleth Map ─────────────────────────────────────────────

let _indonesiaMap = null;
let _indonesiaGeoLayer = null;
let _indonesiaData = null;
let _indonesiaLayer = "rain";

const RAIN_COLORS = [
  { max: 1,   color: "#ffffcc", label: "< 1mm (Kering)" },
  { max: 5,   color: "#fed976", label: "1–5mm (Ringan)" },
  { max: 15,  color: "#fd8d3c", label: "5–15mm (Sedang)" },
  { max: 30,  color: "#e31a1c", label: "15–30mm (Lebat)" },
  { max: 999, color: "#800026", label: "> 30mm (Sangat Lebat)" },
];
const TEMP_COLORS = [
  { max: 20,  color: "#4575b4", label: "< 20°C" },
  { max: 25,  color: "#74add1", label: "20–25°C" },
  { max: 28,  color: "#fee090", label: "25–28°C" },
  { max: 32,  color: "#f46d43", label: "28–32°C" },
  { max: 999, color: "#a50026", label: "> 32°C" },
];
const WIND_COLORS = [
  { max: 5,   color: "#ffffd4", label: "< 5 m/s" },
  { max: 10,  color: "#fed98e", label: "5–10 m/s" },
  { max: 20,  color: "#fe9929", label: "10–20 m/s" },
  { max: 30,  color: "#d95f0e", label: "20–30 m/s" },
  { max: 999, color: "#993404", label: "> 30 m/s" },
];

function getColorForValue(value, colorScale) {
  for (const c of colorScale) {
    if (value <= c.max) return c.color;
  }
  return colorScale[colorScale.length - 1].color;
}

function getProvinceValue(provinceName, data, layer) {
  if (!data) return null;
  const p = data.find(d => d.province === provinceName);
  if (!p) return null;
  if (layer === "rain") return parseFloat(p.precipitation) || 0;
  if (layer === "temp") return parseFloat(p.temp_max) || 0;
  if (layer === "wind") return parseFloat(p.wind_max) || 0;
  return 0;
}

async function showIndonesiaMap() {
  const wrap = document.getElementById("indonesiaMapWrap");
  const cityWrap = document.getElementById("weatherMapWrap");
  if (!wrap) return;

  wrap.style.display = "block";
  if (cityWrap) cityWrap.style.display = "none";

  // Fetch province weather data
  if (!_indonesiaData) {
    document.getElementById("indonesiaMap").innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666">⏳ Memuat data 34 provinsi...</div>';
    try {
      const res = await fetch("/api/indonesia-weather-map");
      const json = await res.json();
      _indonesiaData = json.provinces;
    } catch(e) {
      document.getElementById("indonesiaMap").innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666">❌ Gagal memuat data</div>';
      return;
    }
  }

  renderIndonesiaMap();
}

function showCityMap() {
  const wrap = document.getElementById("indonesiaMapWrap");
  const cityWrap = document.getElementById("weatherMapWrap");
  if (wrap) wrap.style.display = "none";
  if (cityWrap) cityWrap.style.display = "block";
  setTimeout(() => window._weatherMap && window._weatherMap.invalidateSize(), 100);
}

function setIndonesiaLayer(layer, btn) {
  document.querySelectorAll("#indonesiaMapWrap .wmap-btn").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  _indonesiaLayer = layer;
  renderIndonesiaMap();
}

async function renderIndonesiaMap() {
  const mapEl = document.getElementById("indonesiaMap");
  if (!mapEl) return;

  // Init map
  if (!_indonesiaMap) {
    _indonesiaMap = L.map("indonesiaMap", {
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 10, opacity: 0.3,
    }).addTo(_indonesiaMap);
    _indonesiaMap.setView([-2.5, 118], 4);
  }

  // Remove old GeoJSON layer
  if (_indonesiaGeoLayer) {
    _indonesiaMap.removeLayer(_indonesiaGeoLayer);
    _indonesiaGeoLayer = null;
  }

  // Load GeoJSON provinsi Indonesia
  const colorScale = _indonesiaLayer === "rain" ? RAIN_COLORS :
                     _indonesiaLayer === "temp" ? TEMP_COLORS : WIND_COLORS;

  try {
    const geoRes = await fetch("https://raw.githubusercontent.com/rifani/geojson-political-indonesia/master/IDN_adm_2_province.json");
    if (!geoRes.ok) throw new Error("GeoJSON fetch failed");
    const geoData = await geoRes.json();

    _indonesiaGeoLayer = L.geoJSON(geoData, {
      style: function(feature) {
        const name = feature.properties.NAME_1 || feature.properties.name || feature.properties.PROVINSI || "";
        const val = getProvinceValue(name, _indonesiaData, _indonesiaLayer);
        const color = val !== null ? getColorForValue(val, colorScale) : "#cccccc";
        return {
          fillColor: color,
          fillOpacity: 0.75,
          color: "#333",
          weight: 0.8,
          opacity: 0.8,
        };
      },
      onEachFeature: function(feature, layer) {
        const name = feature.properties.NAME_1 || feature.properties.name || feature.properties.PROVINSI || "";
        const val = getProvinceValue(name, _indonesiaData, _indonesiaLayer);
        const unit = _indonesiaLayer === "rain" ? "mm/h" : _indonesiaLayer === "temp" ? "°C" : "m/s";
        const label = _indonesiaLayer === "rain" ? "Hujan" : _indonesiaLayer === "temp" ? "Suhu Maks" : "Angin Maks";
        const pData = (_indonesiaData || []).find(d => d.province === name);
        layer.bindTooltip(`
          <div style="font-family:sans-serif;font-size:12px;min-width:140px">
            <b>${name}</b><br>
            ${pData ? `📍 ${pData.city}<br>` : ""}
            ${label}: <b>${val !== null ? val + unit : "N/A"}</b>
            ${pData && _indonesiaLayer === "rain" ? `<br>🌡️ ${pData.temp_max || "N/A"}°C` : ""}
          </div>
        `, { sticky: true });
        layer.on("mouseover", function() { this.setStyle({ weight: 2, fillOpacity: 0.9 }); });
        layer.on("mouseout", function() { _indonesiaGeoLayer.resetStyle(this); });
      }
    }).addTo(_indonesiaMap);

    // Fit bounds
    _indonesiaMap.fitBounds(_indonesiaGeoLayer.getBounds(), { padding: [10, 10] });

  } catch(e) {
    // Fallback: tampilkan marker per provinsi
    if (_indonesiaData) {
      _indonesiaData.forEach(p => {
        if (!p.lat || !p.lon) return;
        const val = getProvinceValue(p.province, _indonesiaData, _indonesiaLayer);
        const color = getColorForValue(val || 0, colorScale);
        L.circleMarker([p.lat, p.lon], {
          radius: 10, fillColor: color, color: "#333",
          weight: 1, fillOpacity: 0.85,
        }).addTo(_indonesiaMap)
          .bindTooltip(`<b>${p.province}</b><br>${p.city}: ${val}`, { sticky: true });
      });
    }
  }

  // Update legend
  const legendEl = document.getElementById("indonesiaLegend");
  if (legendEl) {
    const items = colorScale.map(c =>
      `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:10px">
        <span style="width:14px;height:14px;border-radius:2px;background:${c.color};display:inline-block;border:1px solid rgba(0,0,0,.15)"></span>
        ${c.label}
      </span>`
    ).join("");
    const title = _indonesiaLayer === "rain" ? "Curah Hujan" :
                  _indonesiaLayer === "temp" ? "Suhu Maksimum" : "Kecepatan Angin";
    legendEl.innerHTML = `<strong>${title}:</strong> ${items}`;
  }

  setTimeout(() => _indonesiaMap.invalidateSize(), 150);
}

// ── Guardian AI Chat ─────────────────────────────────────────────────────

let _guardianHistory = [];
let _guardianOpen = false;

function toggleGuardian() {
  const panel = document.getElementById("guardianPanel");
  _guardianOpen = !_guardianOpen;
  panel.classList.toggle("open", _guardianOpen);
  if (_guardianOpen) {
    setTimeout(() => document.getElementById("guardianInput")?.focus(), 100);
  }
}

function sendQuick(text) {
  document.getElementById("guardianInput").value = text;
  // Hide quick buttons after first use
  const quick = document.getElementById("guardianQuick");
  if (quick) quick.style.display = "none";
  sendGuardian();
}

async function sendGuardian() {
  const input = document.getElementById("guardianInput");
  const btn   = document.getElementById("guardianSend");
  const msgs  = document.getElementById("guardianMessages");
  if (!input || !msgs) return;

  const message = input.value.trim();
  if (!message) return;

  // Add user message
  input.value = "";
  btn.disabled = true;
  appendGuardianMsg(message, "user");

  // Typing indicator
  const typingId = "g-typing-" + Date.now();
  msgs.innerHTML += `<div class="g-msg typing" id="${typingId}">Guardian sedang mengetik<span class="g-dots">...</span></div>`;
  msgs.scrollTop = msgs.scrollHeight;

  // Get context from last analysis
  const context = lastResult ? (lastResult.response || "").slice(0, 600) : "";

  try {
    const res = await fetch("/api/guardian-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        context,
        history: _guardianHistory,
      }),
    });
    const data = await res.json();

    // Remove typing indicator
    document.getElementById(typingId)?.remove();

    if (data.reply) {
      appendGuardianMsg(data.reply, "guardian");
      _guardianHistory.push({ role: "user", content: message });
      _guardianHistory.push({ role: "assistant", content: data.reply });
      if (_guardianHistory.length > 12) _guardianHistory = _guardianHistory.slice(-12);
    }
  } catch(e) {
    document.getElementById(typingId)?.remove();
    appendGuardianMsg("Maaf, terjadi kesalahan. Coba lagi.", "guardian");
  }

  btn.disabled = false;
  input.focus();
}

function appendGuardianMsg(text, role) {
  const msgs = document.getElementById("guardianMessages");
  if (!msgs) return;
  const clean = text
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  const div = document.createElement("div");
  div.className = "g-msg " + role;
  div.innerHTML = clean;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

// ── Auto-Monitoring (Gap 1: Bertindak otonom menanggapi peristiwa nyata) ──

let _autoMonitorInterval = null;
let _lastAlertCity = "";

async function startAutoMonitor(city) {
  if (_autoMonitorInterval) clearInterval(_autoMonitorInterval);
  _lastAlertCity = city;
  await checkAutoMonitor(city);
  // Cek setiap 30 menit
  _autoMonitorInterval = setInterval(() => checkAutoMonitor(_lastAlertCity), 30 * 60 * 1000);
}

async function checkAutoMonitor(city) {
  if (!city) return;
  try {
    const res  = await fetch(`/api/auto-monitor/${encodeURIComponent(city)}`);
    const data = await res.json();
    if (data.has_alert) {
      showAlertBanner(data);
    }
  } catch(e) {}
}

function showAlertBanner(data) {
  let banner = document.getElementById("alertBanner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "alertBanner";
    banner.style.cssText = `
      position:fixed;top:0;left:0;right:0;z-index:9000;
      padding:12px 20px;display:flex;align-items:center;gap:12px;
      font-size:0.82rem;font-weight:600;font-family:var(--sans);
      animation:slideDown .3s ease;
    `;
    document.body.appendChild(banner);
  }

  const levelColors = {
    kritis: { bg: "#dc2626", text: "#fff", icon: "🚨" },
    tinggi: { bg: "#f59e0b", text: "#fff", icon: "⚠️" },
    sedang: { bg: "#2563eb", text: "#fff", icon: "ℹ️" },
  };
  const cfg = levelColors[data.max_level] || levelColors.sedang;
  const alertTexts = data.alerts.map(a => `${a.type}: ${a.value} — ${a.action}`).join(" | ");

  banner.style.background = cfg.bg;
  banner.style.color = cfg.text;
  banner.innerHTML = `
    <span style="font-size:1.1rem">${cfg.icon}</span>
    <span><strong>ALERT ${data.max_level.toUpperCase()} — ${data.city}:</strong> ${alertTexts}</span>
    <button onclick="document.getElementById('alertBanner').style.display='none'"
      style="margin-left:auto;background:rgba(255,255,255,.2);border:none;color:inherit;
             padding:4px 10px;border-radius:6px;cursor:pointer;font-size:0.78rem">✕ Tutup</button>
  `;
  banner.style.display = "flex";

  // Auto-hide setelah 15 detik untuk level sedang
  if (data.max_level === "sedang") {
    setTimeout(() => { if (banner) banner.style.display = "none"; }, 15000);
  }
}

// Mulai auto-monitor saat masuk dashboard
// Update kota monitor saat analisis selesai
const _origRenderResultAM = renderResult;
renderResult = function(data) {
  _origRenderResultAM(data);
  if (data.city) {
    _lastAlertCity = data.city;
    checkAutoMonitor(data.city);
  }
};

// ── Live Agent Thinking ──────────────────────────────────────────────────

const _thinkingMessages = {
  1: [
    "Sedang memeriksa kualitas udara di kota ini...",
    "Membaca data AQI dan partikel PM2.5 dari sensor terdekat...",
    "Membandingkan kondisi udara dengan standar kesehatan WHO...",
    "Menganalisis suhu, kelembaban, dan kecepatan angin...",
    "Monitor Agent selesai — kondisi lingkungan berhasil dipetakan.",
  ],
  2: [
    "Mengambil prakiraan cuaca 7 hari ke depan...",
    "Menghitung kemungkinan hujan lebat dan risiko banjir...",
    "Menganalisis pola angin dan penyebaran polutan...",
    "Mengevaluasi tingkat kepercayaan prediksi berdasarkan data...",
    "Predict Agent selesai — risiko lingkungan berhasil diprediksi.",
  ],
  3: [
    "Mengambil data sosial dari World Bank...",
    "Menganalisis tingkat kemiskinan dan akses air bersih...",
    "Mengidentifikasi kelompok masyarakat yang paling rentan...",
    "Mengevaluasi ketidaksetaraan akses terhadap sumber daya...",
    "Social Agent selesai — dampak sosial berhasil dinilai.",
  ],
  4: [
    "Memeriksa apakah semua analisis bebas dari bias...",
    "Memvalidasi akurasi data yang digunakan...",
    "Menyusun laporan komprehensif berdasarkan semua temuan...",
    "Merumuskan rencana aksi yang konkret dan terukur...",
    "Laporan final siap — analisis EcoGuardian selesai.",
  ],
};

let _thinkingInterval = null;
let _thinkingStep = 0;
let _thinkingMsgIdx = 0;

function startAgentThinking(stepNum) {
  const box = document.getElementById("agentThinking");
  const text = document.getElementById("thinkingText");
  if (!box || !text) return;

  box.style.display = "block";
  _thinkingStep = stepNum;
  _thinkingMsgIdx = 0;

  const messages = _thinkingMessages[stepNum] || [];
  if (!messages.length) return;

  if (_thinkingInterval) clearInterval(_thinkingInterval);

  function typeMessage(msg, cb) {
    text.style.opacity = "0";
    text.textContent = msg;
    let op = 0;
    const fade = setInterval(() => {
      op += 0.15;
      text.style.opacity = String(Math.min(op, 1));
      if (op >= 1) { clearInterval(fade); setTimeout(cb, 1200); }
    }, 30);
  }

  function showNext() {
    if (_thinkingMsgIdx >= messages.length) return;
    typeMessage(messages[_thinkingMsgIdx++], () => {
      if (_thinkingMsgIdx < messages.length) showNext();
    });
  }
  showNext();
}

// Override runAnalysis steps to show thinking
const _origStepUpdate = window._stepUpdate;
document.addEventListener("DOMContentLoaded", function() {
  // Patch step animation to also show thinking
  const origRunAnalysis = runAnalysis;
  // Already defined, just add thinking overlay
});

// Hook into step transitions
const _origStepsForEach = Array.prototype.forEach;
let _lastStepShown = 0;

// Intercept step card updates
const _stepObserver = new MutationObserver(mutations => {
  mutations.forEach(m => {
    if (m.target.classList.contains("running")) {
      const id = m.target.id;
      const stepNum = parseInt(id.replace("step", ""));
      if (stepNum && stepNum !== _lastStepShown) {
        _lastStepShown = stepNum;
        startAgentThinking(stepNum);
      }
    }
  });
});

document.addEventListener("DOMContentLoaded", () => {
  ["step1","step2","step3","step4"].forEach(id => {
    const el = document.getElementById(id);
    if (el) _stepObserver.observe(el, { attributes: true, attributeFilter: ["class"] });
  });
});


// ── Perbandingan 2 Kota ──────────────────────────────────────────────────

let _compareData = {};

async function compareCity(city2) {
  if (!lastResult) {
    showNotif("Jalankan analisis kota pertama dulu");
    return;
  }
  const city1 = lastResult.city;
  if (!city2 || city2 === city1) return;

  showNotif(`Mengambil data ${city2} untuk perbandingan...`);

  try {
    const res = await fetch(`/api/auto-monitor/${encodeURIComponent(city2)}`);
    const data = await res.json();
    _compareData = { city1: lastResult, city2: data };
    renderComparison();
  } catch(e) {
    showNotif("Gagal mengambil data kota pembanding");
  }
}

function renderComparison() {
  const wrap = document.getElementById("compareWrap");
  if (!wrap || !_compareData.city1 || !_compareData.city2) return;

  const c1 = _compareData.city1;
  const c2 = _compareData.city2;
  const m1 = c1.metrics || {};
  const m2 = c2.metrics || {};

  const rows = [
    { label: "AQI", v1: m1.aqi, v2: c2.metrics?.aqi, unit: "", lower_better: true },
    { label: "Suhu", v1: m1.temperature, v2: c2.metrics?.temperature, unit: "°C", lower_better: false },
    { label: "Kelembaban", v1: m1.humidity, v2: c2.metrics?.humidity, unit: "%", lower_better: false },
    { label: "Angin", v1: m1.wind_speed, v2: c2.metrics?.wind_speed, unit: "m/s", lower_better: false },
  ];

  wrap.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:18px;margin-bottom:14px">
      <div style="font-size:0.82rem;font-weight:600;color:var(--text);margin-bottom:14px">
        ⚖️ Perbandingan: <span style="color:var(--green-d)">${c1.city}</span> vs <span style="color:var(--blue)">${c2.city}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:0.8rem">
        <tr style="color:var(--text3);font-size:0.7rem;text-transform:uppercase;letter-spacing:.06em">
          <td style="padding:6px 0">Metrik</td>
          <td style="padding:6px;text-align:center;color:var(--green-d)">${c1.city}</td>
          <td style="padding:6px;text-align:center;color:var(--blue)">${c2.city}</td>
          <td style="padding:6px;text-align:center">Lebih Baik</td>
        </tr>
        ${rows.map(r => {
          const v1 = parseFloat(r.v1) || 0;
          const v2 = parseFloat(r.v2) || 0;
          const c1wins = r.lower_better ? v1 < v2 : v1 > v2;
          const winner = v1 === v2 ? "—" : (c1wins ? c1.city : c2.city);
          const winColor = c1wins ? "var(--green-d)" : "var(--blue)";
          return `<tr style="border-top:1px solid var(--border)">
            <td style="padding:8px 0;color:var(--text2)">${r.label}</td>
            <td style="padding:8px;text-align:center;font-weight:600;color:var(--green-d)">${r.v1 || "—"}${r.unit}</td>
            <td style="padding:8px;text-align:center;font-weight:600;color:var(--blue)">${r.v2 || "—"}${r.unit}</td>
            <td style="padding:8px;text-align:center;font-weight:700;color:${winColor}">${winner}</td>
          </tr>`;
        }).join("")}
      </table>
    </div>
  `;
  wrap.style.display = "block";
}


// ── Skor Tren ────────────────────────────────────────────────────────────

const _trendHistory = JSON.parse(localStorage.getItem("eco_trend") || "[]");

function updateTrend(data) {
  const entry = {
    city: data.city,
    aqi: data.metrics?.aqi,
    risk: data.risk_level,
    ikl: data.ikl?.score,
    time: new Date().toISOString(),
  };
  _trendHistory.push(entry);
  if (_trendHistory.length > 10) _trendHistory.shift();
  try { localStorage.setItem("eco_trend", JSON.stringify(_trendHistory)); } catch(e) {}
  renderTrend(data.city);
}

function renderTrend(city) {
  const el = document.getElementById("trendWrap");
  if (!el) return;

  const cityData = _trendHistory.filter(d => d.city === city).slice(-5);
  if (cityData.length < 2) { el.style.display = "none"; return; }

  const last = cityData[cityData.length - 1];
  const prev = cityData[cityData.length - 2];
  const aqiDiff = (parseFloat(last.aqi) || 0) - (parseFloat(prev.aqi) || 0);
  const iklDiff = (last.ikl || 0) - (prev.ikl || 0);

  const aqiTrend = aqiDiff > 2 ? "↑ Memburuk" : aqiDiff < -2 ? "↓ Membaik" : "→ Stabil";
  const iklTrend = iklDiff > 2 ? "↑ Membaik" : iklDiff < -2 ? "↓ Memburuk" : "→ Stabil";
  const aqiColor = aqiDiff > 2 ? "var(--red)" : aqiDiff < -2 ? "var(--green-d)" : "var(--text3)";
  const iklColor = iklDiff > 2 ? "var(--green-d)" : iklDiff < -2 ? "var(--red)" : "var(--text3)";

  el.innerHTML = `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px 16px;margin-bottom:14px;display:flex;gap:20px;align-items:center">
      <div style="font-size:0.72rem;font-weight:600;color:var(--text3)">📊 TREN ${city.toUpperCase()}</div>
      <div style="font-size:0.8rem">AQI: <strong style="color:${aqiColor}">${aqiTrend}</strong> (${aqiDiff > 0 ? "+" : ""}${aqiDiff.toFixed(1)})</div>
      <div style="font-size:0.8rem">IKL: <strong style="color:${iklColor}">${iklTrend}</strong> (${iklDiff > 0 ? "+" : ""}${iklDiff.toFixed(0)})</div>
      <div style="font-size:0.7rem;color:var(--text3);margin-left:auto">${cityData.length} analisis tercatat</div>
    </div>
  `;
  el.style.display = "block";
}

// Hook ke renderResult untuk update tren
const _origRenderResultTrend = renderResult;
renderResult = function(data) {
  _origRenderResultTrend(data);
  updateTrend(data);
};

// ── Notifikasi Browser ───────────────────────────────────────────────────

function requestBrowserNotif() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function sendBrowserNotif(title, body, icon) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(title, {
      body: body,
      icon: "/static/favicon.ico",
      badge: "/static/favicon.ico",
    });
  }
}

// Kirim notif saat analisis selesai dengan risiko tinggi/kritis
const _origRenderResultNotif = renderResult;
renderResult = function(data) {
  _origRenderResultNotif(data);
  requestBrowserNotif();
  if (data.risk_level === "tinggi" || data.risk_level === "kritis") {
    sendBrowserNotif(
      `⚠️ EcoGuardian Alert — ${data.city}`,
      `Risiko ${data.risk_level.toUpperCase()} terdeteksi! AQI: ${data.metrics?.aqi || "N/A"}. Segera ambil tindakan.`
    );
  } else if (data.risk_level === "sedang") {
    sendBrowserNotif(
      `ℹ️ EcoGuardian — ${data.city}`,
      `Analisis selesai. Risiko sedang. AQI: ${data.metrics?.aqi || "N/A"}.`
    );
  }
};



// ── Grafik AQI 7 Hari ────────────────────────────────────────────────────

function renderAqiChart(forecast, city) {
  const wrap = document.getElementById("aqiChartWrap");
  if (!wrap || !forecast || forecast.length === 0) return;

  wrap.style.display = "block";

  const days = forecast.slice(0, 7);
  const maxRain = Math.max(...days.map(d => parseFloat(d.precipitation) || 0));
  const maxTemp = Math.max(...days.map(d => parseFloat(d.temp_max) || 0));
  const minTemp = Math.min(...days.map(d => parseFloat(d.temp_min) || 0));

  const labels = days.map((d, i) => {
    if (i === 0) return "Hari Ini";
    const dt = new Date(d.date);
    return dt.toLocaleDateString("id-ID", { weekday: "short" });
  });

  const bars = days.map(d => {
    const rain = parseFloat(d.precipitation) || 0;
    const pct = maxRain > 0 ? (rain / Math.max(maxRain, 30)) * 100 : 0;
    const color = rain > 20 ? "#ef4444" : rain > 10 ? "#f59e0b" : rain > 3 ? "#3b82f6" : "#22c55e";
    return { rain, pct, color, temp_max: d.temp_max, temp_min: d.temp_min, uv: d.uv_index };
  });

  wrap.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:18px;margin-bottom:14px">
      <div style="font-size:0.82rem;font-weight:600;color:var(--text);margin-bottom:4px">📊 Grafik Prakiraan 7 Hari — ${city}</div>
      <div style="font-size:0.7rem;color:var(--text3);margin-bottom:14px">Curah hujan & suhu harian</div>
      <div style="display:flex;gap:6px;align-items:flex-end;height:100px">
        ${bars.map((b, i) => `
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
            <div style="font-size:0.62rem;color:var(--text3);font-family:var(--mono)">${b.temp_max ?? "—"}°</div>
            <div style="width:100%;background:${b.color};border-radius:4px 4px 0 0;height:${Math.max(b.pct, 4)}px;
                        transition:height .5s ease;cursor:pointer;position:relative"
                 title="${labels[i]}: ${b.rain}mm hujan, ${b.temp_max}°/${b.temp_min}°C">
            </div>
            <div style="font-size:0.62rem;color:var(--text3);text-align:center">${labels[i]}</div>
            <div style="font-size:0.6rem;color:var(--blue);font-family:var(--mono)">${b.rain}mm</div>
          </div>
        `).join("")}
      </div>
      <div style="display:flex;gap:12px;margin-top:10px;font-size:0.68rem;color:var(--text3)">
        <span><span style="display:inline-block;width:10px;height:10px;background:#22c55e;border-radius:2px;margin-right:4px"></span>Ringan</span>
        <span><span style="display:inline-block;width:10px;height:10px;background:#3b82f6;border-radius:2px;margin-right:4px"></span>Sedang</span>
        <span><span style="display:inline-block;width:10px;height:10px;background:#f59e0b;border-radius:2px;margin-right:4px"></span>Lebat</span>
        <span><span style="display:inline-block;width:10px;height:10px;background:#ef4444;border-radius:2px;margin-right:4px"></span>Sangat Lebat</span>
      </div>
    </div>
  `;
}

// Hook ke renderResult untuk tampilkan grafik
const _origRenderResultChart = renderResult;
renderResult = function(data) {
  _origRenderResultChart(data);
  if (data.forecast && data.forecast.length > 0) {
    renderAqiChart(data.forecast, data.city);
  }
};

// ── Export PDF ───────────────────────────────────────────────────────────

function exportToPDF() {
  if (!lastResult) {
    showNotif("Jalankan analisis dulu sebelum export PDF");
    return;
  }

  // Buat window print dengan konten laporan
  const city = lastResult.city || "—";
  const risk = lastResult.risk_level || "—";
  const response = (lastResult.response || "—")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br>");
  const m = lastResult.metrics || {};
  const now = new Date().toLocaleDateString("id-ID", { weekday:"long", day:"numeric", month:"long", year:"numeric" });

  const actions = (lastResult.actions || []).map((a, i) =>
    `<tr>
      <td>${i+1}</td>
      <td><span style="background:${a.prioritas==='tinggi'?'#fee2e2':a.prioritas==='sedang'?'#fef3c7':'#dcfce7'};
          color:${a.prioritas==='tinggi'?'#dc2626':a.prioritas==='sedang'?'#d97706':'#16a34a'};
          padding:2px 8px;border-radius:4px;font-size:11px">${a.prioritas?.toUpperCase()}</span></td>
      <td>${a.pelaku}</td>
      <td>${a.aksi}</td>
      <td>${a.dampak}</td>
    </tr>`
  ).join("");

  const printContent = `
    <!DOCTYPE html><html lang="id"><head>
    <meta charset="UTF-8">
    <title>Laporan EcoGuardian — ${city}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #1a2e1a; margin: 40px; font-size: 13px; }
      .header { border-bottom: 3px solid #16a34a; padding-bottom: 16px; margin-bottom: 24px; }
      .logo { font-size: 22px; font-weight: 800; color: #16a34a; }
      .subtitle { color: #7a967a; font-size: 12px; }
      .risk-badge { display: inline-block; padding: 4px 14px; border-radius: 20px; font-weight: 700; font-size: 12px;
        background: ${risk==='kritis'||risk==='tinggi'?'#fee2e2':risk==='sedang'?'#fef3c7':'#dcfce7'};
        color: ${risk==='kritis'||risk==='tinggi'?'#dc2626':risk==='sedang'?'#d97706':'#16a34a'}; }
      .metrics { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin: 20px 0; }
      .metric { background: #f8faf8; border: 1px solid #e2e8e2; border-radius: 8px; padding: 12px; text-align: center; }
      .metric-val { font-size: 20px; font-weight: 700; color: #16a34a; }
      .metric-lbl { font-size: 10px; color: #7a967a; text-transform: uppercase; }
      .section { margin: 20px 0; }
      .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #7a967a; margin-bottom: 8px; }
      .response { line-height: 1.8; color: #4a6a4a; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th { background: #f0f4f0; padding: 8px; text-align: left; font-size: 11px; color: #7a967a; text-transform: uppercase; }
      td { padding: 8px; border-bottom: 1px solid #e2e8e2; font-size: 12px; }
      .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8e2; font-size: 11px; color: #7a967a; text-align: center; }
      @media print { body { margin: 20px; } }
    </style></head><body>
    <div class="header">
      <div class="logo">🌿 EcoGuardian AI</div>
      <div class="subtitle">Sistem Multi-Agent AI untuk Pemantauan Lingkungan dan Dampak Sosial</div>
      <div style="margin-top:12px;display:flex;align-items:center;gap:12px">
        <div><strong>${city}</strong></div>
        <div class="risk-badge">Risiko ${risk.toUpperCase()}</div>
        <div style="color:#7a967a;font-size:12px;margin-left:auto">${now}</div>
      </div>
    </div>

    <div class="metrics">
      <div class="metric"><div class="metric-val">${m.aqi||'—'}</div><div class="metric-lbl">AQI</div></div>
      <div class="metric"><div class="metric-val">${m.temperature||'—'}°C</div><div class="metric-lbl">Suhu</div></div>
      <div class="metric"><div class="metric-val">${m.pm25||'—'}</div><div class="metric-lbl">PM2.5 μg/m³</div></div>
      <div class="metric"><div class="metric-val">${m.humidity||'—'}%</div><div class="metric-lbl">Kelembaban</div></div>
    </div>

    <div class="section">
      <div class="section-title">Laporan Analisis</div>
      <div class="response">${response}</div>
    </div>

    ${actions ? `<div class="section">
      <div class="section-title">Rencana Aksi</div>
      <table><thead><tr><th>#</th><th>Prioritas</th><th>Pelaku</th><th>Aksi</th><th>Dampak</th></tr></thead>
      <tbody>${actions}</tbody></table>
    </div>` : ""}

    <div class="footer">
      Laporan dibuat oleh EcoGuardian AI — Powered by CrewAI + Groq<br>
      Data: WAQI, OpenWeatherMap, Open-Meteo, World Bank, BMKG
    </div>
    </body></html>
  `;

  const win = window.open("", "_blank");
  win.document.write(printContent);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}

// ── Statistik Global & Leaderboard ──────────────────────────────────────

async function loadStats() {
  try {
    const res  = await fetch("/api/stats");
    const data = await res.json();
    if (data.error) return;

    // Update stat cards
    document.getElementById("stat-total").textContent = data.total || 0;
    document.getElementById("stat-kritis").textContent =
      `🔴 ${data.risk_distribution?.kritis||0} kritis  🟠 ${data.risk_distribution?.tinggi||0} tinggi  🟡 ${data.risk_distribution?.sedang||0} sedang  🟢 ${data.risk_distribution?.rendah||0} rendah`;

    // Risiko dominan
    const rd = data.risk_distribution || {};
    const dominantEntry = Object.entries(rd).sort((a,b) => b[1]-a[1])[0];
    const dominantLabel = dominantEntry ? dominantEntry[0] : "sedang";
    const dominantCount = dominantEntry ? dominantEntry[1] : 0;
    const dominantBadgeMap = { rendah:"badge-green", sedang:"badge-amber", tinggi:"badge-red", kritis:"badge-red" };
    const dominantEl = document.getElementById("stat-dominant-risk");
    const dominantBadge = document.getElementById("stat-dominant-risk-badge");
    const dominantSub = document.getElementById("stat-dominant-risk-sub");
    if (dominantEl) dominantEl.textContent = dominantLabel.charAt(0).toUpperCase() + dominantLabel.slice(1);
    if (dominantSub) dominantSub.textContent = `${dominantCount} dari ${data.total} analisis`;
    if (dominantBadge) {
      dominantBadge.className = "sc-badge " + (dominantBadgeMap[dominantLabel] || "badge-amber");
      dominantBadge.textContent = dominantLabel === "rendah" ? "Kondisi Baik" :
                                   dominantLabel === "sedang" ? "Perlu Dipantau" :
                                   dominantLabel === "tinggi" ? "Waspada" : "Bahaya";
    }
    // Badge ringkasan di card distribusi
    const rendahBadge = document.getElementById("stat-rendah");
    if (rendahBadge) {
      const pctSedang = data.total > 0 ? Math.round((rd.sedang||0)/data.total*100) : 0;
      rendahBadge.textContent = `${pctSedang}% sedang`;
      rendahBadge.className = "sc-badge " + (pctSedang >= 50 ? "badge-amber" : "badge-green");
    }

    if (data.top_cities && data.top_cities.length > 0) {
      document.getElementById("stat-top-city").textContent = data.top_cities[0].city;
      document.getElementById("stat-top-city-count").textContent = data.top_cities[0].count + "x dianalisis";
    }

    // Leaderboard
    const lb = document.getElementById("leaderboardList");
    if (lb && data.top_cities) {
      const medals = ["🥇","🥈","🥉","4️⃣","5️⃣"];
      lb.innerHTML = data.top_cities.map((c, i) => `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:1.2rem;width:28px">${medals[i]||"•"}</span>
          <div style="flex:1">
            <div style="font-size:0.84rem;font-weight:600;color:var(--text)">${c.city}</div>
            <div style="font-size:0.7rem;color:var(--text3)">${c.count} analisis</div>
          </div>
          <div style="background:var(--green-l);color:var(--green-d);padding:3px 10px;border-radius:20px;font-size:0.72rem;font-weight:600">
            ${c.count}x
          </div>
        </div>
      `).join("");
    }

    // Distribusi risiko — bar chart sederhana
    const rdChart = document.getElementById("riskDistChart");
    if (rdChart && data.risk_distribution) {
      const total = data.total || 1;
      const items = [
        { label: "Rendah", val: data.risk_distribution.rendah, color: "var(--green)" },
        { label: "Sedang", val: data.risk_distribution.sedang, color: "var(--amber)" },
        { label: "Tinggi", val: data.risk_distribution.tinggi, color: "var(--red)" },
        { label: "Kritis", val: data.risk_distribution.kritis, color: "#7c3aed" },
      ];
      rdChart.innerHTML = items.map(item => {
        const pct = total > 0 ? Math.round((item.val / total) * 100) : 0;
        return `<div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:4px">
            <span style="color:var(--text2)">${item.label}</span>
            <span style="color:var(--text3)">${item.val} (${pct}%)</span>
          </div>
          <div style="background:var(--border);border-radius:4px;height:8px;overflow:hidden">
            <div style="background:${item.color};width:${pct}%;height:100%;border-radius:4px;transition:width 1s ease"></div>
          </div>
        </div>`;
      }).join("");
    }

    // Heatmap jam
    const hm = document.getElementById("heatmapChart");
    if (hm && data.hour_distribution) {
      const maxH = Math.max(...data.hour_distribution, 1);
      const hours = data.hour_distribution;
      hm.innerHTML = `
        <div style="display:flex;gap:2px;align-items:flex-end;height:60px">
          ${hours.map((v, h) => {
            const pct = (v / maxH) * 100;
            const color = v === 0 ? "var(--border)" : v >= maxH * 0.7 ? "var(--green)" : v >= maxH * 0.3 ? "var(--teal)" : "var(--green-l)";
            return `<div style="flex:1;background:${color};height:${Math.max(pct,4)}%;border-radius:2px 2px 0 0;cursor:default"
                       title="${h}:00 — ${v} analisis"></div>`;
          }).join("")}
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.62rem;color:var(--text3);margin-top:4px">
          <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
        </div>
      `;
    }

  } catch(e) {
    console.error("loadStats error:", e);
  }
}

// Auto-load stats saat buka halaman statistik
const _origShowPage = showPage;
showPage = function(name, btn) {
  _origShowPage(name, btn);
  if (name === "statistik") loadStats();
};

// Update pageMeta untuk statistik
if (typeof pageMeta !== "undefined") {
  pageMeta.statistik = ["Statistik Global", "Data analisis dari semua sesi — powered by Supabase"];
}


// ── Share Laporan ────────────────────────────────────────────────────────

async function shareReport() {
  if (!lastResult) {
    showNotif("Jalankan analisis dulu sebelum share");
    return;
  }
  try {
    const res = await fetch("/api/share-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        city: lastResult.city,
        risk_level: lastResult.risk_level,
        response: lastResult.response,
        metrics: lastResult.metrics,
      }),
    });
    const data = await res.json();
    if (data.url) {
      const fullUrl = window.location.origin + data.url;
      // Copy ke clipboard
      try {
        await navigator.clipboard.writeText(fullUrl);
        showNotif("Link berhasil disalin: " + fullUrl);
      } catch(e) {
        showNotif("Link: " + fullUrl);
      }
      // Tampilkan di notif panel
      const panel = document.getElementById("notifPanel");
      if (panel) {
        panel.innerHTML += `
          <div style="margin-top:8px;padding:8px 12px;background:var(--blue-l);border:1px solid #93c5fd;
                      border-radius:8px;font-size:0.78rem;color:var(--blue)">
            🔗 <strong>Link Share:</strong>
            <a href="${fullUrl}" target="_blank" style="color:var(--blue);margin-left:4px">${fullUrl}</a>
          </div>`;
      }
    }
  } catch(e) {
    showNotif("Gagal membuat link share");
  }
}

// Tambah tombol share ke notifPanel
const _origRenderNotifShare = renderNotifications;
renderNotifications = function(notifications, reportFile, city) {
  _origRenderNotifShare(notifications, reportFile, city);
  const panel = document.getElementById("notifPanel");
  if (panel && lastResult) {
    panel.innerHTML += `
      <button onclick="shareReport()"
        style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;margin-top:6px;
               background:var(--teal-l);color:var(--teal);border:1.5px solid #5eead4;
               border-radius:8px;font-size:0.8rem;font-weight:600;cursor:pointer;transition:all 0.2s"
        onmouseover="this.style.background='#99f6e4'"
        onmouseout="this.style.background='var(--teal-l)'">
        🔗 Share Laporan
      </button>`;
  }
};
