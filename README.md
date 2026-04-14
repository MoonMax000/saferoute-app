# SafeRoute

Risk-aware navigation prototype. Displays real-time risk zones on a map, calculates alternative routes with per-segment risk scoring, and alerts users when entering high-risk areas.

## Stack

- **Framework:** Next.js 16 (App Router, TypeScript, Turbopack)
- **Map:** Google Maps JavaScript API via `@react-google-maps/api`
- **Styling:** Tailwind CSS v4
- **Icons:** lucide-react

## Setup

```bash
npm install
cp .env.example .env.local
# Add your Google Maps API key to .env.local
npm run dev
```

The app requires a Google Maps API key with the following APIs enabled:
- Maps JavaScript API
- Directions API
- Places API
- Geocoding API

## Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps API key |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |

## Architecture

Feature-oriented structure under `src/features/`. Each feature exposes a public API via `index.ts`.

```
src/
  app/          App shell, layout, global styles
  features/
    map/        Map component, controls, legend
    routing/    Directions API, route risk scoring, search UI
    zones/      Zone data loading, polygon detection, risk styles
    simulation/ Drive simulation with zone enter/exit tracking
    safety/     Safety analysis, event log
  shared/       Geo utilities, base types
```

**Key decisions:**
- Business logic lives in service/utility files, not in components
- Zone detection uses `google.maps.geometry.poly.containsLocation()` for polygon-based accuracy, with haversine fallback
- Risk is evaluated per-segment by sampling multiple points (not just midpoint)
- Simulation uses hysteresis (exit buffer + cooldown) to prevent GPS jitter noise
- Zone data loaded from GeoJSON at runtime; production would swap for an API endpoint

## Trade-offs

- **Web prototype, not React Native.** Built as a Next.js web app to demonstrate core logic quickly. The feature structure and business logic modules are designed to transfer to a React Native codebase.
- **Mock zone data.** Risk zones are static GeoJSON. Production would integrate real-time crime/incident APIs.
- **No persistent state.** All state is in-memory React state. Production would add server-side persistence and user accounts.
- **Google Maps Marker (legacy).** Uses `google.maps.Marker` instead of `AdvancedMarkerElement` for broader compatibility. Should migrate for production.
