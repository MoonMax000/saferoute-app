"use client";

import { Eye, EyeOff, Moon, Sun, Car, Focus } from "lucide-react";
import { RISK_CATEGORIES } from "@/features/risk";

interface MapControlsProps {
  showZones: boolean;
  onToggleZones: () => void;
  nightMode: boolean;
  onToggleNightMode: () => void;
  showTraffic: boolean;
  onToggleTraffic: () => void;
  focusMode: boolean;
  onToggleFocusMode: () => void;
}

export function MapControls({
  showZones,
  onToggleZones,
  nightMode,
  onToggleNightMode,
  showTraffic,
  onToggleTraffic,
  focusMode,
  onToggleFocusMode,
}: MapControlsProps) {
  return (
    <div className="bg-slate-50/80 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/60 shadow-sm">
      <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">
        Map Controls
      </h3>
      <div className="mb-4">
        <div className="flex flex-wrap gap-1.5">
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
            onClick={onToggleTraffic}
            className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all duration-200 ${
              showTraffic
                ? "bg-green-100 text-green-700 shadow-sm hover:bg-green-200"
                : "bg-slate-200 text-slate-500 hover:bg-slate-300"
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            Traffic
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
            Risk
          </button>
          <button
            onClick={onToggleFocusMode}
            title="Strip color from the map and overlays so the chosen route stands out"
            className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all duration-200 ${
              focusMode
                ? "bg-slate-900 text-white shadow-sm hover:bg-slate-800"
                : "bg-slate-200 text-slate-500 hover:bg-slate-300"
            }`}
          >
            <Focus className="w-3.5 h-3.5" />
            Focus
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2.5">
        {RISK_CATEGORIES.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-black/5"
              style={{ backgroundColor: item.colour }}
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
