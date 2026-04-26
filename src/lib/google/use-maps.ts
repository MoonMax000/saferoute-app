"use client";

import { useJsApiLoader } from "@react-google-maps/api";
import { clientEnv } from "@/lib/env";
import { MAPS_LIBRARIES, MAPS_LOADER_ID, MAPS_VERSION } from "./maps-config";

/**
 * Centralised Maps JS loader. All consumers must use this hook so the
 * loader is invoked once with a consistent options object.
 *
 * `mapIds` is critical for `AdvancedMarkerElement` — without preloading
 * the map's vector style id, AME silently fails to attach to the DOM
 * (constructor succeeds, but no marker ever renders). Without this we'd
 * see polylines but no draggable A/B endpoint markers.
 */
export function useMapsApi() {
  const mapId = clientEnv.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;
  return useJsApiLoader({
    id: MAPS_LOADER_ID,
    googleMapsApiKey: clientEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
    libraries: MAPS_LIBRARIES,
    version: MAPS_VERSION,
    mapIds: mapId ? [mapId] : undefined,
  });
}
