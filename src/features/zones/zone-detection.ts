import type { LatLng } from "@/shared/types";
import { haversineDistance } from "@/shared/geo";
import type { RiskZone } from "./zones.types";

export function isPointInZone(point: LatLng, zone: RiskZone): boolean {
  if (
    zone.polygon &&
    typeof google !== "undefined" &&
    google.maps?.geometry?.poly
  ) {
    const latLng = new google.maps.LatLng(point.lat, point.lng);
    const polygon = zone.polygon.map(
      (p) => new google.maps.LatLng(p.lat, p.lng)
    );
    const gmPolygon = new google.maps.Polygon({ paths: polygon });
    return google.maps.geometry.poly.containsLocation(latLng, gmPolygon);
  }
  return haversineDistance(point, zone.center) <= zone.radius;
}

export function calculatePointRisk(
  point: LatLng,
  zones: RiskZone[]
): number {
  let maxRisk = 1;
  for (const zone of zones) {
    if (isPointInZone(point, zone)) {
      maxRisk = Math.max(maxRisk, zone.riskLevel);
    } else {
      const distance = haversineDistance(point, zone.center);
      if (distance <= zone.radius * 2) {
        const factor = 1 - (distance - zone.radius) / zone.radius;
        if (factor > 0) {
          const reducedRisk = Math.max(1, Math.round(zone.riskLevel * factor));
          maxRisk = Math.max(maxRisk, reducedRisk);
        }
      }
    }
  }
  return maxRisk;
}
