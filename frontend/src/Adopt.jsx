import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { get, post } from "./api.js";
import Header from "./components/Header.jsx";
import FooterStrip from "./components/FooterStrip.jsx";
import HamsterLoader from "./components/HamsterLoader.jsx";
import "./dashboard.css";
import "./adopt.css";

const EMPTY = { species: [], age: [], size: [], sex: [] };

function storedZip() {
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
    return /^\d{5}$/.test(value) ? value : "";
  } catch {
    return "";
  }
}

const hideBrokenImage = (event) => {
  event.currentTarget.style.visibility = "hidden";
};

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
function PetDetail({ pet, shelter, title, onClose }) {
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activityError, setActivityError] = useState("");
  const [thankYou, setThankYou] = useState("");

  useEffect(() => {
    let active = true;
    setDetailLoading(true);
    setDetailError("");
    get(`/pets/${encodeURIComponent(pet.id)}`)
      .then((data) => {
        if (active) setRecord(data);
      })
      .catch((error) => {
        if (active) setDetailError(error.message);
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });

    return () => {
      active = false;
    };
  }, [pet.id]);

  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const details = record?.details ?? {};
  const policies =
    title === "Foster" ? record?.policies?.foster : record?.policies?.adopt;
  const policyList = Array.isArray(policies) ? policies : [];

  const submitActivity = async () => {
    setSubmitting(true);
    setActivityError("");
    setThankYou("");
    const date = new Date();
    const from = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const type = title === "Foster" ? "foster" : "adoption";
    const activity = {
      type,
      pet: pet.name,
      kind: pet.species,
      ...(type === "foster" ? { from } : {}),
    };

    try {
      await post("/me/activity", activity, "user");
      setThankYou("Thank you — your interest has been recorded.");
    } catch (error) {
      if (error.status === 401 || error.message === "Please log in again.") {
        navigate("/individual/auth");
        return;
      }
      setActivityError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="detail" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="close" onClick={onClose} aria-label="Close">×</button>
        <div className="detail-grid">
          <img src={pet.src} alt={pet.name} onError={hideBrokenImage} />
          <div className="notepad detail-note">
            <PawPin />
            <h3>{pet.name}</h3>
            <p className="meta">{pet.breed} · {pet.species} · {pet.age} · {pet.size} · {pet.sex}</p>
            {shelter && <p className="meta">At <Link className="shelter-link" to={`/shelters/${pet.shelterId}`} onClick={onClose}>{shelter.name}</Link></p>}
            {detailLoading ? (
              <p>Loading pet details…</p>
            ) : detailError ? (
              <p role="alert">{detailError}</p>
            ) : (
              <>
                <h4>Story</h4>
                <p>{details.story}</p>
                <h4>Health</h4>
                <p>{details.health}</p>
                <h4>Ideal home</h4>
                <p>{details.idealHome}</p>
                {title !== "Foster" && (
                  <h4>
                    Adoption fee: {details.fee != null && details.fee !== "" ? `$${details.fee}` : "ask the shelter"}
                  </h4>
                )}
              </>
            )}
          </div>
        </div>
        <section className="policies">
          <h3>{title === "Foster" ? "How fostering works" : "Shelter adoption policies"}</h3>
          {detailLoading ? (
            <p>Loading policies…</p>
          ) : !detailError && policyList.length > 0 ? (
            <ol>
              {policyList.map((policy) => <li key={policy}>{policy}</li>)}
            </ol>
          ) : !detailError ? (
            <p>Policies not listed yet — contact the shelter.</p>
          ) : null}
          <button type="button" className="meet" onClick={submitActivity} disabled={submitting || Boolean(thankYou)}>
            {title === "Foster" ? `Apply to foster ${pet.name.split(" ")[0]}` : `Start adoption for ${pet.name.split(" ")[0]}`}
          </button>
          {activityError && <p role="alert">{activityError}</p>}
          {thankYou && <p role="status">{thankYou}</p>}
        </section>
      </div>
    </div>
  );
}

