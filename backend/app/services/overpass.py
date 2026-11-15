from __future__ import annotations

import logging
import math
import threading
import time
from typing import Any

import httpx


_API_URL = "https://overpass-api.de/api/interpreter"
_USER_AGENT = "PawPatrol/1.0"
_TIMEOUT = 15.0
_CACHE_TTL = 3600.0
_CACHE: dict[tuple[float, float], tuple[float, list[dict[str, Any]]]] = {}
_CACHE_LOCK = threading.Lock()
_LOGGER = logging.getLogger(__name__)


def _coordinate(value: Any, minimum: float, maximum: float) -> float | None:
    try:
        coordinate = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(coordinate) or not minimum <= coordinate <= maximum:
        return None
    return coordinate


def _query(latitude: float, longitude: float) -> str:
    center = f"{latitude:.2f},{longitude:.2f}"
    return (
        "[out:json][timeout:15];"
        "("
        f'nwr["amenity"="animal_shelter"](around:40000,{center});'
        f'nwr["amenity"="veterinary"]["name"~"emergency|24",i]'
        f"(around:40000,{center});"
        f'nwr["amenity"="veterinary"]["opening_hours"="24/7"]'
        f"(around:40000,{center});"
        ");"
        "out center tags;"
    )


def search(latitude: float, longitude: float) -> list[dict[str, Any]] | None:
    latitude = _coordinate(latitude, -90, 90)
    longitude = _coordinate(longitude, -180, 180)
    if latitude is None or longitude is None:
        return None

    cache_key = (round(latitude, 2), round(longitude, 2))
    now = time.monotonic()
    with _CACHE_LOCK:
        cached = _CACHE.get(cache_key)
        if cached is not None and cached[0] > now:
            return [dict(element) for element in cached[1]]
        if cached is not None:
            del _CACHE[cache_key]

    query = _query(*cache_key)
    try:
        response = httpx.post(
            _API_URL,
            data={"data": query},
            timeout=_TIMEOUT,
            headers={"User-Agent": _USER_AGENT},
        )
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        _LOGGER.warning("OpenStreetMap Overpass request failed (%s).", type(exc).__name__)
        return None

    elements = payload.get("elements") if isinstance(payload, dict) else None
    if not isinstance(elements, list):
        _LOGGER.warning("OpenStreetMap Overpass returned an invalid response.")
        return None
    results = [element for element in elements if isinstance(element, dict)]
    with _CACHE_LOCK:
        _CACHE[cache_key] = (time.monotonic() + _CACHE_TTL, results)
    return [dict(element) for element in results]
