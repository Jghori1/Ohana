import { api } from "./api.js";
import { useEffect, useState } from "react";

const SHELTER_KEY = "pawpatrol.shelterSession";
const sGet = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const sSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

let currentShelter = sGet(SHELTER_KEY);
const shelterListeners = new Set();
export const getShelter = () => currentShelter;
export function setShelter(s) { currentShelter = s; sSet(SHELTER_KEY, s); shelterListeners.forEach((fn) => fn(s)); }
export function shelterLogout() { setShelter(null); }
export function useShelter() {
  const [s, setS] = useState(currentShelter);
  useEffect(() => { shelterListeners.add(setS); return () => shelterListeners.delete(setS); }, []);
  return s;
}

export async function shelterSignup(form) {
  const shelter = await api("/shelter/signup", { method: "POST", body: form });
  setShelter(shelter);
  return shelter;
}
export async function shelterLogin({ email, password }) {
  const shelter = await api("/shelter/login", {
    method: "POST",
    body: { email, password },
  });
  setShelter(shelter);
  return shelter;
}
// Local updates (demo). In the real app these would PATCH /shelterApi/shelter/...
export function updateShelter(patch) { setShelter({ ...currentShelter, ...patch }); }
