import { useEffect, useRef, useState } from "react";
import {
  PETS,
  FUN_FACTS,
  RESCUE_CONTACTS,
  REGIONS,
  TEMPE_WELFARE_RESOURCE,
} from "./data/pets.js";
import Header from "./components/Header.jsx";
import FooterStrip from "./components/FooterStrip.jsx";
import HamsterLoader from "./components/HamsterLoader.jsx";
import "./dashboard.css";

const FALLBACK = "Somewhere else";

// Haversine distance in km
function distanceKm(a, b) {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
// Nearest configured region within its radius; otherwise use the general fallback.
function regionFor(pos) {
  const nearest = REGIONS
    .map((region) => ({ region, distance: distanceKm(pos, region) }))
    .filter(({ region, distance }) => distance <= region.km)
    .sort((a, b) => a.distance - b.distance)[0];

  return nearest?.region.name ?? FALLBACK;
}

/** Individual dashboard: llama-life top bar, Pusheen-style two-panel hero, cartoon-strip footer. */
export default function Dashboard() {
  const [factIdx, setFactIdx] = useState(0);
  const [geo, setGeo] = useState({ status: "idle", region: FALLBACK });
  const [manualQuery, setManualQuery] = useState("");
  const [manualSearch, setManualSearch] = useState({ status: "idle" });
  const geolocationRequest = useRef(0);

  const locate = () => {
    setManualSearch({ status: "idle" });
    const requestId = ++geolocationRequest.current;
    if (!("geolocation" in navigator)) {
      setGeo({ status: "unsupported", region: FALLBACK });
      return;
    }

    setGeo({ status: "asking", region: FALLBACK });
    const handleError = () => {
      if (requestId === geolocationRequest.current) {
        setGeo({ status: "denied", region: FALLBACK });
      }
    };

    try {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          if (requestId !== geolocationRequest.current) return;
          const location = { lat: coords.latitude, lng: coords.longitude };
          if (
            !Number.isFinite(location.lat) ||
            !Number.isFinite(location.lng) ||
            location.lat < -90 ||
            location.lat > 90 ||
            location.lng < -180 ||
            location.lng > 180
          ) {
            handleError();
            return;
          }

          let storageError = false;
          try {
            localStorage.setItem(
              "sunhacks_location",
              JSON.stringify({ ...location, city: "" })
            );
          } catch {
            storageError = true;
          }

          setGeo({
            status: "ok",
            region: regionFor(location),
            storageError,
          });
        },
        handleError,
        { timeout: 10000, maximumAge: 300000 }
      );
    } catch {
      handleError();
    }
  };

  const searchLocation = (event) => {
    event.preventDefault();
    geolocationRequest.current += 1;
    setGeo((current) =>
      current.status === "asking" ? { status: "idle", region: FALLBACK } : current
    );
    const query = manualQuery.trim();
    if (!query) {
      setManualSearch({ status: "empty" });
      return;
    }

    if (TEMPE_WELFARE_RESOURCE.searchTerms.includes(query.toLowerCase())) {
      let storageError = false;
      try {
        localStorage.setItem(
          "sunhacks_location",
          JSON.stringify({ city: TEMPE_WELFARE_RESOURCE.city })
        );
      } catch {
        storageError = true;
      }
      setManualSearch({ status: "tempe", storageError });
      return;
    }

    let storageError = false;
    try {
      localStorage.removeItem("sunhacks_location");
    } catch {
      storageError = true;
    }
    setManualSearch({ status: "unsupported", query, storageError });
  };

  // Rotate fun facts every 5s
  useEffect(() => {
    const id = setInterval(() => setFactIdx((i) => (i + 1) % FUN_FACTS.length), 5000);
    return () => clearInterval(id);
  }, []);

  const photos = [...PETS, ...PETS]; // doubled so the CSS marquee loops seamlessly
  const tempeRegion = REGIONS.find((region) =>
    region.name.split(" / ").includes(TEMPE_WELFARE_RESOURCE.city)
  )?.name;
  const contactsRegion =
    manualSearch.status === "tempe"
      ? tempeRegion ?? FALLBACK
      : manualSearch.status === "unsupported"
        ? FALLBACK
        : geo.region;

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
          <div className="loc">
            {manualSearch.status === "tempe" && <>Numbers for <strong>{TEMPE_WELFARE_RESOURCE.city}</strong></>}
            {manualSearch.status === "unsupported" && <>We don't have verified local welfare contacts for "{manualSearch.query}". Showing general contacts.</>}
            {!["tempe", "unsupported"].includes(manualSearch.status) && geo.status === "asking" && (
              <HamsterLoader size={72} label="Finding your location…" />
            )}
            {!["tempe", "unsupported"].includes(manualSearch.status) && geo.status === "ok" && <>Numbers for <strong>{geo.region}</strong></>}
            {!["tempe", "unsupported"].includes(manualSearch.status) && geo.status === "ok" && geo.storageError && "Location found, but couldn't be saved for the assistant."}
            {!["tempe", "unsupported"].includes(manualSearch.status) && geo.status === "denied" && "We couldn't use your location. Showing general contacts."}
            {!["tempe", "unsupported"].includes(manualSearch.status) && geo.status === "unsupported" && "Location isn't available in this browser. Showing general contacts."}
            {!["tempe", "unsupported"].includes(manualSearch.status) && geo.status === "idle" && "Use your location to find nearby animal welfare contacts."}
            {geo.status !== "asking" && (
              <button type="button" className="loc-btn" onClick={locate}>
                {geo.status === "ok" ? "Update location" : "Use my location"}
              </button>
            )}
          </div>
          <form className="welfare-search" onSubmit={searchLocation}>
            <label htmlFor="welfare-location">City or ZIP</label>
            <div className="welfare-search-controls">
              <input
                id="welfare-location"
                type="search"
                value={manualQuery}
                onChange={(event) => setManualQuery(event.target.value)}
                autoComplete="postal-code"
              />
              <button type="submit">Search</button>
            </div>
          </form>
          {manualSearch.status === "empty" && (
            <p className="welfare-search-status" role="status">
              Enter a city or ZIP code to search.
            </p>
          )}
          {manualSearch.status === "unsupported" && manualSearch.storageError && (
            <p className="welfare-search-status" role="status">
              We couldn't update the saved location for the assistant.
            </p>
          )}
          {manualSearch.status === "tempe" && (
            <section className="tempe-welfare" aria-labelledby="tempe-welfare-name">
              {TEMPE_WELFARE_RESOURCE.verified && (
                <p className="verified-source">Verified official source</p>
              )}
              <h3 id="tempe-welfare-name">{TEMPE_WELFARE_RESOURCE.name}</h3>
              <address>{TEMPE_WELFARE_RESOURCE.address.split("\n").map((line) => (
                <span key={line}>{line}<br /></span>
              ))}</address>
              <p>
                {TEMPE_WELFARE_RESOURCE.hotline.label}:{" "}
                <a href={`tel:${TEMPE_WELFARE_RESOURCE.hotline.phone.replace(/\D/g, "")}`}>
                  {TEMPE_WELFARE_RESOURCE.hotline.phone}
                </a>
              </p>
              <p>
                Email: <a href={`mailto:${TEMPE_WELFARE_RESOURCE.email}`}>
                  {TEMPE_WELFARE_RESOURCE.email}
                </a>
              </p>
              <p>
                Official webpage:{" "}
                <a href={TEMPE_WELFARE_RESOURCE.website} target="_blank" rel="noopener noreferrer">
                  City of Tempe Office of Animal Welfare
                </a>
              </p>
              <div className="tempe-311">
                <strong>{TEMPE_WELFARE_RESOURCE.timeSensitiveContact.name}</strong>
                <span>{TEMPE_WELFARE_RESOURCE.timeSensitiveContact.description}</span>
                <a href={`tel:${TEMPE_WELFARE_RESOURCE.timeSensitiveContact.phone.replace(/\D/g, "")}`}>
                  {TEMPE_WELFARE_RESOURCE.timeSensitiveContact.phone}
                </a>
              </div>
              <p className="service-limitation">{TEMPE_WELFARE_RESOURCE.serviceLimitation}</p>
              {manualSearch.storageError && (
                <p className="welfare-search-status" role="status">
                  Tempe information is shown, but the location couldn't be saved for the assistant.
                </p>
              )}
            </section>
          )}
          <ul>
            {RESCUE_CONTACTS[contactsRegion].map((c) => (
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
