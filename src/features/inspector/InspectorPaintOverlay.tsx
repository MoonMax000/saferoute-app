"use client";

import { Check, Paintbrush, X } from "lucide-react";
import { useInspectorStore } from "./inspector-store";
import { inspectorLog } from "./inspector-log";

/**
 * Top-centre banner shown only while paint mode is active. Walks the
 * user through "click → adjust → confirm" without leaving the map view.
 *
 * Design parity with the existing incident-placement banner so the UX
 * feels native, not bolted on.
 */
export function InspectorPaintOverlay() {
  const enabled = useInspectorStore((s) => s.enabled);
  const paintMode = useInspectorStore((s) => s.paintMode);
  const setPaintRadius = useInspectorStore((s) => s.setPaintRadius);
  const setPaintRisk = useInspectorStore((s) => s.setPaintRisk);
  const stopPaintMode = useInspectorStore((s) => s.stopPaintMode);
  const commitPaintZone = useInspectorStore((s) => s.commitPaintZone);

  if (!enabled || !paintMode.active) return null;

  const hasCenter = paintMode.pendingCenter !== null;

  const handleConfirm = () => {
    if (!paintMode.pendingCenter) return;
    inspectorLog("event", "paint: zone committed", {
      coords: paintMode.pendingCenter,
      radius: paintMode.pendingRadius,
      risk: paintMode.pendingRisk,
    });
    commitPaintZone();
  };

  const handleCancel = () => {
    inspectorLog("event", "paint: cancelled");
    stopPaintMode();
  };

  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 w-[440px] max-w-[92vw] bg-violet-600/95 backdrop-blur-xl shadow-2xl border border-violet-300/40 rounded-2xl px-5 py-4 text-white animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Paintbrush className="w-4 h-4" />
          <span className="font-bold text-sm tracking-wide">
            Paint custom risk zone
          </span>
        </div>
        <button
          type="button"
          onClick={handleCancel}
          className="text-violet-100 hover:text-white p-1 -m-1 rounded-md hover:bg-white/10 transition-colors"
          title="Cancel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {!hasCenter ? (
        <div className="bg-white/10 rounded-lg px-3 py-2 text-[12px] text-violet-50">
          <strong>Step 1:</strong> Click anywhere on the map to set the centre
          of your zone.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-white/10 rounded-lg px-3 py-2 text-[12px] text-violet-50">
            <strong>Step 2:</strong> Adjust the size and risk level — every
            route will re-rank live as you drag.
          </div>

          <Slider
            label="Radius"
            value={paintMode.pendingRadius}
            min={50}
            max={1000}
            step={10}
            unit="m"
            onChange={setPaintRadius}
          />

          <Slider
            label="Risk level"
            value={paintMode.pendingRisk}
            min={1}
            max={10}
            step={0.5}
            unit="/10"
            onChange={setPaintRisk}
          />

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 flex items-center justify-center gap-1.5 bg-white text-violet-700 py-2 rounded-lg font-bold text-sm hover:bg-violet-50 active:scale-[0.98] transition-all"
            >
              <Check className="w-3.5 h-3.5" />
              Confirm zone
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 bg-violet-700 hover:bg-violet-800 text-white py-2 rounded-lg font-bold text-sm border border-violet-400/30 active:scale-[0.98] transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-0.5">
        <span className="text-violet-100 font-medium">{label}</span>
        <span className="font-mono font-bold tabular-nums text-white">
          {value}
          {unit && <span className="text-violet-200 ml-0.5">{unit}</span>}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-white"
      />
    </div>
  );
}
