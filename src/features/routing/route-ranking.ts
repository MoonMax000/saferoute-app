import { getRiskColor, getRiskLabel } from "@/features/zones";
import type {
  RouteCategory,
  RouteOption,
  RouteResult,
  RouteSegment,
} from "./route.types";
import { pathSimilarity, type ScoredRoute } from "./route-exposure";
import { evaluatePointRisk } from "@/features/risk";
import type { RiskCell, TimeContext } from "@/features/risk";

const SAFEST_VS_FASTEST_SIMILARITY = 0.85;

/**
 * Convert a scored route into the segment-decorated `RouteResult` the map
 * draws. Internal numbers (avgRisk, riskScore) are kept; UI text is built
 * from the categorical helpers in `features/zones/zone-styles`.
 */
function buildRouteResult(
  scored: ScoredRoute,
  cells: RiskCell[],
  time: TimeContext,
): RouteResult {
  const SEGMENT_LENGTH = 10;
  const segments: RouteSegment[] = [];
  for (let i = 0; i < scored.path.length - 1; i += SEGMENT_LENGTH) {
    const end = Math.min(i + SEGMENT_LENGTH, scored.path.length);
    const segmentPath = scored.path.slice(i, end);
    const step = segmentPath.length < 6 ? 1 : 3;
    let maxRisk = 1;
    for (let j = 0; j < segmentPath.length; j += step) {
      maxRisk = Math.max(maxRisk, evaluatePointRisk(segmentPath[j], cells, time));
    }
    const rounded = Math.round(maxRisk);
    segments.push({
      path: segmentPath,
      riskScore: rounded,
      color: getRiskColor(rounded),
    });
  }

  return {
    segments,
    totalDistance: formatDistance(scored.distance),
    totalDuration: formatDuration(scored.duration),
    averageRisk: Math.round(scored.avgRisk * 10) / 10,
    overallRiskLabel: getRiskLabel(Math.round(scored.avgRisk)),
    polylinePath: scored.path,
  };
}

/**
 * Pick up to three meaningfully distinct routes and assign the Safest /
 * Fastest / Balanced labels. If fewer distinct routes exist, the function
 * gracefully returns fewer cards rather than fabricating duplicates.
 */
export function rankRoutes(
  scored: ScoredRoute[],
  cells: RiskCell[],
  time: TimeContext,
): RouteOption[] {
  if (scored.length === 0) return [];

  if (scored.length === 1) {
    const only = scored[0];
    return [
      makeOption(only, cells, time, {
        id: 0,
        category: "recommended",
        label: "Recommended Route",
        explanation: buildSingleExplanation(only),
      }),
    ];
  }

  // Identify safest = lowest avgRisk; fastest = lowest duration.
  const bySafe = [...scored].sort((a, b) => a.avgRisk - b.avgRisk);
  const safest = bySafe[0];
  const byFast = [...scored].sort((a, b) => a.duration - b.duration);
  const fastest = byFast[0] === safest ? byFast[1] : byFast[0];

  // If safest and fastest end up being the same route, just label it Recommended.
  if (!fastest || fastest === safest) {
    return [
      makeOption(safest, cells, time, {
        id: 0,
        category: "recommended",
        label: "Recommended Route",
        explanation: buildSingleExplanation(safest),
      }),
    ];
  }

  const minutesSavedFastest = Math.max(
    0,
    Math.round((safest.duration - fastest.duration) / 60),
  );

  const options: RouteOption[] = [];

  // Safest first (so it reads top-to-bottom from safer to faster on the card list).
  options.push(
    makeOption(safest, cells, time, {
      id: 0,
      category: "safest",
      label: "Safest Route",
      explanation: buildSafestExplanation(safest, fastest, minutesSavedFastest),
    }),
  );

  // Try to add a balanced option that is meaningfully different from both.
  const balanced = pickBalanced(scored, safest, fastest);
  if (balanced) {
    options.push(
      makeOption(balanced, cells, time, {
        id: 1,
        category: "balanced",
        label: "Balanced Route",
        explanation: buildBalancedExplanation(balanced, fastest),
      }),
    );
  }

  options.push(
    makeOption(fastest, cells, time, {
      id: options.length,
      category: "fastest",
      label: "Fastest Route",
      explanation: buildFastestExplanation(fastest, safest, minutesSavedFastest),
    }),
  );

  // Reassign deterministic ids in case balanced was skipped.
  options.forEach((o, i) => (o.id = i));

  // Mark the safest as selected by default.
  if (options.length > 0) options[0].selected = true;

  return options;
}

