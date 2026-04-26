"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Paintbrush,
  RotateCcw,
  Sliders,
  Trash2,
} from "lucide-react";
import type { RiskCell } from "@/features/risk";
import { useInspectorStore } from "./inspector-store";
import {
  useRiskConfigStore,
  DEFAULT_BLOCKING_WEIGHT,
  DEFAULT_ADVISORY_WEIGHT,
  DEFAULT_ELEVATED_THRESHOLD,
} from "./risk-config-store";
import { inspectorLog } from "./inspector-log";

interface InspectorTunePanelProps {
  effectiveCells: RiskCell[];
}

/**
 * Slider-driven mutation panel. Russ drags any control and the route
 * ranking, destination verdict, and zone polygon colors all recompute
 * live — proving the UI is downstream of real logic.
 *
 * Tunables persist for the session only (no localStorage), so a reload
 * always returns to the engineered defaults.
 */
export function InspectorTunePanel({ effectiveCells }: InspectorTunePanelProps) {
  const enabled = useInspectorStore((s) => s.enabled);
  const open = useInspectorStore((s) => s.panelLayout.tune);
  const togglePanel = useInspectorStore((s) => s.togglePanel);
  const clearPaintZones = useInspectorStore((s) => s.clearPaintZones);
  const paintZoneCount = useInspectorStore((s) => s.paintZones.length);

  const startPaintMode = useInspectorStore((s) => s.startPaintMode);
  const paintModeActive = useInspectorStore((s) => s.paintMode.active);

  const overrides = useRiskConfigStore((s) => s.overrides);
  const setCellBaseRisk = useRiskConfigStore((s) => s.setCellBaseRisk);
  const globalNightMult = useRiskConfigStore((s) => s.globalNightMultiplier);
  const setGlobalNightMult = useRiskConfigStore(
    (s) => s.setGlobalNightMultiplier,
  );
  const elevatedThreshold = useRiskConfigStore((s) => s.elevatedThreshold);
  const setElevatedThreshold = useRiskConfigStore((s) => s.setElevatedThreshold);
  const blockingWeight = useRiskConfigStore((s) => s.blockingIncidentWeight);
  const setBlockingWeight = useRiskConfigStore((s) => s.setBlockingWeight);
  const advisoryWeight = useRiskConfigStore((s) => s.advisoryIncidentWeight);
  const setAdvisoryWeight = useRiskConfigStore((s) => s.setAdvisoryWeight);
  const resetAll = useRiskConfigStore((s) => s.resetAll);

  const [showAllCells, setShowAllCells] = useState(false);

  // Show built-in cells only; paint zones live in their own list.
  const builtInCells = useMemo(
    () => effectiveCells.filter((c) => !("source" in c)),
    [effectiveCells],
  );
  // Pick the top 6 most "interesting" cells (highest base risk first)
  // for the collapsed view. Russ probably wants to crank the dangerous
  // ones, not browse residential streets.
  const sortedCells = useMemo(
    () => [...builtInCells].sort((a, b) => b.baseDayRisk - a.baseDayRisk),
    [builtInCells],
  );
  const visibleCells = showAllCells ? sortedCells : sortedCells.slice(0, 6);

  const handleResetAll = () => {
    resetAll();
    inspectorLog("event", "Inspector: tunables reset to defaults");
  };

  const handleClearPaint = () => {
    clearPaintZones();
    inspectorLog("event", "Inspector: paint zones cleared");
  };

  if (!enabled) return null;

  return (
    <div className="absolute top-16 right-[340px] z-20 w-[300px] rounded-2xl bg-slate-900/95 backdrop-blur-md text-slate-100 shadow-2xl border border-slate-700/60 overflow-hidden">
      <button
        type="button"
        onClick={() => togglePanel("tune")}
        className="w-full flex items-center justify-between px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-violet-300 hover:bg-slate-800/50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5" />
          Tune Risk Engine
        </span>
        {open ? (
          <ChevronUp className="w-3.5 h-3.5" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Neighborhood risk sliders */}
          <Section
            label="Neighborhood Risk"
            hint="Drag a slider, watch routes re-rank live"
          >
            <div className="space-y-2">
              {visibleCells.map((cell) => {
                const overridden = overrides[cell.id]?.baseDayRisk !== undefined;
                return (
                  <CellSlider
                    key={cell.id}
                    cell={cell}
                    overridden={overridden}
                    onChange={(v) => {
                      setCellBaseRisk(cell.id, v);
                    }}
                    onCommit={(v) => {
                      inspectorLog(
                        "event",
                        `tune: ${cell.label} baseDayRisk → ${v}`,
                        { cellId: cell.id },
                      );
                    }}
                  />
                );
              })}
            </div>
            {sortedCells.length > 6 && (
              <button
                type="button"
                onClick={() => setShowAllCells((v) => !v)}
                className="mt-2 text-[10px] font-bold uppercase tracking-wider text-violet-400 hover:text-violet-300"
              >
                {showAllCells
                  ? "Show top 6 only"
                  : `Show all ${sortedCells.length}`}
              </button>
            )}
          </Section>

          {/* Global controls */}
          <Section label="Global">
            <SliderRow
              label="Night multiplier"
              value={globalNightMult ?? 1}
              defaultLabel={
                globalNightMult === null ? "(per-cell defaults)" : undefined
              }
              min={0.5}
              max={3.0}
              step={0.1}
              onChange={(v) => setGlobalNightMult(v)}
              onCommit={(v) =>
                inspectorLog("event", `tune: global night × → ${v.toFixed(2)}`)
              }
              onReset={() => {
                setGlobalNightMult(null);
                inspectorLog("event", "tune: night × reset to per-cell defaults");
              }}
            />
            <SliderRow
              label="Elevated threshold"
              value={elevatedThreshold}
              min={0}
              max={10}
              step={0.1}
              onChange={(v) => setElevatedThreshold(v)}
              onCommit={(v) =>
                inspectorLog(
                  "event",
                  `tune: elevatedThreshold → ${v.toFixed(2)}`,
                )
              }
              onReset={() =>
                setElevatedThreshold(DEFAULT_ELEVATED_THRESHOLD)
              }
            />
          </Section>

          {/* Incident weights */}
          <Section label="Incident Weights">
            <SliderRow
              label="Blocking ×"
              value={blockingWeight}
              min={0}
              max={10}
              step={0.1}
              onChange={(v) => setBlockingWeight(v)}
              onCommit={(v) =>
                inspectorLog(
                  "event",
                  `tune: blockingIncidentWeight → ${v.toFixed(2)}`,
                )
              }
              onReset={() => setBlockingWeight(DEFAULT_BLOCKING_WEIGHT)}
            />
            <SliderRow
              label="Advisory ×"
              value={advisoryWeight}
              min={0}
              max={10}
              step={0.1}
              onChange={(v) => setAdvisoryWeight(v)}
              onCommit={(v) =>
                inspectorLog(
                  "event",
                  `tune: advisoryIncidentWeight → ${v.toFixed(2)}`,
                )
              }
              onReset={() => setAdvisoryWeight(DEFAULT_ADVISORY_WEIGHT)}
            />
          </Section>

          {/* Bottom actions */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <button
              type="button"
              onClick={() => {
                startPaintMode();
                inspectorLog("event", "paint: mode started");
              }}
              disabled={paintModeActive}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-violet-600/30 hover:bg-violet-600/50 text-violet-200 text-[10px] font-bold uppercase tracking-wider border border-violet-500/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Paintbrush className="w-3 h-3" />
              {paintModeActive ? "Painting…" : "Paint custom zone"}
            </button>
            <button
              type="button"
              onClick={handleResetAll}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold uppercase tracking-wider transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset all tunables
            </button>
            {paintZoneCount > 0 && (
              <button
                type="button"
                onClick={handleClearPaint}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-rose-900/30 hover:bg-rose-900/50 text-rose-300 text-[10px] font-bold uppercase tracking-wider border border-rose-800/50 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Clear {paintZoneCount} paint zone{paintZoneCount === 1 ? "" : "s"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────── Section / Row helpers ─────────── */

function Section({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[9.5px] font-bold uppercase tracking-widest text-slate-400">
        {label}
      </div>
      {hint && <div className="text-[10px] text-slate-500 mb-2">{hint}</div>}
      <div className={hint ? "" : "mt-1"}>{children}</div>
    </div>
  );
}

/**
 * Hook that gives a slider its own local state for visuals plus a
 * throttled commit to the upstream store. Without it, every pixel of
 * slider movement reruns `scoreRoute()` × 3 routes and rebuilds 20+
 * canvas polygons — at 60+ events/sec that locks the UI up.
 *
 * - `localValue`     — drives the input + label, updates instantly
 * - `commitThrottled`— pushes upstream at most every `delay` ms
 * - `commitImmediate`— used on mouseup / touchend (final value)
 */
function useThrottledSlider(
  externalValue: number,
  upstream: (v: number) => void,
  delay = 180,
) {
  const [localValue, setLocalValue] = useState(externalValue);
  // Track the last external value we saw + whether the user is mid-
  // drag, both as state so we can read them safely during render.
  // ("setState during render" derived-state pattern — see React docs:
  // You might not need an effect → adjusting state on prop change.)
  const [lastExternal, setLastExternal] = useState(externalValue);
  const [editing, setEditing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (externalValue !== lastExternal) {
    setLastExternal(externalValue);
    if (!editing) {
      setLocalValue(externalValue);
    }
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const onChange = (v: number) => {
    setLocalValue(v);
    if (!editing) setEditing(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      upstream(v);
    }, delay);
  };

  const flush = (v: number) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setEditing(false);
    upstream(v);
  };

  return { localValue, onChange, flush };
}

function CellSlider({
  cell,
  overridden,
  onChange,
  onCommit,
}: {
  cell: RiskCell;
  overridden: boolean;
  onChange: (v: number) => void;
  onCommit: (v: number) => void;
}) {
  const slider = useThrottledSlider(cell.baseDayRisk, onChange);

  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span
          className="text-slate-300 font-medium truncate"
          title={cell.label}
        >
          {cell.label}
        </span>
        <span
          className={`tabular-nums font-mono font-bold ${overridden ? "text-violet-300" : "text-slate-200"}`}
        >
          {slider.localValue.toFixed(1)}
          {overridden && <span className="ml-1 text-[8px]">●</span>}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        step={0.1}
        value={slider.localValue}
        onChange={(e) => slider.onChange(Number(e.target.value))}
        onMouseUp={(e) => {
          const v = Number((e.target as HTMLInputElement).value);
          slider.flush(v);
          onCommit(v);
        }}
        onTouchEnd={(e) => {
          const v = Number((e.target as HTMLInputElement).value);
          slider.flush(v);
          onCommit(v);
        }}
        className="w-full accent-violet-500 mt-0.5"
      />
    </div>
  );
}

function SliderRow({
  label,
  value,
  defaultLabel,
  min,
  max,
  step,
  onChange,
  onCommit,
  onReset,
}: {
  label: string;
  value: number;
  defaultLabel?: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  onCommit: (v: number) => void;
  onReset?: () => void;
}) {
  const slider = useThrottledSlider(value, onChange);

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="text-slate-300 font-medium">{label}</span>
        <span className="flex items-center gap-1.5">
          <span className="tabular-nums font-mono font-bold text-violet-300">
            {slider.localValue.toFixed(2)}
          </span>
          {defaultLabel && (
            <span className="text-[9px] text-slate-500">{defaultLabel}</span>
          )}
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="text-slate-500 hover:text-slate-300"
              title="Reset to default"
            >
              <RotateCcw className="w-2.5 h-2.5" />
            </button>
          )}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={slider.localValue}
        onChange={(e) => slider.onChange(Number(e.target.value))}
        onMouseUp={(e) => {
          const v = Number((e.target as HTMLInputElement).value);
          slider.flush(v);
          onCommit(v);
        }}
        onTouchEnd={(e) => {
          const v = Number((e.target as HTMLInputElement).value);
          slider.flush(v);
          onCommit(v);
        }}
        className="w-full accent-violet-500 mt-0.5"
      />
    </div>
  );
}
