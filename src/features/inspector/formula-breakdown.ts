import * as turf from "@turf/turf";
import type { LatLng } from "@/shared/types";
import type { RiskCell, RiskIncident } from "@/features/risk";
import { evaluatePointRisk } from "@/features/risk";
import { haversineDistance } from "@/shared/geo";
import type {
  FormulaBreakdown,
  FormulaBreakdownCell,
} from "./inspector.types";

/**
 * Pure function: compute every step of how a single point's risk score is
 * derived. Used by the click-anywhere popup to make the engine transparent.
 */
export function computeFormulaBreakdown(
  point: LatLng,
  cells: RiskCell[],
  time: "day" | "night",
  incidents: RiskIncident[],
  blockingWeight: number,
  advisoryWeight: number,
): FormulaBreakdown {
  const cellRows: FormulaBreakdownCell[] = cells.map((cell) => {
    const { effective, contains, distM } = perCellEffectiveRisk(
      point,
      cell,
      time,
    );
    return {
      id: cell.id,
      label: cell.label,
      distanceM: distM,
      baseDayRisk: cell.baseDayRisk,
      nightMultiplier: cell.nightMultiplier,
      effectiveRisk: effective,
      contains,
    };
  });

  // Top 3 cells that actually contribute risk at this point.
  const topCells = cellRows
    .filter((r) => r.effectiveRisk > 0)
    .sort((a, b) => b.effectiveRisk - a.effectiveRisk)
    .slice(0, 3);

  const interpolatedBase = evaluatePointRisk(point, cells, "day");
  const nightAppliedRisk = evaluatePointRisk(point, cells, time);

  // Incident influence (matches `incidentInfluenceAt` in route-exposure.ts).
  let incidentBoost = 0;
  for (const inc of incidents) {
    const dist = haversineDistance(point, inc.center);
    if (dist > inc.radius) continue;
    const proximity = 1 - dist / inc.radius;
    const weight =
      inc.kind === "blocking"
        ? inc.severity * blockingWeight
        : inc.severity * advisoryWeight;
    incidentBoost = Math.max(incidentBoost, weight * proximity);
  }

  const finalRisk = Math.min(10, nightAppliedRisk + incidentBoost);

  // Verdict — same ladder as evaluateDestinationRisk so the popup
  // language matches the destination card.
  let verdict: FormulaBreakdown["verdict"];
  if (finalRisk <= 3.2) {
    verdict = "normal";
  } else if (finalRisk <= 5.2) {
    verdict = "caution";
  } else if (
    time === "day" &&
    nightAppliedRisk - interpolatedBase >= 1.6 &&
    nightAppliedRisk > 6
  ) {
    verdict = "elevated-night";
  } else if (time === "night" && nightAppliedRisk - interpolatedBase >= 1.6) {
    verdict = "elevated-night";
  } else {
    verdict = "elevated";
  }

  return {
    point,
    time,
    topCells,
    interpolatedBase,
    nightAppliedRisk,
    incidentBoost,
    finalRisk,
    verdict,
  };
}

/* ────────────── helpers ────────────── */

function perCellEffectiveRisk(
  point: LatLng,
  cell: RiskCell,
  time: "day" | "night",
): { effective: number; contains: boolean; distM: number } {
  const distM = haversineDistance(point, cell.center);
  const mult = time === "night" ? cell.nightMultiplier : 1;
  const fullRisk = cell.baseDayRisk * mult;
  if (pointInCell(point, cell)) {
    return { effective: fullRisk, contains: true, distM };
  }
  if (distM <= cell.radius * 1.5) {
    const factor = Math.max(0, 1 - (distM - cell.radius) / cell.radius);
    return { effective: fullRisk * factor, contains: false, distM };
  }
  return { effective: 0, contains: false, distM };
}

function pointInCell(point: LatLng, cell: RiskCell): boolean {
  if (cell.polygon.length < 3) return false;
  const ring: [number, number][] = cell.polygon.map((p) => [p.lng, p.lat]);
  if (
    ring[0][0] !== ring[ring.length - 1][0] ||
    ring[0][1] !== ring[ring.length - 1][1]
  ) {
    ring.push(ring[0]);
  }
  try {
    const poly = turf.polygon([ring]);
    return turf.booleanPointInPolygon(turf.point([point.lng, point.lat]), poly);
  } catch {
    return false;
  }
}
