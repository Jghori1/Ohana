import hashlib
import hmac
import os
import secrets
from typing import Optional

from fastapi import Header, HTTPException

from . import store


_PBKDF2_ITERATIONS = 310_000
_ACCOUNT_COLLECTIONS = {
    "user": "users",
    "shelter": "shelter_accounts",
}

# This authentication implementation is for demos only, not production security.
def hash_password(password: str) -> str:
    salt = os.urandom(16)
    password_hash = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, _PBKDF2_ITERATIONS
    )
    return f"{salt.hex()}${password_hash.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        salt_hex, expected_hash = password_hash.split("$", 1)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(expected_hash)
    except (ValueError, TypeError):
        return False
    actual = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, _PBKDF2_ITERATIONS
    )
    return hmac.compare_digest(actual, expected)


def make_token(kind: str, account_id: str) -> str:
    if kind not in _ACCOUNT_COLLECTIONS:
        raise ValueError(f"Unknown account kind: {kind}")
    token = secrets.token_hex(32)
    store.create(
        "sessions",
        {"token": token, "kind": kind, "accountId": account_id},
    )
    return token


def _current_account(kind: str, authorization: Optional[str]) -> dict:
    if authorization is not None and authorization.startswith("Bearer "):
        token = authorization[len("Bearer ") :].strip()
        session = store.find("sessions", token=token, kind=kind)
        if session is not None:
            account = store.get(_ACCOUNT_COLLECTIONS[kind], session.get("accountId"))
            if account is not None:
                return account
    raise HTTPException(status_code=401, detail="Please log in again.")


def current_user(
    authorization: Optional[str] = Header(default=None),
) -> dict:
    return _current_account("user", authorization)


def current_shelter(
    authorization: Optional[str] = Header(default=None),
) -> dict:
    return _current_account("shelter", authorization)


def public_user(user: dict) -> dict:
    return {key: value for key, value in user.items() if key != "passwordHash"}


def public_shelter(shelter: dict) -> dict:
    return {key: value for key, value in shelter.items() if key != "passwordHash"}
