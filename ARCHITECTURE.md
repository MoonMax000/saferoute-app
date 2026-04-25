# NavShieldAI — Architecture (Phase 1)

This is a one-city investor MVP. The product story has two distinct layers:

1. **Destination risk** — evaluated for the area around the destination *before*
   any routing happens. Uses a small arrival radius around point B and the
   simulated city risk model + currently active incidents + day/night context.

2. **Route risk** — once both A and B are known, fetch alternative routes from
   Google Routes API (server-side), score each route against the same risk
   surface internally, and label them as **Safest / Fastest / Balanced** for
   the UI.

Internal numeric scores stay inside the modules — the UI shows only
human-readable language ("looks normal", "use caution", "higher-risk at
night", etc.). The safety model is simulated; a subtle disclaimer is shown.

## Folder layout

```
src/
  app/                     Next.js App Router entry (page, layout, api routes)
  shared/                  Cross-feature primitives (types, geo math)
  lib/
    env.ts                 zod-validated runtime config (client + server)
    google/                Google loader + server Routes API client (Stage 2/4)
  features/
    map/                   Map shell, controls, AdvancedMarkerElement helpers
    routing/               Route fetching, scoring, ranking, comparison UX
    risk/                  (Stage 3) simulated city risk model + destination risk
    zones/                 Legacy NYC zone primitives (kept for compat; risk/
                           feature will subsume in Stage 3)
    incidents/             (Stage 5) manual incidents, persistence, weighting
    trip/                  (Stage 6) start-trip + browser geolocation deviation
    safety/                Safety summary + event log (existing)
    simulation/            Existing polyline-walker; Stage 6 superseded by trip
  data/                    Static city datasets (Stage 3 will populate)
public/
  data/                    Public-facing GeoJSON (already used for zones)
```

## Why these choices

- **Routes API instead of Directions API.** Directions API became Legacy in
  March 2025. Routes API is the only forward-compatible option, supports
  alternative routes, and requires a `X-Goog-FieldMask` for cost control.
- **Server-side Routes call.** The Routes key is server-only and never reaches
  the browser bundle. This split is enforced by `lib/env.ts`.
- **Destination risk is its own concept.** It uses an arrival radius (not a
  single point) and is evaluated *before* showing route options so the
  investor narrative — "this destination looks risky at night" — comes first.
- **AdvancedMarkerElement + mapId.** Already in place; legacy `Marker` is
  deprecated.
- **No Drawing Library.** Incidents are placed via custom UI (Stage 5).
- **localStorage for incidents.** Phase 1 has no backend; persistence is
  intentionally lightweight.

## What stays from the existing prototype

- Feature-oriented `src/features/*` structure with `index.ts` barrels.
- `containsLocation()`-based polygon detection with haversine fallback.
- Map shell behaviours: draggable A/B markers, traffic toggle, day/night map
  styling, demo seed button, user-location pulse.
- Tailwind v4 + lucide-react UI vocabulary.

## What changes in later stages

| Stage | Replaces | With                                                      |
| ----- | -------- | --------------------------------------------------------- |
| 2     | scattered map bootstrap | clean Google loader + place autocomplete   |
| 3     | NYC-only zone array     | one-city grid + day/night + tags + arrival-radius destination check |
| 4     | client DirectionsService| server `/api/routes` calling Routes API w/ field mask     |
| 5     | (none)                  | manual incidents w/ severity + radius, reroute hint        |
| 6     | polyline-walker sim     | live `watchPosition` with deviation threshold              |
| 7     | (none)                  | seeded demo flow + investor README + Vercel deploy notes   |

## Internal vs UI

- Risk scoring is allowed to be numeric *inside* `features/risk` and
  `features/routing` so we can rank routes deterministically.
- The UI **never** shows numeric scores; it maps to one of:
  - "Area looks normal"
  - "Use caution in this area"
  - "Higher-risk area"
  - "Higher-risk at night"

## Demo disclaimer

A persistent, low-key banner reminds viewers that the safety model is
simulated for demo purposes. This sits in the sidebar near map controls.
