import type { LatLng } from "@/shared/types";

export type IncidentType = "robbery" | "police" | "blockage";

export interface Incident {
  id: string;
  type: IncidentType;
  center: LatLng;
  /** Effective radius in metres (drives the circle on the map + scoring reach). */
  radius: number;
  /** Free-form note left by the reporter. Optional, kept short. */
  note?: string;
  createdAt: number;
}

/** UX state for placing a new incident (similar pattern to PinMode). */
export type IncidentPlacementMode = IncidentType | null;
