"""
EcoGuardian - Environmental Data Tools
Menggunakan API gratis: OpenWeatherMap, WAQI, Open-Meteo, World Bank
"""

import httpx
import os
from typing import Optional

# Koordinat fallback untuk kota-kota umum (jika geocoding gagal)
CITY_COORDS_FALLBACK = {
    "jakarta":      {"lat": -6.2088,  "lon": 106.8456},
    "depok":        {"lat": -6.4025,  "lon": 106.7942},
    "tangerang":    {"lat": -6.1783,  "lon": 106.6319},
    "bekasi":       {"lat": -6.2349,  "lon": 106.9896},
    "bogor":        {"lat": -6.5971,  "lon": 106.8060},
    "bandung":      {"lat": -6.9175,  "lon": 107.6191},
    "surabaya":     {"lat": -7.2575,  "lon": 112.7521},
    "medan":        {"lat":  3.5952,  "lon":  98.6722},
    "semarang":     {"lat": -6.9932,  "lon": 110.4203},
    "makassar":     {"lat": -5.1477,  "lon": 119.4327},
    "yogyakarta":   {"lat": -7.7956,  "lon": 110.3695},
    "palembang":    {"lat": -2.9761,  "lon": 104.7754},
    "pekanbaru":    {"lat":  0.5071,  "lon": 101.4478},
    "balikpapan":   {"lat": -1.2675,  "lon": 116.8289},
    "samarinda":    {"lat": -0.5022,  "lon": 117.1536},
    "pontianak":    {"lat": -0.0263,  "lon": 109.3425},
    "manado":       {"lat":  1.4748,  "lon": 124.8421},
    "denpasar":     {"lat": -8.6705,  "lon": 115.2126},
    "mataram":      {"lat": -8.5833,  "lon": 116.1167},
    "kupang":       {"lat":-10.1772,  "lon": 123.6070},
    "jayapura":     {"lat": -2.5337,  "lon": 140.7181},
    "ambon":        {"lat": -3.6954,  "lon": 128.1814},
    "banjarmasin":  {"lat": -3.3194,  "lon": 114.5908},
    "serang":       {"lat": -6.1201,  "lon": 106.1503},
    "cilegon":      {"lat": -6.0023,  "lon": 106.0052},
    "cirebon":      {"lat": -6.7063,  "lon": 108.5570},
    "malang":       {"lat": -7.9797,  "lon": 112.6304},
    "solo":         {"lat": -7.5755,  "lon": 110.8243},
    "surakarta":    {"lat": -7.5755,  "lon": 110.8243},
    "singapore":    {"lat":  1.3521,  "lon": 103.8198},
    "kuala lumpur": {"lat":  3.1390,  "lon": 101.6869},
    "bangkok":      {"lat": 13.7563,  "lon": 100.5018},
    "tokyo":        {"lat": 35.6762,  "lon": 139.6503},
}


async def get_air_quality(city: str) -> dict:
    """
    Ambil data kualitas udara dari WAQI API (gratis).
    Dokumentasi: https://aqicn.org/json-api/doc/
    """
    token = os.getenv("WAQI_TOKEN", "demo")
    url = f"https://api.waqi.info/feed/{city}/?token={token}"

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            data = resp.json()

        if data.get("status") == "ok":
            d = data["data"]
            iaqi = d.get("iaqi", {})
            return {
                "status": "ok",
                "city": city,
                "aqi": d.get("aqi", "N/A"),
                "pm25": iaqi.get("pm25", {}).get("v", "N/A"),
                "pm10": iaqi.get("pm10", {}).get("v", "N/A"),
                "o3": iaqi.get("o3", {}).get("v", "N/A"),
                "no2": iaqi.get("no2", {}).get("v", "N/A"),
                "co": iaqi.get("co", {}).get("v", "N/A"),
                "temperature": iaqi.get("t", {}).get("v", "N/A"),
                "humidity": iaqi.get("h", {}).get("v", "N/A"),
                "dominant_pollutant": d.get("dominentpol", "N/A"),
                "station": d.get("city", {}).get("name", city),
                "updated_at": d.get("time", {}).get("s", "N/A"),
            }
        else:
            return {"status": "error", "message": data.get("data", "City not found"), "city": city}

    except Exception as e:
        return {"status": "error", "message": str(e), "city": city}


