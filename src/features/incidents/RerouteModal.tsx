"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ShieldCheck, X } from "lucide-react";
import type { IncidentType } from "./incidents.types";
import { INCIDENT_TYPES } from "./incidents-config";

interface RerouteModalProps {
  /** Show/hide. Parent decides when to mount (e.g. only during active trip / sim). */
  open: boolean;
  /** Type of the incident that triggered the modal. Drives icon + tone. */
  triggerType?: IncidentType;
  /** Label for the safer route (e.g. "Balanced Route"). */
  alternativeLabel: string;
  /** Minutes added vs. the currently selected route. */
  minutesAdded: number;
  /** Short reason (one line). */
  reason: string;
  /** Auto-dismiss countdown in seconds. 0 = no countdown. */
  autoDismissAfterSec?: number;
  onAccept: () => void;
  onDismiss: () => void;
}

export function RerouteModal({
  open,
  triggerType = "blockage",
  alternativeLabel,
  minutesAdded,
  reason,
  autoDismissAfterSec = 8,
  onAccept,
  onDismiss,
}: RerouteModalProps) {
  // Parent is expected to remount this component (via a fresh `key`)
  // for each new suggestion, so the countdown naturally resets without
  // needing a setState-in-effect to reset it.
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

  const cfg = INCIDENT_TYPES[triggerType];

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-32 z-40 flex justify-center px-4 animate-fade-in">
      <div
        role="alertdialog"
        aria-live="assertive"
        className="pointer-events-auto w-[min(92vw,520px)] rounded-2xl bg-white border border-rose-200 shadow-[0_25px_60px_rgba(0,0,0,0.25)] overflow-hidden"
      >
        <div className="flex items-stretch">
          {/* Side accent */}
          <div
            className="w-2 flex-shrink-0"
            style={{ backgroundColor: cfg.stroke }}
            aria-hidden
          />

          <div className="flex-1 p-4 pr-3">
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${cfg.stroke}20` }}
              >
                <AlertTriangle
                  className="w-5 h-5 animate-pulse"
                  style={{ color: cfg.stroke }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-rose-700">
                  Incident on your route
                </h4>
                <p className="text-[15px] font-bold leading-snug text-slate-900 mt-0.5">
                  Switch to {alternativeLabel}
                  {minutesAdded > 0 && (
                    <span className="text-rose-700 font-medium">
                      {" "}
                      (+{minutesAdded} min)
                    </span>
                  )}
                </p>
                <p className="text-[12px] text-slate-600 leading-snug mt-1">
                  {reason}
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

            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={onAccept}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all active:scale-[0.98]"
              >
                <ShieldCheck className="w-4 h-4" />
                Switch route
              </button>
              <button
                type="button"
                onClick={onDismiss}
                className="px-4 py-2.5 rounded-xl text-[13px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Stay
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
