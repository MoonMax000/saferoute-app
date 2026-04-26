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

const LOS_ANGELES_SEEDS: RiskCellSeed[] = [
  // ── Westside (calm) ───────────────────────────────────────────────────
  {
    id: "la-beverly-hills",
    label: "Beverly Hills",
    center: { lat: 34.0736, lng: -118.4004 },
    radius: 1500,
    baseDayRisk: 1,
    nightMultiplier: 1.1,
    tags: ["residential"],
  },
  {
    id: "la-pacific-palisades",
    label: "Pacific Palisades",
    center: { lat: 34.0464, lng: -118.5263 },
    radius: 1500,
    baseDayRisk: 1,
    nightMultiplier: 1.1,
    tags: ["residential"],
  },
  {
    id: "la-westwood-ucla",
    label: "Westwood / UCLA",
    center: { lat: 34.0689, lng: -118.4452 },
    radius: 1100,
    baseDayRisk: 2,
    nightMultiplier: 1.2,
    tags: ["residential"],
  },
  {
    id: "la-santa-monica-pier",
    label: "Santa Monica Pier",
    center: { lat: 34.0083, lng: -118.4988 },
    radius: 1000,
    baseDayRisk: 3,
    nightMultiplier: 1.4,
    tags: ["tourist"],
  },
  {
    id: "la-venice-beach",
    label: "Venice Beach",
    center: { lat: 33.985, lng: -118.4695 },
    radius: 1300,
    baseDayRisk: 3,
    nightMultiplier: 1.5,
    tags: ["tourist", "nightlife"],
  },

  // ── Hollywood / nightlife belt ────────────────────────────────────────
  {
    id: "la-west-hollywood",
    label: "West Hollywood",
    center: { lat: 34.09, lng: -118.3617 },
    radius: 1300,
    baseDayRisk: 3,
    nightMultiplier: 1.5,
    tags: ["nightlife", "commercial"],
  },
  {
    id: "la-hollywood-walk-of-fame",
    label: "Hollywood Walk of Fame",
    center: { lat: 34.1015, lng: -118.3267 },
    radius: 1100,
    baseDayRisk: 4,
    nightMultiplier: 1.6,
    tags: ["tourist", "nightlife"],
  },
  {
    id: "la-hollywood-hills",
    label: "Hollywood Hills",
    center: { lat: 34.1267, lng: -118.345 },
    radius: 1700,
    baseDayRisk: 1,
    nightMultiplier: 1.1,
    tags: ["residential"],
  },
  {
    id: "la-echo-park",
    label: "Echo Park / Silver Lake",
    center: { lat: 34.078, lng: -118.2606 },
    radius: 1500,
    baseDayRisk: 3,
    nightMultiplier: 1.4,
    tags: ["residential", "nightlife"],
  },

  // ── Mid / Central LA ──────────────────────────────────────────────────
  {
    id: "la-mid-wilshire",
    label: "Mid-Wilshire",
    center: { lat: 34.0617, lng: -118.35 },
    radius: 1500,
    baseDayRisk: 2,
    nightMultiplier: 1.2,
    tags: ["commercial", "residential"],
  },
  {
    id: "la-koreatown",
    label: "Koreatown",
    center: { lat: 34.0577, lng: -118.3008 },
    radius: 1500,
    baseDayRisk: 4,
    nightMultiplier: 1.4,
    tags: ["commercial", "residential", "nightlife"],
  },
  {
    id: "la-downtown-financial",
    label: "Downtown Financial District",
    center: { lat: 34.05, lng: -118.258 },
    radius: 1300,
    baseDayRisk: 3,
    nightMultiplier: 1.4,
    tags: ["commercial", "corridor"],
  },
  {
    id: "la-skid-row",
    label: "Skid Row",
    center: { lat: 34.044, lng: -118.2434 },
    radius: 700,
    baseDayRisk: 8,
    nightMultiplier: 1.5,
    tags: ["isolated", "industrial"],
  },
  {
    id: "la-arts-district",
    label: "Arts District",
    center: { lat: 34.0407, lng: -118.2349 },
    radius: 700,
    baseDayRisk: 4,
    nightMultiplier: 1.4,
    tags: ["commercial", "industrial"],
  },
  {
    id: "la-boyle-heights",
    label: "Boyle Heights / East LA",
    center: { lat: 34.0344, lng: -118.2104 },
    radius: 1700,
    baseDayRisk: 5,
    nightMultiplier: 1.4,
    tags: ["residential", "corridor"],
  },

  // ── South LA ──────────────────────────────────────────────────────────
  {
    id: "la-south-la",
    label: "South LA",
    center: { lat: 33.987, lng: -118.292 },
    radius: 2000,
    baseDayRisk: 6,
    nightMultiplier: 1.5,
    tags: ["residential", "corridor"],
  },
  {
    id: "la-watts",
    label: "Watts",
    center: { lat: 33.9408, lng: -118.2419 },
    radius: 1400,
    baseDayRisk: 7,
    nightMultiplier: 1.5,
    tags: ["residential", "isolated"],
  },
  {
    id: "la-compton",
    label: "Compton",
    center: { lat: 33.8958, lng: -118.22 },
    radius: 2200,
    baseDayRisk: 6,
    nightMultiplier: 1.5,
    tags: ["residential", "corridor"],
  },
  {
    id: "la-inglewood",
    label: "Inglewood",
    center: { lat: 33.9617, lng: -118.3531 },
    radius: 1900,
    baseDayRisk: 5,
    nightMultiplier: 1.4,
    tags: ["residential", "commercial"],
  },
  {
    id: "la-lax-corridor",
    label: "LAX Airport Corridor",
    center: { lat: 33.9416, lng: -118.4085 },
    radius: 2000,
    baseDayRisk: 4,
    nightMultiplier: 1.3,
    tags: ["corridor", "isolated"],
  },

  // ── Northeast / Pasadena ──────────────────────────────────────────────
  {
    id: "la-pasadena",
    label: "Pasadena Old Town",
    center: { lat: 34.1466, lng: -118.15 },
    radius: 1300,
    baseDayRisk: 1,
    nightMultiplier: 1.2,
    tags: ["residential", "tourist"],
  },
];

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
  "los-angeles": LOS_ANGELES_SEEDS,
  "nha-trang": NHA_TRANG_SEEDS,
  nyc: NYC_SEEDS,
};

let cellCache: { city: DemoCitySlug; cells: RiskCell[] } | null = null;

export function getCityRiskCells(city: DemoCitySlug): RiskCell[] {
  if (cellCache && cellCache.city === city) return cellCache.cells;
  const seeds = CITY_SEEDS[city] ?? CITY_SEEDS["los-angeles"];
  const cells: RiskCell[] = seeds.map((seed, i) => ({
    ...seed,
    polygon: generateCellPolygon(seed.center, seed.radius, i + 3),
  }));
  cellCache = { city, cells };
  return cells;
}
