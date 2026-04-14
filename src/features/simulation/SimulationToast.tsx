"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ShieldCheck, X } from "lucide-react";

export interface ToastData {
  id: string;
  message: string;
  type: "danger" | "warning" | "safe";
  zoneLabel: string;
}

interface SimulationToastProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

export function SimulationToast({ toasts, onDismiss }: SimulationToastProps) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastData;
  onDismiss: (id: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(toast.id), 300);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const bgClass =
    toast.type === "danger"
      ? "from-red-600 to-red-700"
      : toast.type === "warning"
      ? "from-amber-500 to-orange-600"
      : "from-emerald-500 to-emerald-600";

  return (
    <div
      className={`bg-gradient-to-r ${bgClass} text-white rounded-xl shadow-2xl px-4 py-3 flex items-start gap-3 transition-all duration-300 ${
        visible
          ? "opacity-100 translate-x-0"
          : "opacity-0 translate-x-8"
      }`}
    >
      {toast.type === "safe" ? (
        <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5" />
      ) : (
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold">{toast.message}</p>
        <p className="text-[11px] opacity-80 mt-0.5">{toast.zoneLabel}</p>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-1 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