async def get_weather(city: str) -> dict:
    """
    Ambil data cuaca dari OpenWeatherMap API (gratis 1000 calls/day).
    Dokumentasi: https://openweathermap.org/current
    """
    api_key = os.getenv("OPENWEATHER_API_KEY", "")
    if not api_key:
        return {"status": "error", "message": "OPENWEATHER_API_KEY tidak ditemukan"}

    url = "https://api.openweathermap.org/data/2.5/weather"
    params = {"q": city, "appid": api_key, "units": "metric", "lang": "id"}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params=params)
            data = resp.json()

        if data.get("cod") == 200:
            return {
                "status": "ok",
                "city": data["name"],
                "country": data["sys"]["country"],
                "temperature": data["main"]["temp"],
                "feels_like": data["main"]["feels_like"],
                "humidity": data["main"]["humidity"],
                "pressure": data["main"]["pressure"],
                "description": data["weather"][0]["description"],
                "wind_speed": data["wind"]["speed"],
                "visibility": data.get("visibility", "N/A"),
                "clouds": data["clouds"]["all"],
                "uv_index": "N/A",
            }
        else:
            return {"status": "error", "message": data.get("message", "Not found"), "city": city}

    except Exception as e:
        return {"status": "error", "message": str(e), "city": city}


async def get_forecast(lat: float, lon: float) -> dict:
    """
    Ambil prakiraan cuaca 7 hari dari Open-Meteo (100% gratis, tanpa API key).
    Dokumentasi: https://open-meteo.com/en/docs
    """
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,uv_index_max",
        "timezone": "Asia/Jakarta",
        "forecast_days": 7,
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params=params)
            data = resp.json()

        daily = data.get("daily", {})
        forecast_days = []
        dates = daily.get("time", [])

        for i, date in enumerate(dates):
            forecast_days.append({
                "date": date,
                "temp_max": daily.get("temperature_2m_max", [None]*7)[i],
                "temp_min": daily.get("temperature_2m_min", [None]*7)[i],
                "precipitation": daily.get("precipitation_sum", [None]*7)[i],
                "wind_max": daily.get("windspeed_10m_max", [None]*7)[i],
                "uv_index": daily.get("uv_index_max", [None]*7)[i],
            })

        return {"status": "ok", "latitude": lat, "longitude": lon, "forecast": forecast_days}

    except Exception as e:
        return {"status": "error", "message": str(e)}


async def get_social_data(country_code: str) -> dict:
    """
    Ambil data sosial dari World Bank API (100% gratis, tanpa API key).
    Dokumentasi: https://datahelpdesk.worldbank.org/knowledgebase/articles/889392
    Indikator: poverty rate, gini index, access to electricity, internet access
    """
    indicators = {
        "SI.POV.DDAY": "poverty_rate",
        "SI.POV.GINI": "gini_index",
        "EG.ELC.ACCS.ZS": "electricity_access",
        "IT.NET.USER.ZS": "internet_access",
        "SH.STA.BASS.ZS": "basic_sanitation",
        "SH.H2O.BASW.ZS": "clean_water_access",
    }

    results = {"status": "ok", "country": country_code, "data": {}}

    async with httpx.AsyncClient(timeout=15) as client:
        for code, label in indicators.items():
            url = f"https://api.worldbank.org/v2/country/{country_code}/indicator/{code}"
            params = {"format": "json", "mrv": 1, "per_page": 1}
            try:
                resp = await client.get(url, params=params)
                data = resp.json()
                if isinstance(data, list) and len(data) > 1 and data[1]:
                    entry = data[1][0]
                    results["data"][label] = {
                        "value": entry.get("value"),
                        "year": entry.get("date"),
                        "unit": "%",
                    }
                else:
                    results["data"][label] = {"value": None, "year": "N/A", "unit": "%"}
            except Exception:
                results["data"][label] = {"value": None, "year": "N/A", "unit": "%"}

    return results


async def get_earthquake_data() -> dict:
    """
    Ambil data gempa terbaru dari BMKG (100% gratis, tanpa API key).
    Dokumentasi: https://data.bmkg.go.id/gempabumi/
    """
    url = "https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            data = resp.json()
        gempa = data.get("Infogempa", {}).get("gempa", {})
        return {
            "status": "ok",
            "tanggal": gempa.get("Tanggal", "N/A"),
            "jam": gempa.get("Jam", "N/A"),
            "magnitude": gempa.get("Magnitude", "N/A"),
            "kedalaman": gempa.get("Kedalaman", "N/A"),
            "wilayah": gempa.get("Wilayah", "N/A"),
            "potensi": gempa.get("Potensi", "N/A"),
            "koordinat": gempa.get("Coordinates", "N/A"),
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


async def get_city_coordinates(city: str) -> Optional[dict]:
    """
    Geocoding dengan prioritas: fallback hardcoded (akurat) → OpenWeatherMap API.
    """
    # Cek fallback dulu — lebih akurat untuk kota Indonesia
    fallback = CITY_COORDS_FALLBACK.get(city.lower())
    if fallback:
        return fallback

    api_key = os.getenv("OPENWEATHER_API_KEY", "")
    if not api_key:
        return None

    url = "http://api.openweathermap.org/geo/1.0/direct"
    params = {"q": city + ",ID", "limit": 1, "appid": api_key}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params=params)
            data = resp.json()
        if data:
            return {"lat": data[0]["lat"], "lon": data[0]["lon"], "country": data[0].get("country", "")}
        return None
    except Exception:
        return None
