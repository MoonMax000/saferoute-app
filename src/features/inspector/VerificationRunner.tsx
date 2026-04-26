"use client";

import { useEffect, useRef, useState } from "react";
import { Beaker, Check, X } from "lucide-react";
import type { LatLng } from "@/shared/types";
import type { RouteOption } from "@/features/routing";
import { useInspectorStore } from "./inspector-store";
import { inspectorLog, getInspectorLog } from "./inspector-log";
import type {
  VerificationPhase,
  VerificationSummary,
} from "./inspector.types";

interface VerificationRunnerProps {
  routes: RouteOption[];
  simulating: boolean;
  startSim: () => void;
  stopSim: () => void;
  addIncident: (input: {
    type: "robbery" | "police" | "blockage";
    center: LatLng;
  }) => unknown;
  nightMode: boolean;
  setNightMode: (v: boolean) => void;
}

/**
 * One-click "verification scenario" — drives the entire engine through
 * its paces while logging every step:
 *   1. Start the demo drive on the currently-selected route
 *   2. At t+8s: drop a Robbery on the route midpoint
 *   3. At t+16s: flip Night mode on (if it was off)
 *   4. At t+30s: stop, capture summary, surface a result panel
 *
 * The whole flow is timer-based (not sim-progress based) so it stays
 * predictable even if the user fiddles with sliders mid-run.
 */
