import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, signup, DEMO } from "./auth.js";
import Header from "./components/Header.jsx";
import FooterStrip from "./components/FooterStrip.jsx";
import HamsterLoader from "./components/HamsterLoader.jsx";
import "./dashboard.css";
import "./auth.css";

const EMPTY_FORM = { name: "", email: "", phone: "", password: "", confirm: "", age: "", address: "", idFileName: "" };


function validateSignup(f) {
  const e = {};
  if (f.name.trim().length < 2) e.name = "Please enter your full name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = "Enter a valid email address.";
  if (f.phone.replace(/\D/g, "").length < 10) e.phone = "Enter a 10-digit phone number.";
  if (f.password.length < 8) e.password = "Password must be at least 8 characters.";
  else if (!/\d/.test(f.password) || !/[A-Za-z]/.test(f.password)) e.password = "Use letters and at least one number.";
  if (f.confirm !== f.password) e.confirm = "Passwords don't match.";
  const age = Number(f.age);
  if (!age || age < 18 || age > 120) e.age = "You must be 18 or older to adopt or foster.";
  if (f.address.trim().length < 6) e.address = "Enter your street address.";
  return e;
}

/** Login / Sign-up page. After success, goes to `next` (where the visitor was heading) */
export default function Auth({ next = "/individual" }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const onFile = (e) => setForm((f) => ({ ...f, idFileName: e.target.files?.[0]?.name ?? "" }));

  const submit = async (e) => {
    e.preventDefault();
    setServerError("");
    if (mode === "signup" && !DEMO) {
      const errs = validateSignup(form);
      setErrors(errs);
      if (Object.keys(errs).length) return;
    }
    setBusy(true);
    try {
      if (mode === "signup") await signup(form);
      else await login({ email: form.email, password: form.password });
      navigate(next);
    } catch (err) {
      setServerError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // plain function (not a component) so inputs keep focus between keystrokes
  const field = ({ label, k, type = "text", ...rest }) => (
    <label className={errors[k] ? "bad" : ""}>
      <span>{label}</span>
      <input type={type} value={form[k]} onChange={set(k)} {...rest} />
      {errors[k] && <small>{errors[k]}</small>}
    </label>
  );

  return (
    <div className="dash">
      <Header />
      <main className="auth">
        <div className="auth-card">
          <h1 className="auth-title">{mode === "login" ? "Log in" : "Sign up"}</h1>
          <p className="auth-sub">{mode === "login" ? "Welcome back! Log in to continue." : "Create your Ohana account."}</p>

          <form onSubmit={submit} noValidate>
            {mode === "signup" && field({ label: "Full name", k: "name", autoComplete: "name" })}
            {field({ label: "Email", k: "email", type: "email", autoComplete: "email" })}
            {mode === "signup" && field({ label: "Phone number", k: "phone", type: "tel", autoComplete: "tel", placeholder: "(480) 555-0123" })}
            {field({ label: "Password", k: "password", type: "password", autoComplete: mode === "signup" ? "new-password" : "current-password" })}
            {mode === "signup" && (
              <>
                {field({ label: "Confirm password", k: "confirm", type: "password", autoComplete: "new-password" })}
                {field({ label: "Age", k: "age", type: "number", min: "18", max: "120" })}
                {field({ label: "Address", k: "address", autoComplete: "street-address", placeholder: "Street, city, state, ZIP" })}
                <label className="file">
                  <span>Government ID (optional)</span>
                  <input type="file" accept="image/*,.pdf" onChange={onFile} />
                  <em>{form.idFileName || "Upload a photo or PDF of your ID — speeds up adoption approval"}</em>
                </label>
              </>
            )}
            {serverError && <p className="server-error">{serverError}</p>}
            <button type="submit" className="go" disabled={busy}>
              {busy ? (
                <>
                  <HamsterLoader size={22} className="inline" />
                  One moment…
                </>
              ) : mode === "signup" ? "Create account" : "Log in"}
            </button>
          </form>
          <p className="switch">
            {mode === "login" ? "New here? " : "Already have an account? "}
            <button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
              {mode === "login" ? "Sign up" : "Log in"}
            </button>
          </p>
        </div>
      </main>
      <FooterStrip />
    </div>
  );
}
