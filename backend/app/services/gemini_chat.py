from __future__ import annotations

import json
import logging
import os
import re
from typing import Any
from urllib.parse import quote

import httpx

from ..core import store
from .chat_rules import ChatCriteria


_GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models"
_REQUEST_TIMEOUT = httpx.Timeout(connect=5, read=45, write=10, pool=5)
_SYSTEM_INSTRUCTION = """Interpret the user's current pet-search request using only the supplied recent user messages and optional location city.
Return only a JSON object with these filter keys:
species: an array containing only Dog, Cat, Rabbit, Hamster, or Bird
age: an array containing only Baby, Young, Adult, or Senior
size: an array containing only Small, Medium, or Large
sex: an array containing only Male or Female
intent: adopt, foster, or null
city: a city clearly present in the request, recent user messages, or supplied location city, or null
breed: a breed clearly present in the request or recent user messages, or null
Use empty arrays for unspecified array filters and null for unspecified scalar filters.
Do not return pets, IDs, shelters, shelter names, phone numbers, URLs, addresses, availability claims, or any other fields.
Do not guess filters that are not supported by the supplied context."""

_ARRAY_FILTERS: dict[str, dict[str, str]] = {
    "species": {
        "dog": "Dog",
        "cat": "Cat",
        "rabbit": "Rabbit",
        "hamster": "Hamster",
        "bird": "Bird",
    },
    "age": {
        "baby": "Baby",
        "young": "Young",
        "adult": "Adult",
        "senior": "Adult",
    },
    "size": {"small": "Small", "medium": "Medium", "large": "Large"},
    "sex": {"male": "Male", "female": "Female"},
}
_INTENTS = {"adopt": "adopt", "foster": "foster"}
_MODEL_PATTERN = re.compile(r"[A-Za-z0-9._-]+\Z")
_LOGGER = logging.getLogger(__name__)


def _known_cities(shelters: list[dict[str, Any]]) -> dict[str, str]:
    return {
        city.casefold(): city
        for shelter in shelters
        if isinstance((city := shelter.get("city")), str) and city.strip()
    }


def _known_breeds(pets: list[dict[str, Any]]) -> set[str]:
    return {
        breed.strip()
        for pet in pets
        if isinstance((breed := pet.get("breed")), str) and breed.strip()
    }


def _mentioned(value: str, texts: list[str]) -> bool:
    pattern = re.compile(rf"(?<!\w){re.escape(value)}(?!\w)", re.IGNORECASE)
    return any(pattern.search(text) for text in texts)


def _filter_list(
    payload: dict[str, Any], field: str, allowed: dict[str, str]
) -> list[str]:
    value = payload.get(field, [])
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValueError("Invalid filter structure")

    selected: list[str] = []
    for item in value:
        if not isinstance(item, str):
            raise ValueError("Invalid filter value")
        canonical = allowed.get(item.strip().casefold())
        if canonical is None:
            raise ValueError("Unsupported filter value")
        if canonical not in selected:
            selected.append(canonical)
    return selected


def _nullable_string(payload: dict[str, Any], field: str) -> str | None:
    value = payload.get(field)
    if value is None:
        return None
    if not isinstance(value, str) or not value.strip():
        raise ValueError("Invalid filter structure")
    return value.strip()


