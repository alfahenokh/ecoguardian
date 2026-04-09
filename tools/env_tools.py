"""
EcoGuardian - Environmental Data Tools
Menggunakan API gratis: OpenWeatherMap, WAQI, Open-Meteo, World Bank
"""

import httpx
import os
from typing import Optional


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


async def get_city_coordinates(city: str) -> Optional[dict]:
    """
    Geocoding gratis via OpenWeatherMap API.
    """
    api_key = os.getenv("OPENWEATHER_API_KEY", "")
    if not api_key:
        return None

    url = "http://api.openweathermap.org/geo/1.0/direct"
    params = {"q": city, "limit": 1, "appid": api_key}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params=params)
            data = resp.json()
        if data:
            return {"lat": data[0]["lat"], "lon": data[0]["lon"], "country": data[0].get("country", "")}
        return None
    except Exception:
        return None
