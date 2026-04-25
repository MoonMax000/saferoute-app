import type { LatLng } from "@/shared/types";
import { haversineDistance } from "@/shared/geo";
import { getZones, isPointInZone, getRiskLabel } from "@/features/zones";
import type { RouteAlert } from "./route.types";

/**
 * Walk along a route's polyline and surface the named areas it crosses or
 * passes near. Used by the alerts panel — the categorical labels come from
 * `getRiskLabel`, no raw numbers are returned to the UI.
 */
export function getRouteAlerts(path: LatLng[]): RouteAlert[] {
  const zones = getZones();
  const alerts: RouteAlert[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < path.length; i += 5) {
    const point = path[i];
    for (const zone of zones) {
      if (seen.has(zone.id)) continue;

      if (isPointInZone(point, zone)) {
        seen.add(zone.id);
        alerts.push({
          zoneId: zone.id,
          zoneLabel: zone.label,
          riskLevel: zone.riskLevel,
          riskLabel: getRiskLabel(zone.riskLevel),
          type: "crosses",
        });
      } else {
        const dist = haversineDistance(point, zone.center);
        if (dist <= zone.radius * 1.5) {
          seen.add(zone.id);
          alerts.push({
            zoneId: zone.id,
            zoneLabel: zone.label,
            riskLevel: zone.riskLevel,
            riskLabel: getRiskLabel(zone.riskLevel),
            type: "near",
          });
        }
      }
    }
  }

  alerts.sort((a, b) => b.riskLevel - a.riskLevel);
  return alerts;
}
