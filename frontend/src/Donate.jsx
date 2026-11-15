import { useEffect, useMemo, useState } from "react";
import Header from "./components/Header.jsx";
import FooterStrip from "./components/FooterStrip.jsx";
import HamsterLoader from "./components/HamsterLoader.jsx";
import "./dashboard.css";
import "./adopt.css";
import "./donate.css";

const BASE = import.meta.env?.VITE_API_URL ?? "/api";

function safeWebsite(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export default function Donate() {
  const [causes, setCauses] = useState([]);
  const [shelters, setShelters] = useState([]);
  const [filters, setFilters] = useState({ city: "", urgency: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function loadDonationData() {
      setLoading(true);
      setError(false);
      try {
        const [causesResponse, sheltersResponse] = await Promise.all([
          fetch(`${BASE}/causes`, { signal: controller.signal }),
          fetch(`${BASE}/shelters`, { signal: controller.signal }),
        ]);
        if (!causesResponse.ok || !sheltersResponse.ok) {
          throw new Error("Donation information request failed.");
        }

        const [causeData, shelterData] = await Promise.all([
          causesResponse.json(),
          sheltersResponse.json(),
        ]);
        if (!Array.isArray(causeData) || !Array.isArray(shelterData)) {
          throw new Error("Donation information response was invalid.");
        }

        if (active) {
          setCauses(causeData);
          setShelters(shelterData);
        }
      } catch (requestError) {
        if (active && requestError.name !== "AbortError") {
          setCauses([]);
          setShelters([]);
          setError(true);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadDonationData();
    return () => {
      active = false;
      controller.abort();
    };
  }, [reload]);

  const sheltersById = useMemo(
    () => new Map(shelters.map((shelter) => [String(shelter.id), shelter])),
    [shelters],
  );
  const cards = useMemo(() => {
    const campaignCards = causes.map((cause) => {
      const shelter = sheltersById.get(String(cause.shelterId));
      return {
        id: `cause-${cause.id}`,
        kind: "campaign",
        shelter: cause.shelter || shelter?.name || "",
        city: cause.city || shelter?.city || "",
        title: cause.pet || cause.type || "Shelter campaign",
        type: cause.type || "",
        description: cause.story || "",
        urgency: cause.urgency || "",
        items: Array.isArray(cause.breakdown)
          ? cause.breakdown.filter((item) => typeof item === "string")
          : [],
        image: cause.src || shelter?.avatar || "",
        website: safeWebsite(shelter?.website),
      };
    });
    const needsCards = shelters.flatMap((shelter) => {
      const items = Array.isArray(shelter.needs)
        ? shelter.needs.filter(
            (need) => typeof need === "string" && need.trim(),
          )
        : [];
      if (items.length === 0) return [];
      return [
        {
          id: `needs-${shelter.id}`,
          kind: "needs",
          shelter: shelter.name || "",
          city: shelter.city || "",
          title: "Current shelter needs",
          type: "",
          description: shelter.mission || shelter.about || "",
          urgency: "",
          items,
          image: shelter.avatar || "",
          website: safeWebsite(shelter.website),
        },
      ];
    });
    return [...campaignCards, ...needsCards];
  }, [causes, shelters, sheltersById]);

  const cityOptions = useMemo(
    () =>
      [
        ...new Set([
          ...shelters.map((shelter) => shelter.city),
          ...causes.map((cause) => cause.city),
        ].filter(Boolean)),
      ].sort((a, b) => a.localeCompare(b)),
    [causes, shelters],
  );
  const urgencyOptions = useMemo(
    () =>
      [...new Set(causes.map((cause) => cause.urgency).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b),
      ),
    [causes],
  );
  const filteredCards = cards.filter(
    (card) =>
      (!filters.city || card.city === filters.city) &&
      (!filters.urgency || card.urgency === filters.urgency),
  );
  const hasFilters = Boolean(filters.city || filters.urgency);

  return (
    <div className="dash">
      <Header />

      <main className="adopt donations-layout">
        <aside className="filters donation-filters" aria-label="Donation filters">
          <h2>Filter</h2>
          <label htmlFor="donation-city">City</label>
          <select
            id="donation-city"
            value={filters.city}
            onChange={(event) =>
              setFilters((current) => ({ ...current, city: event.target.value }))
            }
          >
            <option value="">All cities</option>
            {cityOptions.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>

          <label htmlFor="donation-urgency">Urgency</label>
          <select
            id="donation-urgency"
            value={filters.urgency}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                urgency: event.target.value,
              }))
            }
            disabled={urgencyOptions.length === 0}
          >
            <option value="">All urgency levels</option>
            {urgencyOptions.map((urgency) => (
              <option key={urgency} value={urgency}>
                {urgency}
              </option>
            ))}
          </select>
          {hasFilters && (
            <button
              type="button"
              className="clear"
              onClick={() => setFilters({ city: "", urgency: "" })}
            >
              Clear filters
            </button>
          )}
        </aside>

        <section className="listings donation-listings">
          <header className="donations-heading">
            <h1 className="page-title">Support local shelters</h1>
            <p>
              Explore current shelter campaigns and needs, then choose how
              you&apos;d like to help.
            </p>
            <p className="donation-disclaimer" role="note">
              Donations go directly to the shelter&apos;s own page. We never
              handle payments.
            </p>
          </header>

          {loading && (
            <HamsterLoader size={96} label="Loading…" />
          )}
          {error && (
            <div className="donation-error" role="alert">
              <p>
                We couldn&apos;t load current donation information. Please try
                again.
              </p>
              <button
                type="button"
                className="clear"
                onClick={() => setReload((current) => current + 1)}
              >
                Try again
              </button>
            </div>
          )}
          {!loading && !error && (
            <>
              <p className="count">
                {filteredCards.length}{" "}
                {filteredCards.length === 1 ? "listing" : "listings"} available
              </p>
              {cards.length === 0 ? (
                <p className="none">
                  No current donation needs or campaigns are listed by
                  shelters. Please check back later.
                </p>
              ) : filteredCards.length === 0 ? (
                <p className="none">
                  No donation listings match those filters.
                </p>
              ) : (
                filteredCards.map((card) => (
                  <article
                    className={`donation-card${
                      card.image ? "" : " donation-card-no-image"
                    }`}
                    key={card.id}
                  >
                    {card.image && (
                      <img
                        className="donation-card-image"
                        src={card.image}
                        alt={card.title}
                        loading="lazy"
                      />
                    )}
                    <div className="donation-card-content">
                      <div className="donation-card-labels">
                        <span className="donation-kind">
                          {card.kind === "needs" ? "Shelter needs" : card.type || "Campaign"}
                        </span>
                        {card.urgency && (
                          <span
                            className={`urgency ${card.urgency
                              .replace(/\s/g, "-")
                              .toLowerCase()}`}
                          >
                            {card.urgency}
                          </span>
                        )}
                      </div>
                      <h2>{card.title}</h2>
                      {card.shelter && (
                        <p className="donation-shelter">{card.shelter}</p>
                      )}
                      {card.city && (
                        <p className="donation-location">{card.city}</p>
                      )}
                      {card.description && <p>{card.description}</p>}
                      {card.items.length > 0 && (
                        <>
                          <h3>
                            {card.kind === "needs"
                              ? "Items needed"
                              : "Campaign details"}
                          </h3>
                          <ul>
                            {card.items.map((item, index) => (
                              <li key={`${card.id}-${index}`}>{item}</li>
                            ))}
                          </ul>
                        </>
                      )}
                      {card.website ? (
                        <a
                          className="meet donation-link"
                          href={card.website}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Donate on the shelter&apos;s website ↗
                        </a>
                      ) : (
                        <p className="donation-website-missing">
                          Shelter website not provided.
                        </p>
                      )}
                    </div>
                  </article>
                ))
              )}
            </>
          )}
        </section>
      </main>

      <FooterStrip />
    </div>
  );
}
