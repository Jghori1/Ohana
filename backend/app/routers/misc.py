import math
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException

from ..core import store

router = APIRouter()


def _is_number(value: Any) -> bool:
    return (
        not isinstance(value, bool)
        and isinstance(value, (int, float))
        and (not isinstance(value, float) or math.isfinite(value))
    )


@router.post("/api/choices")
def record_choice(body: dict[str, Any]) -> dict[str, bool]:
    role = body.get("role")
    if not isinstance(role, str) or role not in {"shelter", "individual"}:
        raise HTTPException(
            status_code=400,
            detail="Role must be shelter or individual.",
        )

    taps = body.get("taps")
    if not _is_number(taps):
        raise HTTPException(status_code=400, detail="Taps must be a number.")

    store.create(
        "choices",
        {
            "role": role,
            "taps": taps,
            "time": datetime.now(timezone.utc).isoformat(),
        },
    )
    return {"ok": True}


@router.get("/api/stats")
def get_stats() -> dict[str, int | float]:
    choices = store.list("choices")
    return {
        "shelter": sum(choice.get("role") == "shelter" for choice in choices),
        "individual": sum(
            choice.get("role") == "individual" for choice in choices
        ),
        "taps": sum(
            choice["taps"]
            for choice in choices
            if (
                choice.get("role") == "shelter"
                or choice.get("role") == "individual"
            )
            and _is_number(choice.get("taps"))
        ),
    }