function makeOption(
  scored: ScoredRoute,
  cells: RiskCell[],
  time: TimeContext,
  meta: {
    id: number;
    category: RouteCategory;
    label: string;
    explanation: string;
  },
): RouteOption {
  return {
    id: meta.id,
    label: meta.label,
    category: meta.category,
    explanation: meta.explanation,
    description: scored.description,
    route: buildRouteResult(scored, cells, time),
    selected: false,
    durationSeconds: scored.duration,
    distanceMeters: scored.distance,
    highRiskFraction: scored.highRiskFraction,
    incidentImpacts: scored.incidentImpacts,
  };
}

function pickBalanced(
  all: ScoredRoute[],
  safest: ScoredRoute,
  fastest: ScoredRoute,
): ScoredRoute | null {
  const remaining = all.filter((r) => r !== safest && r !== fastest);
  if (remaining.length === 0) return null;

  // Prefer routes that diverge from BOTH safest and fastest.
  const ranked = remaining
    .map((r) => ({
      route: r,
      simSafe: pathSimilarity(r.path, safest.path),
      simFast: pathSimilarity(r.path, fastest.path),
    }))
    .sort(
      (a, b) =>
        a.simSafe + a.simFast - (b.simSafe + b.simFast),
    );

  const best = ranked[0];
  if (!best) return null;

  // If the candidate basically overlaps both, drop it instead of pretending.
  if (
    best.simSafe > SAFEST_VS_FASTEST_SIMILARITY &&
    best.simFast > SAFEST_VS_FASTEST_SIMILARITY
  ) {
    return null;
  }
  return best.route;
}

/* ─── Explanation copy ─── */

function buildSingleExplanation(only: ScoredRoute): string {
  if (only.highRiskFraction >= 0.25) {
    return "Only available route — note: passes through some elevated-risk areas.";
  }
  return "Only available route to this destination.";
}

function buildSafestExplanation(
  safest: ScoredRoute,
  fastest: ScoredRoute,
  minutesAdded: number,
): string {
  const delta = Math.max(0, safest.duration - fastest.duration);
  if (delta < 60) {
    return safest.highRiskFraction <= 0.05
      ? "Avoids higher-risk areas."
      : "Mostly avoids higher-risk areas.";
  }
  const tail = `+${minutesAdded} min vs. fastest`;
  return safest.highRiskFraction <= 0.05
    ? `Avoids higher-risk areas (${tail}).`
    : `Stays clear of the worst areas (${tail}).`;
}

function buildFastestExplanation(
  fastest: ScoredRoute,
  safest: ScoredRoute,
  minutesSaved: number,
): string {
  if (fastest.highRiskFraction >= 0.25) {
    return minutesSaved > 0
      ? `Quickest path (saves ~${minutesSaved} min) — passes through some elevated-risk areas.`
      : "Quickest path — passes through some elevated-risk areas.";
  }
  if (fastest.highRiskFraction >= 0.1) {
    return "Quickest path — minor exposure on the way.";
  }
  // No real safety penalty.
  return safest === fastest
    ? "Quickest and safest converge on this route."
    : "Quickest path with no flagged areas.";
}

function buildBalancedExplanation(
  balanced: ScoredRoute,
  fastest: ScoredRoute,
): string {
  const deltaMin = Math.max(
    0,
    Math.round((balanced.duration - fastest.duration) / 60),
  );
  if (balanced.highRiskFraction <= 0.1) {
    return deltaMin > 0
      ? `Balances time and safety (+${deltaMin} min vs. fastest).`
      : "Balances time and safety.";
  }
  return "Trade-off between time and exposure.";
}

/* ─── formatting ─── */

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} sec`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
