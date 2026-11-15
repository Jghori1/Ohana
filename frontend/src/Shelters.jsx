import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SHELTERS, SHELTER_FILTERS, VOLUNTEER_ROLES, DONATION_NEEDS } from "./data/pets.js";
import Header from "./components/Header.jsx";
import FooterStrip from "./components/FooterStrip.jsx";
import HamsterLoader from "./components/HamsterLoader.jsx";
import ShelterDetail from "./components/ShelterDetail.jsx";
import "./dashboard.css";
import "./adopt.css";
import "./shelters.css";

/**
 * Shared shelter directory (Volunteer / Donate): filter by location, animals and
 * either roles needed (volunteer) or supplies needed (donate).
 */
export function ShelterListing({ title, mode }) {
  const extraKey = mode === "volunteer" ? "roles" : "needs";
  const filters = useMemo(
    () => ({ ...SHELTER_FILTERS, [extraKey]: mode === "volunteer" ? VOLUNTEER_ROLES : DONATION_NEEDS }),
    [mode, extraKey]
  );
  const empty = useMemo(() => Object.fromEntries(Object.keys(filters).map((k) => [k, []])), [filters]);
  const [picked, setPicked] = useState(empty);
  const [done, setDone] = useState({}); // shelter id -> true after signing up
  const [open, setOpen] = useState(null); // shelter shown in the detail panel
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  const toggle = (group, value) =>
    setPicked((p) => ({
      ...p,
      [group]: p[group].includes(value) ? p[group].filter((v) => v !== value) : [...p[group], value],
    }));

  const shelters = useMemo(
    () =>
      SHELTERS.filter((s) =>
        Object.keys(filters).every((g) => {
          if (picked[g].length === 0) return true;
          const val = s[g];
          return Array.isArray(val) ? val.some((v) => picked[g].includes(v)) : picked[g].includes(val);
        })
      ),
    [picked, filters]
  );
  const anyPicked = Object.values(picked).some((v) => v.length);
  const labels = { city: "Location", animals: "Animals", roles: "Help needed", needs: "Items needed" };

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
            {shelters.length} {shelters.length === 1 ? "shelter" : "shelters"} {mode === "volunteer" ? "looking for volunteers" : "accepting donations"}
          </p>
          {loading ? (
            <HamsterLoader size={96} label="Loading…" />
          ) : shelters.length === 0 ? (
            <p className="none">No shelters match those filters yet.</p>
          ) : null}
          {!loading && shelters.map((s) => (
            <article key={s.id} className="pet shelter">
              <figure className="insta shelter-card">
                <img src={s.avatar} alt="" />
                <figcaption>
                  <strong><Link className="shelter-link" to={`/shelters/${s.id}`}>{s.name}</Link></strong>
                  <span>{s.address}, {s.city}</span>
                </figcaption>
              </figure>
              <div className="notepad">
                <h3><Link className="shelter-link" to={`/shelters/${s.id}`}>{s.name}</Link></h3>
                <p className="meta">{s.city} · {s.animals.join(" · ")}</p>
                <p className="tags">
                  {mode === "volunteer" ? "Help needed: " : "Needs: "}
                  {s[extraKey].join(", ")}
                </p>
                <ul>
                  {s.notes.map((n) => <li key={n}>{n}</li>)}
                </ul>
                {done[s.id] ? (
                  <p className="thanks">
                    {mode === "volunteer" ? "You're signed up — the shelter will email you. " : "Thank you! Your donation is on its way. "}
                    <button type="button" className="linkish" onClick={() => setOpen(s)}>Shelter details</button>
                  </p>
                ) : (
                  <button type="button" className="meet" onClick={() => { setDone((d) => ({ ...d, [s.id]: true })); setOpen(s); }}>
                    {mode === "volunteer" ? "Volunteer here" : "Donate to this shelter"}
                  </button>
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
