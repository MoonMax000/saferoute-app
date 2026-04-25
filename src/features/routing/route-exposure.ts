import { decode } from "@googlemaps/polyline-codec";
import type { LatLng } from "@/shared/types";
import { evaluatePointRisk } from "@/features/risk";
import type { RiskCell, RiskIncident, TimeContext } from "@/features/risk";
import type { RawRoute } from "@/lib/google/routes-api";
import { haversineDistance } from "@/shared/geo";

export interface ScoredRoute extends RawRoute {
  /** Decoded polyline. */
  path: LatLng[];
  /** Internal — average effective risk along the route. */
  avgRisk: number;
  /** Internal — peak effective risk along the route. */
  maxRisk: number;
  /** Internal — fraction of samples whose risk crosses the elevated threshold. */
  highRiskFraction: number;
  /** Internal — number of incidents within `incidentImpactRadiusM` of the route. */
  incidentImpacts: number;
}

export interface ExposureOptions {
  /** Sample step along the polyline (in vertices). */
  sampleStep?: number;
  /** Threshold above which a sample counts as elevated. */
  elevatedThreshold?: number;
  /** Distance from the polyline (metres) at which an incident counts as a hit. */
  incidentImpactRadiusM?: number;
}

const DEFAULTS: Required<ExposureOptions> = {
  sampleStep: 8,
  elevatedThreshold: 5.5,
  incidentImpactRadiusM: 120,
};

export function decodeRoutePolyline(encoded: string): LatLng[] {
  if (!encoded) return [];
  return decode(encoded).map(([lat, lng]) => ({ lat, lng }));
}

/**
 * Per-sample influence of nearby incidents. `blocking` incidents (closures,
 * accidents) crank the local risk hard; `advisory` incidents (police,
 * recent crime) add a softer bump.
 */
function incidentInfluenceAt(
  point: { lat: number; lng: number },
  incidents: RiskIncident[],
): number {
  let max = 0;
  for (const incident of incidents) {
    const dist = haversineDistance(point, incident.center);
    if (dist > incident.radius) continue;
    const proximity = 1 - dist / incident.radius;
    const weight =
      incident.kind === "blocking"
        ? incident.severity * 2.0
        : incident.severity * 1.0;
    max = Math.max(max, weight * proximity);
  }
  return max;
}

/**
 * Score a single raw route against the simulated risk model and any active
 * incidents. All numbers stay internal — they drive the ranker, never the
 * UI.
 */
export function scoreRoute(
  raw: RawRoute,
  cells: RiskCell[],
  time: TimeContext,
  incidents: RiskIncident[] = [],
  opts: ExposureOptions = {},
): ScoredRoute {
  const { sampleStep, elevatedThreshold, incidentImpactRadiusM } = {
    ...DEFAULTS,
    ...opts,
  };
  const path = decodeRoutePolyline(raw.encodedPolyline);

  let totalRisk = 0;
  let maxRisk = 0;
  let elevatedSamples = 0;
  let totalSamples = 0;

  const evalSample = (i: number) => {
    const base = evaluatePointRisk(path[i], cells, time);
    const bump = incidentInfluenceAt(path[i], incidents);
    const r = Math.min(10, base + bump);
    totalRisk += r;
    maxRisk = Math.max(maxRisk, r);
    if (r >= elevatedThreshold) elevatedSamples++;
    totalSamples++;
  };

  for (let i = 0; i < path.length; i += sampleStep) {
    evalSample(i);
  }
  if (path.length > 0 && (path.length - 1) % sampleStep !== 0) {
    evalSample(path.length - 1);
  }

  const avgRisk = totalSamples > 0 ? totalRisk / totalSamples : 0;
  const highRiskFraction =
    totalSamples > 0 ? elevatedSamples / totalSamples : 0;

  // Count how many distinct incidents touch the route (used for badges
  // and reroute reasoning).
  let incidentImpacts = 0;
  for (const incident of incidents) {
    let touched = false;
    for (let i = 0; i < path.length; i += sampleStep) {
      if (
        haversineDistance(path[i], incident.center) <=
        incidentImpactRadiusM + incident.radius
      ) {
        touched = true;
        break;
      }
    }
    if (touched) incidentImpacts++;
  }

  return {
    ...raw,
    path,
    avgRisk,
    maxRisk,
    highRiskFraction,
    incidentImpacts,
  };
}

/**
 * Rough "are these two routes the same path?" measure. Samples points from
 * `a`, asks how many fall within `nearMeters` of any sample on `b`.
 * Returns 0..1 where 1 means identical coverage of `a` by `b`.
 */
export function pathSimilarity(
  a: LatLng[],
  b: LatLng[],
  nearMeters = 100,
): number {
  if (a.length === 0 || b.length === 0) return 0;
  const stepA = Math.max(1, Math.floor(a.length / 30));
  const stepB = Math.max(1, Math.floor(b.length / 80));
  let close = 0;
  let count = 0;
  for (let i = 0; i < a.length; i += stepA) {
    count++;
    for (let j = 0; j < b.length; j += stepB) {
      if (haversineDistance(a[i], b[j]) <= nearMeters) {
        close++;
        break;
      }
    }
  }
  return count > 0 ? close / count : 0;
}
