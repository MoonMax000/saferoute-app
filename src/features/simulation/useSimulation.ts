"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { LatLng } from "@/shared/types";
import { haversineDistance, calculateBearing } from "@/shared/geo";
import { getZones, isPointInZone, getRiskLabel } from "@/features/zones";
import type { RouteOption } from "@/features/routing";
import type { ToastData } from "./SimulationToast";
import type { EventLogEntry } from "@/features/safety/event-log.types";

const EXIT_BUFFER_METERS = 15;
const ALERT_COOLDOWN_MS = 5000;

function timeStr(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

interface UseSimulationOptions {
  routes: RouteOption[];
}

export function useSimulation({ routes }: UseSimulationOptions) {
  const [simulating, setSimulating] = useState(false);
  const [simPoint, setSimPoint] = useState<LatLng | null>(null);
  const [simHeading, setSimHeading] = useState(0);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);

  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const simZonesEnteredRef = useRef<Set<string>>(new Set());
  const simZoneCooldownRef = useRef<Record<string, number>>({});

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
    simZonesEnteredRef.current.clear();
    simZoneCooldownRef.current = {};
  }, []);

  const start = useCallback(() => {
    const selected = routes.find((r) => r.selected);
    if (!selected || selected.route.polylinePath.length < 2) return;

    stop();
    setSimulating(true);
    simZonesEnteredRef.current.clear();
    simZoneCooldownRef.current = {};

    const path = selected.route.polylinePath;
    let idx = 0;

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

      const nextIdx = Math.min(idx + 3, path.length - 1);
      if (nextIdx > idx) {
        setSimHeading(calculateBearing(path[idx], path[nextIdx]));
      }

      const now = Date.now();
      const zones = getZones();

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
          if (zone.riskLevel >= 7) {
            addToast(
              "Entering High Risk Zone",
              "danger",
              `${zone.label} - ${label}`
            );
          } else if (zone.riskLevel >= 5) {
            addToast(
              "Entering Risk Zone",
              "warning",
              `${zone.label} - ${label}`
            );
          }
        } else if (!isInside && wasInside && canAlert) {
          simZonesEnteredRef.current.delete(zone.id);
          simZoneCooldownRef.current[zone.id] = now;
          addLogEntry("exit", zone.label, zone.riskLevel, {
            lat: point.lat,
            lng: point.lng,
          });
          if (zone.riskLevel >= 5) {
            addToast(
              "Left Risk Zone",
              "safe",
              `${zone.label} - Now in safer area`
            );
          }
        }
      }

      idx += 3;
    }, 100);
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
    toasts,
    eventLog,
    start,
    stop,
    dismissToast,
    clearLog,
  };
}
