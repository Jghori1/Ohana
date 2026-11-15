import { useState } from "react";
import "./ShelterAvatar.css";

/** Shelter picture, or an initials badge when the shelter has no avatar / the image fails. */
export default function ShelterAvatar({ name = "", src = "" }) {
  const [broken, setBroken] = useState(false);
  const initials =
    name
      .split(/\s+/)
      .filter((w) => w && !["the", "of", "and", "&"].includes(w.toLowerCase()))
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "?";

  if (src && !broken) {
    return <img className="shelter-avatar-img" src={src} alt="" draggable={false} onError={() => setBroken(true)} />;
  }
  return <span className="shelter-avatar-badge" aria-hidden>{initials}</span>;
}
