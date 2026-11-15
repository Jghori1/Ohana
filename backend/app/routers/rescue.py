from __future__ import annotations

import math
import os
from typing import Any

from fastapi import APIRouter

from ..services import overpass

router = APIRouter()

_EMERGENCY_CONTACT = {
    "who": "Animal in immediate danger or attacking",
    "phone": "911",
}
_SOURCES = [
    {
        "name": "OpenStreetMap contributors",
        "url": "https://www.openstreetmap.org/copyright",
    }
]


def _coordinates(
    latitude: float | None, longitude: float | None
) -> tuple[float, float] | None:
    if latitude is None or longitude is None:
        home_latitude = os.getenv("HOME_LAT")
        home_longitude = os.getenv("HOME_LNG")
        if home_latitude is None or home_longitude is None:
            return None
        latitude, longitude = home_latitude, home_longitude

    try:
        latitude = float(latitude)
        longitude = float(longitude)
    except (TypeError, ValueError):
        return None
    if (
        not math.isfinite(latitude)
        or not math.isfinite(longitude)
        or not -90 <= latitude <= 90
        or not -180 <= longitude <= 180
    ):
        return None
    return latitude, longitude


def _point(element: dict[str, Any]) -> tuple[float, float] | None:
    center = element.get("center")
    coordinates = center if isinstance(center, dict) else element
    try:
        latitude = float(coordinates["lat"])
        longitude = float(coordinates.get("lon", coordinates.get("lng")))
    except (KeyError, TypeError, ValueError):
        return None
    if (
        not math.isfinite(latitude)
        or not math.isfinite(longitude)
        or not -90 <= latitude <= 90
        or not -180 <= longitude <= 180
    ):
        return None
    return latitude, longitude


def _distance_km(
    origin: tuple[float, float], destination: tuple[float, float]
) -> float:
    latitude_1, longitude_1 = map(math.radians, origin)
    latitude_2, longitude_2 = map(math.radians, destination)
    latitude_delta = latitude_2 - latitude_1
    longitude_delta = longitude_2 - longitude_1
    haversine = (
        math.sin(latitude_delta / 2) ** 2
        + math.cos(latitude_1)
        * math.cos(latitude_2)
        * math.sin(longitude_delta / 2) ** 2
    )
    return 6371 * 2 * math.asin(math.sqrt(min(1.0, haversine)))


def _phone(tags: dict[str, Any]) -> str | None:
    for key in ("phone", "contact:phone"):
        value = tags.get(key)
        if isinstance(value, str) and value.strip():
            phone = value.strip()
            if phone.casefold() not in {"n/a", "none"}:
                return phone
    return None


def _emergency_only(region: str) -> dict[str, Any]:
    return {
        "region": region,
        "contacts": [dict(_EMERGENCY_CONTACT)],
        "sources": [dict(source) for source in _SOURCES],
    }


@router.get("/api/rescue-contacts")
def rescue_contacts(
    lat: float | None = None, lng: float | None = None
) -> dict[str, Any]:
    coordinates = _coordinates(lat, lng)
    if coordinates is None:
        return _emergency_only("Your area")

    elements = overpass.search(*coordinates)
    if elements is None:
        return _emergency_only("Somewhere else")

    nearby: list[tuple[float, dict[str, Any], dict[str, Any]]] = []
    for element in elements:
        tags = element.get("tags")
        if not isinstance(tags, dict):
            continue
        amenity = tags.get("amenity")
        if amenity == "animal_shelter":
            label = "animal shelter"
        elif amenity == "veterinary":
            label = "emergency vet"
        else:
            continue

        name = tags.get("name")
        phone = _phone(tags)
        point = _point(element)
        if (
            not isinstance(name, str)
            or not name.strip()
            or phone is None
            or point is None
        ):
            continue
        contact = {"who": f"{name.strip()} ({label})", "phone": phone}
        nearby.append((_distance_km(coordinates, point), contact, tags))

    nearby.sort(key=lambda result: result[0])
    region = "Your area"
    if nearby:
        city = nearby[0][2].get("addr:city")
        if isinstance(city, str) and city.strip():
            region = city.strip()

    contacts = [contact for _, contact, _ in nearby[:6]]
    contacts.append(dict(_EMERGENCY_CONTACT))
    return {
        "region": region,
        "contacts": contacts,
        "sources": [dict(source) for source in _SOURCES],
    }
