"use client";

import { AlertTriangle, Shield, ShieldAlert } from "lucide-react";
import { getRiskColor } from "@/features/zones";
import type { RouteAlert } from "./route.types";

interface RouteAlertsProps {
  alerts: RouteAlert[];
  userZoneAlert: { label: string; riskLevel: number } | null;
}

export function RouteAlerts({ alerts, userZoneAlert }: RouteAlertsProps) {
  if (alerts.length === 0 && !userZoneAlert) return null;

  const highRiskAlerts = alerts.filter((a) => a.riskLevel >= 7);
  const mediumAlerts = alerts.filter(
    (a) => a.riskLevel >= 5 && a.riskLevel < 7
  );
  const crossingCount = alerts.filter((a) => a.type === "crosses").length;

  return (
    <div className="animate-fade-in flex flex-col gap-3">
      <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
        <span>Alerts</span>
        <div className="h-px bg-slate-200 flex-1" />
        {alerts.length > 0 && (
          <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
            {alerts.length}
          </span>
        )}
      </h3>

      {userZoneAlert && (
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 shadow-sm">
          <div className="relative flex-shrink-0 mt-0.5">
            <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-30" />
            <ShieldAlert className="w-5 h-5 text-red-600 relative z-10" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-red-800">
              You are in a risk zone
            </p>
            <p className="text-[12px] text-red-600 mt-0.5">
              {userZoneAlert.label} -- Risk level{" "}
              {userZoneAlert.riskLevel}/10
            </p>
          </div>
        </div>
      )}

      {alerts.length > 0 && (
        <div
          className={`flex items-start gap-3 p-3.5 rounded-xl border shadow-sm ${
            highRiskAlerts.length > 0
              ? "bg-gradient-to-r from-red-50 to-rose-50 border-red-200"
              : mediumAlerts.length > 0
              ? "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200"
              : "bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200"
          }`}
        >
          {highRiskAlerts.length > 0 ? (
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          ) : (
            <Shield className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <p
              className={`text-[13px] font-bold ${
                highRiskAlerts.length > 0
                  ? "text-red-800"
                  : "text-amber-800"
              }`}
            >
              Route passes through {crossingCount} risk zone
              {crossingCount !== 1 ? "s" : ""}
              {alerts.length > crossingCount &&
                `, near ${alerts.length - crossingCount} more`}
            </p>
            <div className="mt-2 flex flex-col gap-1.5">
              {alerts.map((alert) => (
                <div
                  key={alert.zoneId}
                  className="flex items-center gap-2 text-[12px]"
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: getRiskColor(alert.riskLevel),
                    }}
                  />
                  <span className="text-slate-600 truncate">
                    {alert.zoneLabel}
                  </span>
                  <span className="text-slate-400">--</span>
                  <span
                    className={`font-semibold whitespace-nowrap ${
                      alert.riskLevel >= 7
                        ? "text-red-600"
                        : alert.riskLevel >= 5
                        ? "text-amber-600"
                        : "text-slate-500"
                    }`}
                  >
                    {alert.riskLabel}
                  </span>
                  {alert.type === "near" && (
                    <span className="text-[10px] text-slate-400 font-medium">
                      (nearby)
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
