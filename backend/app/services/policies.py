from __future__ import annotations

import json
from collections.abc import Mapping
from typing import Any


POLICY_GOAL = (
    "Find this animal shelter's adoption requirements, adoption process, adoption "
    "fees and its foster requirements. Return JSON only with the keys adopt and "
    "foster, each a list of short plain sentences copied or closely paraphrased "
    "from the page (at most 5 each). Return empty lists if the page does not say."
)


def clean_policies(answer: Any) -> dict[str, list[str]]:
    if isinstance(answer, str):
        try:
            answer = json.loads(answer)
        except json.JSONDecodeError:
            answer = None
    if not isinstance(answer, Mapping):
        answer = {}

    cleaned: dict[str, list[str]] = {}
    for policy_type in ("adopt", "foster"):
        values = answer.get(policy_type)
        results: list[str] = []
        seen: set[str] = set()
        if isinstance(values, list):
            for value in values:
                if not isinstance(value, str):
                    continue
                sentence = " ".join(value.split())
                normalized = sentence.casefold()
                if (
                    not sentence
                    or len(sentence) > 140
                    or normalized in seen
                    or len(results) >= 5
                ):
                    continue
                seen.add(normalized)
                results.append(sentence)
        cleaned[policy_type] = results
    return cleaned
