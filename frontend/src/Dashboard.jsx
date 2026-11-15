import { useEffect, useState } from "react";
import { PETS, FUN_FACTS, RESCUE_CONTACTS, REGIONS } from "./data/pets.js";
import Header from "./components/Header.jsx";
import FooterStrip from "./components/FooterStrip.jsx";
import "./dashboard.css";

const FALLBACK = "Somewhere else";

// Haversine distance in km
function distanceKm(a, b) {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
// Smallest region whose circle contains the point; otherwise the fallback
function regionFor(pos) {
  const hits = REGIONS.filter((r) => distanceKm(pos, r) <= r.km).sort((a, b) => a.km - b.km);
  return hits[0]?.name ?? FALLBACK;
}

/** Individual dashboard: llama-life top bar, Pusheen-style two-panel hero, cartoon-strip footer. */
export default function Dashboard() {
  const [factIdx, setFactIdx] = useState(0);
  const [geo, setGeo] = useState({ status: "idle", region: FALLBACK }); // idle | asking | ok | denied | unsupported

  const locate = () => {
    if (!("geolocation" in navigator)) return setGeo({ status: "unsupported", region: FALLBACK });
    setGeo({ status: "asking", region: FALLBACK });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setGeo({ status: "ok", region: regionFor({ lat: coords.latitude, lng: coords.longitude }) }),
      () => setGeo({ status: "denied", region: FALLBACK }),
      { timeout: 10000, maximumAge: 300000 }
    );
  };
  useEffect(locate, []); // ask as soon as the dashboard opens

  // Rotate fun facts every 5s
  useEffect(() => {
    const id = setInterval(() => setFactIdx((i) => (i + 1) % FUN_FACTS.length), 5000);
    return () => clearInterval(id);
  }, []);

  const photos = [...PETS, ...PETS]; // doubled so the CSS marquee loops seamlessly

  return (
    <div className="dash">
      <Header showProfile={false} />

      {/* ---- Hero: slideshow + fun facts side by side (Pusheen two-panel layout) ---- */}
      <main className="dash-main">
        <section className="dash-panel dash-marquee" aria-label="Pets looking for homes">
          <div className="marquee-track">
            {photos.map((p, i) => (
              <img key={i} src={p.src} alt={p.alt} loading="lazy" />
            ))}
          </div>
        </section>

        <aside className="dash-panel dash-facts">
          <p className="facts-kicker">Did you know?</p>
          <p className="fact" key={factIdx}>{FUN_FACTS[factIdx]}</p>
          <div className="fact-dots" aria-hidden>
            {FUN_FACTS.map((_, i) => (
              <button key={i} className={i === factIdx ? "on" : ""} onClick={() => setFactIdx(i)} />
            ))}
          </div>
        </aside>
      </main>

      {/* ---- Footer: stray-rescue contacts, then the cartoon crowd image ---- */}
      <footer className="dash-foot">
        <div className="foot-rescue">
          <h2>Found a stray? Who to call</h2>
          <p className="loc">
            {geo.status === "asking" && "Finding your location…"}
            {geo.status === "ok" && <>Numbers for <strong>{geo.region}</strong></>}
            {geo.status === "denied" && "Location access was blocked — showing general numbers."}
            {geo.status === "unsupported" && "This browser can't share location — showing general numbers."}
            {geo.status === "idle" && "General numbers"}
            {geo.status !== "asking" && (
              <button type="button" className="loc-btn" onClick={locate}>
                {geo.status === "ok" ? "Update location" : "Use my location"}
              </button>
            )}
          </p>
          <ul>
            {RESCUE_CONTACTS[geo.region].map((c) => (
              <li key={c.who}>
                <span className="who">{c.who}</span>
                <a className="phone" href={`tel:${c.phone.replace(/\D/g, "")}`}>
                  {c.phone}{c.ext ? ` ${c.ext}` : ""}
                </a>
              </li>
            ))}
          </ul>
          <p className="foot-note">If an animal is in immediate danger, call 911.</p>
        </div>
        <FooterStrip />
      </footer>
    </div>
  );
}
