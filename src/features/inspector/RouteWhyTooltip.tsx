"use client";

import type { RouteOption } from "@/features/routing";

/**
 * Per-route reasoning block. Surfaces the same numbers the ranker used
 * to decide Safest/Balanced/Fastest, so the labels stop being a black
 * box.
 *
 * Designed to drop into the Inspector debug panel as an expandable
 * section — not a tooltip on the route card itself, because the card
 * lives in the left sidebar and the inspector lives in the map area.
 */
export function RouteWhyList({
  routes,
}: {
  routes: RouteOption[];
}) {
  if (routes.length === 0) return null;

  // Lookup the safest + fastest for delta phrasing.
  const safest = routes.reduce(
    (acc, r) => (acc === null || r.route.averageRisk < acc.route.averageRisk ? r : acc),
    null as RouteOption | null,
  );
  const fastest = routes.reduce(
    (acc, r) => (acc === null || r.durationSeconds < acc.durationSeconds ? r : acc),
    null as RouteOption | null,
  );

  return (
    <div className="space-y-2">
      {routes.map((route) => (
        <RouteWhyRow
          key={route.id}
          route={route}
          safest={safest}
          fastest={fastest}
        />
      ))}
    </div>
  );
}

function RouteWhyRow({
  route,
  safest,
  fastest,
}: {
  route: RouteOption;
  safest: RouteOption | null;
  fastest: RouteOption | null;
}) {
  const reasons = buildReasons(route, safest, fastest);
  const accent =
    route.category === "safest"
      ? "border-emerald-500/40 bg-emerald-900/10"
      : route.category === "fastest"
        ? "border-amber-500/40 bg-amber-900/10"
        : "border-slate-600/40 bg-slate-800/40";

  return (
    <div
      className={`rounded-lg border ${accent} p-2 text-[11px] space-y-1`}
    >
      <div className="flex items-center justify-between">
        <span className="font-bold text-slate-100 uppercase tracking-wider text-[10px]">
          {route.label}
        </span>
        {route.selected && (
          <span className="text-[8px] font-bold text-violet-300 uppercase tracking-widest">
            ▸ Selected
          </span>
        )}
      </div>
      <ul className="text-slate-300 space-y-0.5">
        {reasons.map((r, i) => (
          <li key={i} className="flex items-start gap-1.5">
            <span className="text-slate-500 mt-px">•</span>
            <span>{r}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function buildReasons(
  route: RouteOption,
  safest: RouteOption | null,
  fastest: RouteOption | null,
): string[] {
  const out: string[] = [];

  out.push(
    `avgRisk ${route.route.averageRisk.toFixed(2)} • highRiskFrac ${Math.round(route.highRiskFraction * 100)}%`,
  );
  out.push(
    `${route.incidentImpacts} incident impact${route.incidentImpacts === 1 ? "" : "s"} • ${Math.round(route.durationSeconds / 60)} min`,
  );

  if (route.category === "safest" && fastest && fastest !== route) {
    const riskDelta = fastest.route.averageRisk - route.route.averageRisk;
    const minDelta = Math.round(
      (route.durationSeconds - fastest.durationSeconds) / 60,
    );
    if (riskDelta > 0) {
      out.push(
        `avgRisk ${riskDelta.toFixed(2)} lower than Fastest (+${Math.max(0, minDelta)} min)`,
      );
    }
  }

  if (route.category === "fastest" && safest && safest !== route) {
    const minSaved = Math.round(
      (safest.durationSeconds - route.durationSeconds) / 60,
    );
    if (minSaved > 0) {
      out.push(`saves ${minSaved} min over Safest`);
    }
  }

  if (route.category === "balanced") {
    out.push("trade-off between time and exposure");
  }

  return out;
}
