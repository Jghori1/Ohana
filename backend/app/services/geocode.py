from __future__ import annotations

import math
import re
import threading
import time
from collections.abc import Callable
from typing import Any

import httpx


_BASE_URL = "https://nominatim.openstreetmap.org"
_USER_AGENT = "PawPatrol/1.0"
_TIMEOUT = 8.0
_CACHE: dict[tuple[Any, ...], dict[str, Any]] = {}
_REQUEST_LOCK = threading.Lock()
_LAST_REQUEST_AT: float | None = None


def _city(address: dict[str, Any]) -> str | None:
    for key in ("city", "town", "village", "municipality", "hamlet", "locality"):
        value = address.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _state(address: dict[str, Any]) -> str | None:
    value = address.get("state")
    return value.strip() if isinstance(value, str) and value.strip() else None


def _zip_code(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    match = re.fullmatch(r"\s*([0-9]{5})(?:-[0-9]{4})?\s*", value)
    return match.group(1) if match else None


def _parse_reverse(payload: Any) -> dict[str, Any] | None:
    if not isinstance(payload, dict) or not isinstance(payload.get("address"), dict):
        return None
    address = payload["address"]
    zip_code = _zip_code(address.get("postcode"))
    city = _city(address)
    state = _state(address)
    if not zip_code or not city or not state:
        return None
    return {"zip": zip_code, "city": city, "state": state}


def _coordinate(value: Any, minimum: float, maximum: float) -> float | None:
    try:
        coordinate = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(coordinate) or not minimum <= coordinate <= maximum:
        return None
    return coordinate


def _parse_forward(payload: Any) -> dict[str, Any] | None:
    if not isinstance(payload, list):
        return None
    for result in payload:
        if not isinstance(result, dict) or not isinstance(result.get("address"), dict):
            continue
        lat = _coordinate(result.get("lat"), -90, 90)
        lng = _coordinate(result.get("lon"), -180, 180)
        city = _city(result["address"])
        state = _state(result["address"])
        if lat is not None and lng is not None and city and state:
            return {"lat": lat, "lng": lng, "city": city, "state": state}
    return None


def _lookup(
    cache_key: tuple[Any, ...],
    endpoint: str,
    params: dict[str, str | int],
    parse: Callable[[Any], dict[str, Any] | None],
) -> dict[str, Any] | None:
    global _LAST_REQUEST_AT

    with _REQUEST_LOCK:
        cached = _CACHE.get(cache_key)
        if cached is not None:
            return dict(cached)

        try:
            if _LAST_REQUEST_AT is not None:
                delay = 1.0 - (time.monotonic() - _LAST_REQUEST_AT)
                if delay > 0:
                    time.sleep(delay)
            _LAST_REQUEST_AT = time.monotonic()
            response = httpx.get(
                f"{_BASE_URL}/{endpoint}",
                params=params,
                timeout=_TIMEOUT,
                headers={"User-Agent": _USER_AGENT},
            )
            response.raise_for_status()
            result = parse(response.json())
        except Exception:
            _LAST_REQUEST_AT = time.monotonic()
            return None

        if result is None:
            return None
        _CACHE[cache_key] = result
        return dict(result)


def reverse(lat: float, lng: float) -> dict[str, str] | None:
    try:
        latitude = _coordinate(lat, -90, 90)
        longitude = _coordinate(lng, -180, 180)
        if latitude is None or longitude is None:
            return None
        result = _lookup(
            ("reverse", latitude, longitude),
            "reverse",
            {
                "lat": latitude,
                "lon": longitude,
                "format": "jsonv2",
                "addressdetails": 1,
            },
            _parse_reverse,
        )
        return result if result is None else {
            "zip": result["zip"],
            "city": result["city"],
            "state": result["state"],
        }
    except Exception:
        return None


def forward(zip: str) -> dict[str, Any] | None:
    try:
        zip_code = _zip_code(zip)
        if zip_code is None:
            return None
        return _lookup(
            ("forward", zip_code),
            "search",
            {
                "postalcode": zip_code,
                "countrycodes": "us",
                "format": "jsonv2",
                "addressdetails": 1,
            },
            _parse_forward,
        )
    except Exception:
        return None
