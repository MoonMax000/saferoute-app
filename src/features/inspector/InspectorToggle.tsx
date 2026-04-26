"use client";

import { Microscope } from "lucide-react";
import { useInspectorStore } from "./inspector-store";

/**
 * Single floating button in the top-right corner of the map area.
 * Toggles the entire inspector experience (debug panel, log panel,
 * tune sliders, click-breakdown popup, paint mode, verification runner).
 *
 * Default OFF — Russ sees the regular product first; the inspector
 * surface only appears when he clicks "Inspector".
 */
export function InspectorToggle() {
  const enabled = useInspectorStore((s) => s.enabled);
  const toggle = useInspectorStore((s) => s.toggle);

  return (
    <button
      type="button"
      onClick={toggle}
      title={
        enabled
          ? "Hide inspector — return to normal view"
          : "Open inspector — see live calculations + tune the risk engine"
      }
      className={`absolute top-4 right-4 z-30 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold shadow-lg transition-all duration-200 active:scale-[0.98] ${
        enabled
          ? "bg-violet-600 text-white hover:bg-violet-500 ring-2 ring-violet-300/50"
          : "bg-slate-900/90 text-violet-300 hover:bg-slate-800 backdrop-blur-md border border-slate-700"
      }`}
    >
      <Microscope className="w-3.5 h-3.5" />
      {enabled ? "Inspector ON" : "Inspector"}
    </button>
  );
}
