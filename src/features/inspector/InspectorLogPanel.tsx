"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Terminal, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useInspectorStore } from "./inspector-store";
import {
  getInspectorLog,
  subscribeInspectorLog,
  clearInspectorLog,
} from "./inspector-log";
import type { InspectorLogEntry, InspectorLogLevel } from "./inspector.types";

interface InspectorLogPanelProps {
  /** Pixels to offset from the bottom — useful when other UI overlays the foot. */
  bottomOffsetPx?: number;
}

/**
 * Bottom-anchored terminal-style log drawer. Subscribes to the module-level
 * log buffer; updates batched at most once per animation frame so a slider
 * drag firing 60 events/sec won't trash performance.
 */
export function InspectorLogPanel({
  bottomOffsetPx = 0,
}: InspectorLogPanelProps) {
  const enabled = useInspectorStore((s) => s.enabled);
  const open = useInspectorStore((s) => s.panelLayout.log);
  const togglePanel = useInspectorStore((s) => s.togglePanel);

  const [, setTick] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let raf: number | null = null;
    const update = () => {
      if (raf !== null) return;
      raf = requestAnimationFrame(() => {
        setTick((t) => t + 1);
        raf = null;
      });
    };
    const unsub = subscribeInspectorLog(update);
    return () => {
      unsub();
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, []);

  // Auto-scroll to bottom whenever log grows (or panel opens).
  useLayoutEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  });

  if (!enabled) return null;

  const entries = getInspectorLog();

  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none"
      style={{ bottom: bottomOffsetPx }}
    >
      <div className="mx-4 mb-4 rounded-2xl bg-slate-950/95 backdrop-blur-md text-slate-100 shadow-2xl border border-slate-800/80 overflow-hidden pointer-events-auto">
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 border-b border-slate-800/80">
          <button
            type="button"
            onClick={() => togglePanel("log")}
            className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-emerald-300 hover:text-emerald-200 transition-colors"
          >
            <Terminal className="w-3.5 h-3.5" />
            Engine Log
            <span className="text-slate-500 font-mono normal-case">
              ({entries.length})
            </span>
            {open ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              clearInspectorLog();
            }}
            className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 hover:text-rose-300 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Clear
          </button>
        </div>

        {open && (
          <div
            ref={listRef}
            className="max-h-[200px] min-h-[120px] overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed"
          >
            {entries.length === 0 ? (
              <div className="text-slate-500 italic">
                No events yet. Place an incident, change a slider, or run the
                verification scenario to see the engine log fill up.
              </div>
            ) : (
              entries.map((e) => <LogRow key={e.id} entry={e} />)
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────── Log row ─────────── */

const LEVEL_COLORS: Record<InspectorLogLevel, string> = {
  info: "text-slate-400",
  calc: "text-emerald-400",
  event: "text-amber-400",
  warn: "text-rose-400",
};

function LogRow({ entry }: { entry: InspectorLogEntry }) {
  const ts = new Date(entry.ts);
  const stamp = `${pad(ts.getHours())}:${pad(ts.getMinutes())}:${pad(ts.getSeconds())}.${pad(ts.getMilliseconds(), 3)}`;
  const colour = LEVEL_COLORS[entry.level];
  const dataPreview = entry.data ? formatData(entry.data) : null;
  return (
    <div className="flex gap-2 hover:bg-white/5 rounded px-1">
      <span className="text-slate-600 select-none shrink-0">{stamp}</span>
      <span className={`${colour} font-bold shrink-0 uppercase w-[42px]`}>
        {entry.level}
      </span>
      <span className="text-slate-200 break-all">
        {entry.msg}
        {dataPreview && (
          <span className="text-slate-500 ml-2">{dataPreview}</span>
        )}
      </span>
    </div>
  );
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

function formatData(data: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    let display: string;
    if (typeof v === "number") display = String(v);
    else if (Array.isArray(v)) display = `[${v.join(", ")}]`;
    else if (v && typeof v === "object")
      display = JSON.stringify(v).replace(/"/g, "");
    else display = String(v);
    if (display.length > 80) display = display.slice(0, 77) + "…";
    parts.push(`${k}=${display}`);
  }
  return `• ${parts.join(" • ")}`;
}
