from __future__ import annotations

import os
import random
import re
import secrets
import threading
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Query

from ..core import store
from ..core.search import pet_object, search_pets
from ..services import geocode


router = APIRouter()

_FILTER_VALUES = {
    "species": {
        "dog": "Dog",
        "cat": "Cat",
        "hamster": "Hamster",
        "rabbit": "Rabbit",
        "bird": "Bird",
        "other": "Other",
    },
    "age": {"baby": "Baby", "young": "Young", "adult": "Adult", "senior": "Adult"},
    "size": {
        "small": "Small",
        "medium": "Medium",
        "large": "Large",
        "x-large": "Large",
    },
    "sex": {"female": "Female", "male": "Male", "pair": "Pair"},
}
_FILTER_ORDER = {
    "species": ("Dog", "Cat", "Hamster", "Rabbit", "Bird", "Other"),
    "age": ("Baby", "Young", "Adult"),
    "size": ("Small", "Medium", "Large"),
    "sex": ("Female", "Male", "Pair"),
}
_DETAIL_FIELDS = ("story", "health", "idealHome")
_AREA_STATE_LOCK = threading.RLock()
_AREA_REFRESH_LOCK = threading.Lock()
_SCHEDULED_AREA_REFRESHES: set[str] = set()


def _split_values(value: str | None) -> list[str]:
    if value is None:
        return []
    return [part.strip() for part in value.split(",") if part.strip()]


def _policy_values(policies: Any, policy_name: str) -> list[str]:
    if not isinstance(policies, dict):
        return []
    values = policies.get(policy_name)
    if not isinstance(values, list):
        return []
    return [value for value in values if isinstance(value, str)]


def _area_counts(zip_code: str) -> tuple[int, int]:
    pets = sum(1 for pet in store.list("pets") if pet.get("area") == zip_code)
    shelters = sum(
        1 for shelter in store.list("shelters") if shelter.get("area") == zip_code
    )
    return pets, shelters


def _area_record(zip_code: str) -> dict[str, Any] | None:
    return store.find("areas", zip=zip_code)


def _write_area_record(
    zip_code: str,
    status: str,
    started_at: str | None,
    finished_at: str | None,
    pets: int,
    shelters: int,
) -> None:
    record = {
        "id": zip_code,
        "zip": zip_code,
        "status": status,
        "startedAt": started_at,
        "finishedAt": finished_at,
        "pets": pets,
        "shelters": shelters,
    }
    store.replace_where("areas", lambda item: item.get("zip") == zip_code, [record])


def _timestamp(value: Any) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _started_today(now: datetime) -> set[str]:
    started: set[str] = set()
    for record in store.list("areas"):
        zip_code = record.get("zip")
        started_at = _timestamp(record.get("startedAt"))
        if isinstance(zip_code, str) and started_at and started_at.date() == now.date():
            started.add(zip_code)
    return started


def _area_limit_per_day() -> int:
    value = os.getenv("AREA_LIMIT_PER_DAY", "5")
    try:
        limit = int(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=500,
            detail="AREA_LIMIT_PER_DAY must be a non-negative integer.",
        ) from exc
    if limit < 0:
        raise HTTPException(
            status_code=500,
            detail="AREA_LIMIT_PER_DAY must be a non-negative integer.",
        )
    return limit


