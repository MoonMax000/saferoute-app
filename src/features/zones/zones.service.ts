import type { LatLng } from "@/shared/types";
import type { RiskZone } from "./zones.types";

function generateNeighborhoodPolygon(
  center: LatLng,
  radius: number,
  seed: number
): LatLng[] {
  const points: LatLng[] = [];
  const numPoints = 8 + (seed % 4);
  const metersToLat = 1 / 111320;
  const metersToLng = 1 / (111320 * Math.cos((center.lat * Math.PI) / 180));

  for (let i = 0; i < numPoints; i++) {
    const angle = (2 * Math.PI * i) / numPoints;
    const variation = 0.7 + 0.6 * Math.abs(Math.sin(angle * seed + i));
    const r = radius * variation;
    points.push({
      lat: center.lat + r * Math.cos(angle) * metersToLat,
      lng: center.lng + r * Math.sin(angle) * metersToLng,
    });
  }
  return points;
}

const DEFAULT_ZONES: RiskZone[] = [
  { id: "zone-1", center: { lat: 40.758, lng: -73.9855 }, radius: 500, riskLevel: 8, label: "Times Square Area" },
  { id: "zone-2", center: { lat: 40.7484, lng: -73.9857 }, radius: 400, riskLevel: 6, label: "Herald Square" },
  { id: "zone-3", center: { lat: 40.7527, lng: -73.9772 }, radius: 350, riskLevel: 7, label: "Grand Central" },
  { id: "zone-4", center: { lat: 40.7614, lng: -73.9776 }, radius: 600, riskLevel: 9, label: "Midtown East" },
  { id: "zone-5", center: { lat: 40.7282, lng: -73.7949 }, radius: 800, riskLevel: 5, label: "Jamaica, Queens" },
  { id: "zone-6", center: { lat: 40.6892, lng: -73.9857 }, radius: 500, riskLevel: 4, label: "Downtown Brooklyn" },
  { id: "zone-7", center: { lat: 40.8075, lng: -73.9465 }, radius: 700, riskLevel: 7, label: "East Harlem" },
  { id: "zone-8", center: { lat: 40.6501, lng: -73.9496 }, radius: 500, riskLevel: 6, label: "Flatbush" },
  { id: "zone-9", center: { lat: 40.7831, lng: -73.9712 }, radius: 300, riskLevel: 3, label: "Upper West Side" },
  { id: "zone-10", center: { lat: 40.7736, lng: -73.9566 }, radius: 350, riskLevel: 2, label: "Upper East Side" },
  { id: "zone-11", center: { lat: 40.7359, lng: -73.9911 }, radius: 400, riskLevel: 4, label: "Greenwich Village" },
  { id: "zone-12", center: { lat: 40.7128, lng: -74.006 }, radius: 500, riskLevel: 3, label: "Financial District" },
].map((zone, i) => ({
  ...zone,
  polygon: generateNeighborhoodPolygon(zone.center, zone.radius, i + 3),
}));

let zones: RiskZone[] = DEFAULT_ZONES;

export function getZones(): RiskZone[] {
  return zones;
}

export async function loadZonesFromGeoJSON(url: string): Promise<RiskZone[]> {
  const res = await fetch(url);
  const geojson = await res.json();

  zones = geojson.features.map(
    (feature: { properties: { id: string; label: string; riskLevel: number; radius: number }; geometry: { coordinates: [number, number] } }, i: number) => {
      const { id, label, riskLevel, radius } = feature.properties;
      const [lng, lat] = feature.geometry.coordinates;
      const center = { lat, lng };
      return {
        id,
        label,
        riskLevel,
        radius,
        center,
        polygon: generateNeighborhoodPolygon(center, radius, i + 3),
      };
    }
  );

  return zones;
}
