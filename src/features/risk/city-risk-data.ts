import type { LatLng } from "@/shared/types";
import type { DemoCitySlug } from "@/lib/env";
import type { RiskCell, RiskCellSeed } from "./risk.types";

/**
 * Generate an organic neighbourhood-shaped polygon from a centre + radius.
 * Stable per-seed so the same cell always renders the same shape.
 */
function generateCellPolygon(
  center: LatLng,
  radius: number,
  seed: number,
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

const NHA_TRANG_SEEDS: RiskCellSeed[] = [
  {
    id: "nt-promenade",
    label: "Tran Phu Beach Promenade",
    center: { lat: 12.241, lng: 109.197 },
    radius: 700,
    baseDayRisk: 2,
    nightMultiplier: 1.4,
    tags: ["tourist", "nightlife"],
  },
  {
    id: "nt-backpacker",
    label: "Hung Vuong Tourist Strip",
    center: { lat: 12.2435, lng: 109.1925 },
    radius: 450,
    baseDayRisk: 4,
    nightMultiplier: 1.6,
    tags: ["nightlife", "tourist"],
  },
  {
    id: "nt-cho-dam",
    label: "Cho Dam Central Market",
    center: { lat: 12.2492, lng: 109.1881 },
    radius: 500,
    baseDayRisk: 5,
    nightMultiplier: 1.3,
    tags: ["commercial", "corridor"],
  },
  {
    id: "nt-vinh-hai",
    label: "Vinh Hai Residential",
    center: { lat: 12.275, lng: 109.198 },
    radius: 800,
    baseDayRisk: 4,
    nightMultiplier: 1.3,
    tags: ["residential", "corridor"],
  },
  {
    id: "nt-ngoc-hiep",
    label: "Ngoc Hiep Industrial Edge",
    center: { lat: 12.2685, lng: 109.183 },
    radius: 700,
    baseDayRisk: 5,
    nightMultiplier: 1.6,
    tags: ["industrial", "isolated"],
  },
  {
    id: "nt-phuoc-hai",
    label: "Phuoc Hai Residential South",
    center: { lat: 12.222, lng: 109.193 },
    radius: 750,
    baseDayRisk: 3,
    nightMultiplier: 1.2,
    tags: ["residential"],
  },
  {
    id: "nt-cau-da",
    label: "Cau Da Fishing Harbour",
    center: { lat: 12.197, lng: 109.221 },
    radius: 700,
    baseDayRisk: 4,
    nightMultiplier: 1.5,
    tags: ["industrial", "isolated"],
  },
  {
    id: "nt-airport-rd",
    label: "Airport Road Corridor",
    center: { lat: 12.21, lng: 109.205 },
    radius: 950,
    baseDayRisk: 4,
    nightMultiplier: 1.4,
    tags: ["corridor", "isolated"],
  },
  {
    id: "nt-vinpearl",
    label: "Hon Tre Vinpearl Approach",
    center: { lat: 12.215, lng: 109.245 },
    radius: 900,
    baseDayRisk: 2,
    nightMultiplier: 1.2,
    tags: ["tourist"],
  },
  {
    id: "nt-po-nagar",
    label: "Po Nagar Towers",
    center: { lat: 12.265, lng: 109.196 },
    radius: 400,
    baseDayRisk: 3,
    nightMultiplier: 1.3,
    tags: ["tourist", "residential"],
  },
  {
    id: "nt-long-son",
    label: "Long Son Pagoda Area",
    center: { lat: 12.252, lng: 109.176 },
    radius: 500,
    baseDayRisk: 3,
    nightMultiplier: 1.2,
    tags: ["tourist", "residential"],
  },
  {
    id: "nt-railway",
    label: "Railway Station Quarter",
    center: { lat: 12.2475, lng: 109.18 },
    radius: 450,
    baseDayRisk: 5,
    nightMultiplier: 1.5,
    tags: ["corridor", "isolated"],
  },
];

const NYC_SEEDS: RiskCellSeed[] = [
  {
    id: "nyc-times-square",
    label: "Times Square Area",
    center: { lat: 40.758, lng: -73.9855 },
    radius: 500,
    baseDayRisk: 4,
    nightMultiplier: 1.5,
    tags: ["tourist", "nightlife"],
  },
  {
    id: "nyc-herald-square",
    label: "Herald Square",
    center: { lat: 40.7484, lng: -73.9857 },
    radius: 400,
    baseDayRisk: 4,
    nightMultiplier: 1.3,
    tags: ["commercial", "corridor"],
  },
  {
    id: "nyc-grand-central",
    label: "Grand Central",
    center: { lat: 40.7527, lng: -73.9772 },
    radius: 350,
    baseDayRisk: 4,
    nightMultiplier: 1.4,
    tags: ["commercial", "corridor"],
  },
  {
    id: "nyc-midtown-east",
    label: "Midtown East",
    center: { lat: 40.7614, lng: -73.9776 },
    radius: 600,
    baseDayRisk: 5,
    nightMultiplier: 1.4,
    tags: ["commercial"],
  },
  {
    id: "nyc-east-harlem",
    label: "East Harlem",
    center: { lat: 40.8075, lng: -73.9465 },
    radius: 700,
    baseDayRisk: 5,
    nightMultiplier: 1.6,
    tags: ["residential", "corridor"],
  },
  {
    id: "nyc-flatbush",
    label: "Flatbush",
    center: { lat: 40.6501, lng: -73.9496 },
    radius: 500,
    baseDayRisk: 4,
    nightMultiplier: 1.5,
    tags: ["residential"],
  },
  {
    id: "nyc-uws",
    label: "Upper West Side",
    center: { lat: 40.7831, lng: -73.9712 },
    radius: 300,
    baseDayRisk: 2,
    nightMultiplier: 1.1,
    tags: ["residential"],
  },
  {
    id: "nyc-ues",
    label: "Upper East Side",
    center: { lat: 40.7736, lng: -73.9566 },
    radius: 350,
    baseDayRisk: 2,
    nightMultiplier: 1.1,
    tags: ["residential"],
  },
  {
    id: "nyc-village",
    label: "Greenwich Village",
    center: { lat: 40.7359, lng: -73.9911 },
    radius: 400,
    baseDayRisk: 3,
    nightMultiplier: 1.4,
    tags: ["nightlife", "tourist"],
  },
  {
    id: "nyc-fidi",
    label: "Financial District",
    center: { lat: 40.7128, lng: -74.006 },
    radius: 500,
    baseDayRisk: 2,
    nightMultiplier: 1.3,
    tags: ["commercial"],
  },
  {
    id: "nyc-jamaica",
    label: "Jamaica, Queens",
    center: { lat: 40.7282, lng: -73.7949 },
    radius: 800,
    baseDayRisk: 5,
    nightMultiplier: 1.5,
    tags: ["corridor", "residential"],
  },
  {
    id: "nyc-dt-brooklyn",
    label: "Downtown Brooklyn",
    center: { lat: 40.6892, lng: -73.9857 },
    radius: 500,
    baseDayRisk: 3,
    nightMultiplier: 1.3,
    tags: ["commercial", "corridor"],
  },
];

const CITY_SEEDS: Record<DemoCitySlug, RiskCellSeed[]> = {
  "nha-trang": NHA_TRANG_SEEDS,
  nyc: NYC_SEEDS,
};

let cellCache: { city: DemoCitySlug; cells: RiskCell[] } | null = null;

export function getCityRiskCells(city: DemoCitySlug): RiskCell[] {
  if (cellCache && cellCache.city === city) return cellCache.cells;
  const seeds = CITY_SEEDS[city] ?? CITY_SEEDS["nha-trang"];
  const cells: RiskCell[] = seeds.map((seed, i) => ({
    ...seed,
    polygon: generateCellPolygon(seed.center, seed.radius, i + 3),
  }));
  cellCache = { city, cells };
  return cells;
}
