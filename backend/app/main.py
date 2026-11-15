import json
from json import JSONDecodeError
from pathlib import Path

from fastapi import FastAPI, HTTPException

app = FastAPI()

PET_FILTER_VALUES = {
    "species": ("Dog", "Cat", "Hamster", "Rabbit", "Bird", "Other"),
    "age": ("Baby", "Young", "Adult"),
    "size": ("Small", "Medium", "Large"),
    "sex": ("Female", "Male", "Pair"),
}
PET_DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "pets.json"


@app.get("/api/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.get("/api/filters/pets")
def pet_filters() -> dict[str, list[str]]:
    try:
        pets = json.loads(PET_DATA_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        pets = []
    except (OSError, UnicodeDecodeError, JSONDecodeError) as exc:
        raise HTTPException(
            status_code=500, detail="Pet filter data could not be read."
        ) from exc

    if not isinstance(pets, list) or any(
        not isinstance(pet, dict)
        or any(not isinstance(pet.get(field), str) for field in PET_FILTER_VALUES)
        for pet in pets
    ):
        raise HTTPException(status_code=500, detail="Pet filter data has an invalid format.")

    filters: dict[str, list[str]] = {}
    for field, allowed_values in PET_FILTER_VALUES.items():
        present = {
            "Adult" if field == "age" and pet.get(field) == "Senior"
            else "Large" if field == "size" and pet.get(field) == "X-Large"
            else pet.get(field)
            for pet in pets
        }
        filters[field] = [value for value in allowed_values if value in present]

    return filters
