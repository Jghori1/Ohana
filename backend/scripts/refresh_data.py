from __future__ import annotations

import argparse
import json
import os
import tempfile
from collections import Counter
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from dotenv import load_dotenv

from app.services import geocode, rescuegroups, tinyfish
from app.services.mapping import (
    AGENT_GOAL,
    map_agent_result,
    registrable_domain,
    shelter_id_for_site,
    shelter_matches_state,
)


_BACKEND_DIR = Path(__file__).resolve().parents[1]
_DATA_DIR = _BACKEND_DIR / "data"
_BLOCKED_DOMAINS = (
    "petfinder.com",
    "adoptapet.com",
    "facebook.com",
    "keenable.ai",
    "chewy.com",
    "yelp.com",
)
_SITE_KEYWORDS = (
    "shelter",
    "rescue",
    "adopt",
    "adoption",
    "humane society",
    "pet",
    "animal",
)

load_dotenv(Path(__file__).resolve().parents[2] / ".env")


def _read_records(path: Path) -> list[dict[str, Any]]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return []
    if not isinstance(data, list) or any(not isinstance(item, dict) for item in data):
        raise ValueError(f"{path.name} must contain a JSON list of objects.")
    return data


def _atomic_write(path: Path, records: list[dict[str, Any]]) -> None:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
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


def _max_sites() -> int:
    raw_value = os.getenv("MAX_SITES", "6")
    try:
        count = int(raw_value)
    except ValueError as exc:
        raise ValueError("MAX_SITES must be a non-negative integer.") from exc
    if count < 0:
        raise ValueError("MAX_SITES must be a non-negative integer.")
    return count


def _site_candidates(
    search_response: Any, limit: int, dropped: Counter[str]
) -> list[tuple[str, str]]:
    if not isinstance(search_response, dict):
        dropped["invalid search response"] += 1
        return []
    results = search_response.get("results")
    if not isinstance(results, list):
        dropped["missing search results"] += 1
        return []

    sites: list[tuple[str, str]] = []
    seen_domains: set[str] = set()
    for result in results:
        if len(sites) >= limit:
            break
        if not isinstance(result, dict):
            dropped["invalid search result"] += 1
            continue
        title = result.get("title") if isinstance(result.get("title"), str) else ""
        url = result.get("url") if isinstance(result.get("url"), str) else ""
        text = f"{title} {url}".casefold()
        if not any(keyword in text for keyword in _SITE_KEYWORDS):
            dropped["not a shelter or adoption result"] += 1
            continue
        try:
            parsed = urlsplit(url)
            hostname = parsed.hostname
            _ = parsed.port
        except ValueError:
            parsed = None
        if parsed is None or parsed.scheme.lower() not in {"http", "https"}:
            dropped["invalid site URL"] += 1
            continue
        if not hostname:
            dropped["invalid site URL"] += 1
            continue
        domain = registrable_domain(url)
        if domain is None:
            dropped["invalid site URL"] += 1
            continue
        if any(blocked in domain for blocked in _BLOCKED_DOMAINS):
            dropped["excluded site domain"] += 1
            print(f"Skipping {domain}: excluded domain.")
            continue
        if domain in seen_domains:
            dropped["duplicate site domain"] += 1
            print(f"Skipping {domain}: domain already selected.")
            continue
        seen_domains.add(domain)
        sites.append((url, domain))
    return sites


def _parse_answer(raw_answer: Any) -> dict[str, Any] | None:
    if isinstance(raw_answer, str):
        try:
            raw_answer = json.loads(raw_answer)
        except json.JSONDecodeError:
            return None
    return raw_answer if isinstance(raw_answer, dict) and raw_answer else None


