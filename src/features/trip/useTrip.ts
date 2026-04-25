"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LatLng } from "@/shared/types";
import type { RouteOption } from "@/features/routing";
import { distanceToFinalVertex, distanceToPolyline } from "./geo-deviation";
import type { TripState, TripStatus } from "./trip.types";

interface UseTripOptions {
  selectedRoute: RouteOption | null;
  /** Distance (m) above which a fix counts as off-route. */
  thresholdMeters?: number;
  /** Time the fix has to stay off-route before we surface a deviation alert. */
  sustainedMs?: number;
  /** Distance (m) at which we declare "arrived". */
  arrivalRadiusM?: number;
}

const DEFAULTS = {
  thresholdMeters: 60,
  sustainedMs: 5000,
  arrivalRadiusM: 30,
};

const INITIAL: TripStatus = {
  state: "idle",
  position: null,
  distanceFromRouteM: null,
};

/**
 * Real browser-based passenger safety mode.
 *
 * Owns its own `watchPosition` — only active while the user has hit
 * "Start trip", so we don't burn the GPS chip when the demo is just sitting
 * on screen. Permission/unavailable errors are surfaced as discrete states
 * the UI can render without crashing.
 */
export function useTrip(opts: UseTripOptions) {
  const {
    selectedRoute,
    thresholdMeters = DEFAULTS.thresholdMeters,
    sustainedMs = DEFAULTS.sustainedMs,
    arrivalRadiusM = DEFAULTS.arrivalRadiusM,
  } = opts;

  const [status, setStatus] = useState<TripStatus>(INITIAL);
  const watchIdRef = useRef<number | null>(null);
  const offRouteSinceRef = useRef<number | null>(null);
  const polylineRef = useRef<LatLng[]>([]);

  // Keep the latest polyline available to the watcher callback without
  // re-subscribing every time the route reference changes.
  useEffect(() => {
    polylineRef.current = selectedRoute?.route.polylinePath ?? [];
  }, [selectedRoute]);

  const stopTrip = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation?.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    offRouteSinceRef.current = null;
    setStatus(INITIAL);
  }, []);

  const handleFix = useCallback(
    (fix: LatLng) => {
      const polyline = polylineRef.current;
      if (polyline.length < 2) {
        setStatus({
          state: "awaiting-fix",
          position: fix,
          distanceFromRouteM: null,
        });
        return;
      }

      // Arrival check first — once we're at the destination we stop.
      if (
        distanceToFinalVertex(fix, polyline) <= arrivalRadiusM
      ) {
        setStatus({
          state: "arrived",
          position: fix,
          distanceFromRouteM: 0,
        });
        if (watchIdRef.current !== null) {
          navigator.geolocation?.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
        offRouteSinceRef.current = null;
        return;
      }

      const dist = distanceToPolyline(fix, polyline);

      if (dist <= thresholdMeters) {
        offRouteSinceRef.current = null;
        setStatus({
          state: "on-route",
          position: fix,
          distanceFromRouteM: dist,
        });
        return;
      }

      // Off-route: open or extend the sustained-deviation timer.
      const now = Date.now();
      if (offRouteSinceRef.current === null) {
        offRouteSinceRef.current = now;
      }
      const elapsed = now - offRouteSinceRef.current;
      const nextState: TripState =
        elapsed >= sustainedMs ? "deviated" : "evaluating-deviation";
      setStatus({
        state: nextState,
        position: fix,
        distanceFromRouteM: dist,
      });
    },
    [arrivalRadiusM, sustainedMs, thresholdMeters],
  );

  const startTrip = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setStatus({
        state: "unavailable",
        position: null,
        distanceFromRouteM: null,
        errorMessage: "Geolocation is not available in this browser.",
      });
      return;
    }
    if (!selectedRoute || selectedRoute.route.polylinePath.length < 2) {
      setStatus({
        state: "unavailable",
        position: null,
        distanceFromRouteM: null,
        errorMessage: "Select a route before starting a trip.",
      });
      return;
    }

    if (watchIdRef.current !== null) return; // already running
    polylineRef.current = selectedRoute.route.polylinePath;
    offRouteSinceRef.current = null;
    setStatus({
      state: "awaiting-fix",
      position: null,
      distanceFromRouteM: null,
    });

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) =>
        handleFix({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        const denied =
          err.code === GeolocationPositionError.PERMISSION_DENIED;
        setStatus({
          state: denied ? "permission-denied" : "unavailable",
          position: null,
          distanceFromRouteM: null,
          errorMessage: denied
            ? "Location permission was denied. Re-enable it in your browser settings to use trip tracking."
            : err.message ||
              "Could not get a GPS fix. Move outdoors or try again.",
        });
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 },
    );
  }, [handleFix, selectedRoute]);

  // If the user picks a different route mid-trip, clear the deviation timer
  // so we don't carry over state from the old route.
  useEffect(() => {
    if (status.state === "idle" || status.state === "arrived") return;
    offRouteSinceRef.current = null;
  }, [selectedRoute?.id, status.state]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation?.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  return {
    status,
    startTrip,
    stopTrip,
    isActive:
      status.state !== "idle" &&
      status.state !== "permission-denied" &&
      status.state !== "unavailable",
  };
}
