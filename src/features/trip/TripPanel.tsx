"use client";

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MapPin,
  Navigation,
  ShieldOff,
  Square,
} from "lucide-react";
import type { TripState, TripStatus } from "./trip.types";

interface TripPanelProps {
  status: TripStatus;
  hasSelectedRoute: boolean;
  onStart: () => void;
  onStop: () => void;
}

const TONE: Record<
  TripState,
  { container: string; iconWrap: string; title: string; muted: string; icon: typeof Activity }
> = {
  idle: {
    container: "from-slate-50 to-slate-100/50 border-slate-200",
    iconWrap: "bg-slate-100 text-slate-700",
    title: "text-slate-800",
    muted: "text-slate-600",
    icon: Navigation,
  },
  "awaiting-fix": {
    container: "from-indigo-50 to-violet-50 border-indigo-200",
    iconWrap: "bg-indigo-100 text-indigo-700",
    title: "text-indigo-900",
    muted: "text-indigo-700/80",
    icon: Loader2,
  },
  "on-route": {
    container: "from-emerald-50 to-green-50 border-emerald-200",
    iconWrap: "bg-emerald-100 text-emerald-700",
    title: "text-emerald-900",
    muted: "text-emerald-700/80",
    icon: CheckCircle2,
  },
  "evaluating-deviation": {
    container: "from-amber-50 to-orange-50 border-amber-200",
    iconWrap: "bg-amber-100 text-amber-700",
    title: "text-amber-900",
    muted: "text-amber-700/80",
    icon: Activity,
  },
  deviated: {
    container: "from-rose-50 to-red-50 border-rose-200",
    iconWrap: "bg-rose-100 text-rose-700",
    title: "text-rose-900",
    muted: "text-rose-700/80",
    icon: AlertTriangle,
  },
  arrived: {
    container: "from-emerald-50 to-teal-50 border-emerald-200",
    iconWrap: "bg-emerald-100 text-emerald-700",
    title: "text-emerald-900",
    muted: "text-emerald-700/80",
    icon: MapPin,
  },
  "permission-denied": {
    container: "from-rose-50 to-red-50 border-rose-200",
    iconWrap: "bg-rose-100 text-rose-700",
    title: "text-rose-900",
    muted: "text-rose-700/80",
    icon: ShieldOff,
  },
  unavailable: {
    container: "from-slate-50 to-slate-100/50 border-slate-200",
    iconWrap: "bg-slate-100 text-slate-700",
    title: "text-slate-800",
    muted: "text-slate-600",
    icon: ShieldOff,
  },
};

function summarise(status: TripStatus): { title: string; detail?: string } {
  switch (status.state) {
    case "idle":
      return { title: "Trip not started." };
    case "awaiting-fix":
      return { title: "Waiting for GPS fix..." };
    case "on-route":
      return {
        title: "On expected route",
        detail:
          status.distanceFromRouteM != null
            ? `${Math.round(status.distanceFromRouteM)} m from path`
            : undefined,
      };
    case "evaluating-deviation":
      return {
        title: "Drifting off route...",
        detail:
          status.distanceFromRouteM != null
            ? `${Math.round(status.distanceFromRouteM)} m off path`
            : undefined,
      };
    case "deviated":
      return {
        title: "Route deviation detected",
        detail:
          status.distanceFromRouteM != null
            ? `${Math.round(status.distanceFromRouteM)} m off the planned route`
            : "Sustained off-route GPS fix",
      };
    case "arrived":
      return { title: "Arrived at destination." };
    case "permission-denied":
      return {
        title: "Location permission denied",
        detail: status.errorMessage,
      };
    case "unavailable":
      return {
        title: "Tracking unavailable",
        detail: status.errorMessage,
      };
  }
}

export function TripPanel({
  status,
  hasSelectedRoute,
  onStart,
  onStop,
}: TripPanelProps) {
  const tone = TONE[status.state];
  const Icon = tone.icon;
  const { title, detail } = summarise(status);
  const isActive =
    status.state !== "idle" &&
    status.state !== "permission-denied" &&
    status.state !== "unavailable";
  const showStart =
    status.state === "idle" ||
    status.state === "permission-denied" ||
    status.state === "unavailable" ||
    status.state === "arrived";

  return (
    <div
      className={`rounded-2xl border bg-gradient-to-r ${tone.container} p-4 shadow-sm flex flex-col gap-3`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex-shrink-0 w-9 h-9 rounded-xl ${tone.iconWrap} flex items-center justify-center`}
        >
          <Icon
            className={`w-5 h-5 ${
              status.state === "awaiting-fix" ? "animate-spin" : ""
            } ${
              status.state === "deviated" ? "animate-pulse" : ""
            }`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h4
            className={`text-[11px] font-bold uppercase tracking-widest ${tone.title}`}
          >
            Trip status
          </h4>
          <p
            className={`text-[14px] font-semibold leading-snug ${tone.title}`}
          >
            {title}
          </p>
          {detail && (
            <p className={`text-[12px] leading-snug mt-0.5 ${tone.muted}`}>
              {detail}
            </p>
          )}
        </div>
      </div>

      {hasSelectedRoute && showStart && (
        <button
          type="button"
          onClick={onStart}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold transition-all duration-200 active:scale-[0.98] bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
        >
          <Navigation className="w-4 h-4" />
          {status.state === "idle"
            ? "Start trip"
            : status.state === "arrived"
              ? "Start another trip"
              : "Try again"}
        </button>
      )}

      {isActive && (
        <button
          type="button"
          onClick={onStop}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold transition-all duration-200 active:scale-[0.98] bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
        >
          <Square className="w-3.5 h-3.5 fill-slate-700" />
          Stop tracking
        </button>
      )}

      {!hasSelectedRoute && status.state === "idle" && (
        <p className="text-[12px] text-slate-500 italic">
          Pick a route first to start a trip.
        </p>
      )}
    </div>
  );
}