def _existing_shelters_by_id(
    records: list[dict[str, Any]], area: str
) -> dict[str, dict[str, Any]]:
    by_id: dict[str, dict[str, Any]] = {}
    for record in records:
        shelter_id = record.get("id")
        domain = (
            registrable_domain(record.get("website"))
            if record.get("source") == "tinyfish"
            else None
        )
        if domain:
            shelter_id = shelter_id_for_site(domain)
        if not isinstance(shelter_id, str):
            continue
        existing = by_id.get(shelter_id)
        if existing is None:
            by_id[shelter_id] = record
            continue

        prefer_record = record.get("area") == area and existing.get("area") != area
        merged = {**existing, **record} if prefer_record else {**record, **existing}
        for field in ("roles", "needs"):
            first = existing.get(field)
            second = record.get(field)
            first_values = first if isinstance(first, list) else []
            second_values = second if isinstance(second, list) else []
            merged[field] = list(
                dict.fromkeys(
                    item
                    for item in first_values + second_values
                    if isinstance(item, str) and item.strip()
                )
            )

        first_policies = existing.get("policies")
        second_policies = record.get("policies")
        if isinstance(first_policies, dict) or isinstance(second_policies, dict):
            policies = dict(
                first_policies if isinstance(first_policies, dict) else {}
            )
            if isinstance(second_policies, dict):
                for key, value in second_policies.items():
                    if not policies.get(key):
                        policies[key] = value
            for field in ("adopt", "foster"):
                first_values = (
                    first_policies.get(field, [])
                    if isinstance(first_policies, dict)
                    else []
                )
                second_values = (
                    second_policies.get(field, [])
                    if isinstance(second_policies, dict)
                    else []
                )
                first_values = first_values if isinstance(first_values, list) else []
                second_values = second_values if isinstance(second_values, list) else []
                policies[field] = list(
                    dict.fromkeys(
                        item
                        for item in first_values + second_values
                        if isinstance(item, str) and item.strip()
                    )
                )
            merged["policies"] = policies
        by_id[shelter_id] = merged
    return by_id


def _print_summary(
    sites_read: int,
    pets_kept: int,
    shelters_kept: int,
    dropped: Counter[str],
) -> None:
    print(f"Sites read: {sites_read}")
    print(f"Pets kept: {pets_kept}")
    print(f"Shelters kept: {shelters_kept}")
    total_dropped = sum(dropped.values())
    print(f"Dropped: {total_dropped}")
    for reason, count in sorted(dropped.items()):
        print(f"  {reason}: {count}")


def _preserve_shelter_fields(
    shelter: dict[str, Any], existing: dict[str, Any] | None
) -> None:
    if existing is None:
        return
    shelter["roles"] = existing.get("roles", shelter.get("roles", []))
    shelter["needs"] = existing.get("needs", shelter.get("needs", []))
    if "policies" in existing:
        shelter["policies"] = existing["policies"]


