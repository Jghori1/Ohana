import { useEffect, useMemo, useState } from "react";
import { get, post } from "./api.js";
import Header from "./components/Header.jsx";
import FooterStrip from "./components/FooterStrip.jsx";
import HamsterLoader from "./components/HamsterLoader.jsx";
import ShelterDetail from "./components/ShelterDetail.jsx";
import "./dashboard.css";
import "./adopt.css";
import "./donate.css";

function zipQuery() {
  try {
    const stored = localStorage.getItem("pawpatrolArea");
    if (!stored) return "";
    let area;
    try {
      area = JSON.parse(stored);
    } catch {
      area = stored;
    }
    const zip = typeof area === "object" && area ? area.zip : area;
    const value = zip == null ? "" : String(zip);
    return /^\d{5}$/.test(value) ? `?zip=${encodeURIComponent(value)}` : "";
  } catch {
    return "";
  }
}

const hideBrokenImage = (event) => {
  event.currentTarget.style.visibility = "hidden";
};

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
  const [filterOptions, setFilterOptions] = useState({ city: [], urgency: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [amounts, setAmounts] = useState({});
  const [activityErrors, setActivityErrors] = useState({});
  const [submitting, setSubmitting] = useState(null);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadDonationData() {
      setLoading(true);
      setError("");
      const query = zipQuery();
      try {
        const [causesResponse, sheltersResponse, filtersResponse] = await Promise.all([
          get(`/causes${query}`),
          get(`/shelters${query}`),
          get("/filters/causes"),
        ]);
        if (active) {
          setCauses(causesResponse);
          setShelters(sheltersResponse);
          setFilterOptions({
            city: filtersResponse.city ?? [],
            urgency: filtersResponse.urgency ?? [],
          });
        }
      } catch (requestError) {
        if (active) setError(requestError.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadDonationData();
    return () => {
      active = false;
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
        shelterRecord: shelter
          ? { ...shelter, website: safeWebsite(shelter.website) || "" }
          : null,
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
          shelterRecord: { ...shelter, website: safeWebsite(shelter.website) || "" },
        },
      ];
    });
    return [...campaignCards, ...needsCards];
  }, [causes, shelters, sheltersById]);

  const cityOptions = filterOptions.city;
  const urgencyOptions = filterOptions.urgency;
  const filteredCards = cards.filter(
    (card) =>
      (!filters.city || card.city === filters.city) &&
      (!filters.urgency || card.urgency === filters.urgency),
  );
  const hasFilters = Boolean(filters.city || filters.urgency);

  const give = async (card) => {
    const amount = Number(amounts[card.id]);
    if (!Number.isFinite(amount) || amount <= 0) {
      setActivityErrors((current) => ({ ...current, [card.id]: "Enter an amount above 0." }));
      return;
    }
    if (!card.shelterRecord) {
      setActivityErrors((current) => ({ ...current, [card.id]: "Shelter details are unavailable." }));
      return;
    }

    setSubmitting(card.id);
    setActivityErrors((current) => ({ ...current, [card.id]: "" }));
    try {
      await post("/me/activity", {
        type: "donation",
        amount,
        note: card.title,
      }, "user");
      setOpen({
        shelter: card.shelterRecord,
        headline: `Thank you for supporting ${card.shelterRecord.name}!`,
      });
    } catch (requestError) {
      setActivityErrors((current) => ({ ...current, [card.id]: requestError.message }));
    } finally {
      setSubmitting(null);
    }
  };

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
                {error || "We couldn't load current donation information. Please try again."}
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
                        onError={hideBrokenImage}
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
                        <>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={amounts[card.id] ?? ""}
                            onChange={(event) => setAmounts((current) => ({ ...current, [card.id]: event.target.value }))}
                            aria-label={`Donation amount for ${card.title}`}
                            placeholder="Amount"
                            style={{ width: "6rem", marginRight: "8px" }}
                          />
                          <button
                            type="button"
                            className="meet donation-link"
                            onClick={() => give(card)}
                            disabled={submitting === card.id}
                          >
                            Give
                          </button>
                        </>
                      ) : (
                        <p className="donation-website-missing">
                          Shelter website not provided.
                        </p>
                      )}
                      {activityErrors[card.id] && <p role="alert">{activityErrors[card.id]}</p>}
                    </div>
                  </article>
                ))
              )}
            </>
          )}
        </section>
      </main>

      {open && (
        <ShelterDetail
          shelter={open.shelter}
          headline={open.headline}
          cta="Donate on the shelter's website"
          onClose={() => setOpen(null)}
        />
      )}

      <FooterStrip />
    </div>
  );
}
