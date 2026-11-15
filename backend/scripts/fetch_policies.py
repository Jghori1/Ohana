from __future__ import annotations

import argparse
import json
import os
import tempfile
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from app.services.policies import POLICY_GOAL, clean_policies
from app.services.tinyfish import run_agent, search


_DATA_DIR = Path(__file__).resolve().parents[1] / "data"
_SHELTERS_PATH = _DATA_DIR / "shelters.json"
_GENERAL_GUIDANCE = {
    "adopt": (
        "General guidance (not this shelter's rule): most shelters ask for an "
        "application, a meet-and-greet, and an adoption fee that covers "
        "spay/neuter, vaccines and a microchip."
    ),
    "foster": (
        "General guidance (not this shelter's rule): most shelters provide food "
        "and vet care for foster pets and ask fosters to be 18 or older."
    ),
}


def _read_shelters() -> list[dict[str, Any]]:
    try:
        shelters = json.loads(_SHELTERS_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValueError(f"{_SHELTERS_PATH} was not found.") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"{_SHELTERS_PATH} is not valid JSON.") from exc
    if not isinstance(shelters, list) or any(
        not isinstance(shelter, dict) for shelter in shelters
    ):
        raise ValueError(f"{_SHELTERS_PATH} must contain a JSON list of objects.")
    return shelters


def _site_url(value: Any) -> tuple[str, str] | None:
    if not isinstance(value, str) or not value.strip():
        return None
    url = value.strip()
    try:
        parsed = urlsplit(url)
        hostname = parsed.hostname
        _ = parsed.port
    except ValueError:
        return None
    if parsed.scheme.casefold() not in {"http", "https"} or not hostname:
        return None
    return url, hostname.casefold().removeprefix("www.")


def _has_policies(shelter: dict[str, Any]) -> bool:
    policies = shelter.get("policies")
    if not isinstance(policies, dict):
        return False
    return any(
        isinstance(policies.get(policy_type), list)
        and any(
            isinstance(value, str) and value.strip()
            for value in policies[policy_type]
        )
        for policy_type in ("adopt", "foster")
    )


def _search_results(response: Any, domain: str) -> list[str]:
    if not isinstance(response, dict) or not isinstance(response.get("results"), list):
        return []
    matching_urls: list[str] = []
    for result in response["results"]:
        if not isinstance(result, dict):
            continue
        candidate = _site_url(result.get("url"))
        if candidate is not None and candidate[1] == domain:
            matching_urls.append(candidate[0])
    return matching_urls


def _contact_sentence(
    policy_type: str, shelter: dict[str, Any], website: str
) -> str:
    topic = "adoption" if policy_type == "adopt" else "foster"
    sentence = (
        f"Not listed on this shelter's website: {topic} terms are set by the "
        "shelter. Contact them before you apply."
    )
    phone = shelter.get("phone")
    if isinstance(phone, str) and phone.strip() and phone.strip().casefold() not in {
        "n/a",
        "none",
    }:
        sentence += f" Phone: {phone.strip()}."
    if website:
        sentence += f" Website: {website}."
    return sentence


def _atomic_write(shelters: list[dict[str, Any]]) -> None:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    temp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=_DATA_DIR,
            prefix=".shelters-",
            suffix=".tmp",
            delete=False,
        ) as temp_file:
            temp_path = temp_file.name
            json.dump(shelters, temp_file, ensure_ascii=False, indent=2)
            temp_file.write("\n")
        os.replace(temp_path, _SHELTERS_PATH)
    except Exception:
        if temp_path is not None:
            try:
                os.unlink(temp_path)
            except FileNotFoundError:
                pass
        raise


def fetch_shelter_policies(limit: int) -> int:
    shelters = _read_shelters()
    candidates = [
        (shelter, _site_url(shelter.get("website")))
        for shelter in shelters
        if not _has_policies(shelter)
    ]
    candidates = [
        (shelter, site)
        for shelter, site in candidates
        if site is not None
    ][:limit]
    changed = False
    network_failures = 0

    for shelter, site in candidates:
        website, domain = site
        name = shelter.get("name")
        shelter_name = name.strip() if isinstance(name, str) and name.strip() else domain

        first_answer = run_agent(website, POLICY_GOAL)
        if first_answer is None:
            network_failures += 1
            print(f"{shelter_name}: skipped-network (adopt=0, foster=0)")
            continue

        policies = clean_policies(first_answer)
        source_url = website
        if not policies["adopt"] and not policies["foster"]:
            query = f"{shelter_name} adoption requirements {domain}"
            search_response = search(query)
            if search_response is None:
                network_failures += 1
                print(f"{shelter_name}: skipped-network (adopt=0, foster=0)")
                continue

            same_site_urls = _search_results(search_response, domain)
            if same_site_urls:
                source_url = same_site_urls[0]
                fallback_answer = run_agent(source_url, POLICY_GOAL)
                if fallback_answer is None:
                    network_failures += 1
                    print(f"{shelter_name}: skipped-network (adopt=0, foster=0)")
                    continue
                policies = clean_policies(fallback_answer)

        if policies["adopt"] or policies["foster"]:
            kind = "from-site"
        else:
            kind = "contact-shelter"
            source_url = website
            policies = {
                "adopt": [
                    _contact_sentence("adopt", shelter, website),
                    _GENERAL_GUIDANCE["adopt"],
                ],
                "foster": [
                    _contact_sentence("foster", shelter, website),
                    _GENERAL_GUIDANCE["foster"],
                ],
            }

        shelter["policies"] = {
            **policies,
            "sourceUrl": source_url,
            "kind": kind,
        }
        changed = True
        print(
            f"{shelter_name}: {kind} "
            f"(adopt={len(policies['adopt'])}, foster={len(policies['foster'])})"
        )

    if changed:
        _atomic_write(shelters)
    if network_failures:
        print(
            f"Network unavailable for {network_failures} shelter(s); "
            "their policies were left unchanged."
        )
    elif not candidates:
        print("No shelters with a website and missing policies were found.")
    return network_failures


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Fetch shelter adoption and foster policies."
    )
    parser.add_argument("--limit", type=int, default=10)
    args = parser.parse_args()
    if args.limit < 0:
        parser.error("--limit must be zero or greater.")

    if not os.getenv("TINYFISH_API_KEY"):
        print("TINYFISH_API_KEY is missing; set it in the environment or repo-root .env.")
        return 1

    try:
        network_failures = fetch_shelter_policies(args.limit)
    except RuntimeError as exc:
        if "TINYFISH_API_KEY" in str(exc):
            print(
                "TINYFISH_API_KEY is missing; set it in the environment or "
                "repo-root .env."
            )
            return 1
        raise
    except ValueError as exc:
        print(f"Cannot fetch policies: {exc}")
        return 1
    return 1 if network_failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
