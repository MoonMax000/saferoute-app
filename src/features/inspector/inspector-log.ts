/**
 * Module-level ring-buffer log. Lives outside React state so high-frequency
 * pushes (during a slider drag, simulation tick, scenario run) don't cause
 * re-render storms across every panel.
 *
 * Subscribers are notified on every push; consumers should batch their own
 * re-renders via requestAnimationFrame if needed.
 */
import type {
  InspectorLogEntry,
  InspectorLogLevel,
} from "./inspector.types";

const RING_SIZE = 500;
const buf: InspectorLogEntry[] = [];
let nextId = 1;

type Listener = () => void;
const listeners = new Set<Listener>();

export function inspectorLog(
  level: InspectorLogLevel,
  msg: string,
  data?: Record<string, unknown>,
): void {
  const entry: InspectorLogEntry = {
    id: nextId++,
    ts: Date.now(),
    level,
    msg,
    data,
  };
  buf.push(entry);
  if (buf.length > RING_SIZE) buf.shift();
  for (const l of listeners) l();
}

export function clearInspectorLog(): void {
  buf.length = 0;
  for (const l of listeners) l();
}

export function getInspectorLog(): InspectorLogEntry[] {
  return buf;
}

export function subscribeInspectorLog(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Stable formatter for numeric data printed in the log lines. */
export function fmtNum(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return String(n);
  return n.toFixed(digits);
}
