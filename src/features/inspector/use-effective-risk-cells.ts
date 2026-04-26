"use client";

import { useMemo } from "react";
import type { RiskCell } from "@/features/risk";
import { getCityRiskCells } from "@/features/risk";
import { clientEnv } from "@/lib/env";
import { useInspectorStore } from "./inspector-store";
import { useRiskConfigStore } from "./risk-config-store";

/**
 * Returns the merged RiskCell array consumed by route scoring and
 * destination evaluation: built-in city cells (with any tunable overrides
 * applied) followed by user-painted custom zones.
 *
 * The returned array identity is memo-stable until a slider or paint
 * action actually changes — important so that the route re-rank effect in
 * `page.tsx` doesn't re-fire on every render.
 */
export function useEffectiveRiskCells(): RiskCell[] {
  const overrides = useRiskConfigStore((s) => s.overrides);
  const globalMult = useRiskConfigStore((s) => s.globalNightMultiplier);
  const paintZones = useInspectorStore((s) => s.paintZones);

  return useMemo(() => {
    const base = getCityRiskCells(clientEnv.NEXT_PUBLIC_DEMO_CITY);
    const merged: RiskCell[] = base.map((c) => {
      const ov = overrides[c.id];
      return {
        ...c,
        baseDayRisk: ov?.baseDayRisk ?? c.baseDayRisk,
        nightMultiplier: globalMult ?? c.nightMultiplier,
      };
    });
    return [...merged, ...paintZones];
  }, [overrides, globalMult, paintZones]);
}
