import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { setShelter as setShelterSession, useShelter } from "./shelterAuth.js";
import { api, get, post } from "./api.js";
import ShelterHeader from "./components/ShelterHeader.jsx";
import Header from "./components/Header.jsx";
import FooterStrip from "./components/FooterStrip.jsx";
import HamsterLoader from "./components/HamsterLoader.jsx";
import "./dashboard.css";
import "./profile.css";
import "./donate.css";
import "./shelterdash.css";

const hideBrokenImage = (event) => {
  event.currentTarget.style.visibility = "hidden";
};

/**
 * Shelter page. Two uses:
 *  - the signed-in shelter's own page (editable): <ShelterDashboard />
 *  - a public, read-only view for individuals: <ShelterPublic /> (route /shelters/:id)
 */
export function ShelterPage({
  shelter,
  readOnly,
  header,
  onChange,
  onAddRequest,
  onDeleteRequest,
  onAddPhoto,
  onDeletePhoto,
  onError,
  error,
}) {
  const [draft, setDraft] = useState({ title: "", amount: "", note: "" });
  const [editingMission, setEditingMission] = useState(false);
  const [missionDraft, setMissionDraft] = useState(shelter.mission || "");

  useEffect(() => {
    setMissionDraft(shelter.mission || "");
  }, [shelter.mission]);

  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(shelter.address)}&output=embed`;
  const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shelter.address)}`;

  const addRequest = async (e) => {
    e.preventDefault();
    if (!draft.title.trim() || !Number(draft.amount)) return;
    const saved = await onAddRequest({
      title: draft.title.trim(),
      amount: Number(draft.amount),
      note: draft.note.trim(),
    });
    if (saved) setDraft({ title: "", amount: "", note: "" });
  };

  const addPhotos = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 12);
    e.target.value = "";
    try {
      for (const file of files) {
        const reader = new FileReader();
        const data = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error || new Error("Could not read the selected photo."));
          reader.readAsDataURL(file);
        });
        if (typeof data !== "string" || !(await onAddPhoto({ name: file.name, data }))) break;
      }
    } catch (uploadError) {
      onError(uploadError.message);
    }
  };
  const saveMission = async () => {
    if (await onChange({ mission: missionDraft.trim() })) setEditingMission(false);
  };

  return (
    <div className="dash">
      {header}
      <main className="profile shelterdash">
        <h1 className="page-title">{shelter.name}</h1>
        {error && <p role="alert">{error}</p>}
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
                    <div className="req-head"><strong>{r.title}</strong>{!readOnly && <button type="button" className="linkish" onClick={() => onDeleteRequest(r.id)}>remove</button>}</div>
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
                  <img src={p.src} alt={p.name} onError={hideBrokenImage} />
                  {!readOnly && <button type="button" className="del" onClick={() => onDeletePhoto(p.id)} aria-label="Remove photo">×</button>}
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
  const cachedShelter = useShelter();
  const [shelter, setShelter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const updateShelterAccount = (data) => {
    const account = {
      ...data,
      ...(cachedShelter?.token ? { token: cachedShelter.token } : {}),
    };
    setShelter(account);
    setShelterSession(account);
  };

  useEffect(() => {
    if (!cachedShelter?.token) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    get("/shelter/me", "shelter")
      .then((data) => {
        if (!active) return;
        updateShelterAccount(data);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [cachedShelter?.token]);

  const runMutation = async (request) => {
    setError("");
    try {
      await request();
      const updated = await get("/shelter/me", "shelter");
      updateShelterAccount(updated);
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  };

  const onChange = ({ mission }) =>
    runMutation(() => api("/shelter/me", {
      method: "PATCH",
      body: { mission },
      auth: "shelter",
    }));
  const onAddRequest = (request) =>
    runMutation(() => post("/shelter/requests", request, "shelter"));
  const onDeleteRequest = (id) =>
    runMutation(() => api(`/shelter/requests/${encodeURIComponent(id)}`, {
      method: "DELETE",
      auth: "shelter",
    }));
  const onAddPhoto = (photo) =>
    runMutation(() => post("/shelter/photos", photo, "shelter"));
  const onDeletePhoto = (id) =>
    runMutation(() => api(`/shelter/photos/${encodeURIComponent(id)}`, {
      method: "DELETE",
      auth: "shelter",
    }));

  if (loading) {
    return (
      <div className="dash">
        <ShelterHeader />
        <main className="profile"><HamsterLoader size={96} label="Loading…" /></main>
        <FooterStrip />
      </div>
    );
  }
  if (!shelter) {
    return (
      <div className="dash">
        <ShelterHeader />
        <main className="profile">{error && <p role="alert">{error}</p>}</main>
        <FooterStrip />
      </div>
    );
  }
  return (
    <ShelterPage
      shelter={shelter}
      readOnly={false}
      header={<ShelterHeader />}
      onChange={onChange}
      onAddRequest={onAddRequest}
      onDeleteRequest={onDeleteRequest}
      onAddPhoto={onAddPhoto}
      onDeletePhoto={onDeletePhoto}
      onError={setError}
      error={error}
    />
  );
}

/** Public read-only view of a directory shelter, for individuals (route /shelters/:id) */
export function ShelterPublic() {
  const { id } = useParams();
  const [shelter, setShelter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    get(`/shelters/${encodeURIComponent(id)}`)
      .then((data) => {
        if (active) setShelter(data);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="dash">
        <Header />
        <main className="profile"><HamsterLoader size={96} label="Loading…" /></main>
        <FooterStrip />
      </div>
    );
  }
  if (error || !shelter) {
    return <div className="dash"><Header /><main className="profile"><h1 className="page-title" role={error ? "alert" : undefined}>{error || "Shelter not found"}</h1></main><FooterStrip /></div>;
  }
  return <ShelterPage shelter={shelter} readOnly header={<Header />} onChange={() => {}} />;
}
