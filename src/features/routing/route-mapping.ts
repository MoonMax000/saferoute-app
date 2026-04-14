import type { LatLng } from "@/shared/types";
import { haversineDistance } from "@/shared/geo";
import { getZones, isPointInZone, calculatePointRisk, getRiskColor, getRiskLabel } from "@/features/zones";
import type { RouteSegment, RouteResult, RouteAlert } from "./route.types";

const SEGMENT_LENGTH = 10;

export function buildRiskSegments(path: LatLng[]): RouteSegment[] {
  if (path.length < 2) return [];

  const zones = getZones();
  const segments: RouteSegment[] = [];

  for (let i = 0; i < path.length - 1; i += SEGMENT_LENGTH) {
    const end = Math.min(i + SEGMENT_LENGTH, path.length);
    const segmentPath = path.slice(i, end);

    const step = segmentPath.length < 6 ? 1 : 3;
    let maxRisk = 1;
    for (let j = 0; j < segmentPath.length; j += step) {
      const risk = calculatePointRisk(segmentPath[j], zones);
      maxRisk = Math.max(maxRisk, risk);
    }

    segments.push({
      path: segmentPath,
      riskScore: maxRisk,
      color: getRiskColor(maxRisk),
    });
  }

  return segments;
}

export function processDirectionsRoute(
  route: google.maps.DirectionsRoute
): RouteResult {
  const path: LatLng[] = [];

  for (const leg of route.legs) {
    for (const step of leg.steps) {
      for (const point of step.path) {
        const p = { lat: point.lat(), lng: point.lng() };
        const last = path[path.length - 1];
        if (last && last.lat === p.lat && last.lng === p.lng) continue;
        path.push(p);
      }
    }
  }

  const segments = buildRiskSegments(path);

  let totalDistanceMeters = 0;
  let totalDurationSeconds = 0;
  for (const leg of route.legs) {
    totalDistanceMeters += leg.distance?.value ?? 0;
    totalDurationSeconds += leg.duration?.value ?? 0;
  }

  const avgRisk =
    segments.length > 0
      ? segments.reduce((sum, s) => sum + s.riskScore, 0) / segments.length
      : 1;
  const averageRisk = Math.round(avgRisk * 10) / 10;

  return {
    segments,
    totalDistance: formatDistance(totalDistanceMeters),
    totalDuration: formatDuration(totalDurationSeconds),
    averageRisk,
    overallRiskLabel: getRiskLabel(Math.round(averageRisk)),
    polylinePath: path,
  };
}

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

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1609.34).toFixed(1)} mi`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
