import type { FormulaBreakdown } from "./inspector.types";

/**
 * Renders the click-anywhere formula breakdown as an HTML string suitable
 * for a Google Maps `InfoWindow`. Plain HTML (not React) so the map's
 * existing InfoWindow lifecycle handles open/close without re-rendering
 * the polygon overlay layer.
 *
 * Inline styles only — the InfoWindow content is shadow-DOM-isolated, so
 * Tailwind classes from the host page wouldn't apply.
 */
export function renderFormulaBreakdownHtml(b: FormulaBreakdown): string {
  const verdictColors: Record<FormulaBreakdown["verdict"], string> = {
    normal: "#10b981",
    caution: "#f59e0b",
    elevated: "#f97316",
    "elevated-night": "#a855f7",
  };
  const verdictColor = verdictColors[b.verdict];

  const verdictDot = `<span style="display:inline-block;width:10px;height:10px;border-radius:9999px;background:${verdictColor};margin-right:6px;"></span>`;

  const coordLine = `${b.point.lat.toFixed(4)}, ${b.point.lng.toFixed(4)}`;

  const cellRows = b.topCells.length
    ? b.topCells
        .map((c) => {
          const bar = renderBar(c.effectiveRisk);
          const distLabel =
            c.distanceM < 1000
              ? `${Math.round(c.distanceM)} m`
              : `${(c.distanceM / 1000).toFixed(1)} km`;
          const inside = c.contains
            ? `<span style="color:#a855f7;font-size:9px;font-weight:700;margin-left:4px;">INSIDE</span>`
            : "";
          return `
          <div style="display:flex;align-items:center;gap:8px;font-size:11px;line-height:1.4;margin-bottom:2px;">
            ${bar}
            <span style="flex:1;color:#cbd5e1;">${escapeHtml(c.label)}${inside}</span>
            <span style="color:#94a3b8;">${distLabel}</span>
            <span style="color:#f1f5f9;font-weight:700;font-family:ui-monospace,monospace;">
              ${c.effectiveRisk.toFixed(2)}
            </span>
          </div>`;
        })
        .join("")
    : `<div style="color:#94a3b8;font-size:11px;font-style:italic;">No cell influence at this point</div>`;

  const nightLine = b.time === "night"
    ? `<div style="display:flex;justify-content:space-between;font-size:11px;line-height:1.6;color:#cbd5e1;font-family:ui-monospace,monospace;">
         <span>× Night multiplier</span>
         <span style="color:#a855f7;font-weight:700;">${b.nightAppliedRisk.toFixed(2)}</span>
       </div>`
    : `<div style="display:flex;justify-content:space-between;font-size:11px;line-height:1.6;color:#94a3b8;font-family:ui-monospace,monospace;">
         <span>× Night multiplier</span>
         <span>(day — ×1.0)</span>
       </div>`;

  return `
  <div style="font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#f1f5f9;padding:14px 16px;border-radius:12px;width:300px;border:1px solid #334155;">
    <div style="font-size:9.5px;font-weight:800;letter-spacing:0.12em;color:#a78bfa;text-transform:uppercase;margin-bottom:6px;">
      Risk at this point
    </div>
    <div style="font-size:11px;font-family:ui-monospace,monospace;color:#94a3b8;margin-bottom:12px;">${coordLine}</div>

    <div style="font-size:9.5px;font-weight:700;letter-spacing:0.12em;color:#94a3b8;text-transform:uppercase;margin-bottom:6px;">
      Top influencing cells
    </div>
    <div style="margin-bottom:12px;">${cellRows}</div>

    <div style="font-size:9.5px;font-weight:700;letter-spacing:0.12em;color:#94a3b8;text-transform:uppercase;margin-bottom:6px;">
      Calculation
    </div>
    <div style="display:flex;justify-content:space-between;font-size:11px;line-height:1.6;color:#cbd5e1;font-family:ui-monospace,monospace;">
      <span>Interpolated base (day)</span>
      <span style="font-weight:700;">${b.interpolatedBase.toFixed(2)}</span>
    </div>
    ${nightLine}
    <div style="display:flex;justify-content:space-between;font-size:11px;line-height:1.6;color:#cbd5e1;font-family:ui-monospace,monospace;">
      <span>+ Incident boost</span>
      <span style="font-weight:700;color:${b.incidentBoost > 0 ? "#fbbf24" : "#94a3b8"};">${b.incidentBoost.toFixed(2)}</span>
    </div>
    <div style="height:1px;background:#334155;margin:6px 0;"></div>
    <div style="display:flex;justify-content:space-between;font-size:13px;line-height:1.4;color:#f1f5f9;font-family:ui-monospace,monospace;">
      <span style="font-weight:700;">Final risk</span>
      <span style="font-weight:800;color:${verdictColor};">${b.finalRisk.toFixed(2)}</span>
    </div>

    <div style="margin-top:10px;padding-top:10px;border-top:1px solid #334155;display:flex;align-items:center;font-size:11px;color:#cbd5e1;">
      ${verdictDot}<span>Verdict: <strong style="color:${verdictColor};text-transform:uppercase;letter-spacing:0.04em;">${b.verdict}</strong></span>
    </div>
  </div>`;
}

/* ────── helpers ────── */

function renderBar(value: number): string {
  // 0–10 scale → 3 chunks (light/med/full).
  const filled = Math.max(0, Math.min(3, Math.round((value / 10) * 3)));
  const blocks = ["▓", "▓", "▓"]
    .map((b, i) =>
      i < filled
        ? `<span style="color:${value > 6 ? "#f97316" : value > 3 ? "#fbbf24" : "#10b981"};">${b}</span>`
        : `<span style="color:#334155;">${b}</span>`,
    )
    .join("");
  return `<span style="font-family:ui-monospace,monospace;font-size:11px;letter-spacing:-2px;">${blocks}</span>`;
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
