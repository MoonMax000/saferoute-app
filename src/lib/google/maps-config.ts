/**
 * Single source of truth for the Google Maps JS bootstrap.
 *
 * Both the map shell and the place-autocomplete input must call the loader
 * with the *same* `libraries` array and `version` to avoid the duplicate-
 * loader warning emitted by `@react-google-maps/api`.
 */

export const MAPS_LIBRARIES: ("places" | "geometry" | "marker")[] = [
  "places",
  "geometry",
  "marker",
];

export const MAPS_VERSION = "weekly" as const;

export const MAPS_LOADER_ID = "navshield-maps-loader" as const;
