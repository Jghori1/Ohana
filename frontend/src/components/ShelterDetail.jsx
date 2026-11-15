import { useEffect } from "react";
import { Link } from "react-router-dom";

/**
 * Overlay with a shelter's full profile and a button out to its website.
 * `headline` is the thank-you / context line shown at the top (optional).
 */
export default function ShelterDetail({ shelter, headline, cta, onClose }) {
  useEffect(() => { // Esc closes the panel
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="detail" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="close" onClick={onClose} aria-label="Close">×</button>
        {headline && <p className="thanks headline">{headline}</p>}
        <div className="detail-grid">
          <img src={shelter.avatar} alt="" className="shelter-avatar" />
          <div className="notepad detail-note">
            <h3><Link className="shelter-link" to={`/shelters/${shelter.id}`} onClick={onClose}>{shelter.name}</Link></h3>
            <p className="meta">{shelter.address}, {shelter.city}</p>
            <h4>About</h4>
            <p>{shelter.about}</p>
            <h4>Hours</h4>
            <p>{shelter.hours}</p>
            <h4>Animals</h4>
            <p>{shelter.animals.join(", ")}</p>
            <h4>Contact</h4>
            <p>{shelter.phone} · {shelter.email}</p>
          </div>
        </div>
        <section className="policies shelter-more">
          <div>
            <h3>Volunteers needed for</h3>
            <p>{shelter.roles.join(" · ")}</p>
          </div>
          <div>
            <h3>Currently needs</h3>
            <p>{shelter.needs.join(" · ")}</p>
          </div>
          <a className="meet go-site" href={shelter.website} target="_blank" rel="noreferrer">{cta} ↗</a>
        </section>
      </div>
    </div>
  );
}
