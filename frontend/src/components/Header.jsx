import { Link } from "react-router-dom";
import { useAuth } from "../auth.js";

const LOGO_SRC = "/ohana-logo.png";
export const NAV = [
  { label: "Adopt", to: "/individual/adopt" },
  { label: "Volunteer", to: "/individual/volunteer" },
  { label: "Foster", to: "/individual/foster" },
  { label: "Donate", to: "/individual/donate" },
];

/** llama-life style top bar: brand left, links + profile button right */
export default function Header({ showProfile = true }) {
  const user = useAuth();
  return (
    <header className="dash-top">
      <Link to="/individual" className="dash-brand">
        <img src={LOGO_SRC} alt="Ohana" />
      </Link>
      <nav className="dash-nav">
        {NAV.map((n) => (
          <Link key={n.label} to={n.to}>{n.label}</Link>
        ))}
        {showProfile && user && <Link to="/individual/profile" title="Profile">{user.name.split(" ")[0]}</Link>}
      </nav>
    </header>
  );
}
