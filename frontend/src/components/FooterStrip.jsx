import { Link, useLocation } from "react-router-dom";

const PARADE_ANIMALS = [
  { src: "/footer/dog-flat.png", name: "Golden dog" },
  { src: "/footer/orange-cat.png", name: "Cat" },
  { src: "/footer/hamster-cheeks.png", name: "Hamster" },
  { src: "/footer/bunny-sketch.png", name: "Rabbit" },
  { src: "/footer/chick-flat.png", name: "Bird" },
];

export default function FooterStrip() {
  const { pathname } = useLocation();
  // Dashboard already wraps this component in a footer landmark.
  const FooterElement =
    pathname.replace(/\/$/, "") === "/individual" ? "div" : "footer";

  return (
    <FooterElement className="site-footer">
      <div className="animal-parade" aria-hidden="true">
        <div className="animal-parade-track">
          {[0, 1].map((copy) => (
            <div className="animal-parade-group" key={copy}>
              {PARADE_ANIMALS.map((animal) => (
                <img
                  key={animal.name}
                  src={animal.src}
                  alt=""
                  draggable="false"
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="site-footer-content">
        <p className="site-footer-brand">PawPatrol</p>
        <nav aria-label="Footer navigation">
          <ul className="site-footer-links">
            <li>
              <Link to="/#about">About</Link>
            </li>
            <li>
              <span className="site-footer-coming-soon">
                Animal Welfare Resources <small>Coming soon</small>
              </span>
            </li>
            <li>
              <Link to="/individual/donate">Donations</Link>
            </li>
            <li>
              <Link to="/shelter/auth">Shelter Registration</Link>
            </li>
          </ul>
        </nav>
        <p className="site-footer-copyright">
          © {new Date().getFullYear()} PawPatrol
        </p>
      </div>
    </FooterElement>
  );
}
