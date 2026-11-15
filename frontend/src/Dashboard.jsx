import { useEffect, useRef, useState } from "react";
import { get } from "./api.js";
import Header from "./components/Header.jsx";
import FooterStrip from "./components/FooterStrip.jsx";
import HamsterLoader from "./components/HamsterLoader.jsx";
import "./dashboard.css";

const FALLBACK_PHOTOS = [
  "/pets/kitten-grey-white.jpg",
  "/pets/golden-puppy.jpg",
  "/pets/bernese.jpg",
  "/pets/scottish-fold.jpg",
  "/pets/tabby-kitten.jpg",
  "/pets/hamster.jpg",
  "/pets/two-puppies.jpg",
  "/pets/husky.jpg",
].map((src) => ({ src, alt: "" }));

function readStoredArea() {
  try {
    const area = JSON.parse(localStorage.getItem("pawpatrolArea") || "null");
    return typeof area?.zip === "string" && /^\d{5}$/.test(area.zip)
      ? area
      : null;
  } catch {
    return null;
  }
}

const hideBrokenImage = (event) => {
  event.currentTarget.style.visibility = "hidden";
};

/** Individual dashboard: llama-life top bar, two-panel hero and rescue contacts. */
export default function Dashboard() {
  const [factIdx, setFactIdx] = useState(0);
  const [facts, setFacts] = useState([]);
  const [factsError, setFactsError] = useState("");
  const [livePhotos, setLivePhotos] = useState([]);
  const [area, setArea] = useState(readStoredArea);
  const [areaStatus, setAreaStatus] = useState(() =>
    readStoredArea() ? "loading" : "locating",
  );
  const [areaQuery, setAreaQuery] = useState(null);
  const [pollTick, setPollTick] = useState(0);
  const [zipInput, setZipInput] = useState("");
  const [zipError, setZipError] = useState("");
  const [areaError, setAreaError] = useState("");
  const [rescue, setRescue] = useState(null);
  const [rescueError, setRescueError] = useState("");
  const [contactsRefresh, setContactsRefresh] = useState(0);
  const areaStartedAt = useRef(0);
  const areaLookupId = useRef(0);
  const contactsLookupId = useRef(-1);
  const geolocationRequest = useRef(0);

  const startAreaLookup = (query) => {
    areaLookupId.current += 1;
    areaStartedAt.current = Date.now();
    setAreaQuery(query);
    setPollTick(0);
    setAreaStatus("loading");
    setAreaError("");
    setZipError("");
    setRescue(null);
    setRescueError("");
  };

  useEffect(() => {
    const savedArea = readStoredArea();
    if (savedArea) {
      startAreaLookup({ zip: savedArea.zip });
      return undefined;
    }
    if (!navigator.geolocation) {
      setAreaStatus("zip");
      return undefined;
    }

    setAreaStatus("locating");
    const requestId = ++geolocationRequest.current;
    const useZip = () => {
      if (requestId === geolocationRequest.current) {
        setAreaStatus("zip");
        setAreaError("We couldn't use your location. Enter a ZIP code instead.");
      }
    };
    try {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          if (requestId !== geolocationRequest.current) return;
          if (!Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) {
            useZip();
            return;
          }
          startAreaLookup({ lat: coords.latitude, lng: coords.longitude });
        },
        useZip,
        { timeout: 10000, maximumAge: 300000 },
      );
    } catch {
      useZip();
    }
    return () => {
      geolocationRequest.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!areaQuery) return undefined;
    let active = true;
    const query = new URLSearchParams(
      Object.entries(areaQuery).map(([key, value]) => [key, String(value)]),
    );
    get(`/area?${query}`)
      .then((data) => {
        if (!active) return;
        setArea(data);
        const timedOut =
          data.status === "loading" &&
          Date.now() - areaStartedAt.current >= 180000;
        setAreaStatus(timedOut ? "timeout" : data.status);
        if (contactsLookupId.current !== areaLookupId.current) {
          contactsLookupId.current = areaLookupId.current;
          setContactsRefresh((current) => current + 1);
        }
        try {
          const savedArea = {
            zip: data.zip,
            city: data.city,
            state: data.state,
            lat: data.lat,
            lng: data.lng,
          };
          localStorage.setItem("pawpatrolArea", JSON.stringify(savedArea));
        } catch {
          setAreaError("Location found, but it couldn't be saved in this browser.");
        }
      })
      .catch((error) => {
        if (!active) return;
        setAreaError(error.message);
        setAreaStatus("zip");
      });
    return () => {
      active = false;
    };
  }, [areaQuery, pollTick]);

  useEffect(() => {
    if (areaStatus !== "loading") return undefined;
    const interval = setInterval(() => {
      if (Date.now() - areaStartedAt.current >= 180000) {
        setAreaStatus("timeout");
        setAreaError("The search is taking longer than expected. Try another ZIP code.");
        return;
      }
      setPollTick((current) => current + 1);
    }, 5000);
    return () => clearInterval(interval);
  }, [areaStatus]);

  useEffect(() => {
    let active = true;
    get("/fun-facts")
      .then((data) => {
        if (active && Array.isArray(data)) setFacts(data);
      })
      .catch((error) => {
        if (active) setFactsError(error.message);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (facts.length === 0) return undefined;
    const interval = setInterval(
      () => setFactIdx((current) => (current + 1) % facts.length),
      5000,
    );
    return () => clearInterval(interval);
  }, [facts.length]);

  useEffect(() => {
    let active = true;
    const query = area?.zip ? `?zip=${encodeURIComponent(area.zip)}` : "";
    get(`/marquee${query}`)
      .then((data) => {
        if (active) {
          setLivePhotos(
            Array.isArray(data)
              ? data.filter((photo) => typeof photo.src === "string" && photo.src)
              : [],
          );
        }
      })
      .catch(() => {
        if (active) setLivePhotos([]);
      });
    return () => {
      active = false;
    };
  }, [area?.zip]);

  useEffect(() => {
    const lat = Number(area?.lat);
    const lng = Number(area?.lng);
    if (area?.lat == null || area?.lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return undefined;
    }
    let active = true;
    get(`/rescue-contacts?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`)
      .then((data) => {
        if (active) {
          setRescue(data);
          setRescueError("");
        }
      })
      .catch((error) => {
        if (active) setRescueError(error.message);
      });
    return () => {
      active = false;
    };
  }, [area?.lat, area?.lng, contactsRefresh]);

  const submitZip = (event) => {
    event.preventDefault();
    const zip = zipInput.trim();
    if (!/^\d{5}$/.test(zip)) {
      setZipError("Enter a 5-digit ZIP code.");
      return;
    }
    geolocationRequest.current += 1;
    startAreaLookup({ zip });
  };

  const photos = livePhotos.length >= 4
    ? [...livePhotos, ...FALLBACK_PHOTOS]
    : FALLBACK_PHOTOS;
  const marqueePhotos = [...photos, ...photos];
  const showZipBox = !["locating", "loading"].includes(areaStatus);

  return (
    <div className="dash">
      <Header showProfile={false} />

      <main className="dash-main">
        <section className="dash-panel dash-marquee" aria-label="Pets looking for homes">
          <div className="marquee-track">
            {marqueePhotos.map((photo, index) => (
              <img key={`${photo.src}-${index}`} src={photo.src} alt={photo.alt || ""} loading="lazy" onError={hideBrokenImage} />
            ))}
          </div>
        </section>

        <aside className="dash-panel dash-facts">
          <p className="facts-kicker">Did you know?</p>
          <p className="fact" key={factIdx}>
            {facts.length > 0 ? facts[factIdx] : factsError || "Loading fun facts…"}
          </p>
          <div className="fact-dots" aria-hidden>
            {facts.map((_, index) => (
              <button key={index} className={index === factIdx ? "on" : ""} onClick={() => setFactIdx(index)} />
            ))}
          </div>
        </aside>
      </main>

      <footer className="dash-foot">
        <div className="foot-rescue">
          <h2>Found a stray? Who to call</h2>
          <div className="loc">
            {["locating", "loading"].includes(areaStatus) && (
              <HamsterLoader size={140} label="Finding shelters near you…" />
            )}
            {areaStatus === "ready" && area && (
              <p>Pets near <strong>{area.city}, {area.state}</strong></p>
            )}
            {["empty", "limit"].includes(areaStatus) && (
              <p>Nothing was found for this area yet. Try another ZIP code.</p>
            )}
            {areaStatus === "timeout" && <p>{areaError}</p>}
            {areaStatus === "zip" && areaError && <p role="alert">{areaError}</p>}
            {areaError && areaStatus === "ready" && <p role="alert">{areaError}</p>}
          </div>

          {showZipBox && (
            <form className="welfare-search" onSubmit={submitZip}>
              <label htmlFor="area-zip">5-digit ZIP code</label>
              <div className="welfare-search-controls">
                <input
                  id="area-zip"
                  type="text"
                  inputMode="numeric"
                  maxLength="5"
                  value={zipInput}
                  onChange={(event) => setZipInput(event.target.value)}
                  autoComplete="postal-code"
                />
                <button type="submit">Search</button>
              </div>
              {zipError && <p className="welfare-search-status" role="alert">{zipError}</p>}
            </form>
          )}

          {rescueError && <p role="alert">{rescueError}</p>}
          {rescue ? (
            <>
              <p>Rescue contacts for <strong>{rescue.region}</strong></p>
              {rescue.contacts.length > 0 ? (
                <ul>
                  {rescue.contacts.map((contact) => (
                    <li key={`${contact.who}-${contact.phone}`}>
                      <span className="who">{contact.who}</span>
                      <a className="phone" href={`tel:${contact.phone.replace(/\D/g, "")}`}>
                        {contact.phone}{contact.ext ? ` ${contact.ext}` : ""}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No rescue contacts are listed for this area.</p>
              )}
            </>
          ) : !rescueError ? (
            <p>Share your location or enter a ZIP code to find rescue contacts.</p>
          ) : null}
          <p className="foot-note">If an animal is in immediate danger, call 911.</p>
        </div>
        <FooterStrip />
      </footer>
    </div>
  );
}
