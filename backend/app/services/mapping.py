from __future__ import annotations

import hashlib
import math
import re
from collections.abc import Mapping
from typing import Any
from urllib.parse import urlsplit


AGENT_GOAL = (
    "Return JSON only with these exact shelter keys: shelter_name, address, city, "
    "phone, website, description, and animals. animals must be a list of up to 5 "
    "objects with these exact keys: name, species, breed, age, size, sex, "
    "photo_url, page_url, description, fee. fee must be a number or empty. Use "
    "only information found on the site; use empty values for missing "
    "information and never invent details."
)

_MISSING_VALUES = {"", "n/a", "none"}
_IMAGE_SUFFIXES = (".jpg", ".jpeg", ".png", ".webp")
_YEAR_RE = re.compile(r"(\d+(?:\.\d+)?)\s*(?:years?|yrs?|yr|y)\b", re.IGNORECASE)
_MONTH_RE = re.compile(r"(\d+(?:\.\d+)?)\s*(?:months?|mos?|mo)\b", re.IGNORECASE)

_SPECIES = {
    "dog": "Dog",
    "dogs": "Dog",
    "cat": "Cat",
    "cats": "Cat",
    "hamster": "Hamster",
    "hamsters": "Hamster",
    "rabbit": "Rabbit",
    "rabbits": "Rabbit",
    "bird": "Bird",
    "birds": "Bird",
    "other": "Other",
}
_SHELTER_ANIMALS = {
    "Dog": "Dogs",
    "Cat": "Cats",
    "Bird": "Birds",
    "Hamster": "Small animals",
    "Rabbit": "Small animals",
    "Other": "Small animals",
}
_MULTI_LABEL_PUBLIC_SUFFIXES = {
    "ac.uk",
    "co.in",
    "co.jp",
    "co.nz",
    "co.uk",
    "com.au",
    "com.br",
    "com.cn",
    "com.hk",
    "com.mx",
    "com.sg",
    "com.tr",
    "com.tw",
    "com.ua",
    "com.za",
    "edu.au",
    "gov.au",
    "gov.uk",
    "net.au",
    "net.nz",
    "net.uk",
    "org.au",
    "org.nz",
    "org.uk",
}
_STATE_CODES = {
    "alabama": "AL",
    "alaska": "AK",
    "arizona": "AZ",
    "arkansas": "AR",
    "california": "CA",
    "colorado": "CO",
    "connecticut": "CT",
    "delaware": "DE",
    "district of columbia": "DC",
    "florida": "FL",
    "georgia": "GA",
    "hawaii": "HI",
    "idaho": "ID",
    "illinois": "IL",
    "indiana": "IN",
    "iowa": "IA",
    "kansas": "KS",
    "kentucky": "KY",
    "louisiana": "LA",
    "maine": "ME",
    "maryland": "MD",
    "massachusetts": "MA",
    "michigan": "MI",
    "minnesota": "MN",
    "mississippi": "MS",
    "missouri": "MO",
    "montana": "MT",
    "nebraska": "NE",
    "nevada": "NV",
    "new hampshire": "NH",
    "new jersey": "NJ",
    "new mexico": "NM",
    "new york": "NY",
    "north carolina": "NC",
    "north dakota": "ND",
    "ohio": "OH",
    "oklahoma": "OK",
    "oregon": "OR",
    "pennsylvania": "PA",
    "rhode island": "RI",
    "south carolina": "SC",
    "south dakota": "SD",
    "tennessee": "TN",
    "texas": "TX",
    "utah": "UT",
    "vermont": "VT",
    "virginia": "VA",
    "washington": "WA",
    "west virginia": "WV",
    "wisconsin": "WI",
    "wyoming": "WY",
}


def _clean_text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    cleaned = value.strip()
    if cleaned.casefold() in _MISSING_VALUES:
        return None
    return cleaned


def _stable_id(prefix: str, *parts: str) -> str:
    digest = hashlib.sha256("\x1f".join(parts).encode("utf-8")).hexdigest()[:12]
    return f"{prefix}_{digest}"


