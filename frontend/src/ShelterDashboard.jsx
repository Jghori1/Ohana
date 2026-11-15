import { useState } from "react";
import { useParams } from "react-router-dom";
import { useShelter, updateShelter, getShelter } from "./shelterAuth.js";
import { SHELTERS, CAUSES, PETS } from "./data/pets.js";
import ShelterHeader from "./components/ShelterHeader.jsx";
import Header from "./components/Header.jsx";
import FooterStrip from "./components/FooterStrip.jsx";
import "./dashboard.css";
import "./profile.css";
import "./donate.css";
import "./shelterdash.css";

/**
 * Shelter page. Two uses:
 *  - the signed-in shelter's own page (editable): <ShelterDashboard />
 *  - a public, read-only view for individuals: <ShelterPublic /> (route /shelters/:id)
 */
export function ShelterPage({ shelter, readOnly, header, onChange }) {
  const [draft, setDraft] = useState({ title: "", amount: "", note: "" });
  const [editingMission, setEditingMission] = useState(false);
  const [missionDraft, setMissionDraft] = useState(shelter.mission || "");

  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(shelter.address)}&output=embed`;
  const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shelter.address)}`;

  const addRequest = (e) => {
    e.preventDefault();
    if (!draft.title.trim() || !Number(draft.amount)) return;
    const req = { id: Date.now(), title: draft.title.trim(), amount: Number(draft.amount), raised: 0, note: draft.note.trim() };
    onChange({ requests: [req, ...shelter.requests] });
    setDraft({ title: "", amount: "", note: "" });
  };
  const removeRequest = (id) => onChange({ requests: shelter.requests.filter((r) => r.id !== id) });

  // Photos are kept as data URLs in the session for the demo; a real build would upload to S3.
  const addPhotos = (e) => {
    const files = Array.from(e.target.files || []).slice(0, 12);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => onChange({ photos: [{ id: Date.now() + Math.random(), src: reader.result, name: file.name }, ...getShelter().photos] });
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };
  const removePhoto = (id) => onChange({ photos: shelter.photos.filter((p) => p.id !== id) });
  const saveMission = () => { onChange({ mission: missionDraft.trim() }); setEditingMission(false); };

  return (
    <div className="dash">
      {header}
      <main className="profile shelterdash">
        <h1 className="page-title">{shelter.name}</h1>
        <p className="count">
          {shelter.animals.join(" · ")}
          {!readOnly && ` · ${shelter.licenseUploaded ? "License uploaded — pending review" : "No license on file"}`}
          {readOnly && " · Verified shelter"}
        </p>

        <section className="card mission">
          <h2>Our mission {!readOnly && !editingMission && <button type="button" className="linkish" onClick={() => setEditingMission(true)}>Edit</button>}</h2>
          {editingMission ? (
            <div className="mission-edit">
              <textarea rows="4" value={missionDraft} onChange={(e) => setMissionDraft(e.target.value)} placeholder="What does your shelter stand for?" />
              <div className="links">
                <button type="button" className="meet" onClick={saveMission}>Save</button>
                <button type="button" className="meet ghost" onClick={() => { setMissionDraft(shelter.mission || ""); setEditingMission(false); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <p className="mission-text">{shelter.mission || (readOnly ? "This shelter hasn't written a mission yet." : "Tell people what your shelter stands for — click Edit.")}</p>
          )}
        </section>

        <div className="two">
          <section className="card">
            <h2>Find us</h2>
            <iframe className="map" title="Map to the shelter" src={mapSrc} loading="lazy" allowFullScreen referrerPolicy="no-referrer-when-downgrade" />
            <p className="addr">{shelter.address}</p>
            <div className="links">
              <a className="meet" href={mapLink} target="_blank" rel="noreferrer">Open in Google Maps ↗</a>
              <a className="meet" href={shelter.website} target="_blank" rel="noreferrer">Visit our website ↗</a>
            </div>
            <p className="muted small">Contact: {shelter.email}{shelter.phone ? ` · ${shelter.phone}` : ""}{shelter.hours ? ` · ${shelter.hours}` : ""}</p>
          </section>

          <section className="card">
            <h2>Donation requests</h2>
            <ul className="requests">
              {shelter.requests.map((r) => {
                const pct = Math.min(100, Math.round((r.raised / r.amount) * 100));
                return (
                  <li key={r.id}>
                    <div className="req-head"><strong>{r.title}</strong>{!readOnly && <button type="button" className="linkish" onClick={() => removeRequest(r.id)}>remove</button>}</div>
                    {r.note && <p className="muted">{r.note}</p>}
                    <div className="progress"><div className="bar"><span style={{ width: `${pct}%` }} /></div>
                      <p className="raised">${r.raised.toLocaleString()} of ${r.amount.toLocaleString()} · {pct}%</p></div>
                  </li>
                );
              })}
              {shelter.requests.length === 0 && <li className="muted">{readOnly ? "No open requests right now." : "No requests yet — add one below."}</li>}
            </ul>
            {readOnly ? (
              <a className="meet" href={shelter.website} target="_blank" rel="noreferrer">Donate on the shelter's website ↗</a>
            ) : (
              <form className="new-req" onSubmit={addRequest}>
                <input placeholder="What do you need? (e.g. Berry needs meds)" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                <input type="number" min="1" placeholder="$ goal" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
                <input placeholder="Short note (optional)" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
                <button type="submit" className="meet">Add request</button>
              </form>
            )}
          </section>
        </div>

        <section className="card">
          <h2>Photos <small>{shelter.photos.length} {readOnly ? "photos" : "uploaded"}</small></h2>
          {!readOnly && (
            <label className="upload">
              <input type="file" accept="image/*" multiple onChange={addPhotos} />
              <span className="meet">Upload photos</span>
              <em>JPG or PNG, up to 12 at a time</em>
            </label>
          )}
          {shelter.photos.length === 0 ? (
            <p className="muted">{readOnly ? "This shelter hasn't posted photos yet." : "No photos yet. Upload pictures of your animals, kennels and events."}</p>
          ) : (
            <ul className="gallery">
              {shelter.photos.map((p) => (
                <li key={p.id}>
                  <img src={p.src} alt={p.name} />
                  {!readOnly && <button type="button" className="del" onClick={() => removePhoto(p.id)} aria-label="Remove photo">×</button>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <FooterStrip />
    </div>
  );
}

/** The signed-in shelter's own, editable page */
export default function ShelterDashboard() {
  const shelter = useShelter();
  if (!shelter) return null; // route guard sends visitors to the shelter login
  return <ShelterPage shelter={shelter} readOnly={false} header={<ShelterHeader />} onChange={updateShelter} />;
}

/** Public read-only view of a directory shelter, for individuals (route /shelters/:id) */
export function ShelterPublic() {
  const { id } = useParams();
  const s = SHELTERS.find((x) => String(x.id) === String(id));
  if (!s) return <div className="dash"><Header /><main className="profile"><h1 className="page-title">Shelter not found</h1></main><FooterStrip /></div>;
  const shelter = {
    ...s,
    requests: CAUSES.filter((c) => c.shelter === s.name).map((c) => ({ id: c.id, title: `${c.pet} needs ${c.type.toLowerCase()}`, amount: c.goal, raised: c.raised, note: c.story })),
    photos: PETS.slice((s.id - 1) % 5, (s.id - 1) % 5 + 3).map((p, i) => ({ id: i, src: p.src, name: p.alt })), // demo gallery
  };
  return <ShelterPage shelter={shelter} readOnly header={<Header />} onChange={() => {}} />;
}
