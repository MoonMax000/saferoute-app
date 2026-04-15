"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { Info, Sparkles, Play, Square } from "lucide-react";
import type { LatLng } from "@/shared/types";
import { MapControls } from "@/features/map";
import type { PinMode } from "@/features/map";
import { SearchPanel, RouteInfo, RouteAlerts } from "@/features/routing";
import type { RouteOption, RouteAlert } from "@/features/routing";
import { searchRoutes, processDirectionsRoute, getRouteAlerts } from "@/features/routing";
import { loadZonesFromGeoJSON, getZones, isPointInZone } from "@/features/zones";
import { useSimulation, SimulationToast } from "@/features/simulation";
import { SafetySummary, EventLog } from "@/features/safety";

const MapView = dynamic(
  () => import("@/features/map/MapView").then((m) => m.MapView),
  { ssr: false }
);

export default function Home() {
  const [routes, setRoutes] = useState<RouteOption[]>([]);
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
    riskLevel: number;
  } | null>(null);
  const [nightMode, setNightMode] = useState(false);
  const [showTraffic, setShowTraffic] = useState(false);

  const sim = useSimulation({ routes });

  useEffect(() => {
    loadZonesFromGeoJSON("/data/zones.geojson").catch(() => {});
  }, []);

  const handleSearch = useCallback(
    async (originAddr: string, destAddr: string) => {
      setIsLoading(true);
      setError(null);
      setRoutes([]);
      setRouteAlerts([]);
      setPinMode(null);
      setOriginCoords(null);
      setDestCoords(null);

      try {
        const result = await searchRoutes(originAddr, destAddr);

        if (!result.routes || result.routes.length === 0) {
          throw new Error("No routes found. Try different addresses.");
        }

        const options: RouteOption[] = result.routes.map((route, index) => ({
          id: index,
          label: index === 0 ? "Recommended Route" : `Alternative ${index}`,
          route: processDirectionsRoute(route),
          selected: index === 0,
        }));

        options.sort((a, b) => a.route.averageRisk - b.route.averageRisk);

        const count = options.length;
        options.forEach((r, i) => {
          r.selected = i === 0;
          if (count === 1) {
            r.label = "Recommended Route";
          } else if (i === 0) {
            r.label = "Safest Route";
          } else if (i === count - 1) {
            r.label = "Fastest (Higher Risk)";
          } else {
            r.label = "Balanced Route";
          }
        });

        setRoutes(options);

        const selected = options.find((r) => r.selected);
        if (selected) {
          setRouteAlerts(getRouteAlerts(selected.route.polylinePath));
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to calculate route"
        );
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const handleSelectRoute = useCallback((id: number) => {
    setRoutes((prev) => {
      const updated = prev.map((r) => ({ ...r, selected: r.id === id }));
      const selected = updated.find((r) => r.selected);
      if (selected) {
        setRouteAlerts(getRouteAlerts(selected.route.polylinePath));
      }
      return updated;
    });
  }, []);

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

  const handleUserLocationChange = useCallback((loc: LatLng | null) => {
    if (!loc) {
      setUserZoneAlert(null);
      return;
    }
    for (const zone of getZones()) {
      if (isPointInZone(loc, zone)) {
        setUserZoneAlert({ label: zone.label, riskLevel: zone.riskLevel });
        return;
      }
    }
    setUserZoneAlert(null);
  }, []);

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
        setTimeout(() => handleSearch(newOrigin, newDest), 300);
      }
    },
    [origin, destination, handleSearch]
  );

  const handleDemo = useCallback(() => {
    const demoOrigin = "Times Square, Manhattan, NY 10036";
    const demoDestination = "Brooklyn Bridge, New York, NY 10038";
    setOrigin(demoOrigin);
    setDestination(demoDestination);
    setTimeout(() => handleSearch(demoOrigin, demoDestination), 400);
  }, [handleSearch]);

  return (
    <div className="h-screen w-screen flex flex-col md:flex-row overflow-hidden bg-slate-50 font-sans text-slate-800">
      <aside className="w-full md:w-[420px] md:min-w-[420px] h-auto md:h-full flex-shrink-0 flex flex-col bg-white/95 backdrop-blur-xl shadow-[8px_0_30px_rgba(0,0,0,0.06)] border-r border-slate-100 z-20 overflow-y-auto custom-scrollbar">
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 px-8 py-7">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-24 h-24 rounded-full bg-black/10 blur-xl" />
          <div className="relative z-10">
            <h1 className="text-2xl font-black text-white tracking-wide drop-shadow-sm">
              SafeRoute
            </h1>
            <p className="text-indigo-100 text-sm font-medium opacity-90 tracking-wide mt-0.5">
              Risk-aware navigation
            </p>
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
            onPinModeChange={setPinMode}
          />

          {routes.length === 0 && !isLoading && (
            <button
              type="button"
              onClick={handleDemo}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-indigo-200 text-indigo-600 text-sm font-semibold hover:bg-indigo-50 hover:border-indigo-300 transition-all duration-200 active:scale-[0.98]"
            >
              <Sparkles className="w-4 h-4" />
              Try Demo (Times Square to Brooklyn Bridge)
            </button>
          )}

          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 animate-fade-in">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <RouteInfo routes={routes} onSelectRoute={handleSelectRoute} />

          {routes.length > 0 && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={sim.simulating ? sim.stop : sim.start}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-200 active:scale-[0.98] ${
                  sim.simulating
                    ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/25"
                    : "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25"
                }`}
              >
                {sim.simulating ? (
                  <>
                    <Square className="w-4 h-4 fill-white" />
                    Stop Simulation
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    Simulate Drive
                  </>
                )}
              </button>
            </div>
          )}

          <SafetySummary routes={routes} />
          <RouteAlerts alerts={routeAlerts} userZoneAlert={userZoneAlert} />
          <EventLog entries={sim.eventLog} onClear={sim.clearLog} />

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
              <strong className="font-semibold">Note:</strong> Risk zones shown
              are mock/demo data for prototype purposes. Production version
              would use real-time crime statistics and incident reports.
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
          onMapPinDrop={handleMapPinDrop}
          onUserLocationChange={handleUserLocationChange}
          onMarkerDrag={handleMarkerDrag}
        />
      </main>

      <SimulationToast toasts={sim.toasts} onDismiss={sim.dismissToast} />
    </div>
  );
}