def _validate_filters(
    payload: Any,
    *,
    message: str,
    recent_user_messages: list[str],
    location_city: str | None,
    known_cities: dict[str, str],
    known_breeds: set[str],
) -> ChatCriteria | None:
    if not isinstance(payload, dict):
        return None

    species = _filter_list(payload, "species", _ARRAY_FILTERS["species"])
    age = _filter_list(payload, "age", _ARRAY_FILTERS["age"])
    size = _filter_list(payload, "size", _ARRAY_FILTERS["size"])
    sex = _filter_list(payload, "sex", _ARRAY_FILTERS["sex"])

    raw_intent = _nullable_string(payload, "intent")
    intent = None
    if raw_intent is not None:
        intent = _INTENTS.get(raw_intent.casefold())
        if intent is None:
            raise ValueError("Unsupported intent")

    context_texts = [message, *recent_user_messages]
    city = None
    raw_city = _nullable_string(payload, "city")
    if raw_city is not None:
        city = known_cities.get(raw_city.casefold())
        if city is None:
            raise ValueError("Unknown city")
        if not _mentioned(city, context_texts) and (
            location_city is None or location_city.casefold() != city.casefold()
        ):
            raise ValueError("City not supported by context")

    breed = None
    raw_breed = _nullable_string(payload, "breed")
    if raw_breed is not None:
        matching_breeds = {
            known_breed
            for known_breed in known_breeds
            if raw_breed.casefold() in known_breed.casefold()
        }
        if len(matching_breeds) != 1 or not _mentioned(raw_breed, context_texts):
            raise ValueError("Unknown or ambiguous breed")
        breed = raw_breed

    if not any((species, age, size, sex, city, breed)):
        return None

    return ChatCriteria(
        species=species,
        age=age,
        size=size,
        sex=sex,
        city=city,
        intent=intent,
        breed=breed,
    )


def interpret_chat_filters(
    message: str,
    history: list[dict[str, str]],
    location_city: str | None,
) -> ChatCriteria | None:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    model = os.getenv("GEMINI_MODEL", "").strip()
    if not api_key or not model or not _MODEL_PATTERN.fullmatch(model):
        return None

    try:
        recent_user_messages = [
            item["text"].strip()[:500]
            for item in history[-6:]
            if item.get("role") == "user"
            and isinstance(item.get("text"), str)
            and item["text"].strip()
        ][-4:]
        safe_location_city = None
        shelters = store.list("shelters")
        known_cities = _known_cities(shelters)
        if isinstance(location_city, str):
            safe_location_city = known_cities.get(location_city.strip().casefold())

        payload = {
            "message": message[:1200],
            "recent_user_messages": recent_user_messages,
            "location_city": safe_location_city,
        }
        response: httpx.Response | None = None
        for attempt in range(2):
            try:
                response = httpx.post(
                    f"{_GEMINI_ENDPOINT}/{quote(model, safe='-_.')}:generateContent",
                    headers={"x-goog-api-key": api_key},
                    json={
                        "systemInstruction": {
                            "parts": [{"text": _SYSTEM_INSTRUCTION}]
                        },
                        "contents": [
                            {"role": "user", "parts": [{"text": json.dumps(payload)}]}
                        ],
                        "generationConfig": {
                            "responseMimeType": "application/json",
                            "temperature": 0,
                            "maxOutputTokens": 256,
                        },
                    },
                    timeout=_REQUEST_TIMEOUT,
                )
                response.raise_for_status()
                break
            except httpx.ReadTimeout:
                if attempt == 0:
                    continue
                _LOGGER.warning("Gemini fallback: ReadTimeout")
                return None
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code == 503 and attempt == 0:
                    continue
                _LOGGER.warning("Gemini fallback: HTTP %s", exc.response.status_code)
                return None
        if response is None:
            return None

        response_payload = response.json()
        candidates = response_payload.get("candidates")
        if not isinstance(candidates, list) or not candidates:
            return None
        content = candidates[0].get("content")
        parts = content.get("parts") if isinstance(content, dict) else None
        if not isinstance(parts, list):
            return None
        text = "".join(
            part["text"]
            for part in parts
            if isinstance(part, dict) and isinstance(part.get("text"), str)
        ).strip()
        if not text:
            return None

        interpreted = _validate_filters(
            json.loads(text),
            message=message,
            recent_user_messages=recent_user_messages,
            location_city=safe_location_city,
            known_cities=known_cities,
            known_breeds=_known_breeds(store.list("pets")),
        )
        return interpreted
    except Exception as exc:
        # Keep diagnostics safe: exception messages may contain request details.
        _LOGGER.warning(
            "Gemini filter interpretation failed; using rule-based filters (%s)",
            type(exc).__name__,
        )
        return None
