import { api } from "./api.js";
import { useEffect, useState } from "react";

export const DEMO = false;

const KEY = "pawpatrol.session";

const safeGet = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const safeSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };

let current = safeGet(KEY);
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn(current));

export const getUser = () => current;
export function setUser(u) { current = u; safeSet(KEY, u); emit(); }
export function logout() { setUser(null); }

/** React hook: returns the signed-in user (or null) and re-renders on change */
export function useAuth() {
  const [u, setU] = useState(current);
  useEffect(() => { listeners.add(setU); return () => listeners.delete(setU); }, []);
  return u;
}

export async function signup(form) {
  const user = await api("/signup", { method: "POST", body: form });
  setUser(user);
  return user;
}

export async function login({ email, password }) {
  const user = await api("/login", {
    method: "POST",
    body: { email, password },
  });
  setUser(user);
  return user;
}

