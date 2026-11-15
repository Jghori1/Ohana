import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import "../chat.css";

const BASE = import.meta.env?.VITE_API_URL ?? "/api";
const GREETING = "Hi! I'm the Paw Patrol helper. Tell me what you're looking for, like \"a small dog near Tempe\".";

/** Floating chat helper (bottom-right). Talks to POST /api/chat and shows matching pets. */
export default function ChatWidget() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [msgs, setMsgs] = useState([{ from: "bot", text: GREETING, pets: [] }]);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs, open]);

  // Only for individuals: hide on the landing page and the shelter side
  if (pathname === "/" || pathname.startsWith("/shelter")) return null;

  const send = async (e) => {
    e.preventDefault();
    const message = text.trim();
    if (!message || busy) return;
    setText("");
    setMsgs((m) => [...m, { from: "me", text: message, pets: [] }]);
    setBusy(true);
    try {
      const res = await fetch(`${BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      setMsgs((m) => [...m, { from: "bot", text: data.reply || "Sorry, I didn't get that.", pets: data.pets || [] }]);
    } catch {
      setMsgs((m) => [...m, { from: "bot", text: "I can't reach the server right now. Please try again in a moment.", pets: [] }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="chat">
      {open && (
        <section className="chat-panel" role="dialog" aria-label="Paw Patrol chat">
          <header>
            <strong>Paw Patrol helper</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat">×</button>
          </header>
          <div className="chat-log" aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className={`bubble ${m.from}`}>
                <p>{m.text}</p>
                {m.pets.length > 0 && (
                  <ul className="chat-pets">
                    {m.pets.map((p) => (
                      <li key={p.id}>
                        {p.src && <img src={p.src} alt="" loading="lazy" />}
                        <span>
                          <strong>{p.name}</strong>
                          <small>{[p.breed, p.species, p.age, p.size].filter(Boolean).join(" · ")}</small>
                          {p.shelterName && <small>At {p.shelterName}</small>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {m.pets.length > 0 && <Link className="chat-more" to="/individual/adopt" onClick={() => setOpen(false)}>See them on the Adopt page</Link>}
              </div>
            ))}
            {busy && <div className="bubble bot"><p>Thinking…</p></div>}
            <div ref={endRef} />
          </div>
          <form onSubmit={send}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about a pet…" aria-label="Your message" maxLength={300} />
            <button type="submit" disabled={busy || !text.trim()}>Send</button>
          </form>
        </section>
      )}
      <button type="button" className="chat-fab" onClick={() => setOpen((o) => !o)} aria-label={open ? "Close chat" : "Open chat"}>
        <svg viewBox="0 0 64 64" aria-hidden>
          <ellipse cx="32" cy="42" rx="14" ry="12" />
          <ellipse cx="14" cy="26" rx="6" ry="8" />
          <ellipse cx="26" cy="15" rx="6" ry="8" />
          <ellipse cx="38" cy="15" rx="6" ry="8" />
          <ellipse cx="50" cy="26" rx="6" ry="8" />
        </svg>
      </button>
    </div>
  );
}
