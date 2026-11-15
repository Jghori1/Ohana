import argparse
import json
import os
import tempfile
from pathlib import Path
from typing import Any

from app.services.needs import clean_needs
from app.services.tinyfish import run_agent

_BACKEND_DIR = Path(__file__).resolve().parents[1]
_SHELTERS_PATH = _BACKEND_DIR / "data" / "shelters.json"
_GOAL = (
    "List the volunteer roles and the items or money the shelter says it needs, "
    "as JSON with the keys roles and needs; return empty lists if the page does not say."
)


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


def _has_needs(shelter: dict[str, Any]) -> bool:
    return bool(shelter.get("roles")) or bool(shelter.get("needs"))


def _atomic_write(shelters: list[dict[str, Any]]) -> None:
    temp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=_SHELTERS_PATH.parent,
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


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Import volunteer roles and needs from shelter websites."
    )
    parser.add_argument("--limit", type=int, default=20)
    args = parser.parse_args()
    if args.limit < 0:
        parser.error("--limit must be zero or greater.")

    if not os.getenv("TINYFISH_API_KEY"):
        print(
            "TINYFISH_API_KEY is missing; set it in the environment or repo-root .env."
        )
        return 1

    try:
        shelters = _read_shelters()
    except ValueError as exc:
        print(f"Cannot import community needs: {exc}")
        return 1

    candidates = [
        shelter
        for shelter in shelters
        if isinstance(shelter.get("website"), str)
        and shelter["website"].strip()
    ][: args.limit]
    if not candidates:
        print("No shelters with a website were found.")
        return 0

    changed = False
    for shelter in candidates:
        website = shelter["website"].strip()
        name = shelter.get("name")
        shelter_name = name.strip() if isinstance(name, str) and name.strip() else website
        if _has_needs(shelter):
            roles = shelter.get("roles")
            needs = shelter.get("needs")
            role_count = len(roles) if isinstance(roles, list) else int(bool(roles))
            need_count = len(needs) if isinstance(needs, list) else int(bool(needs))
            print(
                f"{shelter_name}: skipped-existing "
                f"(roles={role_count}, needs={need_count})"
            )
            continue

        answer = run_agent(website, _GOAL)
        if answer is None:
            print(
                f"{shelter_name}: TinyFish/network unavailable "
                "(roles=0, needs=0); no changes were saved."
            )
            return 1

        result = clean_needs(answer)
        shelter["roles"] = result["roles"]
        shelter["needs"] = result["needs"]
        changed = changed or bool(result["roles"] or result["needs"])
        print(
            f"{shelter_name}: roles={len(result['roles'])}, "
            f"needs={len(result['needs'])}"
        )

    if changed:
        _atomic_write(shelters)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
