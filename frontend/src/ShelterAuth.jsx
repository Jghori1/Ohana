import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { shelterLogin, shelterSignup } from "./shelterAuth.js";
import { DEMO } from "./auth.js";
import ShelterHeader from "./components/ShelterHeader.jsx";
import FooterStrip from "./components/FooterStrip.jsx";
import "./dashboard.css";
import "./auth.css";

const ANIMALS = ["Dogs", "Cats", "Small animals", "Birds", "Reptiles", "Farm animals"];
const BLANK = { name: "", email: "", password: "", confirm: "", address: "", website: "", animals: [], licenseFileName: "" };

function validate(f) {
  const e = {};
  if (f.name.trim().length < 2) e.name = "Enter the shelter's name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = "Enter the shelter's official email.";
  if (f.password.length < 8) e.password = "Password must be at least 8 characters.";
  if (f.confirm !== f.password) e.confirm = "Passwords don't match.";
  if (f.address.trim().length < 6) e.address = "Enter the shelter's street address.";
  if (!/^https?:\/\/.+\..+/.test(f.website)) e.website = "Enter the full website link (https://…).";
  if (f.animals.length === 0) e.animals = "Pick at least one kind of animal.";
  if (!f.licenseFileName) e.license = "Upload your shelter license.";
  return e;
}

/** Shelter log in / sign up */
export default function ShelterAuth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggleAnimal = (a) => setForm((f) => ({ ...f, animals: f.animals.includes(a) ? f.animals.filter((x) => x !== a) : [...f.animals, a] }));

  const submit = async (e) => {
    e.preventDefault();
    setServerError("");
    if (mode === "signup" && !DEMO) {
      const errs = validate(form); setErrors(errs);
      if (Object.keys(errs).length) return;
    }
    setBusy(true);
    try {
      if (mode === "signup") await shelterSignup(form);
      else await shelterLogin({ email: form.email, password: form.password });
      navigate("/shelter");
    } catch (err) { setServerError(err.message); }
    finally { setBusy(false); }
  };

  const field = ({ label, k, type = "text", ...rest }) => (
    <label className={errors[k] ? "bad" : ""}>
      <span>{label}</span>
      <input type={type} value={form[k]} onChange={set(k)} {...rest} />
      {errors[k] && <small>{errors[k]}</small>}
    </label>
  );

  return (
    <div className="dash">
      <ShelterHeader />
      <main className="auth">
        <div className="auth-card">
          <h1 className="auth-title">{mode === "login" ? "Shelter log in" : "Register your shelter"}</h1>
          <p className="auth-sub">{mode === "login" ? "Welcome back! Log in with your official shelter email." : "Tell us about your shelter so people can find you."}</p>

          <form onSubmit={submit} noValidate>
            {mode === "signup" && field({ label: "Shelter name", k: "name", autoComplete: "organization" })}
            {field({ label: "Official email", k: "email", type: "email", autoComplete: "email" })}
            {field({ label: "Password", k: "password", type: "password", autoComplete: mode === "signup" ? "new-password" : "current-password" })}
            {mode === "signup" && (
              <>
                {field({ label: "Confirm password", k: "confirm", type: "password", autoComplete: "new-password" })}
                {field({ label: "Address", k: "address", autoComplete: "street-address", placeholder: "Street, city, state, ZIP" })}
                {field({ label: "Website link", k: "website", type: "url", placeholder: "https://your-shelter.org" })}
                <fieldset className={`animals ${errors.animals ? "bad" : ""}`}>
                  <legend>Animals you care for</legend>
                  <div className="chips">
                    {ANIMALS.map((a) => (
                      <label key={a} className={form.animals.includes(a) ? "on" : ""}>
                        <input type="checkbox" checked={form.animals.includes(a)} onChange={() => toggleAnimal(a)} />{a}
                      </label>
                    ))}
                  </div>
                  {errors.animals && <small>{errors.animals}</small>}
                </fieldset>
                <label className={`file ${errors.license ? "bad" : ""}`}>
                  <span>Shelter license</span>
                  <input type="file" accept="image/*,.pdf" onChange={(e) => setForm((f) => ({ ...f, licenseFileName: e.target.files?.[0]?.name ?? "" }))} />
                  <em>{form.licenseFileName || "Upload a photo or PDF of your state/county animal shelter license"}</em>
                  {errors.license && <small>{errors.license}</small>}
                </label>
              </>
            )}
            {serverError && <p className="server-error">{serverError}</p>}
            <button type="submit" className="go" disabled={busy}>{busy ? "One moment…" : mode === "signup" ? "Register shelter" : "Log in"}</button>
          </form>
          <p className="switch">
            {mode === "login" ? "New shelter? " : "Already registered? "}
            <button type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setErrors({}); }}>
              {mode === "login" ? "Register" : "Log in"}
            </button>
          </p>
        </div>
      </main>
      <FooterStrip />
    </div>
  );
}
