export interface EventLogEntry {
  id: string;
  timestamp: string;
  type: "enter" | "exit" | "info";
  zone: string;
  riskLevel: number;
  coords?: { lat: number; lng: number };
}
