import type { LatLng } from "@/shared/types";

/**
 * Display category assigned to each compared route. Internal scoring is
 * what produces these — the labels are what the UI surfaces.
 *
 * `best` is special: it's set when one route wins on BOTH risk and time
 * (or wins on risk and is within ~60s of the fastest), so we don't
 * mislead the user with a "Fastest" card that's actually slower than
 * the "Safest" card.
 */
export type RouteCategory =
  | "best"
  | "safest"
  | "fastest"
  | "balanced"
  | "alternative"
  | "recommended";

/**
 * Visual tone for the route card. Drives border, ring, dot, badge —
 * roughly "how good is this option overall?". Computed in `route-ranking`
 * from a blend of avgRisk and how much slower the route is vs. the
 * fastest one.
 */
export type RouteTone = "best" | "good" | "neutral" | "warn";

export interface RouteSegment {
  path: LatLng[];
  /** Internal effective-risk score for this segment (1..10). UI never shows. */
  riskScore: number;
  color: string;
}

export interface RouteResult {
  segments: RouteSegment[];
  totalDistance: string;
  totalDuration: string;
  /** Internal — for ranking only. */
  averageRisk: number;
  /** User-facing label for the route as a whole ("Safe", "Moderate", ...). */
  overallRiskLabel: string;
  polylinePath: LatLng[];
}

export interface RouteOption {
  id: number;
  /** Stable identity for preserving the same physical route across re-ranks. */
  routeKey: string;
  /** Human-readable badge: "Safest Route", "Fastest", etc. */
  label: string;
  /** Display category that drives layout / ordering. */
  category: RouteCategory;
  /** Visual tone — "how good is this overall?". UI uses this for color. */
  tone: RouteTone;
  /** One-line explanation shown in the route card. */
  explanation: string;
  /** Provider-supplied description (e.g. "via Hung Vuong"). */
  description?: string;
  route: RouteResult;
  selected: boolean;
  /** Internal: total duration in seconds. */
  durationSeconds: number;
  /** Internal: total distance in metres. */
  distanceMeters: number;
  /** Internal: fraction of sampled points falling in elevated risk cells. */
  highRiskFraction: number;
  /** Internal: number of distinct incidents physically intersecting the route. */
  incidentImpacts: number;
}

export interface RouteAlert {
  zoneId: string;
  zoneLabel: string;
  riskLevel: number;
  riskLabel: string;
  type: "crosses" | "near";
}
