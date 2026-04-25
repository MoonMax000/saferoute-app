import type { LatLng } from "@/shared/types";

export type TimeContext = "day" | "night";

export type RiskTag =
  | "tourist"
  | "nightlife"
  | "commercial"
  | "residential"
  | "corridor"
  | "isolated"
  | "industrial";

/**
 * One simulated city-risk cell. The cell uses a centre + radius descriptor
 * for authoring convenience; an organic-looking polygon is generated from it
 * at load time so the map overlay does not look like a perfect grid.
 *
 * `baseDayRisk` and `nightMultiplier` are *internal* numeric controls. The UI
 * never exposes the raw numbers — see `risk-model.ts` for how they are
 * converted into one of four human-readable states.
 */
export interface RiskCellSeed {
  id: string;
  label: string;
  center: LatLng;
  radius: number;
  /** 1..10 daytime risk, internal only. */
  baseDayRisk: number;
  /** Multiplier applied to baseDayRisk at night. 1.0 = no change, 1.8 = much riskier. */
  nightMultiplier: number;
  tags: RiskTag[];
}

export interface RiskCell extends RiskCellSeed {
  polygon: LatLng[];
}

export type DestinationRiskState =
  | "normal"
  | "caution"
  | "elevated"
  | "elevated-night";

export interface DestinationRisk {
  state: DestinationRiskState;
  primaryReason: string;
  secondaryReason?: string;
  affectedCellLabels: string[];
}

/** Lightweight incident shape consumed by the risk model and route scorer. */
export interface RiskIncident {
  id: string;
  center: LatLng;
  radius: number;
  /** 1..3 severity. Internal only — never exposed to the UI. */
  severity: number;
  /**
   * `blocking` incidents (road closures, accidents) penalise routes that
   * cross them much more strongly than `advisory` incidents (police
   * activity, recent robberies).
   */
  kind: "advisory" | "blocking";
}
