from __future__ import annotations

import json
import os
from collections import Counter
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv

from .mapping import _clean_text, _valid_http_url, map_agent_result


_API_URL = "https://api.rescuegroups.org/http/v2.json"
_FIELDS = [
    "animalID",
    "animalOrgID",
    "animalAdoptionFee",
    "animalAgeString",
    "animalBreed",
    "animalDescriptionPlain",
    "animalGeneralAge",
    "animalName",
    "animalSex",
    "animalSizeCurrent",
    "animalSpecies",
    "animalSpeciesID",
    "animalThumbnailUrl",
    "animalUrl",
    "locationAddress",
    "locationCity",
    "locationName",
    "locationPhone",
    "locationPostalcode",
    "locationState",
    "locationUrl",
]

load_dotenv(Path(__file__).resolve().parents[3] / ".env")


def _source_id(value: Any) -> str | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (str, int)):
        return _clean_text(str(value))
    return None


def _animals_from_response(response: Any) -> list[dict[str, Any]]:
    if not isinstance(response, dict) or str(response.get("status", "")).casefold() != "ok":
        return []
    data = response.get("data")
    if isinstance(data, dict):
        return [animal for animal in data.values() if isinstance(animal, dict)]
    if isinstance(data, list):
        return [animal for animal in data if isinstance(animal, dict)]
    return []


def fetch_available_animals(zip_code: str) -> list[dict[str, Any]]:
    api_key = os.getenv("RESCUEGROUPS_API_KEY")
    if not api_key:
        return []

    zip_value = _clean_text(zip_code)
    if zip_value is None:
        print("RescueGroups search skipped: ZIP code is missing.")
        return []

    payload = {
        "apikey": api_key,
        "objectType": "animals",
        "objectAction": "publicSearch",
        "search": {
            "resultStart": "0",
            "resultLimit": "10",
            "resultSort": "animalID",
            "resultOrder": "asc",
            "filters": [
                {
                    "fieldName": "animalStatus",
                    "operation": "equals",
                    "criteria": "Available",
                },
                {
                    "fieldName": "animalLocationDistance",
                    "operation": "radius",
                    "criteria": "50",
                },
                {
                    "fieldName": "animalLocation",
                    "operation": "equals",
                    "criteria": zip_value,
                },
            ],
            "filterProcessing": "1",
            "fields": _FIELDS,
        },
    }

    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(_API_URL, json=payload)
            response.raise_for_status()
            raw_response = response.json()
    except (httpx.HTTPError, ValueError):
        print("RescueGroups search failed.")
        return []

    raw_animals = _animals_from_response(raw_response)
    if raw_animals:
        print("RescueGroups raw animal:")
        print(json.dumps(raw_animals[0], ensure_ascii=False))

    groups: dict[str, dict[str, Any]] = {}
    dropped: Counter[str] = Counter()
    for raw_animal in raw_animals:
        organization_id = _source_id(raw_animal.get("animalOrgID"))
        animal_id = _source_id(raw_animal.get("animalID"))
        location_url = _valid_http_url(raw_animal.get("locationUrl"))
        shelter_name = _clean_text(raw_animal.get("locationName"))
        shelter_address = _clean_text(raw_animal.get("locationAddress"))
        shelter_city = _clean_text(raw_animal.get("locationCity"))
        shelter_phone = _clean_text(raw_animal.get("locationPhone"))
        shelter_identity = (
            organization_id
            or location_url
            or "|".join(
                value
                for value in (shelter_name, shelter_address, shelter_city, shelter_phone)
                if value
            )
            or animal_id
            or _clean_text(raw_animal.get("animalName"))
            or ""
        )

        answer = {
            "shelter_name": shelter_name,
            "address": shelter_address,
            "city": shelter_city,
            "phone": shelter_phone,
            "website": location_url,
            "description": "",
            "animals": [
                {
                    "name": raw_animal.get("animalName"),
                    "species": raw_animal.get("animalSpecies")
                    or raw_animal.get("animalSpeciesID"),
                    "breed": raw_animal.get("animalBreed"),
                    "age": raw_animal.get("animalAgeString")
                    or raw_animal.get("animalGeneralAge"),
                    "size": raw_animal.get("animalSizeCurrent"),
                    "sex": raw_animal.get("animalSex"),
                    "photo_url": raw_animal.get("animalThumbnailUrl"),
                    "page_url": raw_animal.get("animalUrl"),
                    "description": raw_animal.get("animalDescriptionPlain"),
                    "fee": raw_animal.get("animalAdoptionFee"),
                }
            ],
        }
        shelter, pets, animal_drops = map_agent_result(
            answer,
            f"rescuegroups:{shelter_identity}",
            zip_value,
        )
        dropped.update(animal_drops)
        if not pets:
            continue
        shelter["source"] = "rescuegroups"

        group = groups.setdefault(
            shelter["id"],
            {"shelter": shelter, "pets": [], "_pet_ids": set()},
        )
        grouped_shelter = group["shelter"]
        grouped_shelter["animals"] = list(
            dict.fromkeys(grouped_shelter["animals"] + shelter["animals"])
        )
        for field in ("name", "city", "address", "phone", "website"):
            if not grouped_shelter.get(field) and shelter.get(field):
                grouped_shelter[field] = shelter[field]
        for pet in pets:
            if pet["id"] not in group["_pet_ids"]:
                group["_pet_ids"].add(pet["id"])
                group["pets"].append(pet)

    if dropped:
        print("RescueGroups animals dropped:")
        for reason, count in sorted(dropped.items()):
            print(f"  {reason}: {count}")

    return [
        {"shelter": group["shelter"], "pets": group["pets"]}
        for group in groups.values()
        if group["pets"]
    ]
