"use client";

import { Eye, EyeOff, Moon, Sun } from "lucide-react";
import { getRiskColor } from "@/features/zones";

const LEGEND_ITEMS = [
  { label: "Very Safe", score: 1 },
  { label: "Safe", score: 3 },
  { label: "Moderate", score: 5 },
  { label: "Elevated", score: 6 },
  { label: "High Risk", score: 7 },
  { label: "Very High", score: 9 },
];

const BORDER_COLORS: Record<number, string> = {
  1: "border-emerald-600",
  3: "border-lime-600",
  5: "border-yellow-500",
  6: "border-orange-600",
  7: "border-red-600",
  9: "border-rose-950",
};

interface MapControlsProps {
  showZones: boolean;
  onToggleZones: () => void;
  nightMode: boolean;
  onToggleNightMode: () => void;
}

export function MapControls({
  showZones,
  onToggleZones,
  nightMode,
  onToggleNightMode,
}: MapControlsProps) {
  return (
    <div className="bg-slate-50/80 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/60 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
          Map Controls
        </h3>
        <div className="flex gap-1.5">
          <button
            onClick={onToggleNightMode}
            className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all duration-200 ${
              nightMode
                ? "bg-slate-800 text-amber-300 shadow-sm hover:bg-slate-700"
                : "bg-slate-200 text-slate-500 hover:bg-slate-300"
            }`}
          >
            {nightMode ? (
              <Moon className="w-3.5 h-3.5" />
            ) : (
              <Sun className="w-3.5 h-3.5" />
            )}
            {nightMode ? "Night" : "Day"}
          </button>
          <button
            onClick={onToggleZones}
            className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all duration-200 ${
              showZones
                ? "bg-indigo-100 text-indigo-700 shadow-sm hover:bg-indigo-200"
                : "bg-slate-200 text-slate-500 hover:bg-slate-300"
            }`}
          >
            {showZones ? (
              <Eye className="w-3.5 h-3.5" />
            ) : (
              <EyeOff className="w-3.5 h-3.5" />
            )}
            Zones
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-3.5 gap-x-4">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.label} className="flex items-center gap-2.5">
            <div
              className={`w-3.5 h-3.5 rounded shadow-sm flex-shrink-0 border ${
                BORDER_COLORS[item.score] ?? ""
              }`}
              style={{ backgroundColor: getRiskColor(item.score) }}
            />
            <span className="text-[12px] font-medium text-slate-600 whitespace-nowrap">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
