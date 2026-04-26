import { getRiskColor, getRiskLabel } from "@/features/zones";
import type {
  RouteCategory,
  RouteOption,
  RouteResult,
  RouteSegment,
  RouteTone,
} from "./route.types";
import { pathSimilarity, type ScoredRoute } from "./route-exposure";
import { evaluatePointRisk } from "@/features/risk";
import type { RiskCell, TimeContext } from "@/features/risk";

/** Two routes counted as "essentially the same path". */
const SAFEST_VS_FASTEST_SIMILARITY = 0.85;
/**
 * If the safest route is no more than this many seconds slower than
 * the actual fastest one, we collapse them into a single "Best" card.
 * Otherwise the user sees a confusing "Fastest is slower than Safest"
 * row — because deduplication forces us to pick a different route as
 * the Fastest label even when the Safest already won on time too.
 */
const BEST_OF_BOTH_THRESHOLD_SEC = 60;

/* ─────────────────────── Tone derivation ─────────────────────── */

/**
 * Map a scored route to a visual tone based on:
 *  - absolute risk (avgRisk on a 1..10 scale)
 *  - relative slowness vs the fastest route
 *  - presence of touched incidents
 *
 * Higher tone = greener card + "this is a good choice" UX.
 */
function deriveTone(
  scored: ScoredRoute,
  fastestDuration: number,
  isTopPick: boolean,
): RouteTone {
  if (isTopPick) return "best";

  const overFastestSec = Math.max(0, scored.duration - fastestDuration);
  const slownessPenalty = overFastestSec / 60; // 1 unit per minute
  const riskPenalty = scored.avgRisk; // 1..10
  const incidentPenalty = scored.incidentImpacts * 1.5;

  const score = riskPenalty + slownessPenalty * 0.5 + incidentPenalty;

  if (score <= 3.5) return "good";
  if (score <= 6) return "neutral";
  return "warn";
}

/* ─────────────────────── Route building ─────────────────────── */

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
    // Include the boundary vertex in both adjacent segments so Google Maps
    // draws continuous colored strokes instead of tiny gaps at risk changes.
    const end = Math.min(i + SEGMENT_LENGTH + 1, scored.path.length);
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

/* ─────────────────────── Ranking ─────────────────────── */

/**
 * Pick the meaningful set of route cards to show, with honest labels:
 *
 *  - 1 distinct route                  → "Recommended" (only choice)
 *  - safest ≈ fastest (≤60s slower)    → "Best", + alternative(s)
 *  - safest noticeably slower          → "Safest", "Balanced", "Fastest"
 */
