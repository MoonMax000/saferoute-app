/**
 * Categorical colour + label helpers for the legacy `RiskZone` shape.
 * Used by the route summary, alerts list, and event log to render per-zone
 * badges. The visual `effectiveRisk*` helpers used by the live map overlay
 * live in `features/risk/risk-styles.ts`.
 */

export function getRiskColor(riskScore: number): string {
  if (riskScore <= 2) return "#22c55e";
  if (riskScore <= 4) return "#84cc16";
  if (riskScore <= 5) return "#eab308";
  if (riskScore <= 6) return "#f97316";
  if (riskScore <= 8) return "#ef4444";
  return "#dc2626";
}

export function getRiskLabel(riskScore: number): string {
  if (riskScore <= 2) return "Very Safe";
  if (riskScore <= 4) return "Safe";
  if (riskScore <= 5) return "Moderate";
  if (riskScore <= 6) return "Elevated";
  if (riskScore <= 8) return "High Risk";
  return "Very High Risk";
}
