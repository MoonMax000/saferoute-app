"use client";

import { Shield, AlertTriangle, Moon, Sun } from "lucide-react";
import type { DestinationRisk, DestinationRiskState } from "./risk.types";

interface Props {
  risk: DestinationRisk | null;
  /** Currently selected time context — drives the icon. */
  time: "day" | "night";
}

const TONE: Record<
  DestinationRiskState,
  { container: string; iconWrap: string; title: string; muted: string }
> = {
  normal: {
    container:
      "from-emerald-50 to-green-50 border-emerald-200",
    iconWrap: "bg-emerald-100 text-emerald-700",
    title: "text-emerald-800",
    muted: "text-emerald-700/80",
  },
  caution: {
    container: "from-amber-50 to-yellow-50 border-amber-200",
    iconWrap: "bg-amber-100 text-amber-700",
    title: "text-amber-800",
    muted: "text-amber-700/80",
  },
  elevated: {
    container: "from-orange-50 to-rose-50 border-rose-200",
    iconWrap: "bg-rose-100 text-rose-700",
    title: "text-rose-800",
    muted: "text-rose-700/80",
  },
  "elevated-night": {
    container: "from-indigo-50 to-violet-50 border-indigo-200",
    iconWrap: "bg-indigo-100 text-indigo-700",
    title: "text-indigo-800",
    muted: "text-indigo-700/80",
  },
};

export function DestinationWarning({ risk, time }: Props) {
  if (!risk) return null;
  const tone = TONE[risk.state];
  const Icon =
    risk.state === "normal"
      ? Shield
      : risk.state === "elevated-night"
        ? time === "night"
          ? Moon
          : Sun
        : AlertTriangle;

  return (
    <div
      className={`animate-fade-in rounded-2xl border bg-gradient-to-r ${tone.container} p-4 flex gap-3.5 shadow-sm`}
    >
      <div
        className={`flex-shrink-0 w-9 h-9 rounded-xl ${tone.iconWrap} flex items-center justify-center`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex flex-col gap-1 min-w-0">
        <h4
          className={`text-[11px] font-bold uppercase tracking-widest ${tone.title}`}
        >
          Destination check
        </h4>
        <p className={`text-[14px] font-semibold leading-snug ${tone.title}`}>
          {risk.primaryReason}
        </p>
        {risk.secondaryReason && (
          <p className={`text-[12px] leading-snug ${tone.muted}`}>
            {risk.secondaryReason}
          </p>
        )}
        {risk.affectedCellLabels.length > 0 && risk.state !== "normal" && (
          <p className={`text-[11px] mt-0.5 ${tone.muted}`}>
            Near: {risk.affectedCellLabels.slice(0, 2).join(" • ")}
          </p>
        )}
      </div>
    </div>
  );
}
