import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, logout } from "./auth.js";
import { get } from "./api.js";
import Header from "./components/Header.jsx";
import FooterStrip from "./components/FooterStrip.jsx";
import "./dashboard.css";
import "./profile.css";

// XP: every action earns points; levels every 250 XP
const LEVELS = ["Paw Pal", "Tail Wagger", "Shelter Hero", "Rescue Legend"];
const xpFor = (a) => 50 + a.adoptions.length * 150 + a.fosters.length * 100 + a.volunteer.reduce((s, v) => s + v.hours * 5, 0) + a.donations.reduce((s, d) => s + d.amount, 0);

const ALL_BADGES = [
  { name: "New member", earned: () => true, how: "Create an account" },
  { name: "First adoption", earned: (a) => a.adoptions.length >= 1, how: "Adopt a pet" },
  { name: "Foster friend", earned: (a) => a.fosters.length >= 1, how: "Foster a pet" },
  { name: "Foster regular", earned: (a) => a.fosters.length >= 2, how: "Foster two pets" },
  { name: "Helping hands", earned: (a) => a.volunteer.reduce((s, v) => s + v.hours, 0) >= 10, how: "Volunteer 10 hours" },
  { name: "Big heart", earned: (a) => a.donations.reduce((s, d) => s + d.amount, 0) >= 50, how: "Donate $50 in total" },
  { name: "All-rounder", earned: (a) => a.adoptions.length && a.fosters.length && a.volunteer.length && a.donations.length, how: "Adopt, foster, volunteer and donate" },
];

export default function Profile() {
  const navigate = useNavigate();
  const user = useAuth();
  const [profile, setProfile] = useState(user);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.token) return undefined;
    let active = true;
    get("/me", "user")
      .then((data) => {
        if (active) setProfile(data);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      });
    return () => {
      active = false;
    };
  }, [user?.token]);

  if (!user) return null; // route guard sends visitors to the login page

  const account = profile ?? user;
  const act = {
    adoptions: account.adoptions ?? [],
    fosters: account.fosters ?? [],
    volunteer: account.volunteer ?? [],
    donations: account.donations ?? [],
  };
  const xp = xpFor(act);
  const level = Math.min(Math.floor(xp / 250), LEVELS.length - 1);
  const intoLevel = xp - level * 250;
  const hours = act.volunteer.reduce((s, v) => s + v.hours, 0);
  const given = act.donations.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="dash">
      <Header />
      <main className="profile">
        <h1 className="page-title">Profile</h1>
        {error && <p role="alert">{error}</p>}

        <section className="card basics">
          <div className="avatar-big">{account.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</div>
          <div>
            <h2>{account.name}</h2>
            <dl>
              <dt>Email</dt><dd>{account.email}</dd>
              <dt>Phone</dt><dd>{account.phone}</dd>
              <dt>Age</dt><dd>{account.age}</dd>
              <dt>Address</dt><dd>{account.address}</dd>
              <dt>Member since</dt><dd>{account.joined}</dd>
              <dt>ID verification</dt><dd>{account.idUploaded ? "ID uploaded — pending review" : "No ID uploaded"}</dd>
            </dl>
          </div>
          <button type="button" className="logout" onClick={() => { logout(); navigate("/individual"); }}>Log out</button>
        </section>

        <section className="card xp">
          <h2>Level {level + 1} · {LEVELS[level]}</h2>
          <div className="bar"><span style={{ width: `${(intoLevel / 250) * 100}%` }} /></div>
          <p>{xp} XP total · {250 - intoLevel} XP to {LEVELS[level + 1] ?? "max level"}</p>
          <ul className="badges">
            {ALL_BADGES.map((b) => {
              const got = Boolean(b.earned(act));
              return <li key={b.name} className={got ? "got" : ""} title={b.how}>{b.name}{!got && <small>{b.how}</small>}</li>;
            })}
          </ul>
        </section>

        <div className="two">
          <section className="card">
            <h2>Adoptions</h2>
            {act.adoptions.length === 0 ? <p className="muted">No adoptions yet.</p> : (
              <ul className="rows">{act.adoptions.map((a) => <li key={a.pet}><strong>{a.pet}</strong><span>{a.kind}</span><span>{a.date}</span></li>)}</ul>
            )}
            <h2>Fostering</h2>
            {act.fosters.length === 0 ? <p className="muted">No fosters yet.</p> : (
              <ul className="rows">{act.fosters.map((f) => <li key={f.pet}><strong>{f.pet}</strong><span>{f.kind}</span><span>{f.from} → {f.to}</span></li>)}</ul>
            )}
          </section>

          <section className="card">
            <h2>Volunteering <small>{hours} hours</small></h2>
            <ul className="rows">{act.volunteer.map((v) => <li key={v.what + v.date}><strong>{v.what}</strong><span>{v.hours} h</span><span>{v.date}</span></li>)}</ul>
            <h2>Donations <small>${given} total</small></h2>
            <ul className="rows">{act.donations.map((d) => <li key={d.date}><strong>${d.amount}</strong><span>{d.note}</span><span>{d.date}</span></li>)}</ul>
          </section>
        </div>
      </main>
      <FooterStrip />
    </div>
  );
}
