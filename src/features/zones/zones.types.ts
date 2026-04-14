import type { LatLng } from "@/shared/types";

export interface RiskZone {
  id: string;
  center: LatLng;
  radius: number;
  riskLevel: number;
  label: string;
  polygon?: LatLng[];
}
