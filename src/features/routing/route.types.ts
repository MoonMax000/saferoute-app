import type { LatLng } from "@/shared/types";

/**
 * Display category assigned to each compared route. Internal scoring is
 * what produces these — the labels are what the UI surfaces.
 */
export type RouteCategory =
  | "safest"
  | "fastest"
  | "balanced"
  | "recommended";

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
  /** Human-readable badge: "Safest Route", "Fastest", etc. */
  label: string;
  /** Display category that drives layout / ordering. */
  category: RouteCategory;
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
