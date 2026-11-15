import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { get, post } from "./api.js";
import Header from "./components/Header.jsx";
import FooterStrip from "./components/FooterStrip.jsx";
import HamsterLoader from "./components/HamsterLoader.jsx";
import ShelterDetail from "./components/ShelterDetail.jsx";
import "./dashboard.css";
import "./adopt.css";
import "./shelters.css";

function ShelterPic({ src, className }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div className="avatar-frame" aria-hidden="true"></div>;
  }
  return <img src={src} alt="" className={className} onError={() => setFailed(true)} />;
}

function zipQuery() {
  try {
    const stored = localStorage.getItem("pawpatrolArea");
    if (!stored) return "";
    let area;
    try {
      area = JSON.parse(stored);
    } catch {
      area = stored;
    }
    const zip = typeof area === "object" && area ? area.zip : area;
    const value = zip == null ? "" : String(zip);
    return /^\d{5}$/.test(value) ? `?zip=${encodeURIComponent(value)}` : "";
  } catch {
    return "";
  }
}

/**
 * Shared shelter directory (Volunteer / Donate): filter by location, animals and
 * either roles needed (volunteer) or supplies needed (donate).
 */
export function ShelterListing({ title, mode }) {
  const extraKey = mode === "volunteer" ? "roles" : "needs";
  const [picked, setPicked] = useState({ city: [], animals: [], roles: [], needs: [] });
  const [done, setDone] = useState({});
  const [open, setOpen] = useState(null);
  const [shelters, setShelters] = useState([]);
  const [filterOptions, setFilterOptions] = useState({});
  const [activityErrors, setActivityErrors] = useState({});
  const [submitting, setSubmitting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const filters = useMemo(
    () => ({
      city: filterOptions.city ?? [],
      animals: filterOptions.animals ?? [],
      [extraKey]: filterOptions[extraKey] ?? [],
    }),
    [extraKey, filterOptions],
  );
  const empty = useMemo(() => Object.fromEntries(Object.keys(filters).map((k) => [k, []])), [filters]);

  useEffect(() => {
    let active = true;
    Promise.all([get(`/shelters${zipQuery()}`), get("/filters/shelters")])
      .then(([shelterData, filtersData]) => {
        if (!active) return;
        setShelters(shelterData);
        setFilterOptions(filtersData);
      })
      .catch((error) => {
        if (active) setLoadError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const toggle = (group, value) =>
    setPicked((p) => ({
      ...p,
      [group]: p[group].includes(value) ? p[group].filter((v) => v !== value) : [...p[group], value],
    }));

  const visibleShelters = useMemo(
    () =>
      shelters.filter((s) =>
        Object.keys(filters).every((g) => {
          if (picked[g].length === 0) return true;
          const val = s[g];
          return Array.isArray(val) ? val.some((v) => picked[g].includes(v)) : picked[g].includes(val);
        })
      ),
    [picked, filters, shelters],
  );
  const anyPicked = Object.values(picked).some((v) => v.length);
  const labels = { city: "Location", animals: "Animals", roles: "Help needed", needs: "Items needed" };

  const signUp = async (shelter) => {
    const volunteerHours = 2;
    setSubmitting(shelter.id);
    setActivityErrors((current) => ({ ...current, [shelter.id]: "" }));
    try {
      await post("/me/activity", {
        type: "volunteer",
        what: shelter.roles?.[0] || "General help",
        hours: volunteerHours,
      }, "user");
      setDone((current) => ({ ...current, [shelter.id]: true }));
      setOpen(shelter);
    } catch (error) {
      setActivityErrors((current) => ({ ...current, [shelter.id]: error.message }));
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="dash">
      <Header />

      <main className="adopt">
        <aside className="filters">
          <h2>Filter</h2>
          {Object.entries(filters).map(([group, values]) => (
            <fieldset key={group} className={values.length > 8 ? "tall" : ""}>
              <legend>{labels[group]}</legend>
              {values.map((v) => (
                <label key={v}>
                  <input type="checkbox" checked={picked[group].includes(v)} onChange={() => toggle(group, v)} />
                  {v}
                </label>
              ))}
            </fieldset>
          ))}
          {anyPicked && (
            <button type="button" className="clear" onClick={() => setPicked(empty)}>Clear filters</button>
          )}
        </aside>

        <section className="listings">
          <h1 className="page-title">{title}</h1>
          <p className="count">
            {visibleShelters.length} {visibleShelters.length === 1 ? "shelter" : "shelters"} {mode === "volunteer" ? "looking for volunteers" : "accepting donations"}
          </p>
          {loading ? (
            <HamsterLoader size={96} label="Loading…" />
          ) : loadError ? (
            <p className="none" role="alert">{loadError}</p>
          ) : visibleShelters.length === 0 ? (
            <p className="none">No shelters match those filters yet.</p>
          ) : null}
          {!loading && !loadError && visibleShelters.map((s) => (
            <article key={s.id} className="pet shelter">
              <figure className="insta shelter-card">
                <ShelterPic src={s.avatar} />
                <figcaption>
                  <strong><Link className="shelter-link" to={`/shelters/${s.id}`}>{s.name}</Link></strong>
                  <span>{s.address}, {s.city}</span>
                </figcaption>
              </figure>
              <div className="notepad">
                <h3><Link className="shelter-link" to={`/shelters/${s.id}`}>{s.name}</Link></h3>
                <p className="meta">{s.city} · {s.animals.join(" · ")}</p>
                {s[extraKey]?.length > 0 && (
                <p className="tags">
                  {mode === "volunteer" ? "Help needed: " : "Needs: "}
                  {s[extraKey].join(", ")}
                </p>
                )}
                <ul>
                  {s.notes.map((n) => <li key={n}>{n}</li>)}
                </ul>
                {done[s.id] ? (
                  <p className="thanks">
                    {mode === "volunteer" ? "Thank you for offering to volunteer. " : "Thank you! "}
                    <button type="button" className="linkish" onClick={() => setOpen(s)}>Shelter details</button>
                  </p>
                ) : (
                  <>
                    <button type="button" className="meet" disabled={submitting === s.id} onClick={() => mode === "volunteer" ? signUp(s) : setOpen(s)}>
                      {mode === "volunteer" ? "Volunteer here" : "Donate to this shelter"}
                    </button>
                    {activityErrors[s.id] && <p role="alert">{activityErrors[s.id]}</p>}
                  </>
                )}
              </div>
            </article>
          ))}
        </section>
      </main>

      {open && (
        <ShelterDetail
          shelter={open}
          headline={mode === "volunteer" ? `Thanks for volunteering at ${open.name}! Here's what to know before your first shift.` : `Thank you for supporting ${open.name}!`}
          cta={mode === "volunteer" ? "Finish sign-up on the shelter's website" : "Donate on the shelter's website"}
          onClose={() => setOpen(null)}
        />
      )}

      <FooterStrip />
    </div>
  );
}

export default function Volunteer() {
  return <ShelterListing title="Volunteer" mode="volunteer" />;
}
