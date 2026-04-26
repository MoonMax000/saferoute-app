"use client";

import { useMemo } from "react";
import { MapPin, ArrowUpDown, Navigation, Loader2 } from "lucide-react";
import type { PinMode } from "@/features/map";
import type { LatLng } from "@/shared/types";
import { PlaceSearchInput, getDemoCity, type FetchedPlace } from "@/lib/google";
import { clientEnv } from "@/lib/env";

interface SearchPanelProps {
  onSearch: (origin: string, destination: string) => void;
  isLoading: boolean;
  origin: string;
  destination: string;
  originCoords?: LatLng | null;
  destCoords?: LatLng | null;
  onOriginChange: (value: string) => void;
  onDestinationChange: (value: string) => void;
  onOriginCoordsChange?: (coords: LatLng | null) => void;
  onDestCoordsChange?: (coords: LatLng | null) => void;
  pinMode: PinMode;
  onPinModeChange: (mode: PinMode) => void;
}

export function SearchPanel({
  onSearch,
  isLoading,
  origin,
  destination,
  originCoords,
  destCoords,
  onOriginChange,
  onDestinationChange,
  onOriginCoordsChange,
  onDestCoordsChange,
  pinMode,
  onPinModeChange,
}: SearchPanelProps) {
  const city = useMemo(
    () => getDemoCity(clientEnv.NEXT_PUBLIC_DEMO_CITY),
    [],
  );

  const handleOriginPlace = (place: FetchedPlace) => {
    if (place.location) onOriginCoordsChange?.(place.location);
  };

  const handleDestPlace = (place: FetchedPlace) => {
    if (place.location) onDestCoordsChange?.(place.location);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (origin.trim() && destination.trim()) onSearch(origin, destination);
  };

  const handleSwap = () => {
    const tmpOrigin = origin;
    const tmpOriginCoords = originCoords ?? null;
    onOriginChange(destination);
    onDestinationChange(tmpOrigin);
    onOriginCoordsChange?.(destCoords ?? null);
    onDestCoordsChange?.(tmpOriginCoords);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="relative flex flex-col gap-3">
        <button
          type="button"
          onClick={handleSwap}
          className="absolute left-7 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-white border border-slate-200 shadow-md rounded-full flex items-center justify-center hover:bg-slate-50 hover:shadow-lg hover:scale-110 active:scale-95 active:shadow-sm transition-all text-slate-500 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          title="Swap origin and destination"
        >
          <ArrowUpDown className="w-4 h-4" />
        </button>

        <div
          className={`flex items-center bg-white border-2 shadow-sm rounded-xl p-2.5 transition-all duration-300 ${
            pinMode === "origin"
              ? "border-emerald-400 bg-emerald-50/30 ring-4 ring-emerald-500/10"
              : "border-slate-200 hover:border-slate-300 focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-500/10 focus-within:shadow-md"
          }`}
        >
          <div className="w-12 flex justify-center items-center">
            <div className="relative flex items-center justify-center">
              <div className="absolute w-5 h-5 bg-emerald-500/20 rounded-full animate-ping" />
              <div className="w-3 h-3 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)] border-2 border-white z-10" />
            </div>
          </div>
          <PlaceSearchInput
            value={origin}
            onValueChange={onOriginChange}
            onPlaceSelect={handleOriginPlace}
            placeholder="Starting point"
            locationBias={city.center}
            biasRadius={city.radiusMeters}
            countryCode={city.countryCode}
          />
          <button
            type="button"
            onClick={() =>
              onPinModeChange(pinMode === "origin" ? null : "origin")
            }
            className={`p-2.5 rounded-lg transition-all duration-200 ${
              pinMode === "origin"
                ? "bg-emerald-100 text-emerald-700 shadow-sm"
                : "hover:bg-slate-100 text-slate-400 hover:text-emerald-600"
            }`}
            title="Pick on map"
          >
            <MapPin className="w-5 h-5" />
          </button>
        </div>

        <div
          className={`flex items-center bg-white border-2 shadow-sm rounded-xl p-2.5 transition-all duration-300 ${
            pinMode === "destination"
              ? "border-rose-400 bg-rose-50/30 ring-4 ring-rose-500/10"
              : "border-slate-200 hover:border-slate-300 focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-500/10 focus-within:shadow-md"
          }`}
        >
          <div className="w-12 flex justify-center items-center">
            <div className="relative flex items-center justify-center">
              <div className="absolute w-5 h-5 bg-rose-500/20 rounded-full animate-ping" />
              <div className="w-3 h-3 bg-rose-500 rounded-full shadow-[0_0_10px_rgba(244,63,94,0.5)] border-2 border-white z-10" />
            </div>
          </div>
          <PlaceSearchInput
            value={destination}
            onValueChange={onDestinationChange}
            onPlaceSelect={handleDestPlace}
            placeholder="Destination"
            locationBias={city.center}
            biasRadius={city.radiusMeters}
            countryCode={city.countryCode}
          />
          <button
            type="button"
            onClick={() =>
              onPinModeChange(
                pinMode === "destination" ? null : "destination",
              )
            }
            className={`p-2.5 rounded-lg transition-all duration-200 ${
              pinMode === "destination"
                ? "bg-rose-100 text-rose-700 shadow-sm"
                : "hover:bg-slate-100 text-slate-400 hover:text-rose-600"
            }`}
            title="Pick on map"
          >
            <MapPin className="w-5 h-5" />
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading || !origin.trim() || !destination.trim()}
        className="w-full relative overflow-hidden group bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:via-indigo-500 hover:to-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-base py-3.5 rounded-xl shadow-[0_8px_20px_rgba(79,70,229,0.25)] hover:shadow-[0_10px_25px_rgba(79,70,229,0.4)] transition-all duration-300 hover:-translate-y-0.5 active:translate-y-[1px] flex justify-center items-center gap-2.5"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Calculating...</span>
          </>
        ) : (
          <>
            <Navigation className="w-5 h-5 fill-white/20" />
            <span>Find Safe Route</span>
          </>
        )}
      </button>
    </form>
  );
}
