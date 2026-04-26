"use client";

import {
  ArrowRight,
  Clock,
  Map as MapIcon,
  Scale,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { getRiskColor, getRiskLabel } from "@/features/zones";
import type { RouteCategory, RouteOption, RouteTone } from "./route.types";

interface RouteInfoProps {
  routes: RouteOption[];
  onSelectRoute: (index: number) => void;
}

/* ─── Tone palette ───────────────────────────────────────────────
 * Each card's overall "good vs bad" reads through one of four tones.
 * `best` is reserved for the top pick — the visual hierarchy is
 * deliberately loud (glow + scale + emerald) so Russ' eye snaps to
 * the safest+fastest choice immediately. `warn` flips toward rose so
 * the trade-off (slower / riskier) is clear at a glance.
 */
const TONE: Record<
  RouteTone,
  {
    selectedBorder: string;
    selectedBg: string;
    selectedShadow: string;
    selectedScale: string;
    accentGradient: string;
    dot: string;
    iconColor: string;
    explanationColor: string;
    headlineColor: string;
  }
> = {
  best: {
    selectedBorder: "border-emerald-500",
    selectedBg: "bg-emerald-50/60",
    selectedShadow: "shadow-[0_10px_30px_rgba(16,185,129,0.25)]",
    selectedScale: "scale-[1.02]",
    accentGradient: "from-emerald-400/10 to-teal-500/10",
    dot: "bg-emerald-500 shadow-emerald-500/40",
    iconColor: "text-emerald-500",
    explanationColor: "text-emerald-800",
    headlineColor: "text-emerald-950",
  },
  good: {
    selectedBorder: "border-lime-500",
    selectedBg: "bg-lime-50/40",
    selectedShadow: "shadow-[0_8px_25px_rgba(132,204,22,0.18)]",
    selectedScale: "scale-[1.01]",
    accentGradient: "from-lime-400/8 to-green-500/8",
    dot: "bg-lime-500 shadow-lime-500/40",
    iconColor: "text-lime-600",
    explanationColor: "text-lime-800",
    headlineColor: "text-lime-950",
  },
  neutral: {
    selectedBorder: "border-amber-400",
    selectedBg: "bg-amber-50/40",
    selectedShadow: "shadow-[0_8px_25px_rgba(245,158,11,0.15)]",
    selectedScale: "scale-[1.01]",
    accentGradient: "from-amber-400/8 to-orange-500/8",
    dot: "bg-amber-400 shadow-amber-400/40",
    iconColor: "text-amber-500",
    explanationColor: "text-amber-800",
    headlineColor: "text-amber-950",
  },
  warn: {
    selectedBorder: "border-rose-400",
    selectedBg: "bg-rose-50/40",
    selectedShadow: "shadow-[0_8px_25px_rgba(244,63,94,0.18)]",
    selectedScale: "scale-[1.01]",
    accentGradient: "from-rose-400/8 to-orange-500/8",
    dot: "bg-rose-500 shadow-rose-500/40",
    iconColor: "text-rose-500",
    explanationColor: "text-rose-800",
    headlineColor: "text-rose-950",
  },
};

const CATEGORY_ICON: Record<RouteCategory, typeof ShieldCheck> = {
  best: Sparkles,
  safest: ShieldCheck,
  balanced: Scale,
  fastest: Zap,
  alternative: ArrowRight,
  recommended: ShieldCheck,
};

export function RouteInfo({ routes, onSelectRoute }: RouteInfoProps) {
  if (routes.length === 0) return null;

  return (
    <div className="animate-fade-in">
      <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
        <span>Route Options</span>
        <div className="h-px bg-slate-200 flex-1" />
      </h3>
      <div className="flex flex-col gap-3.5">
        {routes.map((option) => {
          const risk = option.route.averageRisk;
          const riskColor = getRiskColor(Math.round(risk));
          const riskLabel = getRiskLabel(Math.round(risk));
          const tone = TONE[option.tone];
          const Icon = CATEGORY_ICON[option.category];
          const isBest = option.category === "best";

          // The right-hand badge shows risk verdict only.
          const badgeColorClass =
            risk <= 2
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : risk <= 4
                ? "bg-lime-50 text-lime-700 border-lime-200"
                : risk <= 6
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-rose-50 text-rose-700 border-rose-200";

          return (
            <button
              key={option.id}
              onClick={() => onSelectRoute(option.id)}
              className={`relative text-left p-5 rounded-2xl cursor-pointer transition-all duration-300 border-2 overflow-hidden ${
                option.selected
                  ? `${tone.selectedBg} ${tone.selectedBorder} ${tone.selectedShadow} ${tone.selectedScale}`
                  : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/40 hover:-translate-y-[1px]"
              }`}
            >
              {option.selected && (
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${tone.accentGradient} pointer-events-none`}
                />
              )}

              {/* "Best Choice" ribbon for the top pick */}
              {isBest && (
                <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-bold uppercase tracking-widest shadow-md shadow-emerald-500/30">
                  <Sparkles className="w-2.5 h-2.5" />
                  Top pick
                </div>
              )}

              <div className="relative z-10">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3.5 h-3.5 rounded-full shadow-md ${tone.dot}`}
                    />
                    <h4
                      className={`font-bold text-[15px] ${
                        option.selected ? tone.headlineColor : "text-slate-800"
                      }`}
                    >
                      {option.label}
                    </h4>
                  </div>
                  {!isBest && (
                    <div
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wide shadow-sm ${badgeColorClass}`}
                    >
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: riskColor }}
                      />
                      {riskLabel}
                    </div>
                  )}
                </div>

                {option.description && (
                  <p
                    className={`text-[12px] mb-2 truncate ${
                      option.selected ? "text-slate-700" : "text-slate-500"
                    }`}
                  >
                    {option.description}
                  </p>
                )}

                <div className="flex items-center gap-5 text-[13px] font-semibold text-slate-500 mb-3">
                  <div className="flex items-center gap-1.5">
                    <Clock
                      className={`w-4 h-4 ${
                        option.selected ? tone.iconColor : "text-slate-400"
                      }`}
                    />
                    <span className={option.selected ? "text-slate-900" : ""}>
                      {option.route.totalDuration}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapIcon
                      className={`w-4 h-4 ${
                        option.selected ? tone.iconColor : "text-slate-400"
                      }`}
                    />
                    <span className={option.selected ? "text-slate-900" : ""}>
                      {option.route.totalDistance}
                    </span>
                  </div>
                </div>

                <div
                  className={`flex items-start gap-2 text-[12px] leading-snug ${
                    option.selected ? tone.explanationColor : "text-slate-600"
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${tone.iconColor}`}
                  />
                  <span>{option.explanation}</span>
                </div>

                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200/50 mt-3">
                  <div
                    className="h-full rounded-full transition-all duration-1000 ease-out"
                    style={{
                      width: `${Math.min(100, (risk / 10) * 100)}%`,
                      background: `linear-gradient(to right, ${riskColor}, ${riskColor})`,
                    }}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
