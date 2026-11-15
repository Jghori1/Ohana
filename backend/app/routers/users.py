import re
import threading
import time
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException

from ..core import auth, store
from ..core.auth import current_user
from ..models import ActivityBody, LoginBody, User

router = APIRouter()


_EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_LOGIN_FAILURE_WINDOW = 10 * 60
_LOGIN_FAILURE_LIMIT = 5
_LOGIN_FAILURES: dict[str, list[float]] = {}
_LOGIN_FAILURES_LOCK = threading.Lock()


def _profile_field_problem(field: str, value: Any) -> str | None:
    if field == "name" and (
        not isinstance(value, str) or len(value.strip()) < 2
    ):
        return "Please enter your full name."
    if field == "phone" and (
        not isinstance(value, str)
        or sum(character.isdigit() for character in value) < 10
    ):
        return "Enter a 10-digit phone number."
    if field == "address" and (
        not isinstance(value, str) or len(value.strip()) < 6
    ):
        return "Enter your street address."
    return None


def _signup_problem(body: dict[str, Any]) -> tuple[str | None, int | None]:
    name = body.get("name")
    problem = _profile_field_problem("name", name)
    if problem is not None:
        return problem, None

    email = body.get("email")
    if not isinstance(email, str) or not _EMAIL_PATTERN.fullmatch(email.strip()):
        return "Enter a valid email address.", None

    phone = body.get("phone")
    problem = _profile_field_problem("phone", phone)
    if problem is not None:
        return problem, None

    password = body.get("password")
    if not isinstance(password, str) or len(password) < 8:
        return "Password must be at least 8 characters.", None
    if not any(character.isalpha() for character in password) or not any(
        character.isdigit() for character in password
    ):
        return "Use letters and at least one number.", None

    if body.get("confirm") != password:
        return "Passwords don't match.", None

    age = body.get("age")
    if isinstance(age, str):
        try:
            age = int(age.strip())
        except ValueError:
            age = None
    if not isinstance(age, int) or isinstance(age, bool) or not 18 <= age <= 120:
        return "You must be 18 or older to adopt or foster.", None

    address = body.get("address")
    problem = _profile_field_problem("address", address)
    if problem is not None:
        return problem, None

    return None, age


def _prune_login_failures(now: float) -> None:
    for email, failures in list(_LOGIN_FAILURES.items()):
        recent = [
            failed_at
            for failed_at in failures
            if now - failed_at < _LOGIN_FAILURE_WINDOW
        ]
        if recent:
            _LOGIN_FAILURES[email] = recent
        else:
            del _LOGIN_FAILURES[email]


def _user_response(user: dict[str, Any], token: str) -> dict[str, Any]:
    return {**auth.public_user(user), "token": token}


@router.post("/api/signup", response_model=User)
def signup(body: dict[str, Any]) -> dict[str, Any]:
    problem, age = _signup_problem(body)
    if problem is not None:
        raise HTTPException(status_code=400, detail=problem)

    email = body["email"].strip().lower()
    if any(
        isinstance(user.get("email"), str)
        and user["email"].strip().lower() == email
        for user in store.list("users")
    ):
        raise HTTPException(
            status_code=400,
            detail="An account with that email already exists.",
        )

    user = store.create(
        "users",
        {
            "name": body["name"].strip(),
            "email": email,
            "phone": body["phone"].strip(),
            "passwordHash": auth.hash_password(body["password"]),
            "age": age,
            "address": body["address"].strip(),
            "idUploaded": bool(body.get("idFileName")),
            "joined": date.today().isoformat(),
            "adoptions": [],
            "fosters": [],
            "volunteer": [],
            "donations": [],
            "xp": 50,
            "badges": ["New member"],
        },
    )
    token = auth.make_token("user", user["id"])
    return _user_response(user, token)


