import { Link, useNavigate } from "react-router-dom";
import { useShelter, shelterLogout } from "../shelterAuth.js";

const LOGO_SRC = "/ohana-logo.png";

/** Top bar for the shelter side: brand left, shelter name + log out right */
export default function ShelterHeader() {
  const shelter = useShelter();
  const navigate = useNavigate();
  return (
    <header className="dash-top">
      <Link to="/" className="dash-brand">
        <img src={LOGO_SRC} alt="Ohana" />
      </Link>
      <nav className="dash-nav">
        {shelter && (
          <>
            <Link to="/shelter">{shelter.name}</Link>
            <button type="button" className="nav-btn" onClick={() => { shelterLogout(); navigate("/"); }}>Log out</button>
          </>
        )}
      </nav>
    </header>
  );
}
