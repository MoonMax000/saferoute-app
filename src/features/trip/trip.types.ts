import type { LatLng } from "@/shared/types";

/**
 * Lifecycle state of a passenger-safety trip.
 *
 * - `idle` — no trip active.
 * - `awaiting-fix` — trip started, no GPS sample yet.
 * - `on-route` — most recent fix is within the deviation threshold.
 * - `evaluating-deviation` — fix is off-route, timer still running.
 * - `deviated` — sustained off-route (timer crossed `sustainedMs`).
 * - `arrived` — close enough to the final route vertex.
 * - `permission-denied` — user blocked geolocation.
 * - `unavailable` — `navigator.geolocation` missing or returned an error.
 */
export type TripState =
  | "idle"
  | "awaiting-fix"
  | "on-route"
  | "evaluating-deviation"
  | "deviated"
  | "arrived"
  | "permission-denied"
  | "unavailable";

export interface TripStatus {
  state: TripState;
  position: LatLng | null;
  /** Distance (m) from the most recent fix to the route. `null` until first fix. */
  distanceFromRouteM: number | null;
  /** Free-form error message for `permission-denied` / `unavailable`. */
  errorMessage?: string;
}
