"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LatLng } from "@/shared/types";

const DEBOUNCE_MS = 200;

export interface PlaceSuggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
}

export interface FetchedPlace {
  placeId: string;
  formattedAddress: string;
  displayName?: string;
  location: LatLng | null;
}

interface UsePlaceSuggestionsOptions {
  /** Centre of the autocomplete bias circle. */
  locationBias?: LatLng;
  /** Radius for the bias circle in metres (defaults to 5km). */
  biasRadius?: number;
  /** ISO 3166-1 alpha-2 country code, e.g. "VN", "US". */
  countryCode?: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function readFormattableText(
  value: { text?: string } | string | undefined | null,
): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.text ?? "";
}

/**
 * Hook on top of the modern `AutocompleteSuggestion` API. Replaces the legacy
 * `places.Autocomplete` widget and gives us full control over the dropdown UI.
 *
 * - Debounces input (200 ms)
 * - Manages an autocomplete session token, rotating it after each
 *   confirmed selection, so Google bills suggestions + place details as one
 *   billable session instead of one per keystroke.
 * - Discards stale results when the query changes mid-flight.
 */
export function usePlaceSuggestions(opts: UsePlaceSuggestionsOptions = {}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  const sessionTokenRef =
    useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const requestSeqRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { locationBias, biasRadius, countryCode } = opts;
  const biasLat = locationBias?.lat;
  const biasLng = locationBias?.lng;

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setSuggestions([]);
      setIsFetching(false);
      return;
    }
    const seq = ++requestSeqRef.current;
    setIsFetching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const places = (await google.maps.importLibrary(
          "places",
        )) as google.maps.PlacesLibrary;
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new places.AutocompleteSessionToken();
        }
        const request: any = {
          input: query,
          sessionToken: sessionTokenRef.current,
        };
        if (biasLat !== undefined && biasLng !== undefined) {
          request.locationBias = {
            center: { lat: biasLat, lng: biasLng },
            radius: biasRadius ?? 5000,
          };
        }
        if (countryCode) {
          request.includedRegionCodes = [countryCode.toUpperCase()];
        }
        const { suggestions: raw } =
          await places.AutocompleteSuggestion.fetchAutocompleteSuggestions(
            request,
          );
        if (seq !== requestSeqRef.current) return;
        const mapped: PlaceSuggestion[] = raw
          .filter((s: any) => s.placePrediction)
          .map((s: any) => ({
            placeId: s.placePrediction.placeId,
            mainText: readFormattableText(
              s.placePrediction.mainText ?? s.placePrediction.text,
            ),
            secondaryText: readFormattableText(s.placePrediction.secondaryText),
          }));
        setSuggestions(mapped);
      } catch (err) {
        if (seq === requestSeqRef.current) {
          console.warn("[place-suggestions]", err);
          setSuggestions([]);
        }
      } finally {
        if (seq === requestSeqRef.current) {
          setIsFetching(false);
        }
      }
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, biasLat, biasLng, biasRadius, countryCode]);

  const fetchPlaceDetails = useCallback(
    async (placeId: string): Promise<FetchedPlace | null> => {
      try {
        const places = (await google.maps.importLibrary(
          "places",
        )) as google.maps.PlacesLibrary;
        const place = new places.Place({ id: placeId });
        await place.fetchFields({
          fields: ["displayName", "formattedAddress", "location"],
        });
        const loc = place.location as google.maps.LatLng | null | undefined;
        const result: FetchedPlace = {
          placeId,
          formattedAddress: place.formattedAddress ?? "",
          displayName: place.displayName ?? undefined,
          location: loc ? { lat: loc.lat(), lng: loc.lng() } : null,
        };
        sessionTokenRef.current = null;
        return result;
      } catch (err) {
        console.warn("[place-details]", err);
        return null;
      }
    },
    [],
  );

  return {
    query,
    setQuery,
    suggestions,
    isFetching,
    fetchPlaceDetails,
  };
}
