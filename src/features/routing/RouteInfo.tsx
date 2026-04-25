"use client";

import { Clock, Map as MapIcon, ShieldCheck, Zap, Scale } from "lucide-react";
import { getRiskColor, getRiskLabel } from "@/features/zones";
import type { RouteCategory, RouteOption } from "./route.types";

interface RouteInfoProps {
  routes: RouteOption[];
  onSelectRoute: (index: number) => void;
}

const CATEGORY_DOT: Record<RouteCategory, string> = {
  safest: "bg-emerald-500 shadow-emerald-500/40",
  balanced: "bg-amber-400 shadow-amber-400/40",
  fastest: "bg-rose-500 shadow-rose-500/40",
  recommended: "bg-indigo-500 shadow-indigo-500/40",
};

const CATEGORY_ICON: Record<RouteCategory, typeof ShieldCheck> = {
  safest: ShieldCheck,
  balanced: Scale,
  fastest: Zap,
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
          const dotColorClass = CATEGORY_DOT[option.category];
          const Icon = CATEGORY_ICON[option.category];

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
                  ? "bg-indigo-50/40 border-indigo-500 shadow-[0_8px_25px_rgba(79,70,229,0.15)] scale-[1.01]"
                  : "bg-white border-slate-200 hover:border-indigo-300 hover:shadow-lg hover:shadow-slate-200/50 hover:-translate-y-[1px]"
              }`}
            >
              {option.selected && (
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 pointer-events-none" />
              )}

              <div className="relative z-10">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3.5 h-3.5 rounded-full shadow-md ${dotColorClass}`}
                    />
                    <h4
                      className={`font-bold text-[15px] ${
                        option.selected
                          ? "text-indigo-950"
                          : "text-slate-800"
                      }`}
                    >
                      {option.label}
                    </h4>
                  </div>
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wide shadow-sm ${badgeColorClass}`}
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: riskColor }}
                    />
                    {riskLabel}
                  </div>
                </div>

                {option.description && (
                  <p
                    className={`text-[12px] mb-2 truncate ${
                      option.selected ? "text-indigo-700" : "text-slate-500"
                    }`}
                  >
                    {option.description}
                  </p>
                )}

                <div className="flex items-center gap-5 text-[13px] font-semibold text-slate-500 mb-3">
                  <div className="flex items-center gap-1.5">
                    <Clock
                      className={`w-4 h-4 ${
                        option.selected
                          ? "text-indigo-500"
                          : "text-slate-400"
                      }`}
                    />
                    <span
                      className={option.selected ? "text-indigo-900" : ""}
                    >
                      {option.route.totalDuration}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapIcon
                      className={`w-4 h-4 ${
                        option.selected
                          ? "text-indigo-500"
                          : "text-slate-400"
                      }`}
                    />
                    <span
                      className={option.selected ? "text-indigo-900" : ""}
                    >
                      {option.route.totalDistance}
                    </span>
                  </div>
                </div>

                <div
                  className={`flex items-start gap-2 text-[12px] leading-snug ${
                    option.selected ? "text-indigo-800" : "text-slate-600"
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
                      option.category === "safest"
                        ? "text-emerald-500"
                        : option.category === "fastest"
                          ? "text-rose-500"
                          : option.category === "balanced"
                            ? "text-amber-500"
                            : "text-indigo-500"
                    }`}
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
