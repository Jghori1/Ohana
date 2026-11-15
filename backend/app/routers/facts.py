from __future__ import annotations

import logging
import threading
import time

import httpx
from fastapi import APIRouter, Query


router = APIRouter()

_CAT_FACTS_URL = "https://catfact.ninja/facts"
_DOG_FACTS_URL = "https://dogapi.dog/api/v2/facts"
_TIMEOUT = 8.0
_CACHE_TTL = 600.0
_CACHE: dict[int, tuple[float, list[str]]] = {}
_CACHE_LOCK = threading.Lock()
_LOGGER = logging.getLogger(__name__)


def _cat_facts(count: int) -> list[str] | None:
    try:
        response = httpx.get(
            _CAT_FACTS_URL,
            params={"limit": count},
            timeout=_TIMEOUT,
        )
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        _LOGGER.warning("Cat facts source failed (%s).", type(exc).__name__)
        return None

    data = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(data, list):
        _LOGGER.warning("Cat facts source returned an invalid response.")
        return None
    return [
        item["fact"]
        for item in data
        if isinstance(item, dict) and isinstance(item.get("fact"), str)
    ]


def _dog_facts(count: int) -> list[str] | None:
    try:
        response = httpx.get(
            _DOG_FACTS_URL,
            params={"limit": count},
            timeout=_TIMEOUT,
        )
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        _LOGGER.warning("Dog facts source failed (%s).", type(exc).__name__)
        return None

    data = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(data, list):
        _LOGGER.warning("Dog facts source returned an invalid response.")
        return None
    facts: list[str] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        attributes = item.get("attributes")
        if isinstance(attributes, dict) and isinstance(attributes.get("body"), str):
            facts.append(attributes["body"])
    return facts


def _mix_facts(
    cat_facts: list[str] | None, dog_facts: list[str] | None, count: int
) -> list[str]:
    sources = (cat_facts or [], dog_facts or [])
    output: list[str] = []
    seen: set[str] = set()
    for index in range(max(len(source) for source in sources)):
        for source in sources:
            if index >= len(source):
                continue
            fact = source[index].strip()
            normalized = fact.casefold()
            if not fact or len(fact) > 200 or normalized in seen:
                continue
            seen.add(normalized)
            output.append(fact)
            if len(output) == count:
                return output
    return output


def _get_facts(count: int) -> list[str]:
    if count == 0:
        return []

    now = time.monotonic()
    with _CACHE_LOCK:
        cached = _CACHE.get(count)
        if cached is not None and cached[0] > now:
            return list(cached[1])
        if cached is not None:
            del _CACHE[count]

    cats = _cat_facts(count)
    dogs = _dog_facts(count)
    facts = _mix_facts(cats, dogs, count)
    if cats is not None or dogs is not None:
        with _CACHE_LOCK:
            _CACHE[count] = (time.monotonic() + _CACHE_TTL, facts)
    return facts


@router.get("/api/fun-facts")
def fun_facts(count: int = Query(default=8, ge=0)) -> list[str]:
    return _get_facts(count)
