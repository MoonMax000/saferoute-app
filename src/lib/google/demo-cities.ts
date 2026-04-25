import type { DemoCitySlug } from "@/lib/env";
import type { LatLng } from "@/shared/types";

export interface DemoCityConfig {
  slug: DemoCitySlug;
  label: string;
  center: LatLng;
  /**
   * Approximate radius (in metres) used to bias autocomplete and constrain
   * the simulated risk grid to a single city.
   */
  radiusMeters: number;
  zoom: number;
  /** ISO 3166-1 alpha-2 country code, used for autocomplete region bias. */
  countryCode: string;
  /** Seeded demo origin / destination so the investor demo always works. */
  seed: {
    originLabel: string;
    originCoords: LatLng;
    destinationLabel: string;
    destinationCoords: LatLng;
  };
}

export const DEMO_CITIES: Record<DemoCitySlug, DemoCityConfig> = {
  "nha-trang": {
    slug: "nha-trang",
    label: "Nha Trang",
    center: { lat: 12.2388, lng: 109.1967 },
    radiusMeters: 9000,
    zoom: 13,
    countryCode: "VN",
    seed: {
      // Hotel area on Tran Phu → Po Nagar Towers up north. The fastest path
      // skirts the Ngoc Hiep industrial edge while a safer route hugs the
      // tourist promenade — gives the demo a clear Safest vs Fastest split.
      originLabel: "Sheraton Nha Trang, Tran Phu Boulevard",
      originCoords: { lat: 12.2462, lng: 109.1953 },
      destinationLabel: "Po Nagar Cham Towers, 2 Thang 4",
      destinationCoords: { lat: 12.2654, lng: 109.1957 },
    },
  },
  nyc: {
    slug: "nyc",
    label: "New York City",
    center: { lat: 40.7484, lng: -73.9857 },
    radiusMeters: 12000,
    zoom: 13,
    countryCode: "US",
    seed: {
      originLabel: "Times Square, Manhattan, NY 10036",
      originCoords: { lat: 40.758, lng: -73.9855 },
      destinationLabel: "Brooklyn Bridge, New York, NY 10038",
      destinationCoords: { lat: 40.7061, lng: -73.9969 },
    },
  },
};

export function getDemoCity(slug: DemoCitySlug): DemoCityConfig {
  return DEMO_CITIES[slug] ?? DEMO_CITIES["nha-trang"];
}
