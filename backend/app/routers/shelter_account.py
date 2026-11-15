import re
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException

from ..core import auth, store
from ..core.auth import current_shelter
from ..models import LoginBody, ShelterAccount, ShelterSignupBody

router = APIRouter()

_EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_EDITABLE_FIELDS = (
    "mission",
    "about",
    "hours",
    "phone",
    "website",
    "address",
    "animals",
    "roles",
    "needs",
)
_LIST_FIELDS = {"animals", "roles", "needs"}


def _signup_problem(body: ShelterSignupBody) -> str | None:
    if len(body.name.strip()) < 2:
        return "Enter the shelter's name."
    if not _EMAIL_PATTERN.fullmatch(body.email.strip()):
        return "Enter the shelter's official email."
    if len(body.password) < 8:
        return "Password must be at least 8 characters."
    if body.confirm != body.password:
        return "Passwords don't match."
    if len(body.address.strip()) < 6:
        return "Enter the shelter's street address."
    if not body.website.strip().lower().startswith(("http://", "https://")):
        return "Enter the full website link (https://…)."
    if not body.animals:
        return "Pick at least one kind of animal."
    if not body.licenseFileName or not body.licenseFileName.strip():
        return "Upload your shelter license."
    return None


def _account_response(account: dict[str, Any], token: str) -> dict[str, Any]:
    shelter_id = account["id"]
    requests = [
        request
        for request in store.list("requests")
        if request.get("shelterId") == shelter_id
    ]
    photos = [
        {
            "id": photo.get("id", ""),
            "src": photo.get("src", ""),
            "name": photo.get("name", ""),
        }
        for photo in store.list("photos")
        if photo.get("shelterId") == shelter_id
    ]
    return {
        **auth.public_shelter(account),
        "token": token,
        "requests": requests,
        "photos": photos,
    }


@router.post("/api/shelter/signup", response_model=ShelterAccount)
def shelter_signup(body: ShelterSignupBody) -> dict[str, Any]:
    problem = _signup_problem(body)
    if problem is not None:
        raise HTTPException(status_code=400, detail=problem)

    email = body.email.strip().lower()
    if any(
        isinstance(account.get("email"), str)
        and account["email"].strip().lower() == email
        for account in store.list("shelter_accounts")
    ):
        raise HTTPException(
            status_code=400,
            detail="An account with that email already exists.",
        )

    address = body.address.strip()
    website = body.website.strip()
    account = store.create(
        "shelter_accounts",
        {
            "name": body.name.strip(),
            "email": email,
            "passwordHash": auth.hash_password(body.password),
            "address": address,
            "animals": body.animals,
            "website": website,
            "licenseUploaded": bool(body.licenseFileName.strip()),
            "mission": "",
            "joined": date.today().isoformat(),
        },
    )
    address_parts = address.split(",")
    city = address_parts[1].strip() if len(address_parts) > 1 else ""
    store.create(
        "shelters",
        {
            "id": account["id"],
            "name": account["name"],
            "city": city,
            "address": address,
            "mission": "",
            "about": "",
            "hours": "",
            "phone": "",
            "email": email,
            "website": website,
            "avatar": "",
            "animals": body.animals,
            "roles": [],
            "needs": [],
            "notes": [],
            "source": "registered",
        },
    )
    token = auth.make_token("shelter", account["id"])
    return _account_response(account, token)


@router.post("/api/shelter/login", response_model=ShelterAccount)
def shelter_login(body: LoginBody) -> dict[str, Any]:
    email = body.email.strip().lower()
    account = next(
        (
            candidate
            for candidate in store.list("shelter_accounts")
            if isinstance(candidate.get("email"), str)
            and candidate["email"].strip().lower() == email
        ),
        None,
    )
    if account is None or not auth.verify_password(
        body.password, account.get("passwordHash", "")
    ):
        raise HTTPException(status_code=400, detail="Wrong email or password.")

    token = auth.make_token("shelter", account["id"])
    return _account_response(account, token)


@router.get("/api/shelter/me", response_model=ShelterAccount)
def shelter_me(
    shelter: dict[str, Any] = Depends(current_shelter),
    authorization: str = Header(default=""),
) -> dict[str, Any]:
    token = authorization[len("Bearer ") :].strip()
    return _account_response(shelter, token)


@router.patch("/api/shelter/me", response_model=ShelterAccount)
def update_shelter(
    body: dict[str, Any],
    shelter: dict[str, Any] = Depends(current_shelter),
    authorization: str = Header(default=""),
) -> dict[str, Any]:
    patch = {field: body[field] for field in _EDITABLE_FIELDS if field in body}
    for field, value in patch.items():
        if field in _LIST_FIELDS:
            if not isinstance(value, list) or any(
                not isinstance(item, str) for item in value
            ):
                raise HTTPException(
                    status_code=400,
                    detail=f"{field} must be a list of strings.",
                )
        elif not isinstance(value, str):
            raise HTTPException(status_code=400, detail=f"{field} must be text.")

    shelter_record = store.get("shelters", shelter["id"])
    if shelter_record is None:
        raise HTTPException(status_code=404, detail="Shelter profile not found.")

    account = shelter
    if patch:
        updated_account = store.update("shelter_accounts", shelter["id"], patch)
        if updated_account is None:
            raise HTTPException(status_code=404, detail="Shelter account not found.")

        shelter_patch = dict(patch)
        if "address" in patch:
            address_parts = patch["address"].split(",")
            shelter_patch["city"] = (
                address_parts[1].strip() if len(address_parts) > 1 else ""
            )
        updated_shelter = store.update("shelters", shelter["id"], shelter_patch)
        if updated_shelter is None:
            raise HTTPException(status_code=404, detail="Shelter profile not found.")
        account = updated_account

    token = authorization[len("Bearer ") :].strip()
    return _account_response(account, token)
