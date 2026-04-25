import "server-only";
import { getServerEnv } from "@/lib/env";

const ROUTES_ENDPOINT =
  "https://routes.googleapis.com/directions/v2:computeRoutes";

/**
 * Field mask for the Routes API response. Listing only what we use keeps
 * the request inside the Pro SKU instead of escalating to Enterprise.
 *
 * https://developers.google.com/maps/documentation/routes/choose_fields
 */
const FIELD_MASK = [
  "routes.duration",
  "routes.distanceMeters",
  "routes.polyline.encodedPolyline",
  "routes.description",
  "routes.routeLabels",
  "routes.warnings",
].join(",");

export type RoutesEndpoint = { lat: number; lng: number } | string;

export interface RoutesApiInput {
  origin: RoutesEndpoint;
  destination: RoutesEndpoint;
  /** "DRIVE" by default; left exposed for future modes. */
  travelMode?: "DRIVE" | "WALK" | "BICYCLE" | "TWO_WHEELER";
  languageCode?: string;
  region?: string;
}

export interface RawRoute {
  /** Total duration in seconds. */
  duration: number;
  /** Total distance in metres. */
  distance: number;
  /** Encoded overview polyline string. */
  encodedPolyline: string;
  /** Free-form description from Google ("via Hwy 1"). */
  description?: string;
  /** Routes API labels (DEFAULT_ROUTE / DEFAULT_ROUTE_ALTERNATE / FUEL_EFFICIENT). */
  labels: string[];
  /** Provider warnings, if any. */
  warnings: string[];
}

function buildEndpoint(input: RoutesEndpoint) {
  if (typeof input === "string") return { address: input };
  return { location: { latLng: { latitude: input.lat, longitude: input.lng } } };
}

function parseDurationSeconds(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (typeof raw !== "string") return 0;
  const match = /^(\d+(?:\.\d+)?)s$/.exec(raw);
  return match ? Number(match[1]) : 0;
}

interface RawApiResponse {
  routes?: Array<{
    duration?: string;
    distanceMeters?: number;
    polyline?: { encodedPolyline?: string };
    description?: string;
    routeLabels?: string[];
    warnings?: string[];
  }>;
  error?: { message?: string };
}

export async function computeRoutes(
  input: RoutesApiInput,
): Promise<RawRoute[]> {
  const { GOOGLE_ROUTES_API_KEY } = getServerEnv();

  const body = {
    origin: buildEndpoint(input.origin),
    destination: buildEndpoint(input.destination),
    travelMode: input.travelMode ?? "DRIVE",
    routingPreference: "TRAFFIC_AWARE",
    computeAlternativeRoutes: true,
    polylineQuality: "OVERVIEW",
    polylineEncoding: "ENCODED_POLYLINE",
    languageCode: input.languageCode ?? "en-US",
    units: "METRIC",
    ...(input.region ? { regionCode: input.region } : {}),
  };

  const res = await fetch(ROUTES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_ROUTES_API_KEY,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Routes API ${res.status}: ${text.slice(0, 240)}`);
  }

  const data = (await res.json()) as RawApiResponse;
  if (data.error?.message) throw new Error(data.error.message);
  if (!data.routes || data.routes.length === 0) return [];

  return data.routes.map((r): RawRoute => ({
    duration: parseDurationSeconds(r.duration),
    distance: r.distanceMeters ?? 0,
    encodedPolyline: r.polyline?.encodedPolyline ?? "",
    description: r.description,
    labels: r.routeLabels ?? [],
    warnings: r.warnings ?? [],
  }));
}