@router.post("/api/login", response_model=User)
def login(body: LoginBody) -> dict[str, Any]:
    email = body.email.strip().lower()
    user = next(
        (
            candidate
            for candidate in store.list("users")
            if isinstance(candidate.get("email"), str)
            and candidate["email"].strip().lower() == email
        ),
        None,
    )
    with _LOGIN_FAILURES_LOCK:
        now = time.monotonic()
        _prune_login_failures(now)
        if len(_LOGIN_FAILURES.get(email, [])) >= _LOGIN_FAILURE_LIMIT:
            raise HTTPException(
                status_code=400,
                detail="Too many tries. Please wait a few minutes.",
            )
        if user is None or not auth.verify_password(
            body.password, user.get("passwordHash", "")
        ):
            _LOGIN_FAILURES.setdefault(email, []).append(time.monotonic())
            raise HTTPException(status_code=400, detail="Wrong email or password.")

    token = auth.make_token("user", user["id"])
    return _user_response(user, token)


@router.get("/api/me", response_model=User)
def me(
    user: dict[str, Any] = Depends(current_user),
    authorization: str = Header(default=""),
) -> dict[str, Any]:
    token = authorization[len("Bearer ") :].strip()
    return _user_response(user, token)


@router.put("/api/me", response_model=User)
def update_me(
    body: dict[str, Any],
    user: dict[str, Any] = Depends(current_user),
    authorization: str = Header(default=""),
) -> dict[str, Any]:
    patch: dict[str, str] = {}
    for field in ("name", "phone", "address"):
        if field not in body:
            continue
        problem = _profile_field_problem(field, body[field])
        if problem is not None:
            raise HTTPException(status_code=400, detail=problem)
        patch[field] = body[field].strip()

    updated = store.update("users", user["id"], patch)
    if updated is None:
        raise HTTPException(status_code=401, detail="Please log in again.")
    token = authorization[len("Bearer ") :].strip()
    return _user_response(updated, token)


@router.post("/api/me/activity", response_model=User)
def add_activity(
    body: ActivityBody,
    user: dict[str, Any] = Depends(current_user),
    authorization: str = Header(default=""),
) -> dict[str, Any]:
    token = authorization[len("Bearer ") :].strip()
    today = date.today()

    if body.type == "adoption":
        pet = (body.pet or "").strip()
        if not pet:
            raise HTTPException(status_code=400, detail="Enter the pet's name.")
        activity = {
            "pet": pet,
            "kind": (body.kind or "").strip(),
            "date": body.date or today.isoformat(),
        }
        collection = "adoptions"
    elif body.type == "foster":
        pet = (body.pet or "").strip()
        if not pet:
            raise HTTPException(status_code=400, detail="Enter the pet's name.")
        activity = {
            "pet": pet,
            "kind": (body.kind or "").strip(),
            "from": (body.from_ or "").strip(),
            "to": (body.to or "").strip(),
        }
        if not activity["from"]:
            raise HTTPException(
                status_code=400, detail="Enter the foster start date."
            )
        collection = "fosters"
    elif body.type == "volunteer":
        what = (body.what or "").strip()
        if not what:
            raise HTTPException(
                status_code=400, detail="Enter your volunteer activity."
            )
        if body.hours is None or body.hours <= 0:
            raise HTTPException(
                status_code=400, detail="Enter volunteer hours above 0."
            )
        activity = {
            "what": what,
            "hours": body.hours,
            "date": body.date or today.strftime("%Y-%m"),
        }
        collection = "volunteer"
    else:
        if body.amount is None or body.amount <= 0:
            raise HTTPException(status_code=400, detail="Enter an amount above 0.")
        activity = {
            "amount": body.amount,
            "date": body.date or today.isoformat(),
            "note": (body.note or "").strip(),
        }
        collection = "donations"

    updated = store.update(
        "users",
        user["id"],
        {collection: [*user.get(collection, []), activity]},
    )
    if updated is None:
        raise HTTPException(status_code=401, detail="Please log in again.")
    return _user_response(updated, token)