/** Shared listing page (Adopt / Foster): filter sidebar on the left, pet photo + notepad card for each listing */
export function PetListing({ title, verb }) {
  const [picked, setPicked] = useState(EMPTY);
  const [open, setOpen] = useState(null);
  const [pets, setPets] = useState([]);
  const [shelters, setShelters] = useState([]);
  const [filterOptions, setFilterOptions] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    const zip = storedZip();
    const query = zip ? `?zip=${encodeURIComponent(zip)}` : "";

    Promise.all([
      get(`/pets${query}`),
      get("/filters/pets"),
      get("/shelters"),
    ])
      .then(([petData, filtersData, shelterData]) => {
        if (!active) return;
        setPets(petData);
        setFilterOptions({
          species: filtersData.species ?? [],
          age: filtersData.age ?? [],
          size: filtersData.size ?? [],
          sex: filtersData.sex ?? [],
        });
        setShelters(shelterData);
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

  const sheltersById = useMemo(
    () => new Map(shelters.map((shelter) => [shelter.id, shelter])),
    [shelters],
  );

  const toggle = (group, value) =>
    setPicked((current) => ({
      ...current,
      [group]: current[group].includes(value)
        ? current[group].filter((item) => item !== value)
        : [...current[group], value],
    }));

  const visiblePets = useMemo(
    () =>
      pets.filter((pet) =>
        Object.keys(filterOptions).every(
          (group) =>
            picked[group].length === 0 || picked[group].includes(pet[group]),
        ),
      ),
    [filterOptions, pets, picked],
  );
  const anyPicked = Object.values(picked).some((values) => values.length);

  return (
    <div className="dash">
      <Header />

      <main className="adopt">
        <aside className="filters">
          <h2>Filter</h2>
          {Object.entries(filterOptions).map(([group, values]) => (
            <fieldset key={group}>
              <legend>{group}</legend>
              {values.map((value) => (
                <label key={value}>
                  <input type="checkbox" checked={picked[group].includes(value)} onChange={() => toggle(group, value)} />
                  {value}
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
          <p className="count">{visiblePets.length} {visiblePets.length === 1 ? "pet" : "pets"} {verb}</p>
          {loading ? (
            <HamsterLoader size={96} label="Loading pets…" />
          ) : loadError ? (
            <p className="none">{loadError}</p>
          ) : visiblePets.length === 0 ? (
            <p className="none">No pets match those filters yet.</p>
          ) : null}
          {!loading && !loadError && visiblePets.map((pet) => {
            const shelter = sheltersById.get(pet.shelterId);
            return (
              <article key={pet.id} className="pet">
                <figure className="insta">
                  <img src={pet.src} alt={`${pet.name}, ${pet.breed}`} loading="lazy" onError={hideBrokenImage} />
                </figure>
                <div className="notepad">
                  <PawPin />
                  <h3>{pet.name}</h3>
                  <p className="meta">{pet.breed} · {pet.species} · {pet.age} · {pet.size} · {pet.sex}</p>
                  {shelter && <p className="meta">At <Link className="shelter-link" to={`/shelters/${pet.shelterId}`}>{shelter.name}</Link></p>}
                  <ul>
                    {pet.notes.map((note) => <li key={note}>{note}</li>)}
                  </ul>
                  <button type="button" className="meet" onClick={() => setOpen(pet)}>Ask about {pet.name.split(" ")[0]}</button>
                </div>
              </article>
            );
          })}
        </section>
      </main>

      {open && (
        <PetDetail
          pet={open}
          shelter={sheltersById.get(open.shelterId)}
          title={title}
          onClose={() => setOpen(null)}
        />
      )}

      <FooterStrip />
    </div>
  );
}

export default function Adopt() {
  return <PetListing title="Adopt" verb="looking for a forever home" />;
}
