"use client";

import { create } from "zustand";

/**
 * Default values match the constants the production scoring code used
 * before tunables existed. Resetting any slider always returns here.
 */
export const DEFAULT_ELEVATED_THRESHOLD = 5.5;
export const DEFAULT_BLOCKING_WEIGHT = 5.0;
export const DEFAULT_ADVISORY_WEIGHT = 2.5;

interface CellOverride {
  baseDayRisk?: number;
}

interface RiskConfigState {
  /** Per-cell risk overrides keyed by `RiskCell.id`. */
  overrides: Record<string, CellOverride>;
  /** If non-null, replaces every cell's nightMultiplier. */
  globalNightMultiplier: number | null;
  /** Threshold at which a route sample counts as "elevated" risk. */
  elevatedThreshold: number;
  /** Multiplier applied to severity for blocking incidents (closures). */
  blockingIncidentWeight: number;
  /** Multiplier applied to severity for advisory incidents (police, robbery). */
  advisoryIncidentWeight: number;

  setCellBaseRisk: (cellId: string, base: number) => void;
  clearCellOverride: (cellId: string) => void;
  setGlobalNightMultiplier: (m: number | null) => void;
  setElevatedThreshold: (t: number) => void;
  setBlockingWeight: (w: number) => void;
  setAdvisoryWeight: (w: number) => void;
  resetAll: () => void;
}

export const useRiskConfigStore = create<RiskConfigState>((set) => ({
  overrides: {},
  globalNightMultiplier: null,
  elevatedThreshold: DEFAULT_ELEVATED_THRESHOLD,
  blockingIncidentWeight: DEFAULT_BLOCKING_WEIGHT,
  advisoryIncidentWeight: DEFAULT_ADVISORY_WEIGHT,

  setCellBaseRisk: (cellId, base) =>
    set((s) => ({
      overrides: {
        ...s.overrides,
        [cellId]: { ...s.overrides[cellId], baseDayRisk: base },
      },
    })),
  clearCellOverride: (cellId) =>
    set((s) => {
      const rest = { ...s.overrides };
      delete rest[cellId];
      return { overrides: rest };
    }),
  setGlobalNightMultiplier: (m) => set({ globalNightMultiplier: m }),
  setElevatedThreshold: (t) => set({ elevatedThreshold: t }),
  setBlockingWeight: (w) => set({ blockingIncidentWeight: w }),
  setAdvisoryWeight: (w) => set({ advisoryIncidentWeight: w }),
  resetAll: () =>
    set({
      overrides: {},
      globalNightMultiplier: null,
      elevatedThreshold: DEFAULT_ELEVATED_THRESHOLD,
      blockingIncidentWeight: DEFAULT_BLOCKING_WEIGHT,
      advisoryIncidentWeight: DEFAULT_ADVISORY_WEIGHT,
    }),
}));
