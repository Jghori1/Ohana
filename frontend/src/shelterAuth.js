// Session store for shelter accounts (mirrors auth.js). DEMO accepts any values.
import { useEffect, useState } from "react";
import { DEMO } from "./auth.js";

const SHELTER_KEY = "pawpatrol.shelterSession";
const API_BASE = import.meta.env?.VITE_API_URL ?? "/shelterApi";
const sGet = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const sSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

let currentShelter = DEMO ? null : sGet(SHELTER_KEY);
const shelterListeners = new Set();
export const getShelter = () => currentShelter;
export function setShelter(s) { currentShelter = s; if (!DEMO) sSet(SHELTER_KEY, s); shelterListeners.forEach((fn) => fn(s)); }
export function shelterLogout() { setShelter(null); }
export function useShelter() {
  const [s, setS] = useState(currentShelter);
  useEffect(() => { shelterListeners.add(setS); return () => shelterListeners.delete(setS); }, []);
  return s;
}

// What a brand-new shelter account looks like (demo content for requests/photos)
const starterShelter = (f) => ({
  name: f.name || "Demo Shelter",
  email: f.email || "shelter@example.com",
  address: f.address || "123 Main St, Tempe, AZ 85281",
  animals: f.animals?.length ? f.animals : ["Dogs", "Cats"],
  website: f.website || "https://example.com/demo-shelter",
  licenseUploaded: Boolean(f.licenseFileName),
  mission: "",
  joined: new Date().toISOString().slice(0, 10),
  requests: [
    { id: 1, title: "Berry needs medication", amount: 480, raised: 310, note: "Antibiotics and medicated baths for a skin infection." },
    { id: 2, title: "Winter blankets", amount: 200, raised: 40, note: "Fleece blankets for 30 kennels before December." },
  ],
  photos: [],
});

async function shelterApi(path, body) {
  const res = await fetch(`${API_BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `API ${res.status}`);
  return res.json();
}

export async function shelterSignup(form) {
  if (DEMO) { const s = starterShelter(form); setShelter(s); return s; }
  const s = await shelterApi("/shelter/signup", form); setShelter(s); return s;
}
export async function shelterLogin({ email, password }) {
  if (DEMO) { const s = starterShelter({ email, name: email ? email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) + " Shelter" : "" }); setShelter(s); return s; }
  const s = await shelterApi("/shelter/login", { email, password }); setShelter(s); return s;
}
// Local updates (demo). In the real app these would PATCH /shelterApi/shelter/...
export function updateShelter(patch) { setShelter({ ...currentShelter, ...patch }); }