export function VerificationRunner({
  routes,
  simulating,
  startSim,
  stopSim,
  addIncident,
  nightMode,
  setNightMode,
}: VerificationRunnerProps) {
  const enabled = useInspectorStore((s) => s.enabled);
  const [phase, setPhase] = useState<VerificationPhase>("idle");
  const [summary, setSummary] = useState<VerificationSummary | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Snapshot taken at start so the summary modal can quote before/after.
  const preStateRef = useRef<{
    preAvg: number | null;
    preSelectedId: number | null;
    preNight: boolean;
    preLogCount: number;
  } | null>(null);

  // Live ref to current routes so timer callbacks see the latest path.
  const routesRef = useRef(routes);
  useEffect(() => {
    routesRef.current = routes;
  }, [routes]);

  const clearTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  };

  // Cleanup timers on unmount (e.g. parent navigates away).
  useEffect(() => {
    return () => clearTimers();
  }, []);

  const start = () => {
    const selected = routesRef.current.find((r) => r.selected);
    if (!selected || routesRef.current.length === 0) {
      inspectorLog(
        "warn",
        "verification: no routes selected — search a route first",
      );
      return;
    }

    clearTimers();
    setSummary(null);
    setPhase("starting");

    preStateRef.current = {
      preAvg: selected.route.averageRisk,
      preSelectedId: selected.id,
      preNight: nightMode,
      preLogCount: getInspectorLog().length,
    };

    inspectorLog("event", "🧪 VERIFICATION SCENARIO STARTED", {
      preAvg: selected.route.averageRisk,
      preCategory: selected.category,
      preNight: nightMode,
      candidates: routesRef.current.length,
    });

    // t+0 — fire up the sim
    timersRef.current.push(
      setTimeout(() => {
        startSim();
        setPhase("driving");
        inspectorLog("event", "verification: simulation started");
      }, 200),
    );

    // t+8s — drop robbery on the locked route midpoint
    timersRef.current.push(
      setTimeout(() => {
        const cur =
          routesRef.current.find((r) => r.selected) ?? routesRef.current[0];
        const path = cur?.route.polylinePath;
        if (!path || path.length < 4) {
          inspectorLog("warn", "verification: route path too short to spawn incident");
          return;
        }
        const at = path[Math.floor(path.length * 0.4)];
        addIncident({ type: "robbery", center: at });
        setPhase("incident-placed");
        inspectorLog("event", "verification: robbery placed @ 40% of route", {
          coords: { lat: Number(at.lat.toFixed(5)), lng: Number(at.lng.toFixed(5)) },
        });
      }, 8000),
    );

    // t+16s — toggle Night so Russ sees the multiplier kick in
    timersRef.current.push(
      setTimeout(() => {
        if (!nightMode) {
          setNightMode(true);
          inspectorLog("event", "verification: Night mode ON — multipliers applied");
        } else {
          setNightMode(false);
          inspectorLog("event", "verification: Night mode OFF — re-running daytime calcs");
        }
        setPhase("night-toggled");
      }, 16000),
    );

    // t+30s — wrap up + build summary
    timersRef.current.push(
      setTimeout(() => {
        setPhase("completing");

        const cur =
          routesRef.current.find((r) => r.selected) ?? routesRef.current[0];
        const log = getInspectorLog();
        const pre = preStateRef.current;

        const newEntries = pre
          ? log.slice(pre.preLogCount)
          : log;
        const recalcs = newEntries.filter(
          (e) => e.level === "calc" && e.msg.startsWith("rankRoutes"),
        ).length;
        const alertsFired = newEntries.filter(
          (e) =>
            e.level === "event" &&
            (e.msg.includes("verification:") || e.msg.includes("incident")),
        ).length;
        const rerouteSwitched = pre
          ? cur?.id !== pre.preSelectedId
          : false;

        const built: VerificationSummary = {
          startedAt: pre ? Date.now() - 30000 : Date.now(),
          endedAt: Date.now(),
          recalcs,
          alertsFired,
          toastsFired: 0,
          beforeAvgRisk: pre?.preAvg ?? null,
          afterAvgRisk: cur?.route.averageRisk ?? null,
          rerouteSwitched: !!rerouteSwitched,
        };
        setSummary(built);
        setPhase("done");
        inspectorLog("event", "🧪 VERIFICATION COMPLETE", {
          recalcs: built.recalcs,
          rerouteSwitched: built.rerouteSwitched,
          beforeAvg: built.beforeAvgRisk?.toFixed(2),
          afterAvg: built.afterAvgRisk?.toFixed(2),
        });

        // Stop the simulation gracefully.
        if (simulating) stopSim();
      }, 30000),
    );
  };

  const cancel = () => {
    clearTimers();
    inspectorLog("event", "verification: cancelled by user");
    setPhase("idle");
    if (simulating) stopSim();
  };

  if (!enabled) return null;

  const running = phase !== "idle" && phase !== "done";
  const phaseLabel: Record<VerificationPhase, string> = {
    idle: "Run verification (30s)",
    starting: "Starting…",
    driving: "Driving — placing incident in 8s…",
    "incident-placed": "Robbery placed — toggling night in 8s…",
    "night-toggled": "Night ON — collecting result…",
    completing: "Wrapping up…",
    done: "Run verification again",
  };

  return (
    <>
      {/* Floating Run button — sits to the left of the InspectorToggle so
          it doesn't collide with the right-stacked panels. */}
      <div className="absolute top-4 right-[155px] z-30">
        {!running ? (
          <button
            type="button"
            onClick={start}
            disabled={routes.length === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500 text-white shadow-lg shadow-violet-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            title="Auto-runs a 30-second scenario that drives the engine through every code path while logging each step"
          >
            <Beaker className="w-3.5 h-3.5" />
            {phaseLabel[phase]}
          </button>
        ) : (
          <button
            type="button"
            onClick={cancel}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-lg ring-2 ring-amber-400/40 transition-all"
          >
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            {phaseLabel[phase]}
            <X className="w-3.5 h-3.5 ml-1" />
          </button>
        )}
      </div>

      {/* Summary card — centred modal style after completion. */}
      {summary && phase === "done" && (
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 z-40 w-[360px] rounded-2xl bg-slate-900/97 backdrop-blur-md text-slate-100 shadow-2xl border border-violet-500/40 overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-fuchsia-700/40 to-violet-700/40 border-b border-violet-500/30">
            <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-violet-100">
              <Check className="w-3.5 h-3.5" />
              Verification result
            </span>
            <button
              type="button"
              onClick={() => setSummary(null)}
              className="text-violet-200 hover:text-white p-1 -m-1 rounded transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="px-4 py-3 space-y-2 text-[11px] font-mono">
            <SummaryRow
              k="Re-calculations"
              v={String(summary.recalcs)}
            />
            <SummaryRow
              k="Inspector events"
              v={String(summary.alertsFired)}
            />
            <SummaryRow
              k="avgRisk before"
              v={
                summary.beforeAvgRisk !== null
                  ? summary.beforeAvgRisk.toFixed(2)
                  : "—"
              }
            />
            <SummaryRow
              k="avgRisk after"
              v={
                summary.afterAvgRisk !== null
                  ? summary.afterAvgRisk.toFixed(2)
                  : "—"
              }
              accent="violet"
            />
            <SummaryRow
              k="Reroute swap"
              v={summary.rerouteSwitched ? "yes — switched safer" : "no"}
              accent={summary.rerouteSwitched ? "emerald" : undefined}
            />
            <div className="pt-2 mt-2 border-t border-slate-700 text-[10px] text-slate-400 leading-relaxed">
              All numbers came from real engine calls. See the Engine Log
              below for the full sequence.
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SummaryRow({
  k,
  v,
  accent,
}: {
  k: string;
  v: string;
  accent?: "violet" | "emerald";
}) {
  const colorClass =
    accent === "violet"
      ? "text-violet-300"
      : accent === "emerald"
        ? "text-emerald-300"
        : "text-slate-100";
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-400">{k}</span>
      <span className={`font-bold tabular-nums ${colorClass}`}>{v}</span>
    </div>
  );
}
