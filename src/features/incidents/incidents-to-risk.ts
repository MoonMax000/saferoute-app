import type { RiskIncident } from "@/features/risk";
import type { Incident } from "./incidents.types";
import { INCIDENT_TYPES } from "./incidents-config";

/**
 * Convert UI-level `Incident[]` into the lightweight `RiskIncident[]` shape
 * the risk-model + route-exposure scorer expects.
 */
export function toRiskIncidents(incidents: Incident[]): RiskIncident[] {
  return incidents.map((incident) => {
    const cfg = INCIDENT_TYPES[incident.type];
    return {
      id: incident.id,
      center: incident.center,
      radius: incident.radius,
      severity: cfg.severity,
      kind: cfg.kind,
    };
  });
}
