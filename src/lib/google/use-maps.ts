"use client";

import { useJsApiLoader } from "@react-google-maps/api";
import { clientEnv } from "@/lib/env";
import { MAPS_LIBRARIES, MAPS_LOADER_ID, MAPS_VERSION } from "./maps-config";

/**
 * Centralised Maps JS loader. All consumers must use this hook so the
 * loader is invoked once with a consistent options object.
 */
export function useMapsApi() {
  return useJsApiLoader({
    id: MAPS_LOADER_ID,
    googleMapsApiKey: clientEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
    libraries: MAPS_LIBRARIES,
    version: MAPS_VERSION,
  });
}
