// Thin client for the FastAPI backend. In dev, Vite proxies /api -> :8000.
const BASE = import.meta.env.VITE_API_URL ?? "/api";

export async function recordChoice(role, taps) {
  const res = await fetch(`${BASE}/choices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, taps }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function getStats() {
  const res = await fetch(`${BASE}/stats`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}
