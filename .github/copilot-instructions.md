# Copilot instructions

- The stack is FastAPI, Python, httpx, and a JSON file store.
- The `frontend/` folder is finished and must never be edited.
- All response shapes come from `docs/CONTRACTS.md`; key names must match exactly (camelCase).
- Every error response is JSON: `{"detail": "<readable message>"}`.
- Never invent pets, shelters, phone numbers, URLs, or API keys.
- Do not add sample or fake data to code or JSON files. Data comes only from live fetch scripts or user input.
- Every outbound HTTP call uses httpx with a timeout and try/except so one failing source never crashes the API.
- Keys come from environment variables only and are never printed or logged.