export function rankRoutes(
  scored: ScoredRoute[],
  cells: RiskCell[],
  time: TimeContext,
): RouteOption[] {
  if (scored.length === 0) return [];

  const fastestDurationOverall = Math.min(...scored.map((s) => s.duration));

  if (scored.length === 1) {
    const only = scored[0];
    return [
      makeOption(only, cells, time, fastestDurationOverall, {
        id: 0,
        category: "recommended",
        label: "Recommended Route",
        explanation: buildSingleExplanation(only),
        isTopPick: true,
      }),
    ];
  }

  const bySafe = [...scored].sort((a, b) => a.avgRisk - b.avgRisk);
  const safest = bySafe[0];
  const byFast = [...scored].sort((a, b) => a.duration - b.duration);
  const trueFastest = byFast[0];

  // ── CASE A: safest IS the fastest (or close to it). Don't mislead
  // the user with a slower "Fastest" card — collapse into a single
  // "Best" recommendation and surface real alternatives.
  const safestSlownessVsFastest = safest.duration - trueFastest.duration;
  if (safestSlownessVsFastest <= BEST_OF_BOTH_THRESHOLD_SEC) {
    const options: RouteOption[] = [];

    options.push(
      makeOption(safest, cells, time, fastestDurationOverall, {
        id: 0,
        category: "best",
        label: "Recommended",
        explanation: buildBestExplanation(safest, trueFastest),
        isTopPick: true,
      }),
    );

    // Surface up to 2 alternatives, ranked by being meaningfully
    // different in path AND offering some honest trade-off.
    const alternatives = scored
      .filter((r) => r !== safest)
      .map((r) => ({
        route: r,
        sim: pathSimilarity(r.path, safest.path),
      }))
      .filter((x) => x.sim < SAFEST_VS_FASTEST_SIMILARITY)
      .sort((a, b) => a.sim - b.sim) // most distinct first
      .slice(0, 2)
      .map((x) => x.route);

    alternatives.forEach((alt) => {
      options.push(
        makeOption(alt, cells, time, fastestDurationOverall, {
          id: options.length,
          category: "alternative",
          label:
            alt.duration < safest.duration
              ? "Faster Alternative"
              : "Different Path",
          explanation: buildAlternativeExplanation(alt, safest),
          isTopPick: false,
        }),
      );
    });

    options.forEach((o, i) => (o.id = i));
    if (options.length > 0) options[0].selected = true;
    return options;
  }

  // ── CASE B: Safest and Fastest are genuinely different routes.
  const fastest = trueFastest === safest ? byFast[1] : trueFastest;
  if (!fastest || fastest === safest) {
    return [
      makeOption(safest, cells, time, fastestDurationOverall, {
        id: 0,
        category: "recommended",
        label: "Recommended Route",
        explanation: buildSingleExplanation(safest),
        isTopPick: true,
      }),
    ];
  }

  const minutesAddedForSafest = Math.max(
    0,
    Math.round((safest.duration - fastest.duration) / 60),
  );

  const options: RouteOption[] = [];

  options.push(
    makeOption(safest, cells, time, fastestDurationOverall, {
      id: 0,
      category: "safest",
      label: "Safest Route",
      explanation: buildSafestExplanation(
        safest,
        fastest,
        minutesAddedForSafest,
      ),
      isTopPick: true,
    }),
  );

  const balanced = pickBalanced(scored, safest, fastest);
  if (balanced) {
    options.push(
      makeOption(balanced, cells, time, fastestDurationOverall, {
        id: 1,
        category: "balanced",
        label: "Balanced Route",
        explanation: buildBalancedExplanation(balanced, safest, fastest),
        isTopPick: false,
      }),
    );
  }

  options.push(
    makeOption(fastest, cells, time, fastestDurationOverall, {
      id: options.length,
      category: "fastest",
      label: "Fastest Route",
      explanation: buildFastestExplanation(
        fastest,
        safest,
        minutesAddedForSafest,
      ),
      isTopPick: false,
    }),
  );

  options.forEach((o, i) => (o.id = i));
  if (options.length > 0) options[0].selected = true;
  return options;
}

/* ─────────────────────── makeOption ─────────────────────── */

