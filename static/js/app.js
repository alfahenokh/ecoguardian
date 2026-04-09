/* EcoGuardian AI — Frontend App */

let sessionId = localStorage.getItem("eco_session") || "";
let isLoading = false;

// Inisialisasi
document.addEventListener("DOMContentLoaded", () => {
  checkHealth();
  document.getElementById("queryInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.ctrlKey) runAnalysis();
  });
});

function setQuery(text) {
  document.getElementById("queryInput").value = text;
  document.getElementById("queryInput").focus();
}

async function checkHealth() {
  try {
    const res = await fetch("/api/health");
    if (res.ok) {
      document.getElementById("statusDot").classList.add("active");
      document.getElementById("statusLabel").textContent =
        "Gemini 2.5 Flash — Online";
    }
  } catch (_) {
    document.getElementById("statusLabel").textContent = "Offline";
  }
}

async function runAnalysis() {
  if (isLoading) return;

  const query = document.getElementById("queryInput").value.trim();
  const citySelect = document.getElementById("citySelect");
  const city = citySelect.value;
  const country = citySelect.selectedOptions[0]?.dataset?.country || "ID";

  if (!query) {
    document.getElementById("queryInput").focus();
    document.getElementById("queryInput").style.borderColor =
      "rgba(248,113,113,0.5)";
    setTimeout(
      () => (document.getElementById("queryInput").style.borderColor = ""),
      1500
    );
    return;
  }

  isLoading = true;
  setButtonLoading(true);
  showLoading();
  hideResponse();

  // Animasi step loading
  const steps = [1, 2, 3, 4];
  const delays = [0, 2000, 4000, 6500];
  steps.forEach((s, i) => {
    setTimeout(() => activateStep(s), delays[i]);
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

    hideLoading();
    renderResult(data);
  } catch (err) {
    hideLoading();
    showError(err.message);
  } finally {
    isLoading = false;
    setButtonLoading(false);
  }
}

function renderResult(data) {
  // Response utama
  document.getElementById("responseCity").textContent = `${
    data.city
  } · ${new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })}`;

  const chip = document.getElementById("riskChip");
  chip.textContent = `Risiko ${data.risk_level}`;
  chip.className = "risk-chip risk-" + (data.risk_level || "sedang");

  document.getElementById("responseBody").textContent = data.response || "—";
  document.getElementById("responseCard").style.display = "block";

  // Metrics
  const m = data.metrics || {};
  renderMetric("aqi", m.aqi, getAqiClass(m.aqi), getAqiLabel(m.aqi));
  renderMetric("pm25", m.pm25 !== "N/A" ? m.pm25 : "—", "", "μg/m³");
  renderMetric(
    "temp",
    m.temperature !== "N/A" ? m.temperature + "°" : "—",
    "",
    m.weather_desc || "°C"
  );
  renderMetric(
    "humidity",
    m.humidity !== "N/A" ? m.humidity + "%" : "—",
    "",
    "Kelembaban"
  );

  // Forecast
  if (data.forecast && data.forecast.length > 0) {
    renderForecast(data.forecast);
    document.getElementById("forecastCard").style.display = "block";
  }

  // Insight cards
  if (data.monitor && !data.monitor.error) renderMonitorInsight(data.monitor);
  if (data.predict && !data.predict.error) renderPredictInsight(data.predict);
  if (data.social && !data.social.error) renderSocialInsight(data.social);

  // History
  if (data.history && data.history.length > 0) renderHistory(data.history);
}

function renderMetric(key, value, cls, sub) {
  const el = document.getElementById("mv-" + key);
  el.textContent = value !== undefined && value !== null ? value : "—";
  if (cls) el.className = "mc-value " + cls;
  const subEl = document.getElementById("ms-" + key);
  if (subEl && sub) subEl.textContent = sub;
}

function getAqiClass(aqi) {
  if (typeof aqi !== "number") return "";
  if (aqi <= 50) return "mc-value aqi-good";
  if (aqi <= 100) return "mc-value";
  return "mc-value aqi-bad";
}

function getAqiLabel(aqi) {
  if (typeof aqi !== "number") return "Indeks Kualitas Udara";
  if (aqi <= 50) return "Baik";
  if (aqi <= 100) return "Sedang";
  if (aqi <= 150) return "Tidak Sehat (sensitif)";
  if (aqi <= 200) return "Tidak Sehat";
  if (aqi <= 300) return "Sangat Tidak Sehat";
  return "Berbahaya";
}

function renderForecast(days) {
  const list = document.getElementById("forecastList");
  list.innerHTML = days
    .slice(0, 5)
    .map((d) => {
      const date = new Date(d.date);
      const label = date.toLocaleDateString("id-ID", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
      return `<div class="forecast-row">
      <span class="forecast-date">${label}</span>
      <span class="forecast-temps">
        <span class="temp-max">${d.temp_max ?? "—"}°</span>
        <span class="temp-min">${d.temp_min ?? "—"}°</span>
      </span>
      <span class="forecast-rain">${d.precipitation ?? 0}mm</span>
    </div>`;
    })
    .join("");
}

function renderMonitorInsight(m) {
  const temuan = (m.temuan_utama || []).slice(0, 3);
  const rec = (m.rekomendasi_segera || []).slice(0, 2);
  document.getElementById("monitorBody").innerHTML = `
    ${
      temuan.length
        ? '<div class="ic-row"><strong>Temuan:</strong></div><div class="ic-tags">' +
          temuan.map((t) => `<span class="ic-tag">${t}</span>`).join("") +
          "</div>"
        : ""
    }
    ${
      rec.length
        ? '<div class="ic-row" style="margin-top:8px"><strong>Aksi segera:</strong></div><div class="ic-tags">' +
          rec.map((r) => `<span class="ic-tag">${r}</span>`).join("") +
          "</div>"
        : ""
    }
    ${
      m.ringkasan
        ? '<div class="ic-row" style="margin-top:8px">' + m.ringkasan + "</div>"
        : ""
    }
  `;
  document.getElementById("monitorInsight").style.display = "block";
}

function renderPredictInsight(p) {
  const score = p.skor_risiko_iklim;
  document.getElementById("predictBody").innerHTML = `
    <div class="ic-row">
      <strong>Skor risiko iklim:</strong>
      <span class="ic-score"> ${score ?? "—"}/100</span>
    </div>
    ${
      p.risiko_banjir
        ? '<div class="ic-row">Banjir: <strong>' +
          p.risiko_banjir +
          "</strong></div>"
        : ""
    }
    ${
      p.hari_terbaik_aktivitas_luar
        ? '<div class="ic-row">Terbaik aktivitas luar: <strong>' +
          p.hari_terbaik_aktivitas_luar +
          "</strong></div>"
        : ""
    }
    ${
      p.prediksi_mingguan
        ? '<div class="ic-row" style="margin-top:6px">' +
          p.prediksi_mingguan +
          "</div>"
        : ""
    }
  `;
  document.getElementById("predictInsight").style.display = "block";
}

function renderSocialInsight(s) {
  const kelompok = (s.kelompok_paling_terdampak || []).slice(0, 3);
  const recs = (s.rekomendasi_inklusif || []).slice(0, 2);
  const skor = s.skor_kerentanan_sosial;
  document.getElementById("socialBody").innerHTML = `
    ${
      skor !== undefined
        ? '<div class="ic-row"><strong>Kerentanan sosial:</strong> <span class="ic-score">' +
          skor +
          "/100</span></div>"
        : ""
    }
    ${
      kelompok.length
        ? '<div class="ic-row" style="margin-top:6px"><strong>Kelompok rentan:</strong></div><div class="ic-tags">' +
          kelompok.map((k) => `<span class="ic-tag">${k}</span>`).join("") +
          "</div>"
        : ""
    }
    ${
      recs.length
        ? '<div class="ic-row" style="margin-top:8px"><strong>Rekomendasi:</strong></div><div class="ic-tags">' +
          recs.map((r) => `<span class="ic-tag">${r}</span>`).join("") +
          "</div>"
        : ""
    }
  `;
  document.getElementById("socialInsight").style.display = "block";
}

function renderHistory(history) {
  const list = document.getElementById("historyList");
  list.innerHTML = history
    .map(
      (h) => `
    <div class="history-item">
      <div class="history-query">${h.query}</div>
      <div class="history-meta">${h.city} · Risiko: ${h.risk_level} · ${
        h.at?.slice(0, 10) || ""
      }</div>
    </div>
  `
    )
    .join("");
  document.getElementById("historyCard").style.display = "block";
}

function activateStep(n) {
  const step = document.getElementById("step" + n);
  if (!step) return;
  // Tandai sebelumnya done
  for (let i = 1; i < n; i++) {
    const prev = document.getElementById("step" + i);
    if (prev) {
      prev.classList.remove("active");
      prev.classList.add("done");
    }
  }
  step.classList.add("active");
}

function showLoading() {
  // Reset steps
  for (let i = 1; i <= 4; i++) {
    const s = document.getElementById("step" + i);
    if (s) s.className = "agent-step";
  }
  document.getElementById("loadingCard").style.display = "block";
}

function hideLoading() {
  document.getElementById("loadingCard").style.display = "none";
}
function hideResponse() {
  document.getElementById("responseCard").style.display = "none";
}

function showError(msg) {
  document.getElementById("responseCity").textContent = "Error";
  document.getElementById("riskChip").textContent = "";
  document.getElementById("riskChip").className = "risk-chip";
  document.getElementById("responseBody").textContent =
    "Terjadi kesalahan: " +
    msg +
    "\n\nPastikan API keys sudah dikonfigurasi di file .env";
  document.getElementById("responseCard").style.display = "block";
}

function setButtonLoading(loading) {
  const btn = document.getElementById("analyzeBtn");
  const txt = document.getElementById("btnText");
  btn.disabled = loading;
  txt.textContent = loading ? "Menganalisis..." : "Jalankan Analisis";
}
