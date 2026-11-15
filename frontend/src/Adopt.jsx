import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ADOPTABLE, FILTERS, PET_DETAILS, ADOPTION_POLICIES, FOSTER_POLICIES, SHELTERS } from "./data/pets.js";
const shelterOf = (pet) => SHELTERS.find((s) => s.id === pet.shelterId);
import Header from "./components/Header.jsx";
import FooterStrip from "./components/FooterStrip.jsx";
import HamsterLoader from "./components/HamsterLoader.jsx";
import "./dashboard.css";
import "./adopt.css";

const EMPTY = { species: [], age: [], size: [], sex: [] };

/** Paw-print "push pin" drawn in SVG so it scales cleanly */
const PawPin = () => (
  <svg className="pawpin" viewBox="0 0 64 64" aria-hidden>
    <ellipse cx="32" cy="42" rx="14" ry="12" />
    <ellipse cx="14" cy="26" rx="6" ry="8" />
    <ellipse cx="26" cy="15" rx="6" ry="8" />
    <ellipse cx="38" cy="15" rx="6" ry="8" />
    <ellipse cx="50" cy="26" rx="6" ry="8" />
  </svg>
);

/** Overlay with the pet's full profile and the shelter's policies */
function PetDetail({ pet, policies, title, onClose }) {
  const d = PET_DETAILS[pet.id] ?? {};
  useEffect(() => { // Esc closes the panel
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="detail" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="close" onClick={onClose} aria-label="Close">×</button>
        <div className="detail-grid">
          <img src={pet.src} alt={pet.name} />
          <div className="notepad detail-note">
            <PawPin />
            <h3>{pet.name}</h3>
            <p className="meta">{pet.breed} · {pet.species} · {pet.age} · {pet.size} · {pet.sex}</p>
            {shelterOf(pet) && <p className="meta">At <Link className="shelter-link" to={`/shelters/${pet.shelterId}`} onClick={onClose}>{shelterOf(pet).name}</Link></p>}
            <h4>Story</h4>
            <p>{d.story}</p>
            <h4>Health</h4>
            <p>{d.health}</p>
            <h4>Ideal home</h4>
            <p>{d.idealHome}</p>
            {title !== "Foster" && <h4>Adoption fee: {d.fee != null ? `$${d.fee}` : "ask the shelter"}</h4>}
          </div>
        </div>
        <section className="policies">
          <h3>{title === "Foster" ? "How fostering works" : "Shelter adoption policies"}</h3>
          <ol>
            {policies.map((p) => <li key={p}>{p}</li>)}
          </ol>
          <button type="button" className="meet" onClick={onClose}>
            {title === "Foster" ? `Apply to foster ${pet.name.split(" ")[0]}` : `Start adoption for ${pet.name.split(" ")[0]}`}
          </button>
        </section>
      </div>
    </div>
  );
}

/** Shared listing page (Adopt / Foster): filter sidebar on the left, pet photo + notepad card for each listing */
export function PetListing({ title, verb }) {
  const [picked, setPicked] = useState(EMPTY);
  const [open, setOpen] = useState(null); // pet shown in the detail panel
  const [loading, setLoading] = useState(title === "Adopt");
  const policies = title === "Foster" ? FOSTER_POLICIES : ADOPTION_POLICIES;

  useEffect(() => {
    setLoading(false);
  }, []);

  const toggle = (group, value) =>
    setPicked((p) => ({
      ...p,
      [group]: p[group].includes(value) ? p[group].filter((v) => v !== value) : [...p[group], value],
    }));

  const pets = useMemo(
    () =>
      ADOPTABLE.filter((pet) =>
        Object.keys(FILTERS).every((g) => picked[g].length === 0 || picked[g].includes(pet[g]))
      ),
    [picked]
  );
  const anyPicked = Object.values(picked).some((v) => v.length);

  return (
    <div className="dash">
      <Header />

      <main className="adopt">
        <aside className="filters">
          <h2>Filter</h2>
          {Object.entries(FILTERS).map(([group, values]) => (
            <fieldset key={group}>
              <legend>{group}</legend>
              {values.map((v) => (
                <label key={v}>
                  <input type="checkbox" checked={picked[group].includes(v)} onChange={() => toggle(group, v)} />
                  {v}
                </label>
              ))}
            </fieldset>
          ))}
          {anyPicked && (
            <button type="button" className="clear" onClick={() => setPicked(EMPTY)}>Clear filters</button>
          )}
        </aside>

        <section className="listings">
          <h1 className="page-title">{title}</h1>
          <p className="count">{pets.length} {pets.length === 1 ? "pet" : "pets"} {verb}</p>
          {loading ? (
            <HamsterLoader size={96} label="Loading…" />
          ) : pets.length === 0 ? (
            <p className="none">No pets match those filters yet.</p>
          ) : null}
          {!loading && pets.map((pet) => (
            <article key={pet.id} className="pet">
              <figure className="insta">
                <img src={pet.src} alt={`${pet.name}, ${pet.breed}`} loading="lazy" />
              </figure>
              <div className="notepad">
                <PawPin />
                <h3>{pet.name}</h3>
                <p className="meta">{pet.breed} · {pet.species} · {pet.age} · {pet.size} · {pet.sex}</p>
                {shelterOf(pet) && <p className="meta">At <Link className="shelter-link" to={`/shelters/${pet.shelterId}`}>{shelterOf(pet).name}</Link></p>}
                <ul>
                  {pet.notes.map((n) => <li key={n}>{n}</li>)}
                </ul>
                <button type="button" className="meet" onClick={() => setOpen(pet)}>Ask about {pet.name.split(" ")[0]}</button>
              </div>
            </article>
          ))}
        </section>
      </main>

      {open && <PetDetail pet={open} policies={policies} title={title} onClose={() => setOpen(null)} />}

      <FooterStrip />
    </div>
  );
}

export default function Adopt() {
  return <PetListing title="Adopt" verb="looking for a forever home" />;
}
