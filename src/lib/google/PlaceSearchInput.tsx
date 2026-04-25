"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { LatLng } from "@/shared/types";
import { useMapsApi } from "./use-maps";
import { usePlaceSuggestions, type FetchedPlace } from "./use-place-suggestions";

export type { FetchedPlace } from "./use-place-suggestions";

interface PlaceSearchInputProps {
  /** Externally controlled value (e.g. for swap, reset, programmatic edit). */
  value: string;
  /** Notifies parent of every keystroke / selection. */
  onValueChange: (value: string) => void;
  /** Fires only when the user picks a suggestion (with full place details). */
  onPlaceSelect: (place: FetchedPlace) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  /** Bias autocomplete around this point. */
  locationBias?: LatLng;
  biasRadius?: number;
  /** ISO country code (e.g. "VN") to constrain results. */
  countryCode?: string;
}

export function PlaceSearchInput({
  value,
  onValueChange,
  onPlaceSelect,
  placeholder,
  disabled,
  className,
  inputClassName,
  locationBias,
  biasRadius,
  countryCode,
}: PlaceSearchInputProps) {
  const { isLoaded } = useMapsApi();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { query, setQuery, suggestions, isFetching, fetchPlaceDetails } =
    usePlaceSuggestions({ locationBias, biasRadius, countryCode });

  // Sync external value into the internal query when input is not focused
  // (e.g. swap button in parent). When the user is typing, we don't
  // overwrite their in-progress text.
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setQuery(value);
    }
  }, [value, setQuery]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = async (placeId: string) => {
    setOpen(false);
    const place = await fetchPlaceDetails(placeId);
    if (!place) return;
    const text = place.formattedAddress || place.displayName || "";
    setQuery(text);
    onValueChange(text);
    onPlaceSelect(place);
    inputRef.current?.blur();
  };

  return (
    <div
      ref={containerRef}
      className={className ?? "relative flex-1 min-w-0"}
    >
      <input
        ref={inputRef}
        type="text"
        value={query}
        placeholder={placeholder}
        disabled={disabled || !isLoaded}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          onValueChange(e.target.value);
          setOpen(true);
        }}
        className={
          inputClassName ??
          "bg-transparent flex-1 outline-none text-[15px] font-medium text-slate-700 placeholder:text-slate-400 w-full"
        }
      />
      {open && (suggestions.length > 0 || isFetching) && (
        <ul
          className="absolute left-0 right-0 top-full mt-2 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-72 overflow-y-auto"
          role="listbox"
        >
          {isFetching && suggestions.length === 0 && (
            <li className="flex items-center gap-2 px-4 py-3 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Searching...
            </li>
          )}
          {suggestions.map((s) => (
            <li
              key={s.placeId}
              role="option"
              aria-selected="false"
              className="px-4 py-2.5 cursor-pointer hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
              onMouseDown={(e) => {
                e.preventDefault();
                void handleSelect(s.placeId);
              }}
            >
              <div className="text-sm font-medium text-slate-700 truncate">
                {s.mainText}
              </div>
              {s.secondaryText && (
                <div className="text-xs text-slate-500 truncate">
                  {s.secondaryText}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
