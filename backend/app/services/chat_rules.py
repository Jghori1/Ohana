from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from ..core import store


_SPECIES_PATTERNS = (
    ("Dog", (r"\bdogs?\b", r"\bpupp(?:y|ies)\b")),
    ("Cat", (r"\bcats?\b", r"\bkittens?\b")),
    ("Rabbit", (r"\brabbits?\b", r"\bbunn(?:y|ies)\b")),
    ("Hamster", (r"\bhamsters?\b",)),
    ("Bird", (r"\bbirds?\b", r"\bparrots?\b")),
)
_SIZE_PATTERNS = (
    ("Small", (r"\bsmall\b", r"\btiny\b")),
    ("Medium", (r"\bmedium\b",)),
    ("Large", (r"\blarge\b", r"\bbig\b")),
)
_AGE_PATTERNS = (
    ("Baby", (r"\bbabies\b", r"\bbaby\b", r"\bpupp(?:y|ies)\b", r"\bkittens?\b")),
    ("Young", (r"\byoung\b",)),
    ("Adult", (r"\badult\b", r"\bsenior\b", r"\bold\b")),
)
_SEX_PATTERNS = (
    ("Female", (r"\bfemale\b",)),
    ("Male", (r"\bmale\b",)),
    ("Pair", (r"\bpairs?\b",)),
)
_INTENT_PATTERNS = (
    ("adopt", (r"\badopt(?:ion|ing)?\b",)),
    ("foster", (r"\bfoster(?:ing|ed)?\b",)),
)


@dataclass(frozen=True)
class ChatCriteria:
    species: list[str]
    age: list[str]
    size: list[str]
    sex: list[str]
    city: str | None
    intent: str | None
    breed: str | None


def _has_pattern(text: str, patterns: tuple[str, ...]) -> bool:
    return any(re.search(pattern, text, flags=re.IGNORECASE) for pattern in patterns)


def _known_city(text: str, shelters: list[dict[str, Any]]) -> str | None:
    cities = {
        city.strip()
        for shelter in shelters
        if isinstance((city := shelter.get("city")), str) and city.strip()
    }
    for city in sorted(cities, key=len, reverse=True):
        if re.search(rf"(?<!\w){re.escape(city)}(?!\w)", text, re.IGNORECASE):
            return city
    return None


def _canonical_city(
    city: str | None, shelters: list[dict[str, Any]]
) -> str | None:
    if not isinstance(city, str):
        return None
    requested = city.strip().casefold()
    if not requested:
        return None
    return next(
        (
            value.strip()
            for shelter in shelters
            if isinstance((value := shelter.get("city")), str)
            and value.strip().casefold() == requested
        ),
        None,
    )


def _known_breed(text: str, pets: list[dict[str, Any]]) -> str | None:
    generic_aliases = {
        "adult",
        "baby",
        "bird",
        "cat",
        "dog",
        "female",
        "hamster",
        "large",
        "male",
        "medium",
        "old",
        "pair",
        "rabbit",
        "senior",
        "small",
        "young",
    }
    breed_aliases: set[str] = set()
    for pet in pets:
        breed = pet.get("breed")
        if not isinstance(breed, str):
            continue
        fragments = {fragment.strip() for fragment in re.split(r"[,/()]", breed)}
        for fragment in tuple(fragments):
            words = fragment.split()
            fragments.update(
                " ".join(words[start:end])
                for start in range(len(words))
                for end in range(start + 1, len(words) + 1)
            )
        breed_aliases.update(
            alias
            for alias in fragments
            if len(alias) > 3 and alias.casefold() not in generic_aliases
        )

    for breed in sorted(breed_aliases, key=len, reverse=True):
        if re.search(rf"(?<!\w){re.escape(breed)}(?!\w)", text, re.IGNORECASE):
            return breed
    return None


def _known_breed_in_pets(
    breed: str, pets: list[dict[str, Any]]
) -> set[str]:
    species_values: set[str] = set()
    for pet in pets:
        pet_breed = pet.get("breed")
        species = pet.get("species")
        if (
            isinstance(pet_breed, str)
            and breed.casefold() in pet_breed.casefold()
            and isinstance(species, str)
            and species in {"Dog", "Cat", "Hamster", "Rabbit", "Bird"}
        ):
            species_values.add(species)
    return species_values


def _extract(
    text: str,
    pets: list[dict[str, Any]],
    shelters: list[dict[str, Any]],
) -> dict[str, Any]:
    normalized = text.casefold()
    species = [
        value
        for value, patterns in _SPECIES_PATTERNS
        if _has_pattern(normalized, patterns)
    ]
    age = [
        value
        for value, patterns in _AGE_PATTERNS
        if _has_pattern(normalized, patterns)
    ]
    size = [
        value
        for value, patterns in _SIZE_PATTERNS
        if _has_pattern(normalized, patterns)
    ]
    sex = [
        value
        for value, patterns in _SEX_PATTERNS
        if _has_pattern(normalized, patterns)
    ]

    intent_matches = [
        (match.start(), value)
        for value, patterns in _INTENT_PATTERNS
        for pattern in patterns
        if (match := re.search(pattern, normalized))
    ]
    intent = max(intent_matches, default=(0, None))[1]
    breed = _known_breed(text, pets)
    if not species and breed:
        breed_species = _known_breed_in_pets(breed, pets)
        if len(breed_species) == 1:
            species = list(breed_species)

    return {
        "species": species,
        "age": age,
        "size": size,
        "sex": sex,
        "city": _known_city(text, shelters),
        "intent": intent,
        "breed": breed,
    }


def resolve_chat_criteria(
    message: str,
    history: list[str],
    location_city: str | None = None,
) -> ChatCriteria:
    pets = store.list("pets")
    shelters = store.list("shelters")
    current = _extract(message, pets, shelters)

    remembered: dict[str, Any] = {}
    for previous_message in reversed(history):
        previous = _extract(previous_message, pets, shelters)
        for key, value in previous.items():
            if key not in remembered and value:
                remembered[key] = value
        if len(remembered) == len(current):
            break

    def selected(key: str) -> Any:
        return current[key] or remembered.get(key)

    city = (
        current["city"]
        or _canonical_city(location_city, shelters)
        or remembered.get("city")
    )
    return ChatCriteria(
        species=selected("species") or [],
        age=selected("age") or [],
        size=selected("size") or [],
        sex=selected("sex") or [],
        city=city,
        intent=selected("intent"),
        breed=selected("breed"),
    )
