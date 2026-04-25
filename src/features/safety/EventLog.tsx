"use client";

import { useRef, useEffect } from "react";
import { ScrollText, Trash2 } from "lucide-react";
import { getRiskColor } from "@/features/zones";
import type { EventLogEntry } from "./event-log.types";

interface EventLogProps {
  entries: EventLogEntry[];
  onClear: () => void;
}

export function EventLog({ entries, onClear }: EventLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  if (entries.length === 0) return null;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <ScrollText className="w-3.5 h-3.5" />
          <span>Event Log</span>
          <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {entries.length}
          </span>
        </h3>
        <button
          onClick={onClear}
          className="text-slate-400 hover:text-red-500 transition-colors p-1"
          title="Clear log"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden max-h-48 overflow-y-auto custom-scrollbar"
      >
        <div className="p-3 font-mono text-[11px] leading-relaxed space-y-0.5">
          {entries.map((entry) => {
            const color = getRiskColor(entry.riskLevel);
            const typeLabel =
              entry.type === "enter"
                ? "ENTER"
                : entry.type === "exit"
                ? "EXIT "
                : "INFO ";
            const typeColor =
              entry.type === "enter"
                ? "text-red-400"
                : entry.type === "exit"
                ? "text-emerald-400"
                : "text-blue-400";

            return (
              <div key={entry.id} className="flex gap-2 items-start">
                <span className="text-slate-500 flex-shrink-0">
                  {entry.timestamp}
                </span>
                <span className={`font-bold flex-shrink-0 ${typeColor}`}>
                  {typeLabel}
                </span>
                <span className="text-slate-300 truncate">
                  {entry.zone}
                </span>
                {entry.type !== "info" && (
                  <span
                    className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide"
                    style={{
                      color,
                      backgroundColor: `${color}20`,
                    }}
                  >
                    {entry.riskLevel <= 3
                      ? "calm"
                      : entry.riskLevel <= 5
                        ? "caution"
                        : entry.riskLevel <= 7
                          ? "elevated"
                          : "high"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
