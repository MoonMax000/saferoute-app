import type { IncidentType } from "./incidents.types";

export interface IncidentTypeConfig {
  label: string;
  shortLabel: string;
  description: string;
  defaultRadius: number;
  /** 1..3 internal severity used by the risk scorer. */
  severity: number;
  /** "blocking" types penalise overlapping routes much harder. */
  kind: "advisory" | "blocking";
  /** Theme colours used in UI + map circle. */
  fill: string;
  stroke: string;
  badge: string;
  iconBg: string;
}

export const INCIDENT_TYPES: Record<IncidentType, IncidentTypeConfig> = {
  robbery: {
    label: "Robbery / violent incident",
    shortLabel: "Robbery",
    description: "Recent crime reported in this area.",
    defaultRadius: 200,
    severity: 3,
    kind: "advisory",
    fill: "rgba(239, 68, 68, 0.18)",
    stroke: "rgba(239, 68, 68, 0.85)",
    badge: "bg-rose-100 text-rose-700 border-rose-200",
    iconBg: "bg-rose-500",
  },
  police: {
    label: "Police activity",
    shortLabel: "Police",
    description: "Active police presence — expect delays or checkpoints.",
    defaultRadius: 150,
    severity: 2,
    kind: "advisory",
    fill: "rgba(59, 130, 246, 0.18)",
    stroke: "rgba(59, 130, 246, 0.85)",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
    iconBg: "bg-blue-500",
  },
  blockage: {
    label: "Road blockage",
    shortLabel: "Blockage",
    description: "Road closed or severely obstructed.",
    defaultRadius: 100,
    severity: 3,
    kind: "blocking",
    fill: "rgba(245, 158, 11, 0.22)",
    stroke: "rgba(245, 158, 11, 0.95)",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    iconBg: "bg-amber-500",
  },
};
