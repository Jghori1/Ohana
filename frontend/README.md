# Paw Patrol — frontend (React + Vite)

Demo frontend for the animal-shelter project. Runs on its own, no backend needed
(`DEMO = true` in `src/auth.js` accepts any login and keeps everything in the browser).

## Run it
```bash
npm install
npm run dev        # http://localhost:5173
```
Requires Node 18+. `npm run build` makes a static `dist/` folder.

## Pages
| Route | File | What it is |
|---|---|---|
| `/` | `src/Landing.jsx` | Landing: puppy gif, Animal Shelter / Individual buttons |
| `/individual` | `src/Dashboard.jsx` | Individual dashboard: photo slideshow, fun facts, stray-rescue contacts (GPS) |
| `/individual/auth` | `src/Auth.jsx` | Log in / sign up (shown when an option is clicked) |
| `/individual/adopt`, `/foster` | `src/Adopt.jsx`, `src/Foster.jsx` | Pet listings with filters, notepad cards, "Ask about" detail panel |
| `/individual/volunteer` | `src/Shelters.jsx` | Shelter directory with filters and detail panel |
| `/individual/donate` | `src/Donate.jsx` | Specific causes with goals and progress |
| `/individual/profile` | `src/Profile.jsx` | Profile: info, adoptions/fosters, volunteering/donations, XP + badges |
| `/shelter/auth` | `src/ShelterAuth.jsx` | Shelter log in / registration (license upload) |
| `/shelter` | `src/ShelterDashboard.jsx` | Shelter's own page: mission (editable), map, website, requests, photos |
| `/shelters/:id` | `src/ShelterDashboard.jsx` (`ShelterPublic`) | Read-only shelter page for individuals |

Shared pieces: `src/components/` (Header, ShelterHeader, FooterStrip, ShelterDetail).
Sessions: `src/auth.js` (individuals), `src/shelterAuth.js` (shelters).

## Where to change things
- **All sample content** — pets, pet details, policies, shelters, causes, fun facts,
  rescue phone numbers, filter options: `src/data/pets.js`.
- **Images** — `public/pets/` (slideshow + listings), `public/hero.gif` (landing puppy),
  `public/logo.png` (logo/favicon), `public/footer/footer-strip.jpg` (cartoon footer banner;
  the individual transparent cut-outs it was made from are in the same folder).
- **Colours** — CSS variables at the top of `src/index.css`
  (`--plum --rose --bronze --tangerine --peach --paper`).
- **Fonts** — Lobster (script) and Patrick Hand (notepad) from Google Fonts in `index.html`.
  To use the Hello Christmas font, save it as `public/fonts/HelloChristmas.ttf`; the
  `@font-face` rule in `src/index.css` picks it up automatically.
- **Demo mode** — `DEMO` in `src/auth.js`. Set to `false` to turn on form validation and
  real API calls (`/api/...`, proxied to `http://localhost:8000` by `vite.config.js`).

## Backend
Not included in this zip. The frontend calls these endpoints when `DEMO` is false:
`POST /api/signup`, `POST /api/login`, `POST /api/shelter/signup`, `POST /api/shelter/login`,
`POST /api/choices`. Everything else is currently served from `src/data/pets.js`.
