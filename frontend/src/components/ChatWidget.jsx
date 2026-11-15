import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import "../chat.css";

const BASE = import.meta.env?.VITE_API_URL ?? "/api";
const MESSAGE_STORAGE_KEY = "pawpatrol_chat_messages";
const HINT_STORAGE_KEY = "pawpatrol_chat_hint_dismissed";
const GREETING =
  "Hi! I'm the Ohana assistant. Tell me what kind of pet you're looking for.";
const QUICK_REPLIES = [
  "Foster a small dog near me",
  "Adopt a cat",
  "Volunteer opportunities",
];

function readStoredMessages() {
  try {
    const stored = JSON.parse(
      sessionStorage.getItem(MESSAGE_STORAGE_KEY) || "null",
    );
    if (
      Array.isArray(stored) &&
      stored.every(
        (message) =>
          message &&
          ["user", "assistant"].includes(message.role) &&
          typeof message.text === "string" &&
          Array.isArray(message.pets),
      )
    ) {
      return stored;
    }
  } catch {
    return [{ role: "assistant", text: GREETING, pets: [] }];
  }
  return [{ role: "assistant", text: GREETING, pets: [] }];
}

function readLocation() {
  try {
    const stored = localStorage.getItem("sunhacks_location");
    if (!stored) return null;

    const location = JSON.parse(stored);
    const lat = Number(location?.lat);
    const lng = Number(location?.lng);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      typeof location?.city === "string"
    ) {
      return { lat, lng, city: location.city };
    }
  } catch {
    return null;
  }
  return null;
}

export default function ChatWidget() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState(readStoredMessages);
  const [hintVisible, setHintVisible] = useState(() => {
    try {
      return sessionStorage.getItem(HINT_STORAGE_KEY) !== "true";
    } catch {
      return true;
    }
  });
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const fabRef = useRef(null);
  const sendingRef = useRef(false);

  useEffect(() => {
    try {
      sessionStorage.setItem(MESSAGE_STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // The conversation remains available in component state for this page.
    }
  }, [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages, open, busy]);

  useEffect(() => {
    if (!open) return undefined;
    inputRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        fabRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  if (
    pathname === "/" ||
    pathname === "/shelter" ||
    pathname.startsWith("/shelter/")
  ) {
    return null;
  }

  const openChat = () => {
    setOpen(true);
    setHintVisible(false);
    try {
      sessionStorage.setItem(HINT_STORAGE_KEY, "true");
    } catch {
      // Hiding the hint for this render does not depend on storage.
    }
  };

  const closeChat = () => {
    setOpen(false);
    fabRef.current?.focus();
  };

  const sendMessage = async (value = text) => {
    const message = value.trim();
    if (!message || sendingRef.current) return;

    sendingRef.current = true;
    setBusy(true);
    setText("");
    setMessages((current) => [
      ...current,
      { role: "user", text: message, pets: [] },
    ]);

    try {
      const response = await fetch(`${BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history: messages
            .slice(-6)
            .map(({ role, text: messageText }) => ({
              role,
              text: messageText,
            })),
          location: readLocation(),
        }),
      });
      if (!response.ok) throw new Error(`Chat API returned ${response.status}`);

      const data = await response.json();
      if (
        !data ||
        typeof data.reply !== "string" ||
        !Array.isArray(data.pets) ||
        !data.filters
      ) {
        throw new Error("Chat API returned an invalid response");
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: data.reply,
          pets: data.pets,
          intent: data.filters.intent,
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: "I'm having trouble connecting to the assistant right now. You can browse pets on Adopt or Foster instead.",
          pets: [],
          connectionError: true,
        },
      ]);
    } finally {
      sendingRef.current = false;
      setBusy(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    void sendMessage();
  };

  const handleQuickReply = (reply) => {
    void sendMessage(reply);
  };

  const routeForIntent = (intent) =>
    intent === "foster"
      ? "/individual/foster"
      : intent === "adopt"
        ? "/individual/adopt"
        : null;

  return (
    <div className="chat">
      {open && (
        <section
          id="chat-panel"
          className="chat-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="chat-title"
        >
          <header className="chat-header">
            <img className="chat-avatar" src="/hero.gif" alt="Ohana mascot" />
            <strong id="chat-title">Ohana assistant</strong>
            <button
              type="button"
              onClick={closeChat}
              aria-label="Close chat"
              title="Close chat"
            >
              ×
            </button>
          </header>

          <div className="chat-log" aria-live="polite" aria-relevant="additions">
            {messages.map((message, index) => {
              const viewPath = routeForIntent(message.intent);
              return (
                <article
                  key={`${message.role}-${index}`}
                  className={`bubble ${message.role === "user" ? "me" : "bot"}`}
                >
                  <p>{message.text}</p>
                  {message.pets.length > 0 && (
                    <ul className="chat-pets">
                      {message.pets.map((pet) => (
                        <li key={pet.id}>
                          {pet.src && (
                            <img
                              src={pet.src}
                              alt={`${pet.name} the ${pet.species}`}
                              loading="lazy"
                            />
                          )}
                          <span>
                            <strong>{pet.name}</strong>
                            <small>{pet.breed || "Breed not listed"}</small>
                            <small>
                              At {pet.shelterName || "Shelter not listed"}
                            </small>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {message.pets.length > 0 && viewPath && (
                    <Link
                      className="chat-more"
                      to={viewPath}
                      onClick={closeChat}
                    >
                      View {message.intent === "foster" ? "Foster" : "Adopt"} pets
                    </Link>
                  )}
                  {message.connectionError && (
                    <div className="chat-error-links">
                      <Link to="/individual/adopt" onClick={closeChat}>
                        Browse Adopt
                      </Link>
                      <Link to="/individual/foster" onClick={closeChat}>
                        Browse Foster
                      </Link>
                    </div>
                  )}
                </article>
              );
            })}
            {busy && (
              <div
                className="bubble bot chat-typing"
                role="status"
                aria-live="polite"
                aria-label="Ohana assistant is typing"
              >
                <span aria-hidden="true">•••</span>
                <span className="chat-sr-only">
                  Ohana assistant is typing
                </span>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="chat-quick-replies" aria-label="Suggested messages">
            {QUICK_REPLIES.map((reply) => (
              <button
                key={reply}
                type="button"
                onClick={() => handleQuickReply(reply)}
                disabled={busy}
              >
                {reply}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Ask about a pet…"
              aria-label="Your message"
              maxLength={300}
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy || !text.trim()}
              aria-label="Send message"
            >
              Send
            </button>
          </form>
        </section>
      )}

      {hintVisible && !open && (
        <div className="chat-hint" aria-live="polite">
          Looking for a pet? Ask me!
        </div>
      )}

      <button
        ref={fabRef}
        type="button"
        className="chat-fab"
        onClick={open ? closeChat : openChat}
        aria-label={open ? "Close chat" : "Open Ohana chat"}
        aria-expanded={open}
        aria-controls={open ? "chat-panel" : undefined}
      >
        <svg viewBox="0 0 64 64" aria-hidden="true">
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
