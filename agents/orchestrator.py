async def run_ecoguardian_agents(
user_query: str,
city: str = "Jakarta",
country_code: str = "ID",
session_id: str = "default"
) -> dict:
"""
Orkestrasi utama multi-agent EcoGuardian.
Menjalankan 4 agen: Monitor -> Predict -> Social -> Report
"""

try:
    client = init_groq()
except ValueError as e:
    return {
        "success": False,
        "error": str(e),
        "response": "Konfigurasi API tidak lengkap. Pastikan GROQ_API_KEY sudah diatur."
    }

save_message(session_id, "user", user_query)

env_data = await fetch_all_env_data(city, country_code)

# 🔥 fungsi Groq
def call_groq(prompt: str) -> dict:
    try:
        chat = client.chat.completions.create(
            model="llama3-8b-8192",
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        text = chat.choices[0].message.content.strip()

        # parsing JSON
        if text.startswith("{"):
            return json.loads(text)

        start = text.find("{")
        end = text.rfind("}") + 1
        if start != -1 and end > start:
            return json.loads(text[start:end])

        return {"raw": text}

    except Exception as e:
        return {"error": str(e), "raw": ""}

# Monitor
monitor_prompt = build_monitor_agent_prompt(env_data)
monitor_result = call_groq(monitor_prompt)

# Predict
predict_prompt = build_predict_agent_prompt(env_data)
predict_result = call_groq(predict_prompt)

# Social
social_prompt = build_social_agent_prompt(env_data, city)
social_result = call_groq(social_prompt)

# Report
report_prompt = build_report_agent_prompt(
    monitor_result,
    predict_result,
    social_result,
    user_query,
    city
)

try:
    chat = client.chat.completions.create(
        model="llama3-8b-8192",
        messages=[
            {"role": "user", "content": report_prompt}
        ]
    )
    final_text = chat.choices[0].message.content.strip()
except Exception as e:
    final_text = f"Terjadi kesalahan saat membuat laporan: {str(e)}"

# Extract risk level
risk_level = "sedang"
if "RISK_LEVEL:" in final_text:
    lines = final_text.split("\n")
    for line in lines:
        if "RISK_LEVEL:" in line:
            risk_level = line.split("RISK_LEVEL:")[-1].strip().lower()
            final_text = final_text.replace(line, "").strip()
            break

save_message(session_id, "assistant", final_text)
save_analysis(session_id, user_query, city, final_text[:500], risk_level)

aq = env_data.get("air_quality", {})
weather = env_data.get("weather", {})
forecast_data = env_data.get("forecast", {})
forecast_list = (
    forecast_data.get("forecast", [])[:5]
    if forecast_data.get("status") == "ok"
    else []
)

return {
    "success": True,
    "response": final_text,
    "risk_level": risk_level,
    "city": city,
    "metrics": {
        "aqi": aq.get("aqi", "N/A"),
        "pm25": aq.get("pm25", "N/A"),
        "temperature": weather.get("temperature", "N/A"),
        "humidity": weather.get("humidity", "N/A"),
        "wind_speed": weather.get("wind_speed", "N/A"),
        "dominant_pollutant": aq.get("dominant_pollutant", "N/A"),
        "weather_desc": weather.get("description", "N/A"),
    },
    "forecast": forecast_list,
    "monitor": monitor_result,
    "predict": predict_result,
    "social": social_result,
    "history": get_analysis_history(session_id, limit=3),
}