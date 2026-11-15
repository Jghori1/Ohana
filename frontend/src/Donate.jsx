import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CAUSES, CAUSE_FILTERS, SHELTERS } from "./data/pets.js";
import Header from "./components/Header.jsx";
import FooterStrip from "./components/FooterStrip.jsx";
import ShelterDetail from "./components/ShelterDetail.jsx";
import "./dashboard.css";
import "./adopt.css";
import "./donate.css";

const EMPTY_PICK = { city: [], animal: [], type: [], urgency: [] };
const LABELS = { city: "Location", animal: "Animals", type: "Cause", urgency: "Urgency" };

/** Donate page: specific causes (a pet's meds, a surgery, supplies) with goals and progress */
export default function Donate() {
  const [picked, setPicked] = useState(EMPTY_PICK);
  const [open, setOpen] = useState(null); // { shelter, cause } for the detail panel

  const toggle = (group, value) =>
    setPicked((p) => ({
      ...p,
      [group]: p[group].includes(value) ? p[group].filter((v) => v !== value) : [...p[group], value],
    }));

  const causes = useMemo(
    () => CAUSES.filter((c) => Object.keys(CAUSE_FILTERS).every((g) => picked[g].length === 0 || picked[g].includes(c[g]))),
    [picked]
  );
  const anyPicked = Object.values(picked).some((v) => v.length);
  const give = (cause) => {
    const shelter = SHELTERS.find((s) => s.name === cause.shelter);
    if (shelter) setOpen({ shelter, cause });
  };

  return (
    <div className="dash">
      <Header />

      <main className="adopt">
        <aside className="filters">
          <h2>Filter</h2>
          {Object.entries(CAUSE_FILTERS).map(([group, values]) => (
            <fieldset key={group}>
              <legend>{LABELS[group]}</legend>
              {values.map((v) => (
                <label key={v}>
                  <input type="checkbox" checked={picked[group].includes(v)} onChange={() => toggle(group, v)} />
                  {v}
                </label>
              ))}
            </fieldset>
          ))}
          {anyPicked && (
            <button type="button" className="clear" onClick={() => setPicked(EMPTY_PICK)}>Clear filters</button>
          )}
        </aside>

        <section className="listings">
          <h1 className="page-title">Donate</h1>
          <p className="count">{causes.length} {causes.length === 1 ? "cause" : "causes"} that need you</p>
          {causes.length === 0 && <p className="none">No causes match those filters yet.</p>}
          {causes.map((c) => {
            const raised = c.raised;
            const pct = Math.min(100, Math.round((raised / c.goal) * 100));
            const funded = raised >= c.goal;
            return (
              <article key={c.id} className="pet cause">
                <figure className="insta">
                  <img src={c.src} alt={c.pet} loading="lazy" />
                </figure>
                <div className="notepad">
                  <span className={`urgency ${c.urgency.replace(/\s/g, "-").toLowerCase()}`}>{c.urgency}</span>
                  <h3>{c.pet} needs {c.type.toLowerCase()}</h3>
                  <p className="meta">
                    {SHELTERS.find((s) => s.name === c.shelter)
                      ? <Link className="shelter-link" to={`/shelters/${SHELTERS.find((s) => s.name === c.shelter).id}`}>{c.shelter}</Link>
                      : c.shelter} · {c.city}
                  </p>
                  <p>{c.story}</p>
                  <ul>
                    {c.breakdown.map((b) => <li key={b}>{b}</li>)}
                  </ul>
                  <div className="progress">
                    <div className="bar"><span style={{ width: `${pct}%` }} /></div>
                    <p className="raised"><strong>${raised.toLocaleString()}</strong> raised of ${c.goal.toLocaleString()} · {pct}%</p>
                  </div>
                  {funded ? (
                    <p className="thanks">Fully funded — thank you!</p>
                  ) : (
                    <button type="button" className="meet" onClick={() => give(c)}>Give</button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      </main>

      {open && (
        <ShelterDetail
          shelter={open.shelter}
          headline={`${open.cause.pet} is cared for by ${open.shelter.name}. Here's where your gift goes.`}
          cta="Donate on the shelter's website"
          onClose={() => setOpen(null)}
        />
      )}

      <FooterStrip />
    </div>
  );
}
