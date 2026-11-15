// Tiny auth store for the demo. Tries the FastAPI backend first; if it isn't running
// (e.g. the single-file preview) it falls back to accounts kept in the browser.
import { useEffect, useState } from "react";

// DEMO: when true, any values are accepted and no backend is contacted (for class demos).
export const DEMO = true;

const KEY = "pawpatrol.session";
const USERS_KEY = "pawpatrol.users";
const BASE = import.meta.env?.VITE_API_URL ?? "/api";

const safeGet = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const safeSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };

// In DEMO mode the session is memory-only, so each fresh page load starts logged out.
let current = DEMO ? null : safeGet(KEY);
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn(current));

export const getUser = () => current;
export function setUser(u) { current = u; if (!DEMO) safeSet(KEY, u); emit(); }
export function logout() { setUser(null); }

/** React hook: returns the signed-in user (or null) and re-renders on change */
export function useAuth() {
  const [u, setU] = useState(current);
  useEffect(() => { listeners.add(setU); return () => listeners.delete(setU); }, []);
  return u;
}

// Demo profile data a new account starts with
const starterProfile = (p) => ({
  name: p.name, email: p.email, phone: p.phone, age: p.age, address: p.address,
  idUploaded: Boolean(p.idFileName), joined: new Date().toISOString().slice(0, 10),
  adoptions: [], fosters: [], volunteer: [], donations: [],
  xp: 50, badges: ["New member"],
});

async function tryApi(path, body) {
  const res = await fetch(`${BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw Object.assign(new Error((await res.json().catch(() => ({}))).detail || `API ${res.status}`), { fromApi: true });
  return res.json();
}

export async function signup(form) {
  if (DEMO) {
    const user = starterProfile({ ...form, name: form.name || "Demo User", email: form.email || "demo@example.com" });
    setUser(user); return user;
  }
  try {
    const user = await tryApi("/signup", form);
    setUser(user); return user;
  } catch (err) {
    if (err.fromApi) throw err; // real validation error from the backend
    // backend unreachable -> browser-only demo accounts
    const users = safeGet(USERS_KEY) || {};
    if (users[form.email]) throw new Error("An account with that email already exists.");
    const user = starterProfile(form);
    users[form.email] = { ...user, password: form.password };
    safeSet(USERS_KEY, users);
    setUser(user); return user;
  }
}

export async function login({ email, password }) {
  if (DEMO) {
    const users = safeGet(USERS_KEY) || {};
    const rec = users[email];
    const user = rec ? (({ password: _pw, ...u }) => u)(rec)
      : starterProfile({ name: email ? email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Demo User",
                         email: email || "demo@example.com", phone: "—", age: "—", address: "—" });
    setUser(user); return user;
  }
  try {
    const user = await tryApi("/login", { email, password });
    setUser(user); return user;
  } catch (err) {
    if (err.fromApi) throw err;
    const users = safeGet(USERS_KEY) || {};
    const rec = users[email];
    if (!rec || rec.password !== password) throw new Error("Wrong email or password.");
    const { password: _pw, ...user } = rec;
    setUser(user); return user;
  }
}

