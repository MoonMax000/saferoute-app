"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { Info, Sparkles, Play, Square } from "lucide-react";
import type { LatLng } from "@/shared/types";
import { MapControls } from "@/features/map";
import type { PinMode } from "@/features/map";
import { SearchPanel, RouteInfo, RouteAlerts } from "@/features/routing";
import type { RouteOption, RouteAlert } from "@/features/routing";
import {
  searchRoutes,
  scoreRoute,
  rankRoutes,
  getRouteAlerts,
} from "@/features/routing";
import type { RawRoute } from "@/lib/google/routes-api";
import { getZones, isPointInZone } from "@/features/zones";
import { useSimulation, SimulationToast } from "@/features/simulation";
import { SafetySummary, EventLog } from "@/features/safety";
import {
  DestinationWarning,
  evaluateDestinationRisk,
} from "@/features/risk";
import type { DestinationRisk } from "@/features/risk";
import {
  IncidentsPanel,
  RerouteSuggestion,
  RerouteModal,
  toRiskIncidents,
  useIncidentsStore,
} from "@/features/incidents";
import type {
  IncidentPlacementMode,
  IncidentType,
} from "@/features/incidents";
import { TripPanel, TripHUD, useTrip } from "@/features/trip";
import {
  InspectorToggle,
  useEffectiveRiskCells,
  useRiskConfigStore,
  useInspectorStore,
  inspectorLog,
} from "@/features/inspector";
import { InspectorDebugPanel } from "@/features/inspector/InspectorDebugPanel";
import { InspectorLogPanel } from "@/features/inspector/InspectorLogPanel";
import { InspectorTunePanel } from "@/features/inspector/InspectorTunePanel";
import { InspectorPaintOverlay } from "@/features/inspector/InspectorPaintOverlay";
import { VerificationRunner } from "@/features/inspector/VerificationRunner";
import { getDemoCity } from "@/lib/google";
import { clientEnv } from "@/lib/env";

const DEMO_CITY = getDemoCity(clientEnv.NEXT_PUBLIC_DEMO_CITY);

const MapView = dynamic(
  () => import("@/features/map/MapView").then((m) => m.MapView),
  { ssr: false }
);

