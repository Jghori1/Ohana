from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .routers import (
    chat,
    directory,
    facts,
    misc,
    pets,
    rescue,
    shelter_account,
    shelter_content,
    users,
)


_REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_REPO_ROOT / ".env")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_UPLOADS_PATH = Path(__file__).resolve().parents[1] / "uploads"
_UPLOADS_PATH.mkdir(parents=True, exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory=_UPLOADS_PATH), name="uploads")

@app.get("/api/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    errors = exc.errors()
    if errors:
        problem = errors[0]
        location = ".".join(str(part) for part in problem.get("loc", ()))
        message = problem.get("msg", "Invalid value.")
        detail = f"{location}: {message}" if location else message
    else:
        detail = "Invalid request."
    return JSONResponse(status_code=400, content={"detail": detail})


@app.exception_handler(Exception)
async def unexpected_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={"detail": "Something went wrong"},
    )


for router in (
    shelter_account.router,
    shelter_content.router,
    pets.router,
    users.router,
    misc.router,
    directory.router,
    facts.router,
    rescue.router,
    chat.router,
):
    app.include_router(router)
