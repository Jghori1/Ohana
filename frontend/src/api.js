import { getUser } from "./auth.js";
import { getShelter } from "./shelterAuth.js";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

export async function api(path, { method = "GET", body, auth } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth === "user" || auth === "shelter") {
    const token =
      auth === "user" ? getUser()?.token : getShelter()?.token;
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : `Request failed (${response.status})`,
    );
  }
  return data;
}

export function get(path, auth) {
  return api(path, { method: "GET", auth });
}

export function post(path, body, auth) {
  return api(path, { method: "POST", body, auth });
}

export function recordChoice(role, taps) {
  return post("/choices", { role, taps });
}

export function getStats() {
  return get("/stats");
}
