from __future__ import annotations

import builtins
import json
import os
import tempfile
import threading
import uuid
from pathlib import Path
from typing import Any, Callable


_DATA_DIR = Path(__file__).resolve().parents[2] / "data"
_COLLECTIONS = {
    "users",
    "shelter_accounts",
    "shelters",
    "pets",
    "requests",
    "photos",
    "sessions",
    "choices",
    "areas",
}
_LOCK = threading.RLock()


def _collection_path(collection: str) -> Path:
    if collection not in _COLLECTIONS:
        raise ValueError(f"Unknown collection: {collection}")
    return _DATA_DIR / f"{collection}.json"


def _read(collection: str) -> list[dict[str, Any]]:
    path = _collection_path(collection)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return []
    if not isinstance(data, builtins.list) or any(
        not isinstance(item, dict) for item in data
    ):
        raise ValueError(f"Collection {collection} must contain a JSON list of objects.")
    return data


def _write(collection: str, items: list[dict[str, Any]]) -> None:
    path = _collection_path(collection)
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    temp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=_DATA_DIR,
            prefix=f".{collection}-",
            suffix=".tmp",
            delete=False,
        ) as temp_file:
            temp_path = temp_file.name
            json.dump(items, temp_file, ensure_ascii=False, indent=2)
            temp_file.write("\n")
        os.replace(temp_path, path)
    except Exception:
        if temp_path is not None:
            try:
                os.unlink(temp_path)
            except FileNotFoundError:
                pass
        raise


def list(collection: str) -> list[dict[str, Any]]:
    with _LOCK:
        return _read(collection)


def get(collection: str, id: str) -> dict[str, Any] | None:
    with _LOCK:
        return next((item for item in _read(collection) if item.get("id") == id), None)


def find(collection: str, **equals: Any) -> dict[str, Any] | None:
    with _LOCK:
        return next(
            (
                item
                for item in _read(collection)
                if all(item.get(key) == value for key, value in equals.items())
            ),
            None,
        )


def create(collection: str, item: dict[str, Any]) -> dict[str, Any]:
    with _LOCK:
        items = _read(collection)
        created = dict(item)
        if not created.get("id"):
            created["id"] = str(uuid.uuid4())
        items.append(created)
        _write(collection, items)
        return created


def update(collection: str, id: str, patch: dict[str, Any]) -> dict[str, Any] | None:
    with _LOCK:
        items = _read(collection)
        for index, item in enumerate(items):
            if item.get("id") == id:
                updated = {**item, **patch, "id": item.get("id")}
                items[index] = updated
                _write(collection, items)
                return updated
        return None


def delete(collection: str, id: str) -> bool:
    with _LOCK:
        items = _read(collection)
        remaining = [item for item in items if item.get("id") != id]
        if len(remaining) == len(items):
            return False
        _write(collection, remaining)
        return True


def replace_where(
    collection: str,
    predicate: Callable[[dict[str, Any]], bool],
    new_items: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    with _LOCK:
        items = _read(collection)
        replaced = [item for item in items if not predicate(item)]
        replaced.extend(new_items)
        _write(collection, replaced)
        return replaced
