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

export function getZoneFillColor(riskLevel: number): string {
  if (riskLevel <= 2) return "rgba(34, 197, 94, 0.25)";
  if (riskLevel <= 4) return "rgba(132, 204, 22, 0.25)";
  if (riskLevel <= 5) return "rgba(234, 179, 8, 0.3)";
  if (riskLevel <= 6) return "rgba(249, 115, 22, 0.3)";
  if (riskLevel <= 8) return "rgba(239, 68, 68, 0.3)";
  return "rgba(220, 38, 38, 0.35)";
}

export function getZoneStrokeColor(riskLevel: number): string {
  if (riskLevel <= 2) return "rgba(34, 197, 94, 0.7)";
  if (riskLevel <= 4) return "rgba(132, 204, 22, 0.7)";
  if (riskLevel <= 5) return "rgba(234, 179, 8, 0.8)";
  if (riskLevel <= 6) return "rgba(249, 115, 22, 0.8)";
  if (riskLevel <= 8) return "rgba(239, 68, 68, 0.8)";
  return "rgba(220, 38, 38, 0.9)";
}
