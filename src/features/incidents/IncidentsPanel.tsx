"use client";

import { Trash2, Plus, X, ShieldAlert, Siren, Construction } from "lucide-react";
import type { Incident, IncidentPlacementMode, IncidentType } from "./incidents.types";
import { INCIDENT_TYPES } from "./incidents-config";

interface IncidentsPanelProps {
  incidents: Incident[];
  placementMode: IncidentPlacementMode;
  onPlaceStart: (type: IncidentType) => void;
  onPlaceCancel: () => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

const TYPE_ICON = {
  robbery: ShieldAlert,
  police: Siren,
  blockage: Construction,
} as const;

function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export function IncidentsPanel({
  incidents,
  placementMode,
  onPlaceStart,
  onPlaceCancel,
  onRemove,
  onClear,
}: IncidentsPanelProps) {
  return (
    <div className="bg-slate-50/80 backdrop-blur-sm rounded-2xl p-5 border border-slate-200/60 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
          Incidents
          {incidents.length > 0 && (
            <span className="ml-2 inline-block bg-slate-200 text-slate-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {incidents.length}
            </span>
          )}
        </h3>
        {incidents.length > 0 && (
          <button
            onClick={onClear}
            className="text-slate-400 hover:text-rose-500 text-[11px] font-semibold transition-colors flex items-center gap-1"
            title="Remove all incidents"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {(Object.keys(INCIDENT_TYPES) as IncidentType[]).map((type) => {
          const cfg = INCIDENT_TYPES[type];
          const Icon = TYPE_ICON[type];
          const active = placementMode === type;
          return (
            <button
              key={type}
              onClick={() =>
                active ? onPlaceCancel() : onPlaceStart(type)
              }
              className={`flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl border-2 transition-all duration-200 ${
                active
                  ? `${cfg.iconBg} text-white border-transparent shadow-md`
                  : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:shadow-sm"
              }`}
              title={
                active
                  ? "Click on map to place, or click again to cancel"
                  : `Add ${cfg.shortLabel}`
              }
            >
              {active ? (
                <X className="w-4 h-4" />
              ) : (
                <Icon className="w-4 h-4" />
              )}
              <span className="text-[10px] font-bold uppercase tracking-wide">
                {active ? "Cancel" : cfg.shortLabel}
              </span>
            </button>
          );
        })}
      </div>

      {placementMode && (
        <div className="text-[12px] text-slate-600 px-1 mb-3 leading-snug">
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <Plus className="w-3 h-3" />
            Click on the map to place a {INCIDENT_TYPES[placementMode].shortLabel.toLowerCase()}.
          </span>
        </div>
      )}

      {incidents.length === 0 ? (
        <p className="text-[12px] text-slate-400 italic px-1">
          No reports. Tap a type above to mark something on the map.
        </p>
      ) : (
        <ul className="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
          {[...incidents]
            .sort((a, b) => b.createdAt - a.createdAt)
            .map((incident) => {
              const cfg = INCIDENT_TYPES[incident.type];
              const Icon = TYPE_ICON[incident.type];
              return (
                <li
                  key={incident.id}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 flex items-center gap-3"
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-white ${cfg.iconBg}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-slate-700 truncate">
                      {cfg.shortLabel}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {timeAgo(incident.createdAt)} • {incident.radius} m
                    </p>
                  </div>
                  <button
                    onClick={() => onRemove(incident.id)}
                    className="text-slate-300 hover:text-rose-500 transition-colors p-1"
                    title="Remove"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}
