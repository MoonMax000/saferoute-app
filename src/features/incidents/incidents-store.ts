"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { LatLng } from "@/shared/types";
import type { Incident, IncidentType } from "./incidents.types";
import { INCIDENT_TYPES } from "./incidents-config";

interface IncidentsState {
  incidents: Incident[];
  addIncident: (input: { type: IncidentType; center: LatLng; radius?: number; note?: string }) => Incident;
  removeIncident: (id: string) => void;
  clearIncidents: () => void;
}

function nextId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `inc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useIncidentsStore = create<IncidentsState>()(
  persist(
    (set) => ({
      incidents: [],
      addIncident: ({ type, center, radius, note }) => {
        const cfg = INCIDENT_TYPES[type];
        const incident: Incident = {
          id: nextId(),
          type,
          center,
          radius: radius ?? cfg.defaultRadius,
          note,
          createdAt: Date.now(),
        };
        set((state) => ({ incidents: [...state.incidents, incident] }));
        return incident;
      },
      removeIncident: (id) =>
        set((state) => ({
          incidents: state.incidents.filter((i) => i.id !== id),
        })),
      clearIncidents: () => set({ incidents: [] }),
    }),
    {
      name: "navshield.incidents.v1",
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? {
              getItem: () => null,
              setItem: () => undefined,
              removeItem: () => undefined,
            }
          : window.localStorage,
      ),
      // Do not hydrate during SSR; let the client take over once mounted.
      skipHydration: false,
    },
  ),
);
