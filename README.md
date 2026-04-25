# NavShieldAI — Phase 1 MVP

One-city investor demo for risk-aware navigation. Compares Safest / Fastest /
Balanced routes, surfaces destination caution before routing, lets you mark
incidents on the map, and tracks live trips with browser geolocation.

The safety model is **simulated** — there is no real crime data feed.

## Demo flow (the investor story)

1. **Pick a destination** — Place autocomplete is biased to the configured
   demo city.
2. **Destination caution** — a banner appears before routing, e.g. "Use
   caution near a nightlife district" or "Higher-risk at night".
3. **Compare routes** — up to three cards (Safest / Balanced / Fastest)
   with one-line explanations.
4. **Switch Day / Night** — risk overlay and route ranking shift live, no
   server round-trip.
5. **Mark an incident** — tap Robbery / Police / Blockage in the Incidents
   panel, then click the map. Routes re-rank instantly.
6. **Reroute suggestion** — when an incident makes the selected route worse
   and a safer alternative exists, a banner offers the swap (never forced).
7. **Start trip** — live `watchPosition` tracks GPS vs. the selected
   polyline, with on-route / drift / sustained-deviation / arrived states.

A "Try Demo" button seeds the Sheraton → Po Nagar pair on Nha Trang,
which crosses both calm tourist areas and the industrial edge — clean
Safest-vs-Fastest split.

## Stack

- **Framework** — Next.js 16 (App Router, Turbopack), React 19, TypeScript 5
- **Styling** — Tailwind v4
- **Maps** — Google Maps JavaScript API (`@react-google-maps/api`),
  `AdvancedMarkerElement`, `mapId`
- **Routing** — Google **Routes API** via a server-side `/api/routes`
  handler with explicit `X-Goog-FieldMask`
- **Place search** — `AutocompleteSuggestion.fetchAutocompleteSuggestions`
  + `Place.fetchFields` (the modern replacement for legacy
  `places.Autocomplete`)
- **Geometry** — `@turf/turf` for polygon-vs-circle and point-to-line math
- **State** — React local state + `zustand` (incidents, with localStorage
  persistence)
- **Validation** — `zod` for env config
- **Icons** — `lucide-react`

## Required Google APIs

Enable these in the Google Cloud Console for the project tied to your key:

1. **Maps JavaScript API** — for the map shell and the Places web SDK
2. **Routes API** — used by `/api/routes` for alternative-route computation
3. **Places API (New)** — used by `AutocompleteSuggestion` / `Place` calls
4. **Geocoding API** — used by reverse-geocode on map clicks

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Purpose | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Browser key for Maps JS + Places | Restrict by **HTTP referrer** in Google Cloud Console |
| `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` | Map style ID | Required for `AdvancedMarkerElement` |
| `GOOGLE_ROUTES_API_KEY` | **Server-only** key for Routes API | Restrict by **IP** (and to Routes API) in Cloud Console. In dev this falls back to `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, with a warning. |
| `NEXT_PUBLIC_DEMO_CITY` | `nha-trang` (default) or `nyc` | Drives map centre, autocomplete bias, risk dataset, and seed addresses |

## Local setup

```bash
npm install
cp .env.example .env.local
# fill the keys
npm run dev
```

The dev server runs on the port chosen by Next.js (3000 by default;
`PORT=3001 npm run dev` if you have something else on 3000).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server with Turbopack |
| `npm run build` | Production build (also runs `tsc --noEmit`) |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint (Next.js config) |

## Deploy to Vercel

1. Push the repo to GitHub / GitLab / Bitbucket.
2. Import the project in Vercel.
3. Set the four environment variables on the Vercel **Production** (and
   **Preview**) environments. `GOOGLE_ROUTES_API_KEY` must be set as a
   plain (non-`NEXT_PUBLIC_`) variable so it never leaks to the browser
   bundle.
4. Trigger a deploy. Vercel applies env-var changes only on the next
   build, so re-deploy after editing them.
5. After the first successful deploy, **lock down API keys**:
   - Browser key: HTTP referrer restriction → your Vercel domain only.
   - Server key: IP restriction → Vercel's outbound IP range, or remove
     the IP filter and use Vercel's protected env-only key (preferred).

## Architecture (one-screen tour)

```
src/
  app/
    page.tsx           Single-screen UI orchestration
    layout.tsx         App shell + metadata
    api/routes/route.ts  POST handler wrapping the Routes API
  shared/              Cross-feature primitives (LatLng, geo math)
  lib/
    env.ts             zod-validated client + server env
    google/            Maps loader, demo-cities config, place search
                       (modern AutocompleteSuggestion API), Routes API client
  features/
    map/               Map shell, AdvancedMarkerElement helpers, overlays
    risk/              Simulated city cells, day/night model,
                       destination evaluation (arrival radius)
    routing/           Server-call helper, route exposure scoring,
                       Safest / Balanced / Fastest ranker, route cards
    incidents/         zustand store w/ localStorage, panel, marker
                       layer, reroute suggestion
    trip/              Live geolocation deviation detection state-machine
    safety/            Safety summary card + event log (works for both
                       Demo Drive and Live Trip)
    simulation/        Polyline-walker for the on-screen "Demo Drive"
                       button (no GPS)
    zones/             Compatibility shim — derives the legacy RiskZone[]
                       shape from the new risk-cell dataset