def registrable_domain(value: Any) -> str | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        candidate = value.strip()
        if "://" not in candidate and ":" in candidate.split("/", 1)[0]:
            return None
        parsed = urlsplit(candidate if "://" in candidate else f"//{candidate}")
        hostname = parsed.hostname
        _ = parsed.port
    except ValueError:
        return None
    if not hostname:
        return None
    labels = hostname.casefold().rstrip(".").split(".")
    if len(labels) < 2:
        return hostname.casefold().rstrip(".")
    public_suffix = ".".join(labels[-2:])
    label_count = 3 if public_suffix in _MULTI_LABEL_PUBLIC_SUFFIXES else 2
    return ".".join(labels[-label_count:])


def shelter_id_for_site(site_url: Any) -> str:
    domain = registrable_domain(site_url)
    identity = domain or (
        site_url.strip().casefold() if isinstance(site_url, str) else ""
    )
    return _stable_id("shelter", identity)


def shelter_matches_state(shelter: Mapping[str, Any], state: Any) -> bool:
    cleaned_state = _clean_text(state)
    if cleaned_state is None:
        return False

    state_name = cleaned_state
    state_code = _STATE_CODES.get(cleaned_state.casefold())
    if state_code is None:
        reverse_codes = {code.casefold(): name for name, code in _STATE_CODES.items()}
        state_name = reverse_codes.get(cleaned_state.casefold(), cleaned_state)
        if re.fullmatch(r"[a-z]{2}", cleaned_state, re.IGNORECASE):
            state_code = cleaned_state.upper()

    fields = " ".join(
        value
        for field in ("address", "city")
        if (value := _clean_text(shelter.get(field))) is not None
    )
    if re.search(rf"\b{re.escape(state_name)}\b", fields, re.IGNORECASE):
        return True
    return bool(
        state_code
        and re.search(rf"\b{re.escape(state_code)}\b", fields, re.IGNORECASE)
    )


def _valid_http_url(value: Any) -> str | None:
    cleaned = _clean_text(value)
    if cleaned is None:
        return None
    try:
        parsed = urlsplit(cleaned)
        hostname = parsed.hostname
        _ = parsed.port
    except ValueError:
        return None
    if parsed.scheme.lower() not in {"http", "https"} or not hostname:
        return None
    return cleaned


def _photo_url(value: Any) -> str | None:
    cleaned = _clean_text(value)
    if cleaned is None:
        return None
    try:
        parsed = urlsplit(cleaned)
        hostname = parsed.hostname
        _ = parsed.port
    except ValueError:
        return None
    if parsed.scheme.lower() != "https" or not hostname:
        return None
    path = parsed.path.lower()
    if path.endswith(_IMAGE_SUFFIXES) or "/profile-pictures/" in path:
        return cleaned
    return None


def normalize_species(value: Any) -> str | None:
    cleaned = _clean_text(value)
    return _SPECIES.get(cleaned.casefold()) if cleaned else None


def normalize_age(value: Any) -> str | None:
    cleaned = _clean_text(value)
    if cleaned is None:
        return None

    text = cleaned.casefold()
    if re.search(r"\b(?:puppy|puppies|kitten|kittens)\b", text):
        return "Baby"
    if re.search(r"\bsenior\b", text):
        return "Adult"
    if text in {"baby", "young", "adult"}:
        return text.capitalize()

    years = [float(match) for match in _YEAR_RE.findall(text)]
    months = [float(match) for match in _MONTH_RE.findall(text)]
    if not years and not months:
        return None

    total_months = sum(years) * 12 + sum(months)
    if total_months < 12:
        return "Baby"
    if total_months <= 24:
        return "Young"
    return "Adult"


def normalize_size(value: Any) -> str | None:
    cleaned = _clean_text(value)
    if cleaned is None:
        return None
    first_word = cleaned.split(maxsplit=1)[0].strip(".,:;()").casefold()
    if first_word == "small":
        return "Small"
    if first_word == "medium":
        return "Medium"
    if first_word in {"large", "x-large", "xlarge"}:
        return "Large"
    return None


