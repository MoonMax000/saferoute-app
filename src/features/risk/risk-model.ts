import * as turf from "@turf/turf";
import type { LatLng } from "@/shared/types";
import { haversineDistance } from "@/shared/geo";
import type {
  DestinationRisk,
  DestinationRiskState,
  RiskCell,
  RiskIncident,
  RiskTag,
  TimeContext,
} from "./risk.types";

/**
 * Default arrival radius (in metres) used for destination risk evaluation.
 * Small enough to mean "the area you actually walk through after parking",
 * large enough not to depend on a single GPS pixel.
 */
export const DEFAULT_ARRIVAL_RADIUS_M = 250;

/* ───────────────────────── Internal helpers ───────────────────────── */

function closePolygon(path: LatLng[]): [number, number][] {
  const coords: [number, number][] = path.map((p) => [p.lng, p.lat]);
  if (
    coords.length > 0 &&
    (coords[0][0] !== coords[coords.length - 1][0] ||
      coords[0][1] !== coords[coords.length - 1][1])
  ) {
    coords.push(coords[0]);
  }
  return coords;
}

function pointInCell(point: LatLng, cell: RiskCell): boolean {
  const ring = closePolygon(cell.polygon);
  const poly = turf.polygon([ring]);
  return turf.booleanPointInPolygon(turf.point([point.lng, point.lat]), poly);
}

function circleIntersectsCell(
  center: LatLng,
  radiusMeters: number,
  cell: RiskCell,
): boolean {
  const c = turf.circle([center.lng, center.lat], radiusMeters / 1000, {
    steps: 16,
    units: "kilometers",
  });
  const ring = closePolygon(cell.polygon);
  const poly = turf.polygon([ring]);
  return turf.booleanIntersects(c, poly);
}

function cellRiskAt(cell: RiskCell, time: TimeContext): number {
  const m = time === "night" ? cell.nightMultiplier : 1;
  return cell.baseDayRisk * m;
}

/* ──────────────────────────── Public API ──────────────────────────── */

/**
 * Effective risk at a single point. Used internally — never displayed.
 */
export function evaluatePointRisk(
  point: LatLng,
  cells: RiskCell[],
  time: TimeContext,
): number {
  let max = 1;
  for (const cell of cells) {
    if (pointInCell(point, cell)) {
      max = Math.max(max, cellRiskAt(cell, time));
    } else {
      const dist = haversineDistance(point, cell.center);
      if (dist <= cell.radius * 1.5) {
        const factor = Math.max(0, 1 - (dist - cell.radius) / cell.radius);
        max = Math.max(max, cellRiskAt(cell, time) * factor);
      }
    }
  }
  return max;
}

/**
 * Effective risk for an arrival area (small disc around the destination).
 * Picks the worst cell that intersects the disc plus any incident impact.
 */
export function evaluateArrivalRisk(
  point: LatLng,
  cells: RiskCell[],
  time: TimeContext,
  incidents: RiskIncident[] = [],
  arrivalRadiusM: number = DEFAULT_ARRIVAL_RADIUS_M,
): { effectiveRisk: number; affected: RiskCell[]; incidentBoost: number } {
  const affected: RiskCell[] = [];
  let max = 1;
  for (const cell of cells) {
    if (circleIntersectsCell(point, arrivalRadiusM, cell)) {
      affected.push(cell);
      max = Math.max(max, cellRiskAt(cell, time));
    }
  }
  // Incidents within arrival radius bump the score upward.
  let incidentBoost = 0;
  for (const inc of incidents) {
    const dist = haversineDistance(point, inc.center);
    if (dist <= arrivalRadiusM + inc.radius) {
      incidentBoost = Math.max(incidentBoost, inc.severity * 1.2);
    }
  }
  return {
    effectiveRisk: Math.min(10, max + incidentBoost),
    affected,
    incidentBoost,
  };
}

/**
 * Destination-risk evaluation. Returns ONE of four states plus human-readable
 * reason strings. The internal numeric score is never returned.
 */
export function evaluateDestinationRisk(
  destination: LatLng,
  cells: RiskCell[],
  time: TimeContext,
  incidents: RiskIncident[] = [],
  arrivalRadiusM: number = DEFAULT_ARRIVAL_RADIUS_M,
): DestinationRisk {
  const dayEval = evaluateArrivalRisk(
    destination,
    cells,
    "day",
    incidents,
    arrivalRadiusM,
  );
  const nightEval = evaluateArrivalRisk(
    destination,
    cells,
    "night",
    incidents,
    arrivalRadiusM,
  );

  const effective = time === "night" ? nightEval : dayEval;
  const dayRisk = dayEval.effectiveRisk;
  const nightRisk = nightEval.effectiveRisk;
  const score = effective.effectiveRisk;

  // State decision
  let state: DestinationRiskState;
  if (score <= 3.2) {
    state = "normal";
  } else if (score <= 5.2) {
    state = "caution";
  } else if (time === "day" && nightRisk - dayRisk >= 1.6 && nightRisk > 6) {
    // Daytime is fine, but nighttime would be much worse — still call it
    // out so investors see the day/night signal in the demo.
    state = "elevated-night";
  } else if (time === "night" && nightRisk - dayRisk >= 1.6) {
    state = "elevated-night";
  } else {
    state = "elevated";
  }

  const primaryReason = buildPrimaryReason(state, effective.affected, time);
  const secondaryReason = buildSecondaryReason(
    state,
    dayRisk,
    nightRisk,
    effective.incidentBoost,
  );

  return {
    state,
    primaryReason,
    secondaryReason,
    affectedCellLabels: effective.affected.map((c) => c.label),
  };
}

function buildPrimaryReason(
  state: DestinationRiskState,
  affected: RiskCell[],
  time: TimeContext,
): string {
  if (state === "normal") return "This area looks normal.";
  const tagSet = new Set<RiskTag>();
  for (const c of affected) for (const t of c.tags) tagSet.add(t);
  const tagPhrase = describeTags([...tagSet]);
  if (state === "caution") {
    return tagPhrase
      ? `Use caution near ${tagPhrase}.`
      : "Use caution in this area.";
  }
  if (state === "elevated-night") {
    return time === "night"
      ? "Higher-risk at night — be alert when arriving."
      : "Looks fine now, but this area gets riskier after dark.";
  }
  return tagPhrase
    ? `Higher-risk area — close to ${tagPhrase}.`
    : "Higher-risk area.";
}

function buildSecondaryReason(
  state: DestinationRiskState,
  dayRisk: number,
  nightRisk: number,
  incidentBoost: number,
): string | undefined {
  if (incidentBoost > 0) {
    return "Recent incident reported nearby.";
  }
  if (state === "elevated-night" && nightRisk - dayRisk >= 1.6) {
    return "Daytime profile is calmer — consider arriving before dusk.";
  }
  return undefined;
}

function describeTags(tags: RiskTag[]): string {
  const parts: string[] = [];
  if (tags.includes("nightlife")) parts.push("a nightlife district");
  if (tags.includes("industrial") || tags.includes("isolated"))
    parts.push("an isolated/industrial stretch");
  if (tags.includes("corridor") && parts.length === 0)
    parts.push("a transit corridor");
  if (tags.includes("commercial") && parts.length === 0)
    parts.push("a commercial zone");
  if (tags.includes("tourist") && parts.length === 0)
    parts.push("a tourist hotspot");
  return parts.slice(0, 2).join(" and ");
}
