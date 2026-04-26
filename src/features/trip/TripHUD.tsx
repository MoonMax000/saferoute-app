"use client";

import { Gauge, Clock, MapPin, Navigation2 } from "lucide-react";
import type { RouteOption } from "@/features/routing";

interface TripHUDProps {
  /** Visible only while a trip or simulation is in motion. */
  visible: boolean;
  /** Live km/h reading. `null` = no reading yet. */
  speedKmh: number | null;
  /** Currently followed route (for label + distance). */
  selectedRoute: RouteOption | null;
  /** Progress along the route, 0..1. */
  progress: number;
  /** Optional kicker for the panel (e.g. "Live trip" / "Demo drive"). */
  modeLabel: string;
  /** Optional state hint shown small under the speed (e.g. "On expected route"). */
  stateLabel?: string;
  /** Tone of the state label. */
  stateTone?: "ok" | "warn" | "danger" | "info";
}

const STATE_TONE: Record<
  NonNullable<TripHUDProps["stateTone"]>,
  string
> = {
  ok: "text-emerald-300",
  warn: "text-amber-300",
  danger: "text-rose-300",
  info: "text-indigo-200",
};

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function TripHUD({
  visible,
  speedKmh,
  selectedRoute,
  progress,
  modeLabel,
  stateLabel,
  stateTone = "ok",
}: TripHUDProps) {
  if (!visible || !selectedRoute) return null;

  const totalDistanceM = (() => {
    // Pull from the human-readable RouteResult field when possible to avoid
    // recomputing from polyline.
    const txt = selectedRoute.route.totalDistance;
    const km = parseFloat(txt);
    if (!Number.isFinite(km)) return 0;
    return txt.endsWith(" m") ? km : km * 1000;
  })();
  const totalDurationS = (() => {
    const txt = selectedRoute.route.totalDuration;
    if (txt.endsWith(" min")) return parseInt(txt, 10) * 60;
    if (txt.endsWith(" s")) return parseInt(txt, 10);
    if (txt.includes("h")) {
      const [h, m] = txt.split("h").map((s) => parseInt(s, 10));
      return (h || 0) * 3600 + (m || 0) * 60;
    }
    return 0;
  })();

  const remainingM = Math.max(0, totalDistanceM * (1 - progress));
  const remainingS = Math.max(0, totalDurationS * (1 - progress));

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 -translate-x-1/2 z-30 w-[min(92vw,560px)] animate-fade-in">
      <div className="pointer-events-auto rounded-2xl bg-slate-900/85 backdrop-blur-md border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.4)] text-white">
        <div className="flex items-stretch divide-x divide-white/10">
          {/* Speed */}
          <div className="flex-shrink-0 px-5 py-3 flex items-center gap-3 min-w-[140px]">
            <Gauge className="w-6 h-6 text-emerald-300" />
            <div>
              <div className="font-mono text-3xl font-black leading-none tracking-tight">
                {speedKmh ?? "--"}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400 mt-1">
                km/h
              </div>
            </div>
          </div>

          {/* ETA */}
          <div className="flex-1 px-5 py-3 flex items-center gap-3">
            <Clock className="w-5 h-5 text-indigo-300" />
            <div>
              <div className="text-[11px] uppercase tracking-widest text-slate-400">
                ETA
              </div>
              <div className="font-semibold text-base leading-tight">
                {formatDuration(remainingS)}
              </div>
            </div>
          </div>

          {/* Distance remaining */}
          <div className="flex-1 px-5 py-3 flex items-center gap-3">
            <MapPin className="w-5 h-5 text-rose-300" />
            <div>
              <div className="text-[11px] uppercase tracking-widest text-slate-400">
                Remaining
              </div>
              <div className="font-semibold text-base leading-tight">
                {formatDistance(remainingM)}
              </div>
            </div>
          </div>
        </div>

        {/* Footer: route + state */}
        <div className="px-5 py-2.5 border-t border-white/10 flex items-center justify-between gap-3 text-[12px]">
          <div className="flex items-center gap-2 min-w-0">
            <Navigation2 className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
            <span className="text-slate-300 truncate">
              <span className="text-slate-400">{modeLabel} • </span>
              <span className="font-semibold text-white">
                {selectedRoute.label}
              </span>
              {selectedRoute.description && (
                <>
                  <span className="text-slate-500"> • </span>
                  <span className="text-slate-400">
                    {selectedRoute.description}
                  </span>
                </>
              )}
            </span>
          </div>
          {stateLabel && (
            <span
              className={`font-bold uppercase tracking-wider whitespace-nowrap ${STATE_TONE[stateTone]}`}
            >
              {stateLabel}
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-white/10 overflow-hidden rounded-b-2xl">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 via-indigo-400 to-rose-400 transition-all duration-300 ease-out"
            style={{ width: `${Math.max(2, Math.min(100, progress * 100))}%` }}
          />
        </div>
      </div>
    </div>
  );
}
