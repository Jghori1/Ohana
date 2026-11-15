import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { recordChoice } from "./api.js";

const HERO_SRC = "/hero.gif"; // animated puppy
const LOGO_SRC = "/logo.png"; // house + heart + paws mark

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
        if (e.target.closest("button, a")) return;
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

    </main>
  );
}