def normalize_sex(value: Any) -> str | None:
    cleaned = _clean_text(value)
    if cleaned is None:
        return None
    return {"female": "Female", "male": "Male", "pair": "Pair"}.get(
        cleaned.casefold()
    )


def _fee(value: Any) -> int | float | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, str):
        cleaned = _clean_text(value)
        if cleaned is None:
            return None
        value = cleaned.replace("$", "").replace(",", "")
    try:
        amount = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(amount):
        return None
    return int(amount) if amount.is_integer() else amount


def map_agent_result(
    answer: Mapping[str, Any],
    site_url: str,
    area: str,
    existing_shelters: Mapping[str, Mapping[str, Any]] | None = None,
) -> tuple[dict[str, Any], list[dict[str, Any]], dict[str, int]]:
    shelter_id = shelter_id_for_site(site_url)
    name = _clean_text(answer.get("shelter_name"))
    if name is None:
        return {"id": shelter_id, "name": ""}, [], {"missing shelter name": 1}

    address = _clean_text(answer.get("address"))
    city = _clean_text(answer.get("city"))
    description = _clean_text(answer.get("description"))
    website = _valid_http_url(answer.get("website")) or ""
    animals = answer.get("animals")
    dropped: dict[str, int] = {}
    pets: list[dict[str, Any]] = []
    seen_pet_ids: set[str] = set()

    if not isinstance(animals, list):
        dropped["missing or invalid animals list"] = 1
        animals = []

    for animal in animals:
        if not isinstance(animal, Mapping):
            reason = "invalid animal data"
            dropped[reason] = dropped.get(reason, 0) + 1
            continue

        pet_name = _clean_text(animal.get("name"))
        species = normalize_species(animal.get("species"))
        photo = _photo_url(animal.get("photo_url"))
        reason = (
            "missing name"
            if pet_name is None
            else "unmapped species"
            if species is None
            else "no photo"
            if photo is None
            else None
        )
        if reason is not None:
            dropped[reason] = dropped.get(reason, 0) + 1
            continue

        page_url = _valid_http_url(animal.get("page_url")) or ""
        pet_id = _stable_id("pet", shelter_id, pet_name, page_url)
        if pet_id in seen_pet_ids:
            dropped["duplicate pet"] = dropped.get("duplicate pet", 0) + 1
            continue
        seen_pet_ids.add(pet_id)

        pets.append(
            {
                "id": pet_id,
                "name": pet_name,
                "src": photo,
                "shelterId": shelter_id,
                "species": species,
                "age": normalize_age(animal.get("age")),
                "size": normalize_size(animal.get("size")),
                "sex": normalize_sex(animal.get("sex")),
                "breed": _clean_text(animal.get("breed")) or "",
                "notes": [],
                "sourceUrl": page_url,
                "area": area,
                "details": {
                    "story": _clean_text(animal.get("description")),
                    "health": None,
                    "idealHome": None,
                    "fee": _fee(animal.get("fee")),
                },
                "policies": {"adopt": [], "foster": []},
            }
        )

    found_animals = list(
        dict.fromkeys(_SHELTER_ANIMALS[pet["species"]] for pet in pets)
    )
    existing = (existing_shelters or {}).get(shelter_id, {})
    shelter: dict[str, Any] = {
        "id": shelter_id,
        "name": name or "",
        "city": city.split(",", 1)[0].strip() if city else "",
        "address": address or "",
        "mission": "",
        "about": description or "",
        "hours": "",
        "phone": _clean_text(answer.get("phone")) or "",
        "email": "",
        "website": website,
        "avatar": "",
        "animals": found_animals,
        "roles": existing.get("roles", []),
        "needs": existing.get("needs", []),
        "notes": [],
        "source": "tinyfish",
        "area": area,
    }
    if "policies" in existing:
        shelter["policies"] = existing["policies"]

    return shelter, pets, dropped
