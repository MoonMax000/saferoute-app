import * as turf from "@turf/turf";
import type { LatLng } from "@/shared/types";
import { haversineDistance } from "@/shared/geo";

/**
 * Distance (in metres) from a point to the closest point on a polyline.
 * Used to decide whether a GPS fix is still on the selected route.
 *
 * Returns `Infinity` if the polyline is degenerate (< 2 points).
 */
export function distanceToPolyline(
  point: LatLng,
  polyline: LatLng[],
): number {
  if (polyline.length < 2) return Infinity;
  const line = turf.lineString(polyline.map((p) => [p.lng, p.lat]));
  return turf.pointToLineDistance(turf.point([point.lng, point.lat]), line, {
    units: "meters",
  });
}

/**
 * Quick "are we basically there?" check using the route's last vertex.
 */
export function distanceToFinalVertex(
  point: LatLng,
  polyline: LatLng[],
): number {
  if (polyline.length === 0) return Infinity;
  return haversineDistance(point, polyline[polyline.length - 1]);
}
