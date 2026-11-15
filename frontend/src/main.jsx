import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Landing from "./Landing.jsx";
import Dashboard from "./Dashboard.jsx";
import Auth from "./Auth.jsx";
import Profile from "./Profile.jsx";
import Adopt from "./Adopt.jsx";
import Foster from "./Foster.jsx";
import Volunteer from "./Shelters.jsx";
import Donate from "./Donate.jsx";
import { useAuth } from "./auth.js";
import ShelterAuth from "./ShelterAuth.jsx";
import ShelterDashboard, { ShelterPublic } from "./ShelterDashboard.jsx";
import ChatWidget from "./components/ChatWidget.jsx";
import { useShelter } from "./shelterAuth.js";
import "./index.css";

// Placeholder destinations — replace with your real pages.
const Stub = ({ title }) => (
  <main className="stub">
    <h1>{title}</h1>
    <a href="/individual">← back</a>
  </main>
);

/** Sends signed-out visitors to the login page, then back to where they were going */
function RequireAuth({ children }) {
  const user = useAuth();
  const loc = useLocation();
  return user ? children : <Navigate to="/individual/auth" state={{ next: loc.pathname }} replace />;
}
function RequireShelter({ children }) {
  const shelter = useShelter();
  return shelter ? children : <Navigate to="/shelter/auth" replace />;
}
function AuthPage() {
  const loc = useLocation();
  return <Auth next={loc.state?.next ?? "/individual"} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/shelter" element={<RequireShelter><ShelterDashboard /></RequireShelter>} />
        <Route path="/shelter/auth" element={<ShelterAuth />} />
        <Route path="/shelters/:id" element={<RequireAuth><ShelterPublic /></RequireAuth>} />
        <Route path="/individual" element={<Dashboard />} />
        <Route path="/individual/auth" element={<AuthPage />} />
        <Route path="/individual/profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/individual/adopt" element={<RequireAuth><Adopt /></RequireAuth>} />
        <Route path="/individual/foster" element={<RequireAuth><Foster /></RequireAuth>} />
        <Route path="/individual/volunteer" element={<RequireAuth><Volunteer /></RequireAuth>} />
        <Route path="/individual/donate" element={<RequireAuth><Donate /></RequireAuth>} />
        <Route path="/individual/:section" element={<RequireAuth><Stub title="Coming soon" /></RequireAuth>} />
      </Routes>
      <ChatWidget />
    </BrowserRouter>
  </React.StrictMode>
);
