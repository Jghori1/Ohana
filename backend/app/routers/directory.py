from typing import Any

from fastapi import APIRouter, HTTPException

from ..core import store
from ..models import Cause, Shelter, ShelterDetailResponse

router = APIRouter()


_URGENCY_ORDER = {"Urgent": 0, "This month": 1, "Ongoing": 2}


def _filter_values(value: str | None) -> set[str]:
    if not value:
        return set()
    return {part.strip().casefold() for part in value.split(",") if part.strip()}


def _field_values(value: Any) -> list[str]:
    items = value if isinstance(value, list) else [value]
    return [
        item.strip()
        for item in items
        if isinstance(item, str) and item.strip()
    ]


def _matches(value: Any, requested: set[str]) -> bool:
    if not requested:
        return True
    return any(item.casefold() in requested for item in _field_values(value))


def _matches_zip(shelter: dict[str, Any], requested: set[str]) -> bool:
    if not requested or str(shelter.get("source", "")).casefold() == "registered":
        return True
    return _matches(shelter.get("area"), requested)


def _distinct_values(records: list[dict[str, Any]], field: str) -> list[str]:
    return sorted(
        {
            value
            for record in records
            for value in _field_values(record.get(field))
        },
        key=str.casefold,
    )


@router.get("/api/shelters", response_model=list[Shelter])
def list_shelters(
    city: str | None = None,
    animals: str | None = None,
    roles: str | None = None,
    needs: str | None = None,
    zip: str | None = None,
) -> list[dict[str, Any]]:
    filters = {
        "city": _filter_values(city),
        "animals": _filter_values(animals),
        "roles": _filter_values(roles),
        "needs": _filter_values(needs),
    }
    zip_filter = _filter_values(zip)
    return [
        shelter
        for shelter in store.list("shelters")
        if all(
            _matches(shelter.get(field), requested)
            for field, requested in filters.items()
        )
        and _matches_zip(shelter, zip_filter)
    ]


@router.get(
    "/api/shelters/{shelter_id}",
    response_model=ShelterDetailResponse,
)
def get_shelter(shelter_id: str) -> dict[str, Any]:
    shelter = store.get("shelters", shelter_id)
    if shelter is None:
        raise HTTPException(status_code=404, detail="Shelter not found")

    requests = [
        request
        for request in store.list("requests")
        if request.get("shelterId") == shelter_id
    ]
    photos = [
        {
            "id": photo.get("id", ""),
            "src": photo.get("src", ""),
            "name": photo.get("name", ""),
        }
        for photo in store.list("photos")
        if photo.get("shelterId") == shelter_id
    ]
    if not photos:
        photos = [
            {
                "id": pet.get("id", ""),
                "src": pet.get("src", ""),
                "name": pet.get("name", ""),
            }
            for pet in store.list("pets")
            if pet.get("shelterId") == shelter_id
        ][:6]

    return {**shelter, "requests": requests, "photos": photos}


@router.get("/api/filters/shelters")
def shelter_filters() -> dict[str, list[str]]:
    shelters = store.list("shelters")
    return {
        field: _distinct_values(shelters, field)
        for field in ("city", "animals", "roles", "needs")
    }


def _cause_records() -> list[dict[str, Any]]:
    shelters = {
        shelter.get("id"): shelter
        for shelter in store.list("shelters")
        if isinstance(shelter.get("id"), str)
    }
    causes = []
    for request in reversed(store.list("requests")):
        shelter = shelters.get(request.get("shelterId"))
        if shelter is None:
            continue
        animals = _field_values(shelter.get("animals"))
        causes.append(
            {
                "id": request.get("id", ""),
                "shelterId": shelter["id"],
                "pet": request.get("pet") or request.get("title", ""),
                "src": request.get("src") or shelter.get("avatar") or "",
                "shelter": shelter.get("name", ""),
                "city": shelter.get("city", ""),
                "animal": request.get("animal") or (animals[0] if animals else ""),
                "type": request.get("type") or "Other",
                "urgency": request.get("urgency") or "Ongoing",
                "goal": request.get("amount", 0),
                "raised": request.get("raised", 0),
                "story": request.get("note", ""),
                "breakdown": request.get("breakdown") or [],
                "_area": shelter.get("area"),
                "_source": shelter.get("source"),
            }
        )
    return sorted(
        causes,
        key=lambda cause: _URGENCY_ORDER.get(cause["urgency"], len(_URGENCY_ORDER)),
    )


@router.get("/api/causes", response_model=list[Cause])
def list_causes(
    city: str | None = None,
    animal: str | None = None,
    type: str | None = None,
    urgency: str | None = None,
    zip: str | None = None,
) -> list[dict[str, Any]]:
    filters = {
        "city": _filter_values(city),
        "animal": _filter_values(animal),
        "type": _filter_values(type),
        "urgency": _filter_values(urgency),
    }
    zip_filter = _filter_values(zip)
    return [
        {key: value for key, value in cause.items() if not key.startswith("_")}
        for cause in _cause_records()
        if all(
            _matches(cause.get(field), requested)
            for field, requested in filters.items()
        )
        and _matches_zip(
            {"source": cause.get("_source"), "area": cause.get("_area")},
            zip_filter,
        )
    ]


@router.get("/api/filters/causes")
def cause_filters() -> dict[str, list[str]]:
    causes = _cause_records()
    return {
        field: _distinct_values(causes, field)
        for field in ("city", "animal", "type", "urgency")
    }
