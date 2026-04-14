"use client";

import { useRef, useEffect, useCallback } from "react";
import { MapPin, ArrowUpDown, Navigation, Loader2 } from "lucide-react";
import type { PinMode } from "@/features/map";

interface SearchPanelProps {
  onSearch: (origin: string, destination: string) => void;
  isLoading: boolean;
  origin: string;
  destination: string;
  onOriginChange: (value: string) => void;
  onDestinationChange: (value: string) => void;
  pinMode: PinMode;
  onPinModeChange: (mode: PinMode) => void;
}

export function SearchPanel({
  onSearch,
  isLoading,
  origin,
  destination,
  onOriginChange,
  onDestinationChange,
  pinMode,
  onPinModeChange,
}: SearchPanelProps) {
  const originRef = useRef<HTMLInputElement>(null);
  const destRef = useRef<HTMLInputElement>(null);
  const originAutocompleteRef =
    useRef<google.maps.places.Autocomplete | null>(null);
  const destAutocompleteRef =
    useRef<google.maps.places.Autocomplete | null>(null);

  const setupAutocomplete = useCallback(() => {
    if (!window.google?.maps?.places) return;

    if (originRef.current && !originAutocompleteRef.current) {
      originAutocompleteRef.current = new google.maps.places.Autocomplete(
        originRef.current,
        { types: ["geocode", "establishment"] }
      );
      originAutocompleteRef.current.addListener("place_changed", () => {
        const place = originAutocompleteRef.current?.getPlace();
        if (place?.formatted_address) {
          onOriginChange(place.formatted_address);
        } else if (place?.name) {
          onOriginChange(place.name);
        }
      });
    }

    if (destRef.current && !destAutocompleteRef.current) {
      destAutocompleteRef.current = new google.maps.places.Autocomplete(
        destRef.current,
        { types: ["geocode", "establishment"] }
      );
      destAutocompleteRef.current.addListener("place_changed", () => {
        const place = destAutocompleteRef.current?.getPlace();
        if (place?.formatted_address) {
          onDestinationChange(place.formatted_address);
        } else if (place?.name) {
          onDestinationChange(place.name);
        }
      });
    }
  }, [onOriginChange, onDestinationChange]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (window.google?.maps?.places) {
        setupAutocomplete();
        clearInterval(interval);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [setupAutocomplete]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (origin.trim() && destination.trim()) {
      onSearch(origin, destination);
    }
  };

  const handleSwap = () => {
    const temp = origin;
    onOriginChange(destination);
    onDestinationChange(temp);
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
          <input
            ref={originRef}
            type="text"
            placeholder="Starting point"
            value={origin}
            onChange={(e) => onOriginChange(e.target.value)}
            className="bg-transparent flex-1 outline-none text-[15px] font-medium text-slate-700 placeholder:text-slate-400 w-full"
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
          <input
            ref={destRef}
            type="text"
            placeholder="Destination"
            value={destination}
            onChange={(e) => onDestinationChange(e.target.value)}
            className="bg-transparent flex-1 outline-none text-[15px] font-medium text-slate-700 placeholder:text-slate-400 w-full"
          />
          <button
            type="button"
            onClick={() =>
              onPinModeChange(
                pinMode === "destination" ? null : "destination"
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
