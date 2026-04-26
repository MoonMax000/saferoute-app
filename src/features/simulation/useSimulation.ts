"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { LatLng } from "@/shared/types";
import { haversineDistance, calculateBearing } from "@/shared/geo";
import { getZones, isPointInZone, getRiskLabel, calculatePointRisk } from "@/features/zones";
import type { RouteOption } from "@/features/routing";
import type { Incident } from "@/features/incidents";
import { INCIDENT_TYPES } from "@/features/incidents";
import type { ToastData } from "./SimulationToast";
import type { EventLogEntry } from "@/features/safety/event-log.types";

const EXIT_BUFFER_METERS = 15;
const ALERT_COOLDOWN_MS = 5000;
/**
 * Demo drive timing controls.
 *
 * The car visits every polyline vertex (no skipping) so it traces the
 * route precisely without cutting corners. Total duration is clamped
 * between `MIN_DEMO_DURATION_MS` (so short routes still take ~30s and
 * investors can watch the car move) and `MAX_DEMO_DURATION_MS` (so
 * very long freeway routes don't stretch out forever).
 */
const MIN_DEMO_DURATION_MS = 30000;
const MAX_DEMO_DURATION_MS = 60000;

function timeStr(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

interface UseSimulationOptions {
  routes: RouteOption[];
  incidents?: Incident[];
}

/** Distance (m) ahead of the simulated car at which an approach toast fires. */
const INCIDENT_APPROACH_BUFFER_M = 250;

export function useSimulation({
  routes,
  incidents = [],
}: UseSimulationOptions) {
  const [simulating, setSimulating] = useState(false);
  const [simPoint, setSimPoint] = useState<LatLng | null>(null);
  const [simHeading, setSimHeading] = useState(0);
  const [simSpeedKmh, setSimSpeedKmh] = useState(0);
  const [simProgress, setSimProgress] = useState(0); // 0..1 along route
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);

  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const simZonesEnteredRef = useRef<Set<string>>(new Set());
  const simZoneCooldownRef = useRef<Record<string, number>>({});
  const simIncidentsApproachedRef = useRef<Set<string>>(new Set());
  const incidentsRef = useRef<Incident[]>(incidents);

  // Keep latest incidents accessible from inside the interval callback
  // without re-binding the effect each tick.
  useEffect(() => {
    incidentsRef.current = incidents;
  }, [incidents]);

  const addToast = useCallback(
    (message: string, type: ToastData["type"], zoneLabel: string) => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev.slice(-3), { id, message, type, zoneLabel }]);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addLogEntry = useCallback(
    (
      type: EventLogEntry["type"],
      zone: string,
      riskLevel: number,
      coords?: { lat: number; lng: number }
    ) => {
      setEventLog((prev) => [
        ...prev.slice(-99),
        {
          id: `${Date.now()}-${Math.random()}`,
          timestamp: timeStr(),
          type,
          zone,
          riskLevel,
          coords,
        },
      ]);
    },
    []
  );

  const clearLog = useCallback(() => setEventLog([]), []);

  const stop = useCallback(() => {
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    setSimulating(false);
    setSimPoint(null);
    setSimSpeedKmh(0);
    setSimProgress(0);
    simZonesEnteredRef.current.clear();
    simZoneCooldownRef.current = {};
    simIncidentsApproachedRef.current.clear();
  }, []);

  const start = useCallback(() => {
    const selected = routes.find((r) => r.selected);
    if (!selected || selected.route.polylinePath.length < 2) return;

    stop();
    setSimulating(true);
    simZonesEnteredRef.current.clear();
    simZoneCooldownRef.current = {};
    simIncidentsApproachedRef.current.clear();

    const path = selected.route.polylinePath;
    let idx = 0;

    // Visit every polyline vertex (step = 1) so the car never cuts a
    // corner. Tick interval is sized so total playtime sits between 30
    // and 60 seconds regardless of how dense the polyline is.
    const totalTicks = Math.max(1, path.length);
    const targetDurationMs = Math.max(
      MIN_DEMO_DURATION_MS,
      Math.min(MAX_DEMO_DURATION_MS, totalTicks * 100),
    );
    const tickMs = Math.max(20, Math.ceil(targetDurationMs / totalTicks));

    addToast("Navigation started", "safe", "Simulation mode active");
    addLogEntry("info", "Simulation started", 0);

    simIntervalRef.current = setInterval(() => {
      if (idx >= path.length) {
        addLogEntry("info", "Arrived at destination", 0);
        addToast("Arrived at destination", "safe", "Navigation complete");
        stop();
        return;
      }

      const point = path[idx];
      setSimPoint(point);

      const nextIdx = Math.min(idx + 1, path.length - 1);
      if (nextIdx > idx) {
        setSimHeading(calculateBearing(path[idx], path[nextIdx]));
      }

      // Speed estimate — slow down through higher-risk segments so the
      // demo "feels" like a careful driver. 60 km/h calm → ~25 km/h hot
      // zone. Internal numeric only — UI shows km/h but never the raw
      // risk value.
      const zones = getZones();
      const localRisk = calculatePointRisk(point, zones);
      const baseSpeed = 60 - localRisk * 3.5;
      const jitter = Math.sin(idx * 0.3) * 4;
      const speed = Math.max(15, Math.min(70, baseSpeed + jitter));
      setSimSpeedKmh(Math.round(speed));
      setSimProgress(idx / path.length);

      const now = Date.now();

      for (const zone of zones) {
        const inZone = isPointInZone(point, zone);
        const wasInside = simZonesEnteredRef.current.has(zone.id);
        const dist = haversineDistance(point, zone.center);
        const isInside =
          inZone ||
          (wasInside && dist < zone.radius + EXIT_BUFFER_METERS);

        const lastAlert = simZoneCooldownRef.current[zone.id] ?? 0;
        const canAlert = now - lastAlert > ALERT_COOLDOWN_MS;

        if (isInside && !wasInside && canAlert) {
          simZonesEnteredRef.current.add(zone.id);
          simZoneCooldownRef.current[zone.id] = now;
          const label = getRiskLabel(zone.riskLevel);
          addLogEntry("enter", zone.label, zone.riskLevel, {
            lat: point.lat,
            lng: point.lng,
          });
          // Always notify on zone entry — investors should see the live
          // overlay reacting. Tone scales with risk level.
          if (zone.riskLevel >= 7) {
            addToast(
              "Entering high-risk area",
              "danger",
              `${zone.label} • ${label}`,
            );
          } else if (zone.riskLevel >= 5) {
            addToast(
              "Entering elevated-risk area",
              "warning",
              `${zone.label} • ${label}`,
            );
          } else {
            addToast(
              "Entering safe area",
              "safe",
              `${zone.label} • ${label}`,
            );
          }
        } else if (!isInside && wasInside && canAlert) {
          simZonesEnteredRef.current.delete(zone.id);
          simZoneCooldownRef.current[zone.id] = now;
          addLogEntry("exit", zone.label, zone.riskLevel, {
            lat: point.lat,
            lng: point.lng,
          });
          // Always notify on zone exit too.
          if (zone.riskLevel >= 7) {
            addToast(
              "Cleared high-risk area",
              "safe",
              `Left ${zone.label} — back to safer ground`,
            );
          } else if (zone.riskLevel >= 5) {
            addToast(
              "Cleared elevated-risk area",
              "safe",
              `Left ${zone.label}`,
            );
          } else {
            addToast(
              "Leaving safe area",
              "safe",
              `Left ${zone.label}`,
            );
          }
        }
      }

      // ── Incident proximity ─────────────────────────────────────────
      // Fire one toast per incident the moment the simulated car gets
      // within `incident.radius + INCIDENT_APPROACH_BUFFER_M`. Each
      // incident alerts at most once per drive (cleared on stop/start).
      for (const inc of incidentsRef.current) {
        if (simIncidentsApproachedRef.current.has(inc.id)) continue;
        const distM = haversineDistance(point, inc.center);
        if (distM > inc.radius + INCIDENT_APPROACH_BUFFER_M) continue;
        simIncidentsApproachedRef.current.add(inc.id);
        const cfg = INCIDENT_TYPES[inc.type];
        const tone: ToastData["type"] =
          cfg.kind === "blocking" || inc.type === "robbery"
            ? "danger"
            : "warning";
        const headline =
          inc.type === "robbery"
            ? "Robbery report ahead"
            : inc.type === "police"
              ? "Police activity ahead"
              : "Road blockage ahead";
        const distanceLabel = `${Math.max(0, Math.round(distM))} m`;
        addToast(headline, tone, `${cfg.label} • ${distanceLabel}`);
        // Map incident severity (1..3 internal) onto the event log's
        // 1..10 scale so the row tag reads CAUTION / ELEVATED / HIGH
        // rather than always CALM.
        const eventLogLevel =
          inc.type === "robbery" ? 7 : inc.type === "police" ? 5 : 8;
        addLogEntry(
          "enter",
          `INCIDENT: ${cfg.shortLabel}`,
          eventLogLevel,
          { lat: inc.center.lat, lng: inc.center.lng },
        );
      }

      idx += 1;
    }, tickMs);
  }, [routes, stop, addToast, addLogEntry]);

  useEffect(() => {
    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, []);

  return {
    simulating,
    simPoint,
    simHeading,
    simSpeedKmh,
    simProgress,
    toasts,
    eventLog,
    start,
    stop,
    dismissToast,
    clearLog,
  };
}
