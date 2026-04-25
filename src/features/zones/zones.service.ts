import type { RiskZone } from "./zones.types";
import { getCityRiskCells } from "@/features/risk";
import type { RiskCell } from "@/features/risk";
import { clientEnv } from "@/lib/env";

/**
 * Compatibility shim. The old `RiskZone` shape is still used by
 * `route-mapping` (segment scoring) and `simulation` (zone enter/exit).
 * Stage 4 will retire this in favour of the cell + risk-model API directly.
 *
 * Until then we expose the current city's risk cells under the legacy zone
 * type so the existing prototype features keep working without a rewrite.
 */
function cellToZone(cell: RiskCell): RiskZone {
  return {
    id: cell.id,
    label: cell.label,
    riskLevel: Math.round(cell.baseDayRisk),
    radius: cell.radius,
    center: cell.center,
    polygon: cell.polygon,
  };
}

export function getZones(): RiskZone[] {
  return getCityRiskCells(clientEnv.NEXT_PUBLIC_DEMO_CITY).map(cellToZone);
}
