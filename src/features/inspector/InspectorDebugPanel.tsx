"use client";

import { useMemo } from "react";
import { ChevronDown, ChevronUp, Copy, Microscope } from "lucide-react";
import type { LatLng } from "@/shared/types";
import type { RiskCell } from "@/features/risk";
import { evaluatePointRisk } from "@/features/risk";
import type { RouteOption } from "@/features/routing";
import type { DestinationRisk } from "@/features/risk";
import type { Incident } from "@/features/incidents";
import { useInspectorStore } from "./inspector-store";
import { useRiskConfigStore } from "./risk-config-store";
import { fmtNum } from "./inspector-log";
import { RouteWhyList } from "./RouteWhyTooltip";

interface InspectorDebugPanelProps {
  routes: RouteOption[];
  destinationRisk: DestinationRisk | null;
  incidents: Incident[];
  effectiveCells: RiskCell[];
  nightMode: boolean;
  simulating: boolean;
  simPoint: LatLng | null;
  simSpeedKmh: number;
  simProgress: number;
}

/**
 * Floating panel that surfaces every internal number the risk engine
 * touches. The whole point is for Russ (or anyone reviewing) to watch
 * these tick in real time as he interacts with the demo.
 *
 * Hidden when inspector mode is OFF. Collapsible to a single row.
 */