def _refresh_area_background(zip_code: str) -> None:
    try:
        with _AREA_REFRESH_LOCK:
            from scripts.refresh_data import refresh_area

            refresh_area(zip_code)
    except Exception as exc:
        print(f"Area refresh failed ({type(exc).__name__}).")
    finally:
        try:
            pets_count, shelters_count = _area_counts(zip_code)
        except Exception as exc:
            print(f"Area refresh counts failed ({type(exc).__name__}).")
            pets_count, shelters_count = 0, 0

        try:
            with _AREA_STATE_LOCK:
                previous = _area_record(zip_code)
                started_at = (
                    previous.get("startedAt")
                    if previous is not None
                    and isinstance(previous.get("startedAt"), str)
                    else None
                )
                finished_at = datetime.now(timezone.utc).isoformat()
                status = "ready" if pets_count or shelters_count else "empty"
                _write_area_record(
                    zip_code,
                    status,
                    started_at,
                    finished_at,
                    pets_count,
                    shelters_count,
                )
        except Exception as exc:
            print(f"Area refresh status update failed ({type(exc).__name__}).")
        finally:
            with _AREA_STATE_LOCK:
                _SCHEDULED_AREA_REFRESHES.discard(zip_code)


def _area_response(
    zip_code: str,
    city: str,
    state: str,
    lat: float,
    lng: float,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    with _AREA_STATE_LOCK:
        pets_count, shelters_count = _area_counts(zip_code)
        previous = _area_record(zip_code)
        started_at = (
            previous.get("startedAt")
            if previous is not None and isinstance(previous.get("startedAt"), str)
            else None
        )
        finished_at = (
            previous.get("finishedAt")
            if previous is not None and isinstance(previous.get("finishedAt"), str)
            else None
        )

        if zip_code in _SCHEDULED_AREA_REFRESHES:
            status = "loading"
        elif pets_count or shelters_count:
            status = "ready"
            _write_area_record(
                zip_code,
                status,
                started_at,
                finished_at,
                pets_count,
                shelters_count,
            )
        elif (
            previous is not None
            and previous.get("status") == "empty"
            and (finished := _timestamp(finished_at)) is not None
            and timedelta(0) <= now - finished < timedelta(hours=6)
        ):
            status = "empty"
        else:
            started_today = _started_today(now)
            if (
                zip_code not in started_today
                and len(started_today) >= _area_limit_per_day()
            ):
                status = "limit"
                _write_area_record(
                    zip_code,
                    status,
                    started_at,
                    finished_at,
                    pets_count,
                    shelters_count,
                )
            else:
                status = "loading"
                started_at = now.isoformat()
                finished_at = None
                _write_area_record(
                    zip_code,
                    status,
                    started_at,
                    finished_at,
                    pets_count,
                    shelters_count,
                )
                _SCHEDULED_AREA_REFRESHES.add(zip_code)
                background_tasks.add_task(_refresh_area_background, zip_code)

    return {
        "zip": zip_code,
        "city": city,
        "state": state,
        "lat": lat,
        "lng": lng,
        "status": status,
        "pets": pets_count,
        "shelters": shelters_count,
    }


@router.get("/api/pets")
def list_pets(
    species: str | None = None,
    age: str | None = None,
    size: str | None = None,
    sex: str | None = None,
    shelterId: str | None = None,
    city: str | None = None,
    q: str | None = None,
    zip: str | None = None,
    limit: int = Query(default=100, ge=0),
    offset: int = Query(default=0, ge=0),
) -> list[dict[str, Any]]:
    results = search_pets(
        species=_split_values(species),
        age=_split_values(age),
        size=_split_values(size),
        sex=_split_values(sex),
        shelter_id=shelterId,
        city=city,
        q=q,
        zip=zip,
    )
    return results[offset : offset + limit]


@router.get("/api/pets/{id}")
def pet_detail(id: str) -> dict[str, Any]:
    record = store.get("pets", id)
    if record is None:
        raise HTTPException(status_code=404, detail="Pet not found")

    details_record = record.get("details")
    if not isinstance(details_record, dict):
        details_record = {}
    details = {field: details_record.get(field) for field in _DETAIL_FIELDS}

    shelter_id = record.get("shelterId")
    shelters = store.list("shelters") if isinstance(shelter_id, str) else []
    shelter_area = record.get("area")
    shelter = next(
        (
            item
            for item in shelters
            if item.get("id") == shelter_id and item.get("area") == shelter_area
        ),
        None,
    )
    if shelter is None:
        shelter = next(
            (item for item in shelters if item.get("id") == shelter_id),
            None,
        )
    shelter_policies = shelter.get("policies") if shelter is not None else None

    return {
        "pet": pet_object(record),
        "details": details,
        "policies": {
            "adopt": _policy_values(shelter_policies, "adopt"),
            "foster": _policy_values(shelter_policies, "foster"),
        },
    }


@router.get("/api/filters/pets")
def pet_filters() -> dict[str, list[str]]:
    pets = store.list("pets")
    present: dict[str, set[str]] = {
        field: set() for field in _FILTER_VALUES
    }
    for pet in pets:
        for field, mapping in _FILTER_VALUES.items():
            value = pet.get(field)
            if isinstance(value, str):
                normalized = mapping.get(value.strip().casefold())
                if normalized is not None:
                    present[field].add(normalized)
    return {
        field: [value for value in _FILTER_ORDER[field] if value in present[field]]
        for field in _FILTER_ORDER
    }


@router.get("/api/marquee")
def marquee(
    count: int = Query(default=8, ge=0),
    zip: str | None = None,
) -> list[dict[str, str]]:
    pets = search_pets(zip=zip)
    with_photos = [
        pet
        for pet in pets
        if isinstance(pet.get("src"), str)
        and pet["src"].strip().casefold() not in {"", "n/a", "none"}
    ]
    selected = random.sample(with_photos, min(count, len(with_photos)))
    return [
        {
            "src": pet["src"],
            "alt": f"{pet.get('name') or ''}, {pet.get('breed') or ''}",
        }
        for pet in selected
    ]


@router.get("/api/area")
def get_area(
    background_tasks: BackgroundTasks,
    lat: float | None = None,
    lng: float | None = None,
    zip: str | None = None,
) -> dict[str, Any]:
    if zip is not None:
        if re.fullmatch(r"[0-9]{5}", zip) is None:
            raise HTTPException(
                status_code=400,
                detail="Enter a 5-digit ZIP code.",
            )
        location = geocode.forward(zip)
        if location is None:
            raise HTTPException(
                status_code=400,
                detail="We could not find that location. Try typing a ZIP code.",
            )
        latitude = location["lat"]
        longitude = location["lng"]
        city = location["city"]
        state = location["state"]
        zip_code = zip
    elif lat is not None and lng is not None:
        location = geocode.reverse(lat, lng)
        if location is None:
            raise HTTPException(
                status_code=400,
                detail="We could not find that location. Try typing a ZIP code.",
            )
        zip_code = location["zip"]
        if re.fullmatch(r"[0-9]{5}", zip_code) is None:
            raise HTTPException(
                status_code=400,
                detail="We could not find that location. Try typing a ZIP code.",
            )
        latitude = lat
        longitude = lng
        city = location["city"]
        state = location["state"]
    else:
        raise HTTPException(
            status_code=400,
            detail="We could not find that location. Try typing a ZIP code.",
        )

    return _area_response(
        zip_code,
        city,
        state,
        latitude,
        longitude,
        background_tasks,
    )


@router.post("/api/admin/refresh")
def admin_refresh(
    background_tasks: BackgroundTasks,
    admin_token: str | None = Header(default=None, alias="X-Admin-Token"),
) -> dict[str, bool]:
    configured_token = os.getenv("ADMIN_TOKEN")
    if (
        not configured_token
        or admin_token is None
        or not secrets.compare_digest(admin_token, configured_token)
    ):
        raise HTTPException(status_code=403, detail="Forbidden")

    zip_code = os.getenv("DEFAULT_ZIP")
    if not zip_code:
        raise HTTPException(
            status_code=400,
            detail="DEFAULT_ZIP is not configured.",
        )
    from scripts.refresh_data import refresh_area

    background_tasks.add_task(refresh_area, zip_code)
    return {"started": True}