def refresh_area(zip: str) -> dict[str, Any]:
    area = str(zip).strip()
    if not area:
        raise ValueError("A ZIP code is required.")

    location = geocode.forward(area)
    if (
        not isinstance(location, dict)
        or not isinstance(location.get("city"), str)
        or not isinstance(location.get("state"), str)
    ):
        dropped: Counter[str] = Counter({"ZIP geocoding failed": 1})
        print(f"Could not geocode ZIP {area}; existing data kept.")
        _print_summary(0, 0, 0, dropped)
        return {
            "zip": area,
            "sitesRead": 0,
            "petsKept": 0,
            "sheltersKept": 0,
            "dropped": dict(dropped),
        }

    city = location["city"].strip()
    state = location["state"].strip()
    if not city or not state:
        dropped = Counter({"ZIP geocoding failed": 1})
        print(f"Could not geocode ZIP {area}; existing data kept.")
        _print_summary(0, 0, 0, dropped)
        return {
            "zip": area,
            "sitesRead": 0,
            "petsKept": 0,
            "sheltersKept": 0,
            "dropped": dict(dropped),
        }

    max_sites = _max_sites()
    old_shelters = _read_records(_DATA_DIR / "shelters.json")
    old_pets = _read_records(_DATA_DIR / "pets.json")
    existing_shelters = _existing_shelters_by_id(old_shelters, area)
    dropped: Counter[str] = Counter()
    query = (
        "Animal shelters and rescues with adoptable dogs and cats near "
        f"{city}, {state} {area}"
    )
    try:
        search_response = tinyfish.search(query)
    except Exception as exc:
        dropped[f"search failed ({type(exc).__name__})"] += 1
        print(f"TinyFish search failed ({type(exc).__name__}); existing data kept.")
        _print_summary(0, 0, 0, dropped)
        return {
            "zip": area,
            "sitesRead": 0,
            "petsKept": 0,
            "sheltersKept": 0,
            "dropped": dict(dropped),
        }
    if search_response is None:
        dropped["search returned no data"] += 1
        print("TinyFish search returned no data; existing data kept.")
        _print_summary(0, 0, 0, dropped)
        return {
            "zip": area,
            "sitesRead": 0,
            "petsKept": 0,
            "sheltersKept": 0,
            "dropped": dict(dropped),
        }

    sites = _site_candidates(search_response, max_sites, dropped)
    new_shelters: dict[str, dict[str, Any]] = {}
    new_pets: dict[str, dict[str, Any]] = {}
    sites_read = 0

    for site_number, (site_url, domain) in enumerate(sites, start=1):
        try:
            raw_answer = tinyfish.run_agent(site_url, AGENT_GOAL)
        except Exception as exc:
            dropped[f"agent failed for {domain} ({type(exc).__name__})"] += 1
            print(f"Skipping {domain}: agent call failed ({type(exc).__name__}).")
            continue
        answer = _parse_answer(raw_answer)
        if answer is None:
            dropped["agent returned no usable JSON"] += 1
            print(f"Skipping {domain}: agent returned no usable JSON.")
            continue

        raw_path = _DATA_DIR / f"raw_{site_number}.json"
        raw_path.parent.mkdir(parents=True, exist_ok=True)
        raw_path.write_text(
            json.dumps(answer, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        sites_read += 1

        shelter, pets, animal_drops = map_agent_result(
            answer,
            site_url,
            area,
            existing_shelters,
        )
        dropped.update(animal_drops)
        if not shelter.get("name"):
            print(f"Skipping {domain}: shelter name is missing.")
            continue
        state_check = {**shelter, "city": answer.get("city", shelter.get("city"))}
        if not shelter_matches_state(state_check, state):
            dropped["out of state"] += 1 + len(pets)
            print(f"Skipping {domain}: shelter is out of state.")
            continue
        shelter["source"] = "tinyfish"
        new_shelters[shelter["id"]] = shelter
        for pet in pets:
            if pet["id"] in new_pets:
                dropped["duplicate pet"] += 1
                continue
            new_pets[pet["id"]] = pet

    if len(new_pets) < 10 and os.getenv("RESCUEGROUPS_API_KEY"):
        try:
            rescuegroups_results = rescuegroups.fetch_available_animals(area)
        except Exception as exc:
            dropped[f"RescueGroups failed ({type(exc).__name__})"] += 1
            print(f"RescueGroups fallback failed ({type(exc).__name__}).")
            rescuegroups_results = []

        for result in rescuegroups_results:
            if not isinstance(result, dict):
                dropped["invalid RescueGroups result"] += 1
                continue
            shelter = result.get("shelter")
            pets = result.get("pets")
            if not isinstance(shelter, dict) or not isinstance(pets, list):
                dropped["invalid RescueGroups result"] += 1
                continue
            if not shelter_matches_state(shelter, state):
                dropped["out of state"] += 1 + len(pets)
                continue

            shelter_id = shelter.get("id")
            if not isinstance(shelter_id, str):
                dropped["RescueGroups shelter missing id"] += 1
                continue
            valid_pets = [
                pet
                for pet in pets
                if isinstance(pet, dict) and isinstance(pet.get("id"), str)
            ]
            new_pets_for_shelter = [
                pet for pet in valid_pets if pet["id"] not in new_pets
            ]
            duplicate_count = len(valid_pets) - len(new_pets_for_shelter)
            if duplicate_count:
                dropped["duplicate pet"] += duplicate_count
            if not new_pets_for_shelter:
                continue

            _preserve_shelter_fields(
                shelter,
                existing_shelters.get(shelter_id),
            )
            existing_new_shelter = new_shelters.get(shelter_id)
            if existing_new_shelter is None:
                new_shelters[shelter_id] = shelter
            else:
                existing_new_shelter["animals"] = list(
                    dict.fromkeys(
                        existing_new_shelter.get("animals", [])
                        + shelter.get("animals", [])
                    )
                )
            for pet in new_pets_for_shelter:
                new_pets[pet["id"]] = pet

    if not new_pets:
        print("No pets were found; existing shelters.json and pets.json were kept.")
        _print_summary(sites_read, 0, 0, dropped)
        return {
            "zip": area,
            "sitesRead": sites_read,
            "petsKept": 0,
            "sheltersKept": 0,
            "dropped": dict(dropped),
        }

    replaced_shelters = [
        shelter for shelter in old_shelters if shelter.get("area") != area
    ] + list(new_shelters.values())
    replaced_pets = [
        pet for pet in old_pets if pet.get("area") != area
    ] + list(new_pets.values())

    _atomic_write(_DATA_DIR / "shelters.json", replaced_shelters)
    _atomic_write(_DATA_DIR / "pets.json", replaced_pets)

    _print_summary(sites_read, len(new_pets), len(new_shelters), dropped)
    return {
        "zip": area,
        "sitesRead": sites_read,
        "petsKept": len(new_pets),
        "sheltersKept": len(new_shelters),
        "dropped": dict(dropped),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Refresh shelter and pet data.")
    parser.add_argument("zip", nargs="?", help="ZIP code to refresh")
    args = parser.parse_args()
    zip_code = args.zip or os.getenv("DEFAULT_ZIP")
    if not zip_code:
        parser.error("provide a ZIP code or set DEFAULT_ZIP in .env")
    refresh_area(zip_code)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