function makeOption(
  scored: ScoredRoute,
  cells: RiskCell[],
  time: TimeContext,
  fastestDuration: number,
  meta: {
    id: number;
    category: RouteCategory;
    label: string;
    explanation: string;
    isTopPick: boolean;
  },
): RouteOption {
  return {
    id: meta.id,
    routeKey:
      scored.encodedPolyline ||
      `${scored.description ?? "route"}:${scored.distance}:${scored.duration}`,
    label: meta.label,
    category: meta.category,
    tone: deriveTone(scored, fastestDuration, meta.isTopPick),
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

/* ─────────────────────── Balanced picker ─────────────────────── */

function pickBalanced(
  all: ScoredRoute[],
  safest: ScoredRoute,
  fastest: ScoredRoute,
): ScoredRoute | null {
  const remaining = all.filter((r) => r !== safest && r !== fastest);
  if (remaining.length === 0) return null;

  const ranked = remaining
    .map((r) => ({
      route: r,
      simSafe: pathSimilarity(r.path, safest.path),
      simFast: pathSimilarity(r.path, fastest.path),
    }))
    .sort(
      (a, b) => a.simSafe + a.simFast - (b.simSafe + b.simFast),
    );

  const best = ranked[0];
  if (!best) return null;

  if (
    best.simSafe > SAFEST_VS_FASTEST_SIMILARITY &&
    best.simFast > SAFEST_VS_FASTEST_SIMILARITY
  ) {
    return null;
  }
  return best.route;
}

/* ─────────────────────── Explanation copy ─────────────────────── */

function buildSingleExplanation(only: ScoredRoute): string {
  if (only.highRiskFraction >= 0.25) {
    return "Only available route — passes through some elevated-risk areas.";
  }
  return "Only available route to this destination.";
}

function buildBestExplanation(
  safest: ScoredRoute,
  trueFastest: ScoredRoute,
): string {
  const sameRoute = safest === trueFastest;
  if (sameRoute) {
    if (safest.highRiskFraction <= 0.05) {
      return "Quickest path AND lowest risk — best choice.";
    }
    if (safest.highRiskFraction <= 0.15) {
      return "Quickest path with the lowest overall risk.";
    }
    return "Quickest path with the lowest risk among the options.";
  }
  // safest is within 60s of fastest — basically the same time.
  const secondsSlower = Math.round(safest.duration - trueFastest.duration);
  return `Lowest-risk path — only ~${secondsSlower}s slower than the absolute quickest.`;
}

function buildAlternativeExplanation(
  alt: ScoredRoute,
  best: ScoredRoute,
): string {
  const minDelta = Math.round((alt.duration - best.duration) / 60);
  const riskDelta = alt.avgRisk - best.avgRisk;

  if (alt.duration < best.duration) {
    // Faster but worse on risk
    const minSaved = Math.round((best.duration - alt.duration) / 60);
    if (riskDelta > 0.5) {
      return `Saves ${minSaved} min — but passes through higher-risk areas.`;
    }
    return `Saves ${minSaved} min — comparable safety to the recommended route.`;
  }

  if (riskDelta < -0.3) {
    return minDelta > 0
      ? `Even safer than the recommended (+${minDelta} min) — different streets.`
      : "Even safer than the recommended — different streets.";
  }

  if (alt.highRiskFraction >= 0.2) {
    return minDelta > 0
      ? `Different route (+${minDelta} min) — some elevated-risk segments.`
      : "Different route — some elevated-risk segments.";
  }

  return minDelta > 0
    ? `Different streets (+${minDelta} min) — comparable safety.`
    : "Different streets — comparable safety.";
}

function buildSafestExplanation(
  safest: ScoredRoute,
  fastest: ScoredRoute,
  minutesAdded: number,
): string {
  const riskDelta = fastest.avgRisk - safest.avgRisk;
  const tail = minutesAdded > 0 ? ` (+${minutesAdded} min vs Fastest)` : "";

  if (riskDelta >= 1.5) {
    return `Lowest-exposure path with a clear safety edge over Fastest${tail}.`;
  }
  if (safest.highRiskFraction <= 0.05) {
    return `Avoids higher-risk areas${tail}.`;
  }
  return `Stays clear of the worst spots${tail}.`;
}

function buildFastestExplanation(
  fastest: ScoredRoute,
  safest: ScoredRoute,
  minutesSaved: number,
): string {
  const tail = minutesSaved > 0 ? ` saves ~${minutesSaved} min` : "";
  if (fastest.highRiskFraction >= 0.25 || fastest.incidentImpacts > 0) {
    return minutesSaved > 0
      ? `Quickest path — ${tail.trim()} but passes through elevated-risk areas.`
      : "Quickest path — passes through elevated-risk areas.";
  }
  if (fastest.highRiskFraction >= 0.1) {
    return minutesSaved > 0
      ? `Quickest path — ${tail.trim()}, minor exposure on the way.`
      : "Quickest path — minor exposure on the way.";
  }
  return minutesSaved > 0
    ? `Quickest path with no flagged areas (${tail.trim()}).`
    : "Quickest path with no flagged areas.";
}

function buildBalancedExplanation(
  balanced: ScoredRoute,
  safest: ScoredRoute,
  fastest: ScoredRoute,
): string {
  const overFastest = Math.max(
    0,
    Math.round((balanced.duration - fastest.duration) / 60),
  );
  const overFastestTail = overFastest > 0 ? ` (+${overFastest} min vs Fastest)` : "";

  if (balanced.highRiskFraction <= 0.1) {
    return `Compromise — avoids the worst spots${overFastestTail}.`;
  }
  if (balanced.avgRisk < (safest.avgRisk + fastest.avgRisk) / 2) {
    return `Middle ground${overFastestTail} — closer to Safest in exposure.`;
  }
  return `Middle ground${overFastestTail} — minor exposure on the way.`;
}

/* ─────────────────────── formatting ─────────────────────── */

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
