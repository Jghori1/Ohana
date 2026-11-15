import argparse
import json
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

_BACKEND_DIR = Path(__file__).resolve().parents[1]
_REPO_ROOT = _BACKEND_DIR.parent
_DATA_DIR = _BACKEND_DIR / "data"

load_dotenv(_REPO_ROOT / ".env")


def _looks_like_shelter(result: dict[str, Any]) -> bool:
    keywords = ("shelter", "rescue", "adopt", "adoption", "humane society")
    text = f"{result.get('title', '')} {result.get('url', '')}".lower()
    return any(keyword in text for keyword in keywords)


def main() -> int:
    parser = argparse.ArgumentParser(description="Explore TinyFish shelter search results.")
    parser.add_argument("zip_code", nargs="?", help="ZIP code to search near")
    args = parser.parse_args()

    zip_code = args.zip_code or os.getenv("DEFAULT_ZIP")
    if not zip_code:
        parser.error("provide a ZIP code or set DEFAULT_ZIP in .env")

    from app.services.mapping import AGENT_GOAL
    from app.services.tinyfish import run_agent, search

    query = (
        f"Animal shelters and rescues with adoptable dogs and cats near {zip_code}"
    )
    raw_search = search(query)
    if raw_search is None:
        return 1

    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    (_DATA_DIR / "raw_search.json").write_text(
        json.dumps(raw_search, indent=2) + "\n", encoding="utf-8"
    )

    results = raw_search.get("results", [])
    for result in results[:10]:
        print(f"{result.get('title', '')}\n{result.get('url', '')}")

    shelter = next(
        (
            result
            for result in results
            if isinstance(result, dict)
            and _looks_like_shelter(result)
            and result.get("url")
        ),
        None,
    )
    if shelter is None:
        print("No shelter or adoption site found in the search results.")
        return 1

    raw_sample = run_agent(shelter["url"], AGENT_GOAL)
    if raw_sample is None:
        return 1

    (_DATA_DIR / "raw_sample.json").write_text(
        json.dumps(raw_sample, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(raw_sample, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
