"use client";

import { useEffect } from "react";

export type ToastType = "success" | "error";

export interface ToastData {
  type: ToastType;
  message: string;
}

interface ToastProps {
  toast: ToastData | null;
  onClear: () => void;
  duration?: number; // default 3500ms
}

export default function Toast({ toast, onClear, duration = 3500 }: ToastProps) {
  // Auto-hide
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => onClear(), duration);
    return () => clearTimeout(t);
  }, [toast, duration, onClear]);

  if (!toast) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center">
      <div
        className={`pointer-events-auto inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs shadow-lg transition-opacity ${
          toast.type === "success"
            ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-50"
            : "border-red-400/60 bg-red-500/10 text-red-50"
        }`}
      >
        <span className="font-medium">
          {toast.type === "success" ? "Saved" : "Error"}
        </span>
        <span className="text-[11px] opacity-90">{toast.message}</span>
      </div>
    </div>
  );
}