import base64
import binascii
import re
import secrets
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..core import store
from ..core.auth import current_shelter
from ..models import CauseUrgency, Photo, Request as RequestResponse

router = APIRouter()

_UPLOADS_DIR = Path(__file__).resolve().parents[2] / "uploads"
_MAX_PHOTO_BYTES = 5 * 1024 * 1024
_PHOTO_DATA_URL = re.compile(
    r"data:image/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/]*={0,2})",
    re.IGNORECASE,
)
_PHOTO_EXTENSIONS = {
    "png": ".png",
    "jpeg": ".jpg",
    "webp": ".webp",
    "gif": ".gif",
}


class ShelterRequestBody(BaseModel):
    title: str
    amount: int
    note: str
    pet: str | None = None
    src: str | None = None
    animal: str | None = None
    type: str | None = None
    urgency: CauseUrgency | None = None
    breakdown: list[str] = Field(default_factory=list)


class ShelterRequestPatch(BaseModel):
    title: str | None = None
    amount: int | None = None
    raised: int | None = None
    note: str | None = None
    pet: str | None = None
    src: str | None = None
    animal: str | None = None
    type: str | None = None
    urgency: CauseUrgency | None = None
    breakdown: list[str] | None = None


class ShelterPhotoBody(BaseModel):
    name: str
    data: str


def _owned_record(collection: str, record_id: str, shelter_id: str) -> dict[str, Any]:
    record = store.get(collection, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found.")
    if record.get("shelterId") != shelter_id:
        raise HTTPException(
            status_code=403,
            detail="That belongs to another shelter.",
        )
    return record


def _positive_amount(value: Any) -> bool:
    return (
        isinstance(value, int)
        and not isinstance(value, bool)
        and value > 0
    )


@router.post("/api/shelter/requests", response_model=RequestResponse)
def create_request(
    body: ShelterRequestBody,
    shelter: dict[str, Any] = Depends(current_shelter),
) -> dict[str, Any]:
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="Enter a request title.")
    if not _positive_amount(body.amount):
        raise HTTPException(status_code=400, detail="Enter an amount above $0.")

    return store.create(
        "requests",
        {
            "shelterId": shelter["id"],
            "title": body.title.strip(),
            "amount": body.amount,
            "raised": 0,
            "note": body.note,
            "pet": body.pet,
            "src": body.src,
            "animal": body.animal,
            "type": body.type,
            "urgency": body.urgency,
            "breakdown": body.breakdown,
        },
    )


@router.patch(
    "/api/shelter/requests/{request_id}",
    response_model=RequestResponse,
)
def update_request(
    request_id: str,
    body: ShelterRequestPatch,
    shelter: dict[str, Any] = Depends(current_shelter),
) -> dict[str, Any]:
    request = _owned_record("requests", request_id, shelter["id"])
    patch = body.model_dump(exclude_unset=True)

    if "title" in patch:
        if not isinstance(patch["title"], str) or not patch["title"].strip():
            raise HTTPException(status_code=400, detail="Enter a request title.")
        patch["title"] = patch["title"].strip()
    if "note" in patch and not isinstance(patch["note"], str):
        raise HTTPException(status_code=400, detail="Enter a note.")
    if "breakdown" in patch and not isinstance(patch["breakdown"], list):
        raise HTTPException(
            status_code=400,
            detail="breakdown must be a list of strings.",
        )
    if "amount" in patch and not _positive_amount(patch["amount"]):
        raise HTTPException(status_code=400, detail="Enter an amount above $0.")

    amount = patch.get("amount", request.get("amount"))
    raised = patch.get("raised", request.get("raised", 0))
    if (
        not isinstance(amount, int)
        or isinstance(amount, bool)
        or not isinstance(raised, int)
        or isinstance(raised, bool)
        or raised < 0
        or raised > amount
    ):
        raise HTTPException(
            status_code=400,
            detail="Raised amount must be between $0 and the request amount.",
        )

    updated = store.update("requests", request_id, patch)
    if updated is None:
        raise HTTPException(status_code=404, detail="Request not found.")
    return updated


@router.delete("/api/shelter/requests/{request_id}")
def delete_request(
    request_id: str,
    shelter: dict[str, Any] = Depends(current_shelter),
) -> dict[str, bool]:
    _owned_record("requests", request_id, shelter["id"])
    if not store.delete("requests", request_id):
        raise HTTPException(status_code=404, detail="Request not found.")
    return {"ok": True}


@router.post("/api/shelter/photos", response_model=Photo)
def create_photo(
    body: ShelterPhotoBody,
    shelter: dict[str, Any] = Depends(current_shelter),
) -> dict[str, Any]:
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Enter a file name.")
    match = _PHOTO_DATA_URL.fullmatch(body.data)
    if match is None:
        raise HTTPException(
            status_code=400,
            detail="Upload a PNG, JPEG, WebP, or GIF image.",
        )

    image_type = match.group(1).lower()
    encoded = match.group(2)
    max_encoded_size = 4 * ((_MAX_PHOTO_BYTES + 2) // 3)
    if len(encoded) > max_encoded_size:
        raise HTTPException(
            status_code=400,
            detail="That photo is too large (5 MB maximum).",
        )
    try:
        image = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail="The photo data is invalid.")
    if len(image) > _MAX_PHOTO_BYTES:
        raise HTTPException(
            status_code=400,
            detail="That photo is too large (5 MB maximum).",
        )
    if not image:
        raise HTTPException(status_code=400, detail="The photo data is invalid.")

    file_name = f"{secrets.token_hex(16)}{_PHOTO_EXTENSIONS[image_type]}"
    _UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    (_UPLOADS_DIR / file_name).write_bytes(image)
    return store.create(
        "photos",
        {
            "shelterId": shelter["id"],
            "name": body.name.strip(),
            "src": f"/api/uploads/{file_name}",
        },
    )


@router.delete("/api/shelter/photos/{photo_id}")
def delete_photo(
    photo_id: str,
    shelter: dict[str, Any] = Depends(current_shelter),
) -> dict[str, bool]:
    photo = _owned_record("photos", photo_id, shelter["id"])
    source = photo.get("src")
    if isinstance(source, str) and source.startswith("/api/uploads/"):
        file_name = source.removeprefix("/api/uploads/")
        if file_name and Path(file_name).name == file_name:
            uploads_dir = _UPLOADS_DIR.resolve()
            file_path = (_UPLOADS_DIR / file_name).resolve()
            if file_path.parent == uploads_dir:
                try:
                    file_path.unlink()
                except FileNotFoundError:
                    pass
    if not store.delete("photos", photo_id):
        raise HTTPException(status_code=404, detail="Photo not found.")
    return {"ok": True}
