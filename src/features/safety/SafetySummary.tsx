"use client";

import { ShieldCheck } from "lucide-react";
import { getRiskColor } from "@/features/zones";
import type { RouteOption } from "@/features/routing";

interface SafetySummaryProps {
  routes: RouteOption[];
}

export function SafetySummary({ routes }: SafetySummaryProps) {
  const selected = routes.find((r) => r.selected);
  if (!selected) return null;

  const segments = selected.route.segments;
  const total = segments.length;
  if (total === 0) return null;

  const safe = segments.filter((s) => s.riskScore <= 2).length;
  const low = segments.filter((s) => s.riskScore > 2 && s.riskScore <= 4).length;
  const moderate = segments.filter((s) => s.riskScore > 4 && s.riskScore <= 6).length;
  const high = segments.filter((s) => s.riskScore > 6).length;

  const safePercent = Math.round(((safe + low) / total) * 100);

  const categories = [
    { label: "Very Safe", count: safe, color: getRiskColor(1) },
    { label: "Safe", count: low, color: getRiskColor(3) },
    { label: "Moderate", count: moderate, color: getRiskColor(5) },
    { label: "High Risk", count: high, color: getRiskColor(8) },
  ].filter((c) => c.count > 0);

  return (
    <div className="animate-fade-in">
      <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
        <span>Safety Analysis</span>
        <div className="h-px bg-slate-200 flex-1" />
      </h3>

      <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-5">
          <div className="relative w-20 h-20 flex-shrink-0">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle
                cx="18"
                cy="18"
                r="15.9"
                fill="none"
                stroke="#f1f5f9"
                strokeWidth="3.5"
              />
              {(() => {
                let offset = 0;
                return categories.map((cat) => {
                  const pct = (cat.count / total) * 100;
                  const el = (
                    <circle
                      key={cat.label}
                      cx="18"
                      cy="18"
                      r="15.9"
                      fill="none"
                      stroke={cat.color}
                      strokeWidth="3.5"
                      strokeDasharray={`${pct} ${100 - pct}`}
                      strokeDashoffset={-offset}
                      strokeLinecap="round"
                    />
                  );
                  offset += pct;
                  return el;
                });
              })()}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-black text-slate-800">
                {safePercent}%
              </span>
            </div>
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span className="text-[14px] font-bold text-slate-800">
                {safePercent >= 80
                  ? "Very Safe Route"
                  : safePercent >= 60
                  ? "Mostly Safe Route"
                  : safePercent >= 40
                  ? "Mixed Safety Route"
                  : "Caution Advised"}
              </span>
            </div>
            <p className="text-[12px] text-slate-500 leading-relaxed">
              {safePercent}% of this route passes through safe areas
            </p>
          </div>
        </div>

        <div className="mt-4 flex rounded-full overflow-hidden h-2.5 shadow-inner border border-slate-200/50">
          {categories.map((cat) => (
            <div
              key={cat.label}
              className="h-full transition-all duration-700"
              style={{
                width: `${(cat.count / total) * 100}%`,
                backgroundColor: cat.color,
              }}
            />
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {categories.map((cat) => (
            <div key={cat.label} className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: cat.color }}
              />
              <span className="text-[11px] text-slate-500 font-medium">
                {cat.label} ({Math.round((cat.count / total) * 100)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
