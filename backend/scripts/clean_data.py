from __future__ import annotations

import json
import os
import tempfile
from collections import Counter
from pathlib import Path
from typing import Any

from app.services import geocode
from app.services.mapping import (
    _clean_text,
    registrable_domain,
    shelter_id_for_site,
    shelter_matches_state,
)


_DATA_DIR = Path(__file__).resolve().parents[1] / "data"


def _read_records(path: Path) -> list[dict[str, Any]]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return []
    if not isinstance(data, list) or any(not isinstance(item, dict) for item in data):
        raise ValueError(f"{path.name} must contain a JSON list of objects.")
    return data


def _atomic_write(path: Path, records: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=path.parent,
            prefix=f".{path.stem}-",
            suffix=".tmp",
            delete=False,
        ) as temp_file:
            temp_path = temp_file.name
            json.dump(records, temp_file, ensure_ascii=False, indent=2)
            temp_file.write("\n")
        os.replace(temp_path, path)
    except Exception:
        if temp_path is not None:
            try:
                os.unlink(temp_path)
            except FileNotFoundError:
                pass
        raise


def _area(record: dict[str, Any]) -> str | None:
    value = record.get("area")
    return value.strip() if isinstance(value, str) and value.strip() else None


def _state_for_area(
    area: str | None,
    cache: dict[str, str | None],
    lookup_failures: set[str],
) -> str | None:
    if area is None:
        return None
    if area not in cache:
        result = geocode.forward(area)
        state = result.get("state") if isinstance(result, dict) else None
        cache[area] = state.strip() if isinstance(state, str) and state.strip() else None
        if cache[area] is None:
            lookup_failures.add(area)
            print(f"Could not geocode ZIP {area}; preserving records for it.")
    return cache[area]


def _string_values(value: Any) -> list[str]:
    values = value if isinstance(value, list) else []
    return [item for item in values if isinstance(item, str) and item.strip()]


def _merge_policies(first: Any, second: Any) -> Any:
    if not isinstance(first, dict):
        return second
    if not isinstance(second, dict):
        return first
    merged = dict(first)
    for field in ("adopt", "foster"):
        merged[field] = list(
            dict.fromkeys(
                _string_values(first.get(field)) + _string_values(second.get(field))
            )
        )
    for key, value in second.items():
        if not merged.get(key):
            merged[key] = value
    return merged


def _merge_shelter(first: dict[str, Any], second: dict[str, Any]) -> None:
    for field in ("roles", "needs", "animals", "notes"):
        first[field] = list(
            dict.fromkeys(
                _string_values(first.get(field)) + _string_values(second.get(field))
            )
        )
    policies = _merge_policies(first.get("policies"), second.get("policies"))
    if policies is not None:
        first["policies"] = policies
    for field, value in second.items():
        if field in {"id", "area", "roles", "needs", "animals", "notes", "policies"}:
            continue
        if not _clean_text(first.get(field)):
            first[field] = value


def clean_data() -> dict[str, int]:
    shelters_path = _DATA_DIR / "shelters.json"
    pets_path = _DATA_DIR / "pets.json"
    old_shelters = _read_records(shelters_path)
    old_pets = _read_records(pets_path)

    states: dict[str, str | None] = {}
    lookup_failures: set[str] = set()
    dropped_shelters: Counter[str] = Counter()
    dropped_pets: Counter[str] = Counter()
    merged_count = 0
    shelters_by_key: dict[tuple[str, str | None], dict[str, Any]] = {}
    old_shelter_lookup: dict[tuple[str, str | None], dict[str, Any]] = {}
    removed_shelters: dict[tuple[str, str | None], str] = {}

    for original in old_shelters:
        shelter = dict(original)
        original_id = shelter.get("id")
        area = _area(shelter)
        old_key = (original_id, area) if isinstance(original_id, str) else None

        if _clean_text(shelter.get("name")) is None:
            dropped_shelters["empty name"] += 1
            if old_key is not None:
                removed_shelters[old_key] = "empty shelter"
            continue
        if not isinstance(original_id, str) or not original_id:
            dropped_shelters["missing id"] += 1
            continue

        state = _state_for_area(area, states, lookup_failures)
        if state is not None and not shelter_matches_state(shelter, state):
            dropped_shelters["out of state"] += 1
            removed_shelters[old_key] = "out of state"
            continue

        city = shelter.get("city")
        if isinstance(city, str):
            shelter["city"] = city.split(",", 1)[0].strip()

        domain = registrable_domain(shelter.get("website"))
        shelter_id = (
            shelter_id_for_site(domain)
            if domain and shelter.get("source") == "tinyfish"
            else original_id
        )
        shelter["id"] = shelter_id
        merge_key = (shelter_id, area)
        existing = shelters_by_key.get(merge_key)
        if existing is None:
            shelters_by_key[merge_key] = shelter
            existing = shelter
        else:
            _merge_shelter(existing, shelter)
            merged_count += 1
        if old_key is not None:
            old_shelter_lookup[old_key] = existing

    shelters = list(shelters_by_key.values())
    pets: list[dict[str, Any]] = []
    for original in old_pets:
        pet = dict(original)
        old_id = pet.get("shelterId")
        area = _area(pet)
        if not isinstance(old_id, str):
            dropped_pets["missing shelter"] += 1
            continue

        shelter = old_shelter_lookup.get((old_id, area))
        if shelter is None:
            candidates = [
                candidate
                for (candidate_id, _), candidate in old_shelter_lookup.items()
                if candidate_id == old_id
            ]
            if len(candidates) == 1:
                shelter = candidates[0]
        if shelter is None:
            if removed_shelters.get((old_id, area)) == "out of state":
                dropped_pets["out of state"] += 1
            else:
                dropped_pets["missing shelter"] += 1
            continue

        state = _state_for_area(area, states, lookup_failures)
        if (
            state is not None
            and area != _area(shelter)
            and not shelter_matches_state(shelter, state)
        ):
            dropped_pets["out of state"] += 1
            continue
        pet["shelterId"] = shelter["id"]
        pets.append(pet)

    _atomic_write(shelters_path, shelters)
    _atomic_write(pets_path, pets)

    print(f"Shelters read: {len(old_shelters)}")
    print(f"Shelters kept: {len(shelters)}")
    print(f"Shelters merged: {merged_count}")
    print(f"Shelters dropped: {sum(dropped_shelters.values())}")
    for reason, count in sorted(dropped_shelters.items()):
        print(f"  {reason}: {count}")
    print(f"Pets read: {len(old_pets)}")
    print(f"Pets kept: {len(pets)}")
    print(f"Pets dropped: {sum(dropped_pets.values())}")
    for reason, count in sorted(dropped_pets.items()):
        print(f"  {reason}: {count}")
    print(f"ZIP lookups unavailable: {len(lookup_failures)}")

    return {
        "sheltersRead": len(old_shelters),
        "sheltersKept": len(shelters),
        "sheltersMerged": merged_count,
        "sheltersDropped": sum(dropped_shelters.values()),
        "petsRead": len(old_pets),
        "petsKept": len(pets),
        "petsDropped": sum(dropped_pets.values()),
        "zipLookupsUnavailable": len(lookup_failures),
    }


if __name__ == "__main__":
    clean_data()
