from __future__ import annotations

from typing import Any

from . import store


PET_FIELDS = (
    "id",
    "name",
    "src",
    "shelterId",
    "species",
    "age",
    "size",
    "sex",
    "breed",
    "notes",
    "sourceUrl",
)


def _normalized(value: Any) -> str:
    return value.strip().casefold() if isinstance(value, str) else ""


def _selected_values(values: list[str] | None) -> set[str]:
    return {normalized for value in values or [] if (normalized := _normalized(value))}


def _matches_choice(value: Any, selected: set[str]) -> bool:
    return not selected or _normalized(value) in selected


def _city_for_pet(
    pet: dict[str, Any], shelters_by_id: dict[str, list[dict[str, Any]]]
) -> Any:
    shelter_id = pet.get("shelterId")
    shelters = shelters_by_id.get(shelter_id, [])
    if not shelters:
        return None

    pet_area = pet.get("area")
    shelter = next(
        (item for item in shelters if item.get("area") == pet_area),
        shelters[0],
    )
    return shelter.get("city")


def pet_object(record: dict[str, Any]) -> dict[str, Any]:
    return {field: record.get(field) for field in PET_FIELDS}


def search_pets(
    species: list[str] | None = None,
    age: list[str] | None = None,
    size: list[str] | None = None,
    sex: list[str] | None = None,
    shelter_id: str | None = None,
    city: str | None = None,
    q: str | None = None,
    zip: str | None = None,
) -> list[dict[str, Any]]:
    species_values = _selected_values(species)
    age_values = _selected_values(age)
    size_values = _selected_values(size)
    sex_values = _selected_values(sex)
    shelter_value = _normalized(shelter_id)
    city_value = _normalized(city)
    query = _normalized(q)
    zip_value = _normalized(zip)
    pets = store.list("pets")

    shelters_by_id: dict[str, list[dict[str, Any]]] = {}
    if city_value:
        for shelter in store.list("shelters"):
            shelter_id_value = shelter.get("id")
            if isinstance(shelter_id_value, str):
                shelters_by_id.setdefault(shelter_id_value, []).append(shelter)

    matching: list[dict[str, Any]] = []
    for pet in pets:
        if not _matches_choice(pet.get("species"), species_values):
            continue
        if not _matches_choice(pet.get("age"), age_values):
            continue
        if not _matches_choice(pet.get("size"), size_values):
            continue
        if not _matches_choice(pet.get("sex"), sex_values):
            continue
        if shelter_value and _normalized(pet.get("shelterId")) != shelter_value:
            continue
        if city_value and _normalized(_city_for_pet(pet, shelters_by_id)) != city_value:
            continue

        area = pet.get("area")
        if zip_value and _normalized(area) and _normalized(area) != zip_value:
            continue

        if query:
            notes = pet.get("notes")
            if isinstance(notes, list):
                notes_text = " ".join(
                    note for note in notes if isinstance(note, str)
                )
            elif isinstance(notes, str):
                notes_text = notes
            else:
                notes_text = ""
            searchable = " ".join(
                (
                    pet.get("name") if isinstance(pet.get("name"), str) else "",
                    pet.get("breed") if isinstance(pet.get("breed"), str) else "",
                    notes_text,
                )
            ).casefold()
            if query not in searchable:
                continue

        matching.append(pet_object(pet))

    return matching
