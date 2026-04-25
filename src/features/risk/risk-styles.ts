/**
 * Visual styling for the risk overlay. Inputs are *internal* effective-risk
 * numbers; outputs are colours only — the UI never renders the raw number.
 */

export function effectiveRiskFill(risk: number): string {
  if (risk <= 2.5) return "rgba(34, 197, 94, 0.18)";
  if (risk <= 4) return "rgba(132, 204, 22, 0.22)";
  if (risk <= 5.5) return "rgba(234, 179, 8, 0.26)";
  if (risk <= 7) return "rgba(249, 115, 22, 0.3)";
  if (risk <= 8.5) return "rgba(239, 68, 68, 0.32)";
  return "rgba(220, 38, 38, 0.35)";
}

export function effectiveRiskStroke(risk: number): string {
  if (risk <= 2.5) return "rgba(34, 197, 94, 0.6)";
  if (risk <= 4) return "rgba(132, 204, 22, 0.65)";
  if (risk <= 5.5) return "rgba(234, 179, 8, 0.75)";
  if (risk <= 7) return "rgba(249, 115, 22, 0.8)";
  if (risk <= 8.5) return "rgba(239, 68, 68, 0.85)";
  return "rgba(220, 38, 38, 0.9)";
}

/**
 * The four user-facing risk categories (used by the legend, not by the
 * destination warning which speaks in full sentences).
 */
export const RISK_CATEGORIES = [
  { label: "Looks normal", colour: "rgba(34, 197, 94, 0.55)" },
  { label: "Use caution", colour: "rgba(234, 179, 8, 0.7)" },
  { label: "Higher-risk", colour: "rgba(249, 115, 22, 0.8)" },
  { label: "High at night", colour: "rgba(220, 38, 38, 0.85)" },
] as const;
