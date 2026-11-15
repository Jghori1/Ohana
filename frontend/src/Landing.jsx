import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { recordChoice } from "./api.js";

const HERO_SRC = "/hero.gif"; // animated puppy
const LOGO_SRC = "/logo.png"; // house + heart + paws mark
const ABOUT_ANIMALS = [
  {
    src: "/pets/golden-puppy.jpg",
    alt: "Golden puppy sitting and looking toward the camera",
  },
  {
    src: "/pets/tabby-kitten.jpg",
    alt: "Tabby kitten resting",
  },
  {
    src: "/pets/hamster.jpg",
    alt: "Hamster sitting with its paws together",
  },
  {
    src: "/footer/bunny-sketch.png",
    alt: "Illustration of a rabbit",
  },
];

/**
 * Bongo-cat-style landing page:
 *  - click anywhere / press any key -> the logo "taps", a paw-print pops
 *    where you clicked, a soft pop sound plays, and the counter goes up
 *  - two role buttons: Animal Shelter / Individual
 */
export default function Landing() {
  const navigate = useNavigate();
  const [taps, setTaps] = useState(0);
  const [bounce, setBounce] = useState(false);
  const [busy, setBusy] = useState(null);
  const audioCtx = useRef(null);

  // Tiny synthesized "bongo" so there's no audio file to ship.
  const playPop = useCallback(() => {
    try {
      if (!audioCtx.current) {
        audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtx.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(220 + Math.random() * 80, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.16);
    } catch {
      /* audio is optional */
    }
  }, []);

  const tap = useCallback(
    (x, y) => {
      setTaps((n) => n + 1);
      setBounce(true);
      setTimeout(() => setBounce(false), 140);
      playPop();
    },
    [playPop]
  );

  // Keyboard taps, like bongo.cat
  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat || e.metaKey || e.ctrlKey) return;
      if (
        e.target instanceof Element &&
        e.target.closest("button, a, .about-section")
      ) {
        return;
      }
      tap(
        window.innerWidth * (0.3 + Math.random() * 0.4),
        window.innerHeight * (0.3 + Math.random() * 0.3)
      );
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tap]);

  const choose = async (role) => {
    setBusy(role);
    try {
      await recordChoice(role, taps); // non-blocking for UX; failure is logged
    } catch (err) {
      console.warn("could not record choice", err);
    } finally {
      setBusy(null);
      navigate(role === "shelter" ? "/shelter" : "/individual");
    }
  };

  return (
    <main
      className="landing"
      onClick={(e) => {
        if (e.target.closest("button, a, .about-section")) return;
        tap(e.clientX, e.clientY);
      }}
    >

      <header className="topbar">
        <span className="brand">
          <img src={LOGO_SRC} alt="" className="brand-logo" draggable={false} />
          Paw Patrol
        </span>
      </header>

      <section className="hero">
        <img
          src={HERO_SRC}
          alt="A fluffy puppy wagging its tail"
          className={`hero-img ${bounce ? "bounce" : ""}`}
          draggable={false}
        />

        <div className="choices">
          <button
            className="choice shelter"
            disabled={busy !== null}
            onClick={() => choose("shelter")}
          >
            Animal Shelter
          </button>
          <button
            className="choice individual"
            disabled={busy !== null}
            onClick={() => choose("individual")}
          >
            Individual
          </button>
        </div>
      </section>

      <section
        id="about"
        className="about-section"
        aria-labelledby="about-heading"
      >
        <div className="about-intro">
          <div className="about-copy">
            <p className="about-brand">OHANA</p>
            <h1 id="about-heading">Because every animal deserves a family.</h1>
            <p className="about-lead">
              At Ohana, we believe every animal deserves care, connection, and
              the chance to find a family. We bring shelters and people
              together in one place, making it easier to discover animals,
              connect with shelters, foster, adopt, volunteer, donate, and find
              ways to help animals in your community.
            </p>
          </div>

          <div className="about-gallery">
            {ABOUT_ANIMALS.map((animal) => (
              <figure className="about-animal-card" key={animal.src}>
                <img src={animal.src} alt={animal.alt} loading="lazy" />
              </figure>
            ))}
          </div>
        </div>

        <figure className="about-quote">
          <blockquote>“Ohana means family. Family means nobody gets left behind—or forgotten.”</blockquote>
          <figcaption className="about-attribution">
            <span>— Lilo &amp; Stitch</span>
          </figcaption>
        </figure>

        <div className="about-details">
          <article className="about-detail-card">
            <h2>The Problem</h2>
            <p>
              People who want to help animals often have to search across many
              different shelter websites and resources. Available animals,
              foster opportunities, volunteer needs, and ways to support
              shelters can be scattered across different places.
            </p>
          </article>

          <article className="about-detail-card">
            <h2>Our Mission</h2>
            <p>
              Ohana brings animal welfare opportunities together into one
              welcoming experience. Our mission is to make it easier for people
              and shelters to find each other and help more animals find care,
              support, and families.
            </p>
          </article>

          <article className="about-detail-card about-help-card">
            <h2>How Ohana Helps</h2>
            <ul>
              <li>Discover animals available for adoption and fostering</li>
              <li>Connect directly with shelters</li>
              <li>Find volunteer opportunities</li>
              <li>Support shelter needs</li>
              <li>Find animal welfare resources</li>
              <li>Ask the Ohana assistant to help search for animals</li>
            </ul>
          </article>
        </div>
      </section>
    </main>
  );
}
