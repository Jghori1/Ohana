# PawPatrol

PawPatrol connects animal shelters with people who want to adopt, foster, volunteer, or donate.

## Run the backend

From the repository root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API health check is at `http://127.0.0.1:8000/api/health`.

## Run the frontend

In another terminal:

```powershell
cd frontend
npm install
npm run dev
```

## Environment variables

Copy the repository-root `.env.example` to `backend/.env` and set values as needed. `TINYFISH_API_KEY` is required for the main data source. `MAX_SITES` defaults to 6. `RESCUEGROUPS_API_KEY` is an optional backup pet source. `GEMINI_API_KEY` is optional; the chatbot falls back to rules. `GEMINI_MODEL` defaults to `gemini-4-hydrogen`. `ADMIN_TOKEN` optionally protects the refresh endpoint. `DEFAULT_ZIP`, `HOME_LAT`, and `HOME_LNG` are development/test defaults only; real sessions use the visitor's location. `AREA_LIMIT_PER_DAY` defaults to 5 new ZIP codes. `PORT` defaults to 8000.

## Known limits

- The backend currently provides the health check and pet-filter values derived from fetched data in `backend/data/pets.json`.
- No pet data or API keys are bundled; live data requires environment configuration and fetch scripts.
