import wheel from "./hamster-wheel.png";
import hamster from "./hamster-body.png";
import "./hamster.css";

/**
 * Hamster-on-a-wheel loader built from the LottieFiles line art (two transparent layers).
 *   <HamsterLoader label="Finding shelters near you…" />   // large with text
 *   <HamsterLoader size={24} className="inline" />         // inside a button
 */
export default function HamsterLoader({ label, size = 120, className = "" }) {
  return (
    <div className={`hamster-loader ${className}`} role="status" aria-live="polite" style={{ "--size": `${size}px` }}>
      <div className="hl-stage">
        <img src={wheel} alt="" className="hl-wheel" draggable={false} />
        <img src={hamster} alt="" className="hl-hamster" draggable={false} />
      </div>
      {label && <p className="hl-label">{label}</p>}
    </div>
  );
}
