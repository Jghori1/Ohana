from __future__ import annotations

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..core import store
from ..core.search import search_pets
from ..services.chat_rules import ChatCriteria, resolve_chat_criteria


router = APIRouter()


class ChatHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    text: str


class ChatLocation(BaseModel):
    lat: float
    lng: float
    city: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatHistoryMessage] = Field(default_factory=list)
    location: ChatLocation | None = None


def _shelter_name_for_pet(
    pet: dict[str, object],
    pet_records: dict[str, dict[str, object]],
    shelters_by_id: dict[str, list[dict[str, object]]],
) -> str:
    pet_id = pet.get("id")
    record = pet_records.get(pet_id) if isinstance(pet_id, str) else None
    if not record:
        return ""

    shelter_id = record.get("shelterId")
    if not isinstance(shelter_id, str):
        return ""
    shelters = shelters_by_id.get(shelter_id, [])
    if not shelters:
        return ""

    pet_area = record.get("area")
    shelter = next(
        (item for item in shelters if item.get("area") == pet_area),
        shelters[0],
    )
    name = shelter.get("name")
    return name if isinstance(name, str) else ""


def _reply(criteria: ChatCriteria, count: int) -> str:
    if not criteria.species:
        return (
            "Which animal would you like to find? I can help with dogs, cats, "
            "rabbits, hamsters, or birds."
        )

    intent = {
        "adopt": " to adopt",
        "foster": " to foster",
    }.get(criteria.intent, "")
    city = f" in {criteria.city}" if criteria.city else ""
    if count == 0:
        return (
            f"I couldn't find matching pets{intent}{city}. "
            "Try relaxing a filter or changing the location."
        )
    return f"I found {count} matching pet{'s' if count != 1 else ''}{intent}{city}."


@router.post("/api/chat")
def chat(request: ChatRequest) -> dict[str, object]:
    history = [item.text for item in request.history if item.role == "user"]
    criteria = resolve_chat_criteria(
        message=request.message,
        history=history,
        location_city=request.location.city if request.location else None,
    )

    pets: list[dict[str, object]] = []
    if criteria.species:
        pets = search_pets(
            species=criteria.species,
            age=criteria.age,
            size=criteria.size,
            sex=criteria.sex,
            city=criteria.city,
            q=criteria.breed,
        )[:4]

    pet_records = {
        item["id"]: item
        for item in store.list("pets")
        if isinstance(item.get("id"), str)
    }
    shelters_by_id: dict[str, list[dict[str, object]]] = {}
    for shelter in store.list("shelters"):
        shelter_id = shelter.get("id")
        if isinstance(shelter_id, str):
            shelters_by_id.setdefault(shelter_id, []).append(shelter)

    response_pets = [
        {
            **pet,
            "shelterName": _shelter_name_for_pet(
                pet, pet_records, shelters_by_id
            ),
        }
        for pet in pets
    ]
    return {
        "reply": _reply(criteria, len(response_pets)),
        "filters": {
            "species": criteria.species,
            "age": criteria.age,
            "size": criteria.size,
            "sex": criteria.sex,
            "city": criteria.city or "",
            **({"intent": criteria.intent} if criteria.intent else {}),
        },
        "pets": response_pets,
    }
