import type { LatLng } from "@/shared/types";

export interface RouteSegment {
  path: LatLng[];
  riskScore: number;
  color: string;
}

export interface RouteResult {
  segments: RouteSegment[];
  totalDistance: string;
  totalDuration: string;
  averageRisk: number;
  overallRiskLabel: string;
  polylinePath: LatLng[];
}

export interface RouteOption {
  id: number;
  label: string;
  route: RouteResult;
  selected: boolean;
}

export interface RouteAlert {
  zoneId: string;
  zoneLabel: string;
  riskLevel: number;
  riskLabel: string;
  type: "crosses" | "near";
}