export function InspectorDebugPanel({
  routes,
  destinationRisk,
  incidents,
  effectiveCells,
  nightMode,
  simulating,
  simPoint,
  simSpeedKmh,
  simProgress,
}: InspectorDebugPanelProps) {
  const enabled = useInspectorStore((s) => s.enabled);
  const open = useInspectorStore((s) => s.panelLayout.debug);
  const togglePanel = useInspectorStore((s) => s.togglePanel);
  const globalNightMult = useRiskConfigStore((s) => s.globalNightMultiplier);
  const elevatedThreshold = useRiskConfigStore((s) => s.elevatedThreshold);
  const blockingWeight = useRiskConfigStore((s) => s.blockingIncidentWeight);
  const advisoryWeight = useRiskConfigStore((s) => s.advisoryIncidentWeight);

  const time: "day" | "night" = nightMode ? "night" : "day";
  const selected = routes.find((r) => r.selected);
  const others = routes.filter((r) => !r.selected);

  const avgNightMult = useMemo(() => {
    if (globalNightMult !== null) return globalNightMult;
    if (effectiveCells.length === 0) return 1;
    const sum = effectiveCells.reduce((acc, c) => acc + c.nightMultiplier, 0);
    return sum / effectiveCells.length;
  }, [effectiveCells, globalNightMult]);

  const positionRisk = useMemo(() => {
    if (!simPoint || effectiveCells.length === 0) return null;
    return evaluatePointRisk(simPoint, effectiveCells, time);
  }, [simPoint, effectiveCells, time]);

  const incidentBuckets = useMemo(() => {
    const buckets = { robbery: 0, police: 0, blockage: 0 };
    for (const inc of incidents) {
      if (inc.type === "robbery") buckets.robbery++;
      else if (inc.type === "police") buckets.police++;
      else if (inc.type === "blockage") buckets.blockage++;
    }
    return buckets;
  }, [incidents]);

  const handleCopyJson = () => {
    const snapshot = {
      time,
      effectiveNightMultiplier:
        globalNightMult !== null ? globalNightMult : "per-cell defaults",
      avgNightMultiplier: Number(avgNightMult.toFixed(2)),
      elevatedThreshold,
      incidentWeights: { blocking: blockingWeight, advisory: advisoryWeight },
      selectedRoute: selected
        ? {
            label: selected.label,
            category: selected.category,
            avgRisk: selected.route.averageRisk,
            highRiskFraction: selected.highRiskFraction,
            incidentImpacts: selected.incidentImpacts,
            durationSec: selected.durationSeconds,
          }
        : null,
      alternatives: others.map((r) => ({
        category: r.category,
        avgRisk: r.route.averageRisk,
        incidentImpacts: r.incidentImpacts,
      })),
      destination: destinationRisk
        ? {
            state: destinationRisk.state,
            affected: destinationRisk.affectedCellLabels,
          }
        : null,
      incidents: incidentBuckets,
      simulation: simulating
        ? {
            positionRisk: positionRisk ? Number(positionRisk.toFixed(2)) : null,
            speedKmh: simSpeedKmh,
            progressPct: Math.round(simProgress * 100),
          }
        : null,
    };
    void navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
  };

  if (!enabled) return null;

  return (
    <div className="absolute top-16 right-4 z-20 w-[320px] rounded-2xl bg-slate-900/95 backdrop-blur-md text-slate-100 shadow-2xl border border-slate-700/60 overflow-hidden">
      <button
        type="button"
        onClick={() => togglePanel("debug")}
        className="w-full flex items-center justify-between px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-violet-300 hover:bg-slate-800/50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Microscope className="w-3.5 h-3.5" />
          Engine Internals
        </span>
        {open ? (
          <ChevronUp className="w-3.5 h-3.5" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2 space-y-3 text-[11px] font-mono leading-relaxed">
          <Section label="Time Context">
            <Row k="Mode" v={time} accent={time === "night" ? "violet" : "amber"} />
            <Row
              k={globalNightMult !== null ? "Night ×" : "Avg night ×"}
              v={fmtNum(avgNightMult, 2)}
            />
            <Row k="Elevated threshold" v={fmtNum(elevatedThreshold, 1)} />
            <Row
              k="Incident wts (B/A)"
              v={`${fmtNum(blockingWeight, 1)} / ${fmtNum(advisoryWeight, 1)}`}
            />
          </Section>

          {selected && (
            <Section label={`Selected • ${selected.label}`}>
              <Row k="avgRisk" v={fmtNum(selected.route.averageRisk, 2)} accent="emerald" />
              <Row k="highRiskFrac" v={`${Math.round(selected.highRiskFraction * 100)}%`} />
              <Row k="incidentImpacts" v={String(selected.incidentImpacts)} />
              <Row
                k="duration"
                v={`${Math.round(selected.durationSeconds / 60)} min`}
              />
            </Section>
          )}

          {others.length > 0 && (
            <Section label="Alternatives">
              {others.map((r) => (
                <Row
                  key={r.id}
                  k={r.category}
                  v={`avg ${fmtNum(r.route.averageRisk, 2)} / imp ${r.incidentImpacts}`}
                />
              ))}
            </Section>
          )}

          {routes.length > 0 && (
            <Section label="Why this ranking?">
              <RouteWhyList routes={routes} />
            </Section>
          )}

          {destinationRisk && (
            <Section label="Destination">
              <Row k="verdict" v={destinationRisk.state} accent="violet" />
              {destinationRisk.affectedCellLabels.length > 0 && (
                <Row
                  k="affected"
                  v={destinationRisk.affectedCellLabels.slice(0, 2).join(", ")}
                />
              )}
            </Section>
          )}

          <Section label="Incidents">
            <Row k="robbery" v={String(incidentBuckets.robbery)} />
            <Row k="police" v={String(incidentBuckets.police)} />
            <Row k="blockage" v={String(incidentBuckets.blockage)} />
          </Section>

          {simulating && (
            <Section label="Simulation • running">
              <Row
                k="position risk"
                v={positionRisk !== null ? fmtNum(positionRisk, 2) : "—"}
                accent="amber"
              />
              <Row k="speed" v={`${simSpeedKmh} km/h`} />
              <Row k="progress" v={`${Math.round(simProgress * 100)}%`} />
            </Section>
          )}

          <Section label="Cells">
            <Row k="built-in" v={String(effectiveCells.filter((c) => !("source" in c)).length)} />
            <Row
              k="custom paint"
              v={String(effectiveCells.filter((c) => "source" in c).length)}
            />
          </Section>

          <button
            type="button"
            onClick={handleCopyJson}
            className="w-full flex items-center justify-center gap-2 mt-2 py-2 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/40 text-violet-200 text-[10px] font-bold uppercase tracking-wider transition-colors"
          >
            <Copy className="w-3 h-3" />
            Copy state as JSON
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────── Local helpers ─────────── */

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[9.5px] font-bold uppercase tracking-widest text-slate-400 mb-1">
        {label}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Row({
  k,
  v,
  accent,
}: {
  k: string;
  v: string;
  accent?: "violet" | "emerald" | "amber";
}) {
  const valueClass =
    accent === "violet"
      ? "text-violet-300"
      : accent === "emerald"
        ? "text-emerald-300"
        : accent === "amber"
          ? "text-amber-300"
          : "text-slate-100";
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-400">{k}</span>
      <span className={`tabular-nums font-bold ${valueClass}`}>{v}</span>
    </div>
  );
}
