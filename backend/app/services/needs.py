import json
from collections.abc import Mapping
from typing import Any


def _clean_values(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []

    cleaned: list[str] = []
    seen: set[str] = set()
    for item in value:
        if not isinstance(item, str):
            continue
        text = item.strip()
        key = text.casefold()
        if not text or len(text) > 80 or key in seen:
            continue
        seen.add(key)
        cleaned.append(text)
    return cleaned


def clean_needs(answer: Any) -> dict[str, list[str]]:
    if isinstance(answer, str):
        try:
            answer = json.loads(answer)
        except json.JSONDecodeError:
            return {"roles": [], "needs": []}
    if not isinstance(answer, Mapping):
        return {"roles": [], "needs": []}
    return {
        "roles": _clean_values(answer.get("roles")),
        "needs": _clean_values(answer.get("needs")),
    }
