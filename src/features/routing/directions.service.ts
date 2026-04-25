import type { LatLng } from "@/shared/types";
import type { RawRoute } from "@/lib/google/routes-api";

export interface SearchRouteInput {
  origin: { text: string; coords: LatLng | null };
  destination: { text: string; coords: LatLng | null };
}

interface ApiResponse {
  routes?: RawRoute[];
  error?: string;
}

/**
 * Client-side helper that asks the server-side `/api/routes` handler for
 * alternative routes from the Google Routes API. The Routes API key is
 * never exposed to the browser.
 */
export async function searchRoutes(
  input: SearchRouteInput,
): Promise<RawRoute[]> {
  const body = {
    origin: input.origin.coords ?? input.origin.text,
    destination: input.destination.coords ?? input.destination.text,
  };
  const res = await fetch("/api/routes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data: ApiResponse = {};
  try {
    data = (await res.json()) as ApiResponse;
  } catch {
    /* ignore parse errors and fall through */
  }
  if (!res.ok) {
    throw new Error(
      data.error ?? `Route lookup failed (${res.status})`,
    );
  }
  return data.routes ?? [];
}