export default function Home() {
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [rawRoutes, setRawRoutes] = useState<RawRoute[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showZones, setShowZones] = useState(true);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [originCoords, setOriginCoords] = useState<LatLng | null>(null);
  const [destCoords, setDestCoords] = useState<LatLng | null>(null);
  const [pinMode, setPinMode] = useState<PinMode>(null);
  const [routeAlerts, setRouteAlerts] = useState<RouteAlert[]>([]);
  const [userZoneAlert, setUserZoneAlert] = useState<{
    label: string;
    categoryLabel: string;
  } | null>(null);
  const [nightMode, setNightMode] = useState(false);
  const [showTraffic, setShowTraffic] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [destinationRisk, setDestinationRisk] =
    useState<DestinationRisk | null>(null);
  const [incidentPlacementMode, setIncidentPlacementMode] =
    useState<IncidentPlacementMode>(null);
  const [dismissedRerouteFor, setDismissedRerouteFor] = useState<string | null>(
    null,
  );

  const incidents = useIncidentsStore((s) => s.incidents);
  const addIncident = useIncidentsStore((s) => s.addIncident);
  const removeIncident = useIncidentsStore((s) => s.removeIncident);
  const clearIncidents = useIncidentsStore((s) => s.clearIncidents);

  // Effective risk cells = built-in city seeds + tunable overrides + custom
  // paint zones. Identity is memo-stable until something actually changes,
  // so the route re-rank effect doesn't fire on every render.
  const effectiveCells = useEffectiveRiskCells();
  const elevatedThreshold = useRiskConfigStore((s) => s.elevatedThreshold);
  const blockingIncidentWeight = useRiskConfigStore(
    (s) => s.blockingIncidentWeight,
  );
  const advisoryIncidentWeight = useRiskConfigStore(
    (s) => s.advisoryIncidentWeight,
  );

  // Inspector mode wiring — hooked up to MapView so that:
  //   • plain map clicks open the formula-breakdown popup,
  //   • paint mode click sets the centre of a custom risk zone.
  const inspectorEnabled = useInspectorStore((s) => s.enabled);
  const paintMode = useInspectorStore((s) => s.paintMode);
  const paintZones = useInspectorStore((s) => s.paintZones);
  const setPaintCenter = useInspectorStore((s) => s.setPaintCenter);

  // Memoize the RiskIncident projection so MapView (and routing) get a
  // stable identity — re-renders only fire when the actual incident list
  // shifts.
  const riskIncidents = useMemo(() => toRiskIncidents(incidents), [incidents]);

  const handlePaintMapClick = useCallback(
    (latlng: LatLng) => {
      setPaintCenter(latlng);
      inspectorLog("event", "paint: centre set", {
        coords: { lat: Number(latlng.lat.toFixed(5)), lng: Number(latlng.lng.toFixed(5)) },
      });
    },
    [setPaintCenter],
  );

  const sim = useSimulation({ routes, incidents });
  const selectedRoute = useMemo(
    () => routes.find((r) => r.selected) ?? null,
    [routes],
  );
  const trip = useTrip({ selectedRoute });
  const { isActive: tripActive, stopTrip: tripStop } = trip;

  // If the user picks a different route while a trip is active, stop the
  // current tracking session — the polyline reference would be wrong.
  useEffect(() => {
    if (tripActive) tripStop();
  }, [selectedRoute?.id, tripActive, tripStop]);

  // Recompute destination risk whenever destination, time-of-day,
  // active incidents, or any tunable cell override changes.
  useEffect(() => {
    if (!destCoords) {
      setDestinationRisk(null);
      return;
    }
    const time: "day" | "night" = nightMode ? "night" : "day";
    const riskIncidents = toRiskIncidents(incidents);
    const verdict = evaluateDestinationRisk(
      destCoords,
      effectiveCells,
      time,
      riskIncidents,
    );
    setDestinationRisk(verdict);
    inspectorLog(
      "calc",
      `evaluateDestinationRisk → ${verdict.state}`,
      {
        coords: destCoords,
        time,
        affected: verdict.affectedCellLabels,
      },
    );
  }, [destCoords, nightMode, incidents, effectiveCells]);

  const handleSearch = useCallback(
    async (
      originAddr: string,
      destAddr: string,
      opts: {
        isDragRebuild?: boolean;
        originCoordsOverride?: LatLng | null;
        destCoordsOverride?: LatLng | null;
      } = {},
    ) => {
      const { isDragRebuild = false, originCoordsOverride, destCoordsOverride } =
        opts;

      setIsLoading(true);
      setError(null);
      if (!isDragRebuild) {
        setRoutes([]);
        setRawRoutes([]);
        setRouteAlerts([]);
        setPinMode(null);
      }

      try {
        const raw = await searchRoutes({
          origin: {
            text: originAddr,
            coords: originCoordsOverride ?? originCoords,
          },
          destination: {
            text: destAddr,
            coords: destCoordsOverride ?? destCoords,
          },
        });
        if (raw.length === 0) {
          throw new Error("No routes found. Try different addresses.");
        }
        setRawRoutes(raw);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to calculate route",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [originCoords, destCoords],
  );

  // Re-rank routes when day/night flips, fresh raw routes arrive, incidents
  // change, or any tunable parameter (overrides, weights, threshold) moves.
  // Re-ranking is local — we never re-call /api/routes.
  useEffect(() => {
    if (rawRoutes.length === 0) {
      setRoutes([]);
      setRouteAlerts([]);
      return;
    }
    const time: "day" | "night" = nightMode ? "night" : "day";
    const riskIncidents = toRiskIncidents(incidents);
    const t0 = performance.now();
    const scored = rawRoutes.map((r) =>
      scoreRoute(r, effectiveCells, time, riskIncidents, {
        elevatedThreshold,
        blockingIncidentWeight,
        advisoryIncidentWeight,
      }),
    );
    const ranked = rankRoutes(scored, effectiveCells, time);
    const ms = performance.now() - t0;
    inspectorLog(
      "calc",
      `rankRoutes(${rawRoutes.length} candidates) → [${ranked.map((r) => r.category).join(", ")}]`,
      {
        time,
        ms: Math.round(ms),
        avgRisks: scored.map((s) => s.avgRisk.toFixed(2)),
        maxRisks: scored.map((s) => s.maxRisk.toFixed(2)),
        impacts: scored.map((s) => s.incidentImpacts),
      },
    );
    setRoutes((prev) => {
      const prevSelectedCategory = prev.find((r) => r.selected)?.category;
      if (prevSelectedCategory) {
        const matched = ranked.find((r) => r.category === prevSelectedCategory);
        if (matched) {
          return ranked.map((r) => ({ ...r, selected: r === matched }));
        }
      }
      return ranked;
    });
  }, [
    rawRoutes,
    nightMode,
    incidents,
    effectiveCells,
    elevatedThreshold,
    blockingIncidentWeight,
    advisoryIncidentWeight,
  ]);

  // Keep route alerts in sync with whichever route is currently selected.
  useEffect(() => {
    const selected = routes.find((r) => r.selected);
    setRouteAlerts(selected ? getRouteAlerts(selected.route.polylinePath) : []);
  }, [routes]);

  const handleSelectRoute = useCallback((id: number) => {
    // The alerts useEffect re-derives RouteAlerts whenever `routes` updates.
    setRoutes((prev) => prev.map((r) => ({ ...r, selected: r.id === id })));
    setDismissedRerouteFor(null);
    // If the demo drive is currently running, restart it on the newly
    // selected route so the simulated car follows the user's choice.
    // setTimeout gives React one tick to propagate the new selection.
    if (simRef.current.simulating) {
      setTimeout(() => simRef.current.start(), 100);
    }
  }, []);

  const handleIncidentPlaceStart = useCallback((type: IncidentType) => {
    setIncidentPlacementMode((prev) => (prev === type ? null : type));
    setPinMode(null);
  }, []);

  const handleIncidentPlaceCancel = useCallback(() => {
    setIncidentPlacementMode(null);
  }, []);

  const handleIncidentPlace = useCallback(
    (latlng: LatLng) => {
      if (!incidentPlacementMode) return;
      addIncident({ type: incidentPlacementMode, center: latlng });
      setIncidentPlacementMode(null);
    },
    [incidentPlacementMode, addIncident],
  );

  // Suggest a safer alternative when one exists that is meaningfully less
  // exposed AND not too much slower than the currently selected route.
  // Never forces a reroute — just offers it.
  const rerouteSuggestion = useMemo(() => {
    if (routes.length < 2) return null;
    const selected = routes.find((r) => r.selected);
    if (!selected) return null;
    // Trigger when:
    //   (a) the selected route is physically touched by ≥1 incident, AND
    //   (b) some alternative is touched by fewer incidents OR has a
    //       meaningfully lower avg-risk profile, AND
    //   (c) the alternative isn't more than 6 minutes slower.
    // Falling back on avg-risk delta lets the prompt also fire when no
    // hard incident exists but ranking shifts (e.g. day → night).
    const candidate = routes
      .filter((r) => r.id !== selected.id)
      .filter((r) => {
        const dt = r.durationSeconds - selected.durationSeconds;
        if (dt > 360) return false;
        const incidentBetter = r.incidentImpacts < selected.incidentImpacts;
        const riskBetter =
          r.route.averageRisk + 0.4 < selected.route.averageRisk;
        // Fallback: as long as the SELECTED route has any active incident,
        // surface the alternative even if it also has incidents — the user
        // still sees a swap option. Demo can chain multiple reroutes back
        // and forth without getting stuck.
        const selectedHasIncident = selected.incidentImpacts > 0;
        return incidentBetter || riskBetter || selectedHasIncident;
      })
      .sort((a, b) => {
        // Prefer fewer incident impacts first, then lower avg risk.
        if (a.incidentImpacts !== b.incidentImpacts)
          return a.incidentImpacts - b.incidentImpacts;
        return a.route.averageRisk - b.route.averageRisk;
      })[0];
    if (!candidate) return null;
    // Encode current impact counts into the dismiss key so each new
    // incident creates a distinct suggestion that can re-prompt even
    // after the user dismissed an earlier round.
    const dismissKey = `${selected.id}->${candidate.id}@${selected.incidentImpacts}+${candidate.incidentImpacts}`;
    if (dismissedRerouteFor === dismissKey) return null;
    return {
      candidate,
      dismissKey,
      minutesAdded: Math.max(
        0,
        Math.round(
          (candidate.durationSeconds - selected.durationSeconds) / 60,
        ),
      ),
    };
  }, [routes, dismissedRerouteFor]);

  const handleMapPinDrop = useCallback(
    (latlng: LatLng, address: string, mode: PinMode) => {
      if (mode === "origin") {
        setOrigin(address);
        setOriginCoords(latlng);
      } else if (mode === "destination") {
        setDestination(address);
        setDestCoords(latlng);
      }
      setPinMode(null);
    },
    []
  );

  const handleUserLocationChange = useCallback(
    (loc: LatLng | null) => {
      if (!loc) {
        setUserZoneAlert(null);
        return;
      }
      const time: "day" | "night" = nightMode ? "night" : "day";
      for (const zone of getZones()) {
        if (isPointInZone(loc, zone)) {
          // Translate the legacy zone risk level into the public category
          // vocabulary so we never leak a number into the UI.
          const cell = effectiveCells.find((c) => c.id === zone.id);
          const effective = cell
            ? cell.baseDayRisk * (time === "night" ? cell.nightMultiplier : 1)
            : zone.riskLevel;
          const categoryLabel =
            effective <= 3.2
              ? "Looks normal"
              : effective <= 5.2
                ? "Use caution here"
                : effective <= 7
                  ? "Higher-risk area"
                  : "High-risk area";
          setUserZoneAlert({ label: zone.label, categoryLabel });
          return;
        }
      }
      setUserZoneAlert(null);
    },
    [nightMode, effectiveCells],
  );

  const handleMarkerDrag = useCallback(
    (latlng: LatLng, address: string, mode: "origin" | "destination") => {
      if (mode === "origin") {
        setOrigin(address);
        setOriginCoords(latlng);
      } else {
        setDestination(address);
        setDestCoords(latlng);
      }
      // Auto-rebuild route if both points are set. Pass the just-dragged
      // coordinates explicitly to avoid the React state-propagation race.
      const newOrigin = mode === "origin" ? address : origin;
      const newDest = mode === "destination" ? address : destination;
      const newOriginCoords = mode === "origin" ? latlng : originCoords;
      const newDestCoords = mode === "destination" ? latlng : destCoords;
      if (newOrigin.trim() && newDest.trim()) {
        setTimeout(
          () =>
            handleSearch(newOrigin, newDest, {
              isDragRebuild: true,
              originCoordsOverride: newOriginCoords,
              destCoordsOverride: newDestCoords,
            }),
          300,
        );
      }
    },
    [origin, destination, originCoords, destCoords, handleSearch],
  );

  const handleDemo = useCallback(() => {
    const { originLabel, originCoords, destinationLabel, destinationCoords } =
      DEMO_CITY.seed;
    setOrigin(originLabel);
    setDestination(destinationLabel);
    setOriginCoords(originCoords);
    setDestCoords(destinationCoords);
    // Pass the seed coordinates explicitly — the useState updates above
    // haven't propagated yet by the time the timeout fires.
    setTimeout(
      () =>
        handleSearch(originLabel, destinationLabel, {
          originCoordsOverride: originCoords,
          destCoordsOverride: destinationCoords,
        }),
      400,
    );
  }, [handleSearch]);

  // ── Demo Scenario state machine ─────────────────────────────────────
  // The scenario is driven by reacting to live state (routes appear → sim
  // starts → mid-trip an incident is spawned), so the click handler only
  // arms the flag and the flow proceeds via effects.
  type ScenarioPhase = "idle" | "awaiting-routes" | "driving" | "spawned";
  const scenarioPhaseRef = useRef<ScenarioPhase>("idle");
  const scenarioTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Latest live refs so timer callbacks use fresh values, not stale
  // closures from when the scenario was kicked off.
  const simRef = useRef(sim);
  const routesRef = useRef(routes);
  useEffect(() => {
    simRef.current = sim;
  }, [sim]);
  useEffect(() => {
    routesRef.current = routes;
  }, [routes]);

  const clearScenarioTimers = useCallback(() => {
    scenarioTimersRef.current.forEach((t) => clearTimeout(t));
    scenarioTimersRef.current = [];
  }, []);

  const runDemoScenario = useCallback(() => {
    clearScenarioTimers();
    scenarioPhaseRef.current = "awaiting-routes";
    handleDemo();
  }, [clearScenarioTimers, handleDemo]);

  // Phase 2: routes have landed → start sim + schedule incident.
  useEffect(() => {
    if (scenarioPhaseRef.current !== "awaiting-routes") return;
    if (routes.length === 0) return;
    scenarioPhaseRef.current = "driving";

    // Start the sim first so its path is locked to the initial Safest
    // route. Then drop the three incident types directly on that locked
    // path at 30 / 55 / 80 % — far enough ahead that the simulated car
    // drives into each one and triggers the proximity toast.
    scenarioTimersRef.current.push(
      setTimeout(() => simRef.current.start(), 600),
    );

    const placements: Array<{ frac: number; type: IncidentType }> = [
      { frac: 0.3, type: "robbery" },
      { frac: 0.55, type: "police" },
      { frac: 0.8, type: "blockage" },
    ];
    placements.forEach((p, i) => {
      scenarioTimersRef.current.push(
        setTimeout(
          () => {
            // Pull the path that's actually being driven RIGHT NOW so
            // incidents land on the simulated car's track even if the
            // ranker swapped Safest/Fastest in the meantime.
            const path = (
              routesRef.current.find((r) => r.selected) ??
              routesRef.current[0]
            )?.route.polylinePath;
            if (!path || path.length < 4) return;
            const at = path[Math.floor(path.length * p.frac)];
            addIncident({ type: p.type, center: at });
          },
          1500 + i * 700,
        ),
      );
    });
  }, [routes, addIncident]);

  useEffect(() => {
    return () => clearScenarioTimers();
  }, [clearScenarioTimers]);

  const tripRunning = sim.simulating || tripActive;
  // Reroute modal: shown whenever a safer alternative exists. Dismiss is
  // also routed through `setDismissedRerouteFor` so the sidebar banner
  // and the centred modal share one acknowledgement state — clicking
  // "Stay" anywhere hides both for that selected→candidate pair.
  const rerouteModalOpen = rerouteSuggestion !== null;

  return (
    <div className="h-screen w-screen flex flex-col md:flex-row overflow-hidden bg-slate-50 font-sans text-slate-800">
      <aside className="w-full md:w-[420px] md:min-w-[420px] h-auto md:h-full flex-shrink-0 flex flex-col bg-white/95 backdrop-blur-xl shadow-[8px_0_30px_rgba(0,0,0,0.06)] border-r border-slate-100 z-20 overflow-y-auto custom-scrollbar">
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 px-8 py-7">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-24 h-24 rounded-full bg-black/10 blur-xl" />
          <div className="relative z-10 flex items-end justify-between">
            <div>
              <h1 className="text-2xl font-black text-white tracking-wide drop-shadow-sm">
                NavShieldAI
              </h1>
              <p className="text-indigo-100 text-sm font-medium opacity-90 tracking-wide mt-0.5">
                Risk-aware navigation
              </p>
            </div>
            <span className="text-[10px] font-bold text-indigo-100 bg-white/10 backdrop-blur-sm border border-white/20 px-2 py-1 rounded-full uppercase tracking-widest">
              {DEMO_CITY.label} demo
            </span>
          </div>
        </div>

        <div className="px-6 py-7 flex flex-col gap-6">
          <SearchPanel
            onSearch={handleSearch}
            isLoading={isLoading}
            origin={origin}
            destination={destination}
            onOriginChange={setOrigin}
            onDestinationChange={setDestination}
            onOriginCoordsChange={setOriginCoords}
            onDestCoordsChange={setDestCoords}
            pinMode={pinMode}
            onPinModeChange={(m) => {
              setPinMode(m);
              if (m) setIncidentPlacementMode(null);
            }}
          />

          {routes.length === 0 && !isLoading && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleDemo}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-indigo-200 text-indigo-600 text-sm font-semibold hover:bg-indigo-50 hover:border-indigo-300 transition-all duration-200 active:scale-[0.98]"
              >
                <Sparkles className="w-4 h-4" />
                Try Demo ({DEMO_CITY.seed.originLabel.split(",")[0]} to{" "}
                {DEMO_CITY.seed.destinationLabel.split(",")[0]})
              </button>
              <button
                type="button"
                onClick={runDemoScenario}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 hover:from-fuchsia-500 hover:via-violet-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-violet-500/25 transition-all duration-200 active:scale-[0.98]"
                title="Plays the full investor pitch: route → drive → mid-trip incident → reroute prompt"
              >
                <Sparkles className="w-4 h-4 fill-white/30" />
                Run Investor Demo (auto-incident)
              </button>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 animate-fade-in">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <DestinationWarning
            risk={destinationRisk}
            time={nightMode ? "night" : "day"}
          />

          {rerouteSuggestion && (
            <RerouteSuggestion
              alternativeLabel={rerouteSuggestion.candidate.label}
              minutesAdded={rerouteSuggestion.minutesAdded}
              reason={rerouteSuggestion.candidate.explanation}
              onAccept={() => handleSelectRoute(rerouteSuggestion.candidate.id)}
              onDismiss={() => setDismissedRerouteFor(rerouteSuggestion.dismissKey)}
            />
          )}

          <RouteInfo routes={routes} onSelectRoute={handleSelectRoute} />

          {routes.length > 0 && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={sim.simulating ? sim.stop : sim.start}
                disabled={tripActive}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
                  sim.simulating
                    ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/25"
                    : "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25"
                }`}
                title={
                  tripActive
                    ? "Stop the live trip first"
                    : "Animate the route on screen — no driving needed"
                }
              >
                {sim.simulating ? (
                  <>
                    <Square className="w-4 h-4 fill-white" />
                    Stop on-screen demo
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    Run on-screen demo
                  </>
                )}
              </button>
            </div>
          )}

          {routes.length > 0 && (
            <TripPanel
              status={trip.status}
              hasSelectedRoute={!!selectedRoute}
              onStart={trip.startTrip}
              onStop={trip.stopTrip}
            />
          )}

          <SafetySummary routes={routes} />
          <RouteAlerts alerts={routeAlerts} userZoneAlert={userZoneAlert} />
          <EventLog entries={sim.eventLog} onClear={sim.clearLog} />

          <IncidentsPanel
            incidents={incidents}
            placementMode={incidentPlacementMode}
            onPlaceStart={handleIncidentPlaceStart}
            onPlaceCancel={handleIncidentPlaceCancel}
            onRemove={removeIncident}
            onClear={clearIncidents}
          />

          {routes.length > 0 && <hr className="border-slate-100" />}

          <MapControls
            showZones={showZones}
            onToggleZones={() => setShowZones(!showZones)}
            nightMode={nightMode}
            onToggleNightMode={() => setNightMode(!nightMode)}
            showTraffic={showTraffic}
            onToggleTraffic={() => setShowTraffic(!showTraffic)}
            focusMode={focusMode}
            onToggleFocusMode={() => setFocusMode((v) => !v)}
          />

          <div className="bg-gradient-to-r from-amber-50 to-orange-50/30 border border-amber-200/60 rounded-xl p-4 flex gap-3.5 text-amber-800 shadow-sm">
            <Info className="w-5 h-5 flex-shrink-0 text-amber-500 mt-0.5" />
            <p className="text-[13px] leading-relaxed">
              <strong className="font-semibold">Demo:</strong> Safety model is
              simulated for {DEMO_CITY.label} and changes between day and
              night. Production would use real safety data and live incident
              reporting.
            </p>
          </div>
        </div>
      </aside>

      <main className="flex-1 relative min-h-[400px] md:min-h-0">
        <InspectorToggle />
        <MapView
          routes={routes}
          showZones={showZones}
          showTraffic={showTraffic}
          pinMode={pinMode}
          nightMode={nightMode}
          focusMode={focusMode}
          simulationPoint={sim.simPoint}
          simulationHeading={sim.simHeading}
          originCoords={originCoords}
          destCoords={destCoords}
          incidents={incidents}
          incidentPlacementMode={incidentPlacementMode}
          onMapPinDrop={handleMapPinDrop}
          onUserLocationChange={handleUserLocationChange}
          onMarkerDrag={handleMarkerDrag}
          onIncidentPlace={handleIncidentPlace}
          onIncidentRemove={removeIncident}
          effectiveCells={effectiveCells}
          inspectorEnabled={inspectorEnabled}
          riskIncidents={riskIncidents}
          blockingIncidentWeight={blockingIncidentWeight}
          advisoryIncidentWeight={advisoryIncidentWeight}
          paintModeActive={paintMode.active}
          paintCenter={paintMode.pendingCenter}
          paintRadius={paintMode.pendingRadius}
          paintRisk={paintMode.pendingRisk}
          paintZones={paintZones}
          onPaintMapClick={handlePaintMapClick}
        />

        <InspectorDebugPanel
          routes={routes}
          destinationRisk={destinationRisk}
          incidents={incidents}
          effectiveCells={effectiveCells}
          nightMode={nightMode}
          simulating={sim.simulating}
          simPoint={sim.simPoint}
          simSpeedKmh={sim.simSpeedKmh}
          simProgress={sim.simProgress}
        />
        <InspectorTunePanel effectiveCells={effectiveCells} />
        <InspectorPaintOverlay />
        <VerificationRunner
          routes={routes}
          simulating={sim.simulating}
          startSim={sim.start}
          stopSim={sim.stop}
          addIncident={(input) =>
            addIncident({ type: input.type, center: input.center })
          }
          nightMode={nightMode}
          setNightMode={setNightMode}
        />
        <InspectorLogPanel />

        <TripHUD
          visible={tripRunning}
          speedKmh={
            sim.simulating
              ? sim.simSpeedKmh
              : trip.status.speedKmh
          }
          selectedRoute={selectedRoute}
          progress={
            sim.simulating
              ? sim.simProgress
              : trip.status.state === "arrived"
                ? 1
                : 0
          }
          modeLabel={sim.simulating ? "On-screen demo" : "Live GPS trip"}
          stateLabel={
            sim.simulating
              ? "Simulating"
              : trip.status.state === "on-route"
                ? "On expected route"
                : trip.status.state === "evaluating-deviation"
                  ? "Drifting off route"
                  : trip.status.state === "deviated"
                    ? "Deviation detected"
                    : trip.status.state === "arrived"
                      ? "Arrived"
                      : trip.status.state === "awaiting-fix"
                        ? "Waiting for GPS"
                        : undefined
          }
          stateTone={
            sim.simulating
              ? "info"
              : trip.status.state === "deviated"
                ? "danger"
                : trip.status.state === "evaluating-deviation"
                  ? "warn"
                  : "ok"
          }
        />

        {rerouteSuggestion && (
          <RerouteModal
            key={rerouteSuggestion.dismissKey}
            open={rerouteModalOpen}
            triggerType="blockage"
            alternativeLabel={rerouteSuggestion.candidate.label}
            minutesAdded={rerouteSuggestion.minutesAdded}
            reason={rerouteSuggestion.candidate.explanation}
            autoDismissAfterSec={0}
            onAccept={() =>
              handleSelectRoute(rerouteSuggestion.candidate.id)
            }
            onDismiss={() =>
              setDismissedRerouteFor(rerouteSuggestion.dismissKey)
            }
          />
        )}
      </main>

      <SimulationToast toasts={sim.toasts} onDismiss={sim.dismissToast} />
    </div>
  );
}