```

See `ARCHITECTURE.md` for the detailed design notes and the rationale
behind the Routes API / mapId / AutocompleteSuggestion / no-Drawing-Library
choices.

## Manual QA checklist

Run through this before each demo. Numbers are **never** displayed in the
UI by design; everything below is verified visually against categorical
labels and explanation strings.

- [ ] **Map loads** centred on the configured demo city.
- [ ] **Place autocomplete** in the origin / destination inputs is biased
      to the demo city (e.g. typing "po na" suggests Po Nagar Towers in
      the Nha Trang demo).
- [ ] **Try Demo** button populates origin + destination and renders three
      route cards.
- [ ] **Day / Night toggle** changes the overlay colours AND re-orders /
      re-explains the route cards without a network call (open the
      Network tab and verify no extra `/api/routes`).
- [ ] **Destination warning** card appears before route cards and reflects
      Day vs Night.
- [ ] **Drag the A or B marker** triggers a fresh route fetch and
      re-renders the comparison.
- [ ] **Place an Incident** (Robbery / Police / Blockage):
      - Marker + radius circle render on the map.
      - Routes re-rank locally (no network call).
      - For Blockage on the selected route, a **Safer route available**
        banner appears.
      - "Switch route" swaps the selection; "Dismiss" hides only that
        suggestion.
- [ ] **Incidents persist** through a full page reload (localStorage).
- [ ] **Demo Drive** walks the selected polyline on screen, with toasts
      when it enters / exits flagged areas.
- [ ] **Start Trip** with location permission **allowed**:
      - State goes `awaiting-fix` → `on-route` once GPS arrives.
      - Move the device (or fake the location in DevTools → Sensors)
        ~100 m off the polyline; state should go through
        `evaluating-deviation` → `deviated` after ~5 s.
      - Returning on path resets to `on-route`.
      - Reaching ≤ 30 m from the destination marks `arrived` and stops
        the watcher.
- [ ] **Start Trip** with permission **denied** shows the
      `permission-denied` card with a re-enable hint, and never crashes.
- [ ] **No raw risk numbers** appear anywhere in the UI (search the page
      for `/10` — you should only see Tailwind opacity tokens).
- [ ] **Demo disclaimer** ("Safety model is simulated…") is visible at
      the bottom of the sidebar.

## Known scope boundaries (Phase 1)

These are intentionally outside Phase 1 and live in the contract for
later phases:

- No accounts / auth / payments.
- No real-time crime / safety data integration.
- No mobile apps. Web only, but the data model is portable.
- No background geolocation. Trip tracking only runs while the tab is
  visible.
- No production hardening (rate limiting on `/api/routes`, no observability,
  no analytics).
- No multi-city architecture. Switching `NEXT_PUBLIC_DEMO_CITY` is a
  build-time toggle, not a per-user setting.

## Trade-off notes

- **Simulated risk data.** Each city has 12 hand-tuned cells with
  day/night multipliers and tags. Production would swap the in-bundle
  GeoJSON for a hosted dataset.
- **Routes API field mask.** Locked to the minimum needed for ranking
  (`duration`, `distanceMeters`, `polyline.encodedPolyline`,
  `description`, `routeLabels`, `warnings`). Adding more fields can
  bump the Routes pricing tier.
- **Zustand persistence.** Incidents live in `localStorage` only. A
  multi-device demo would need a backend; deliberately out of Phase 1.
- **One watcher per role.** `MapView` watches the user pulse,
  `useTrip` runs its own watcher only while a trip is active.
