"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Construction,
  Map as MapIcon,
  Shield,
  ShieldCheck,
  Siren,
  Sparkles,
  X,
} from "lucide-react";
import type { IncidentType } from "./incidents.types";
import { INCIDENT_TYPES } from "./incidents-config";
import type { RouteCategory, RouteTone } from "@/features/routing/route.types";

/** Lightweight projection of `RouteOption` so this modal doesn't
 *  pull in the entire routing types graph.
 *
 *  `tone` and `category` mirror the RouteInfo card directly so the
 *  modal stays visually consistent with the sidebar list. */
export interface RerouteRouteSummary {
  label: string;
  durationSec: number;
  distanceMeters: number;
  avgRisk: number;
  incidentImpacts: number;
  tone: RouteTone;
  category: RouteCategory;
}

interface RerouteModalProps {
  /** Show/hide. Parent decides when to mount. */
  open: boolean;
  /** Type of the incident that triggered the modal, if any. */
  triggerType?: IncidentType | null;
  /** Currently selected route — what the user is on right now. */
  current: RerouteRouteSummary;
  /** The proposed safer alternative. */
  alternative: RerouteRouteSummary;
  /** Auto-dismiss countdown in seconds. 0 = no countdown. */
  autoDismissAfterSec?: number;
  /** Shows raw scoring values only inside Inspector/proof mode. */
  showTechnicalMetrics?: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}

const HEADLINES: Record<IncidentType, { title: string; subtitle: string }> = {
  robbery: {
    title: "Robbery report ahead",
    subtitle: "Your route passes through the alert area.",
  },
  police: {
    title: "Police activity ahead",
    subtitle: "Expect possible delays or checkpoints.",
  },
  blockage: {
    title: "Road blockage ahead",
    subtitle: "Your route is impacted.",
  },
};

const TRIGGER_ICON: Record<IncidentType, typeof AlertTriangle> = {
  robbery: Siren,
  police: Shield,
  blockage: Construction,
};

