"use client";

import { create } from "zustand";
import type { LatLng } from "@/shared/types";
import type { PaintZone } from "./inspector.types";

interface PaintModeState {
  active: boolean;
  pendingCenter: LatLng | null;
  pendingRadius: number; // metres
  pendingRisk: number; // 1-10
}

interface InspectorState {
  enabled: boolean;
  paintMode: PaintModeState;
  paintZones: PaintZone[];
  panelLayout: {
    debug: boolean;
    tune: boolean;
    log: boolean;
  };

  setEnabled: (v: boolean) => void;
  toggle: () => void;
  togglePanel: (panel: "debug" | "tune" | "log") => void;

  startPaintMode: () => void;
  stopPaintMode: () => void;
  setPaintCenter: (c: LatLng | null) => void;
  setPaintRadius: (r: number) => void;
  setPaintRisk: (r: number) => void;
  commitPaintZone: () => void;
  removePaintZone: (id: string) => void;
  clearPaintZones: () => void;
}

/**
 * Build a circular polygon (16 vertices) around `center` with the given
 * radius in metres. Same equirectangular trick used in `city-risk-data.ts`
 * for built-in cells.
 */
function generatePaintPolygon(
  center: LatLng,
  radiusM: number,
  steps = 16,
): LatLng[] {
  const pts: LatLng[] = [];
  const earthR = 6378137;
  const cosLat = Math.cos((Math.PI * center.lat) / 180);
  for (let i = 0; i < steps; i++) {
    const a = (2 * Math.PI * i) / steps;
    const dLat = (radiusM * Math.cos(a)) / earthR;
    const dLng = (radiusM * Math.sin(a)) / (earthR * cosLat);
    pts.push({
      lat: center.lat + (dLat * 180) / Math.PI,
      lng: center.lng + (dLng * 180) / Math.PI,
    });
  }
  return pts;
}

function newPaintId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `paint-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `paint-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export const useInspectorStore = create<InspectorState>((set, get) => ({
  enabled: false,
  paintMode: {
    active: false,
    pendingCenter: null,
    pendingRadius: 250,
    pendingRisk: 7,
  },
  paintZones: [],
  panelLayout: { debug: true, tune: false, log: true },

  setEnabled: (v) => set({ enabled: v }),
  toggle: () => set((s) => ({ enabled: !s.enabled })),
  togglePanel: (panel) =>
    set((s) => ({
      panelLayout: { ...s.panelLayout, [panel]: !s.panelLayout[panel] },
    })),

  startPaintMode: () =>
    set((s) => ({
      paintMode: { ...s.paintMode, active: true, pendingCenter: null },
    })),
  stopPaintMode: () =>
    set((s) => ({
      paintMode: { ...s.paintMode, active: false, pendingCenter: null },
    })),
  setPaintCenter: (c) =>
    set((s) => ({ paintMode: { ...s.paintMode, pendingCenter: c } })),
  setPaintRadius: (r) =>
    set((s) => ({ paintMode: { ...s.paintMode, pendingRadius: r } })),
  setPaintRisk: (r) =>
    set((s) => ({ paintMode: { ...s.paintMode, pendingRisk: r } })),

  commitPaintZone: () => {
    const { pendingCenter, pendingRadius, pendingRisk } = get().paintMode;
    if (!pendingCenter) return;
    const id = newPaintId();
    const zone: PaintZone = {
      id,
      label: `Custom Zone (${pendingRisk}/10)`,
      center: pendingCenter,
      radius: pendingRadius,
      baseDayRisk: pendingRisk,
      nightMultiplier: 1.3,
      tags: [],
      polygon: generatePaintPolygon(pendingCenter, pendingRadius),
      source: "paint",
      createdAt: Date.now(),
    };
    set((s) => ({
      paintZones: [...s.paintZones, zone],
      paintMode: {
        ...s.paintMode,
        active: false,
        pendingCenter: null,
      },
    }));
  },
  removePaintZone: (id) =>
    set((s) => ({ paintZones: s.paintZones.filter((z) => z.id !== id) })),
  clearPaintZones: () => set({ paintZones: [] }),
}));
