import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from tinyfish import CompleteEvent, TinyFish

load_dotenv(Path(__file__).resolve().parents[3] / ".env")


def _require_api_key() -> None:
    if not os.getenv("TINYFISH_API_KEY"):
        raise RuntimeError(
            "TINYFISH_API_KEY is missing. Set TINYFISH_API_KEY in your environment or .env file."
        )


def search(query: str) -> dict[str, Any] | None:
    _require_api_key()
    try:
        client = TinyFish()
        response = client.search.query(query=query, location="US")
        return response.model_dump(mode="json")
    except Exception:
        print("TinyFish search failed.")
        return None


def run_agent(url: str, goal: str) -> Any | None:
    _require_api_key()
    try:
        client = TinyFish(timeout=120)
        with client.agent.stream(url=url, goal=goal) as stream:
            for event in stream:
                if isinstance(event, CompleteEvent):
                    return event.result_json
        raise RuntimeError("TinyFish agent stream ended without a completion event.")
    except Exception:
        print("TinyFish agent run failed.")
        return None