export function RerouteModal({
  open,
  triggerType,
  current,
  alternative,
  autoDismissAfterSec = 0,
  showTechnicalMetrics = false,
  onAccept,
  onDismiss,
}: RerouteModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(autoDismissAfterSec);

  useEffect(() => {
    if (!open || autoDismissAfterSec <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          onDismiss();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [open, autoDismissAfterSec, onDismiss]);

  if (!open) return null;

  const cfg = triggerType ? INCIDENT_TYPES[triggerType] : null;
  const TriggerIcon = triggerType ? TRIGGER_ICON[triggerType] : Sparkles;
  const accentColor = cfg?.stroke ?? "rgba(16, 185, 129, 0.85)";

  const headline = triggerType
    ? HEADLINES[triggerType]
    : {
        title: "Safer route available",
        subtitle: "Conditions changed — here's a better option.",
      };

  // Numbers for the comparison row.
  const minDelta = Math.round(
    (alternative.durationSec - current.durationSec) / 60,
  );
  const riskDelta = current.avgRisk - alternative.avgRisk; // positive = alt is safer
  const incidentDelta = current.incidentImpacts - alternative.incidentImpacts;

  // Headline copy for the time delta — never "+0 min" / "saves 0 min".
  const timeDeltaLabel =
    minDelta > 0
      ? `+${minDelta} min`
      : minDelta < 0
        ? `${minDelta} min faster`
        : "Same time";
  const timeDeltaTone =
    minDelta > 0
      ? "text-amber-700"
      : minDelta < 0
        ? "text-emerald-700"
        : "text-slate-600";

  // Headline copy for risk delta.
  const riskDeltaLabel = showTechnicalMetrics
    ? riskDelta >= 0.5
      ? `↓ ${riskDelta.toFixed(1)} avgRisk`
      : riskDelta <= -0.5
        ? `↑ ${Math.abs(riskDelta).toFixed(1)} avgRisk`
        : "Comparable risk"
    : riskDelta >= 0.5
      ? "Lower exposure"
      : riskDelta <= -0.5
        ? "Higher exposure"
        : "Comparable exposure";
  const riskDeltaTone =
    riskDelta >= 0.5
      ? "text-emerald-700"
      : riskDelta <= -0.5
        ? "text-rose-700"
        : "text-slate-600";

  // The single-line "why switch" argument. Picks the strongest
  // honest argument we can make.
  const whySwitch = buildWhyText({
    triggerType: triggerType ?? null,
    cfg,
    incidentDelta,
    riskDelta,
    minDelta,
    showTechnicalMetrics,
  });

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-32 z-40 flex justify-center px-4 animate-fade-in">
      <div
        role="alertdialog"
        aria-live="assertive"
        className="pointer-events-auto w-[min(94vw,560px)] rounded-2xl bg-white border border-slate-200 shadow-[0_25px_60px_rgba(0,0,0,0.28)] overflow-hidden"
      >
        <div className="flex items-stretch">
          {/* Side accent bar — coloured by incident type */}
          <div
            className="w-1.5 flex-shrink-0"
            style={{ backgroundColor: accentColor }}
            aria-hidden
          />

          <div className="flex-1 p-4 pr-3">
            {/* Header */}
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${accentColor}25` }}
              >
                <TriggerIcon
                  className="w-5 h-5 animate-pulse"
                  style={{ color: accentColor }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <h4
                  className="text-[10.5px] font-bold uppercase tracking-widest"
                  style={{ color: accentColor }}
                >
                  {triggerType ? "Reroute suggested" : "Better route found"}
                </h4>
                <p className="text-[15px] font-bold leading-tight text-slate-900 mt-0.5">
                  {headline.title}
                </p>
                <p className="text-[12px] text-slate-600 leading-snug mt-0.5">
                  {headline.subtitle}
                </p>
              </div>
              <button
                type="button"
                onClick={onDismiss}
                className="flex-shrink-0 text-slate-400 hover:text-slate-700 transition-colors p-1"
                title="Dismiss"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Side-by-side comparison — colours and labels match the
                 RouteInfo cards in the sidebar so the user can map
                 "Your route" → the card they actually selected. */}
            <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
              <RouteCard
                role="current"
                routeLabel={current.label}
                tone={current.tone}
                durationSec={current.durationSec}
                distanceMeters={current.distanceMeters}
                avgRisk={current.avgRisk}
                incidentImpacts={current.incidentImpacts}
                showTechnicalMetrics={showTechnicalMetrics}
              />
              <div className="flex items-center justify-center text-slate-400">
                <ArrowRight className="w-5 h-5" />
              </div>
              <RouteCard
                role="alternative"
                routeLabel={alternative.label}
                tone={alternative.tone}
                durationSec={alternative.durationSec}
                distanceMeters={alternative.distanceMeters}
                avgRisk={alternative.avgRisk}
                incidentImpacts={alternative.incidentImpacts}
                showTechnicalMetrics={showTechnicalMetrics}
              />
            </div>

            {/* Trade-off summary */}
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
              <span className={`font-semibold ${timeDeltaTone}`}>
                {timeDeltaLabel}
              </span>
              <span className="text-slate-300">•</span>
              <span className={`font-semibold ${riskDeltaTone}`}>
                {riskDeltaLabel}
              </span>
              {incidentDelta > 0 && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="font-semibold text-emerald-700">
                    Avoids {incidentDelta} incident
                    {incidentDelta === 1 ? "" : "s"}
                  </span>
                </>
              )}
            </div>

            {/* Why switch */}
            <p className="mt-2 text-[12.5px] leading-snug text-slate-700">
              {whySwitch}
            </p>

            {/* CTA */}
            <div className="flex items-center gap-2 mt-3.5">
              <button
                type="button"
                onClick={onAccept}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition-all active:scale-[0.98]"
              >
                <ShieldCheck className="w-4 h-4" />
                Take safer route
              </button>
              <button
                type="button"
                onClick={onDismiss}
                className="px-4 py-2.5 rounded-xl text-[13px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Keep current
                {autoDismissAfterSec > 0 && (
                  <span className="ml-1 text-slate-400 tabular-nums">
                    ({secondsLeft}s)
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Route comparison card ─────────────── */

/** Same tone palette as the RouteInfo sidebar cards — keeps the modal
 *  visually consistent with the list the user is choosing from. */
const TONE_STYLE: Record<
  RouteTone,
  {
    ring: string;
    bg: string;
    dot: string;
    labelColor: string;
  }
> = {
  best: {
    ring: "border-emerald-400/70",
    bg: "bg-emerald-50/70",
    dot: "bg-emerald-500 shadow-emerald-400/40",
    labelColor: "text-emerald-800",
  },
  good: {
    ring: "border-lime-400/70",
    bg: "bg-lime-50/60",
    dot: "bg-lime-500 shadow-lime-400/40",
    labelColor: "text-lime-800",
  },
  neutral: {
    ring: "border-amber-300/70",
    bg: "bg-amber-50/50",
    dot: "bg-amber-400 shadow-amber-400/40",
    labelColor: "text-amber-800",
  },
  warn: {
    ring: "border-rose-300/80",
    bg: "bg-rose-50/50",
    dot: "bg-rose-500 shadow-rose-400/40",
    labelColor: "text-rose-800",
  },
};

function RouteCard({
  role,
  routeLabel,
  tone,
  durationSec,
  distanceMeters,
  avgRisk,
  incidentImpacts,
  showTechnicalMetrics,
}: {
  /** Which side of the comparison this card represents. */
  role: "current" | "alternative";
  /** The same label used in the sidebar list ("Safest Route", "Fastest
   *  Route", "Balanced Route", etc) so the user can map back. */
  routeLabel: string;
  tone: RouteTone;
  durationSec: number;
  distanceMeters: number;
  avgRisk: number;
  incidentImpacts: number;
  showTechnicalMetrics: boolean;
}) {
  const accent = TONE_STYLE[tone];
  const subLabel =
    role === "current" ? "Your current" : "Suggested switch";
  const exposureLabel = exposureFromRisk(avgRisk);

  return (
    <div
      className={`rounded-xl border ${accent.ring} ${accent.bg} p-2.5 flex flex-col gap-1`}
    >
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`w-2 h-2 rounded-full shadow-sm ${accent.dot}`} />
          <span
            className={`text-[11px] font-bold tracking-tight ${accent.labelColor} truncate`}
          >
            {routeLabel}
          </span>
        </div>
      </div>
      <div className="text-[9.5px] font-bold uppercase tracking-widest text-slate-500">
        {subLabel}
      </div>
      <div className="flex items-center gap-2.5 text-[12px] font-semibold text-slate-700">
        <span className="inline-flex items-center gap-1">
          <Clock className="w-3 h-3 text-slate-400" />
          {formatDuration(durationSec)}
        </span>
        <span className="inline-flex items-center gap-1">
          <MapIcon className="w-3 h-3 text-slate-400" />
          {formatDistance(distanceMeters)}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[10.5px]">
        <span
          className={
            showTechnicalMetrics
              ? "font-mono tabular-nums font-bold text-slate-600"
              : "font-bold text-slate-600"
          }
        >
          {showTechnicalMetrics
            ? `avgRisk ${avgRisk.toFixed(1)}`
            : exposureLabel}
        </span>
        {incidentImpacts > 0 ? (
          <span className="inline-flex items-center gap-0.5 font-bold text-rose-700">
            <AlertTriangle className="w-3 h-3" />
            {incidentImpacts} incident{incidentImpacts === 1 ? "" : "s"}
          </span>
        ) : (
          role === "alternative" && (
            <span className="inline-flex items-center gap-0.5 font-bold text-emerald-700">
              <CheckCircle2 className="w-3 h-3" />
              clear
            </span>
          )
        )}
      </div>
    </div>
  );
}

/* ─────────────── Why-switch copy ─────────────── */

function buildWhyText(args: {
  triggerType: IncidentType | null;
  cfg: ReturnType<() => (typeof INCIDENT_TYPES)[IncidentType]> | null;
  incidentDelta: number;
  riskDelta: number;
  minDelta: number;
  showTechnicalMetrics: boolean;
}): string {
  const {
    triggerType,
    cfg,
    incidentDelta,
    riskDelta,
    minDelta,
    showTechnicalMetrics,
  } = args;

  if (triggerType && cfg) {
    if (incidentDelta > 0) {
      return `Switching avoids ${cfg.shortLabel.toLowerCase()} on your current path${
        minDelta > 0 ? ` for an extra ${minDelta} min` : ""
      }${minDelta < 0 ? ` and gets you there ${Math.abs(minDelta)} min sooner` : ""}.`;
    }
    return `${cfg.shortLabel} reported on your route. The alternative ${
      riskDelta >= 0.5 ? "has lower exposure" : "stays on cleaner streets"
    }${minDelta > 0 ? ` for ${minDelta} min more` : ""}.`;
  }

  if (riskDelta >= 1) {
    return showTechnicalMetrics
      ? `Conditions shifted — the alternative is meaningfully safer (avgRisk down ${riskDelta.toFixed(1)})${minDelta > 0 ? `, costs ${minDelta} min` : ""}.`
      : `Conditions shifted — the alternative has meaningfully lower exposure${minDelta > 0 ? ` for ${minDelta} min more` : ""}.`;
  }
  if (incidentDelta > 0) {
    return `Conditions shifted — the alternative avoids ${incidentDelta} incident${incidentDelta === 1 ? "" : "s"}.`;
  }
  return "A better balance of time and exposure is now available.";
}

function exposureFromRisk(avgRisk: number): string {
  if (avgRisk <= 3.2) return "Low exposure";
  if (avgRisk <= 5.2) return "Moderate exposure";
  if (avgRisk <= 7) return "Elevated exposure";
  return "High exposure";
}

/* ─────────────── Formatters ─────────────── */

function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
