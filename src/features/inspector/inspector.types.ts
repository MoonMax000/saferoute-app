import type { LatLng } from "@/shared/types";
import type { RiskCell } from "@/features/risk";

/**
 * A user-painted custom risk zone. Shape-compatible with `RiskCell` so it
 * can be merged into the array consumed by the risk model and route scorer.
 */
export interface PaintZone extends RiskCell {
  source: "paint";
  createdAt: number;
}

export type InspectorLogLevel = "info" | "calc" | "event" | "warn";

export interface InspectorLogEntry {
  id: number;
  ts: number; // epoch ms
  level: InspectorLogLevel;
  msg: string;
  data?: Record<string, unknown>;
}

/**
 * Per-cell row inside the formula breakdown popup. `effectiveRisk` is the
 * final per-cell value after radius falloff and the night multiplier.
 */
export interface FormulaBreakdownCell {
  id: string;
  label: string;
  distanceM: number;
  baseDayRisk: number;
  nightMultiplier: number;
  effectiveRisk: number;
  contains: boolean; // true if the point sits inside this cell's polygon
}

/**
 * Full risk breakdown for a single map point. Used by the click-anywhere
 * popup to demystify how a final risk score is computed.
 */
export interface FormulaBreakdown {
  point: LatLng;
  time: "day" | "night";
  topCells: FormulaBreakdownCell[];
  interpolatedBase: number;
  nightAppliedRisk: number;
  incidentBoost: number;
  finalRisk: number;
  verdict: "normal" | "caution" | "elevated" | "elevated-night";
}

/**
 * Phases of the self-running verification scenario. Drives a small state
 * machine in `VerificationRunner` plus the summary modal at completion.
 */
export type VerificationPhase =
  | "idle"
  | "starting"
  | "driving"
  | "incident-placed"
  | "reroute-switched"
  | "night-toggled"
  | "completing"
  | "done";

export interface VerificationSummary {
  startedAt: number;
  endedAt: number;
  recalcs: number;
  alertsFired: number;
  toastsFired: number;
  beforeAvgRisk: number | null;
  afterAvgRisk: number | null;
  rerouteSwitched: boolean;
}
