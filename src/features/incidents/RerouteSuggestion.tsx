"use client";

import { ShieldCheck, X } from "lucide-react";

interface RerouteSuggestionProps {
  /** Label for the safer route candidate (e.g. "Safest Route"). */
  alternativeLabel: string;
  /** Minutes added vs. the currently selected route. Positive = slower. */
  minutesAdded: number;
  /** Reason text — short, human. */
  reason: string;
  onAccept: () => void;
  onDismiss: () => void;
}

export function RerouteSuggestion({
  alternativeLabel,
  minutesAdded,
  reason,
  onAccept,
  onDismiss,
}: RerouteSuggestionProps) {
  return (
    <div className="animate-fade-in rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50/70 p-4 flex gap-3.5 shadow-sm">
      <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
        <ShieldCheck className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-[11px] font-bold uppercase tracking-widest text-emerald-800">
          Safer route available
        </h4>
        <p className="text-[14px] font-semibold leading-snug text-emerald-900 mt-1">
          Switch to {alternativeLabel}
          {minutesAdded > 0 && (
            <span className="text-emerald-700 font-medium">
              {" "}
              (+{minutesAdded} min)
            </span>
          )}
        </p>
        <p className="text-[12px] text-emerald-700/90 leading-snug mt-0.5">
          {reason}
        </p>
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={onAccept}
            className="text-[12px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors px-3 py-1.5 rounded-lg shadow-sm"
          >
            Switch route
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="text-[12px] font-semibold text-emerald-800/70 hover:text-emerald-900 transition-colors px-2 py-1.5 rounded-lg flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
