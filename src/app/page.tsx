"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
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
  getCityRiskCells,
} from "@/features/risk";
import type { DestinationRisk } from "@/features/risk";
import {
  IncidentsPanel,
  RerouteSuggestion,
  toRiskIncidents,
  useIncidentsStore,
} from "@/features/incidents";
import type {
  IncidentPlacementMode,
  IncidentType,
} from "@/features/incidents";
import { TripPanel, useTrip } from "@/features/trip";
import { getDemoCity } from "@/lib/google";
import { clientEnv } from "@/lib/env";

const DEMO_CITY = getDemoCity(clientEnv.NEXT_PUBLIC_DEMO_CITY);
const RISK_CELLS = getCityRiskCells(clientEnv.NEXT_PUBLIC_DEMO_CITY);

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

  const sim = useSimulation({ routes });
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

  // Recompute destination risk whenever destination, time-of-day, or
  // active incidents change.
  useEffect(() => {
    if (!destCoords) {
      setDestinationRisk(null);
      return;
    }
    const time: "day" | "night" = nightMode ? "night" : "day";
    const riskIncidents = toRiskIncidents(incidents);
    setDestinationRisk(
      evaluateDestinationRisk(destCoords, RISK_CELLS, time, riskIncidents),
    );
  }, [destCoords, nightMode, incidents]);

  const handleSearch = useCallback(
    async (originAddr: string, destAddr: string, isDragRebuild = false) => {
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
          origin: { text: originAddr, coords: originCoords },
          destination: { text: destAddr, coords: destCoords },
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

  // Re-rank routes when day/night flips, fresh raw routes arrive, or
  // incidents change. Re-ranking is local — we never re-call /api/routes.
  useEffect(() => {
    if (rawRoutes.length === 0) {
      setRoutes([]);
      setRouteAlerts([]);
      return;
    }
    const time: "day" | "night" = nightMode ? "night" : "day";
    const riskIncidents = toRiskIncidents(incidents);
    const scored = rawRoutes.map((r) =>
      scoreRoute(r, RISK_CELLS, time, riskIncidents),
    );
    const ranked = rankRoutes(scored, RISK_CELLS, time);
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
  }, [rawRoutes, nightMode, incidents]);

  // Keep route alerts in sync with whichever route is currently selected.
  useEffect(() => {
    const selected = routes.find((r) => r.selected);
    setRouteAlerts(selected ? getRouteAlerts(selected.route.polylinePath) : []);
  }, [routes]);

  const handleSelectRoute = useCallback((id: number) => {
    // The alerts useEffect re-derives RouteAlerts whenever `routes` updates.
    setRoutes((prev) => prev.map((r) => ({ ...r, selected: r.id === id })));
    setDismissedRerouteFor(null);
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
    const candidate = routes
      .filter((r) => r.id !== selected.id)
      .filter(
        (r) =>
          r.route.averageRisk + 1.0 < selected.route.averageRisk &&
          r.durationSeconds - selected.durationSeconds <= 360,
      )
      .sort((a, b) => a.route.averageRisk - b.route.averageRisk)[0];
    if (!candidate) return null;
    const dismissKey = `${selected.id}->${candidate.id}`;
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
          const cell = RISK_CELLS.find((c) => c.id === zone.id);
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
    [nightMode],
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
      // Auto-rebuild route if both points are set
      const newOrigin = mode === "origin" ? address : origin;
      const newDest = mode === "destination" ? address : destination;
      if (newOrigin.trim() && newDest.trim()) {
        setTimeout(() => handleSearch(newOrigin, newDest, true), 300);
      }
    },
    [origin, destination, handleSearch]
  );

  const handleDemo = useCallback(() => {
    const { originLabel, originCoords, destinationLabel, destinationCoords } =
      DEMO_CITY.seed;
    setOrigin(originLabel);
    setDestination(destinationLabel);
    setOriginCoords(originCoords);
    setDestCoords(destinationCoords);
    setTimeout(() => handleSearch(originLabel, destinationLabel), 400);
  }, [handleSearch]);

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
            <button
              type="button"
              onClick={handleDemo}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-indigo-200 text-indigo-600 text-sm font-semibold hover:bg-indigo-50 hover:border-indigo-300 transition-all duration-200 active:scale-[0.98]"
            >
              <Sparkles className="w-4 h-4" />
              Try Demo ({DEMO_CITY.seed.originLabel.split(",")[0]} to{" "}
              {DEMO_CITY.seed.destinationLabel.split(",")[0]})
            </button>
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
                    : "Walk through the route on screen (no GPS)"
                }
              >
                {sim.simulating ? (
                  <>
                    <Square className="w-4 h-4 fill-white" />
                    Stop Demo Drive
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    Demo Drive (no GPS)
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
        <MapView
          routes={routes}
          showZones={showZones}
          showTraffic={showTraffic}
          pinMode={pinMode}
          nightMode={nightMode}
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
        />
      </main>

      <SimulationToast toasts={sim.toasts} onDismiss={sim.dismissToast} />
    </div>
  );
}
