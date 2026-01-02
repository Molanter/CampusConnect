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

export default function Toast({ toast, onClear, duration = 8000 }: ToastProps) {
  // UI Definitions
  const ui = {
    wrapper: "pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex justify-center",
    base: "pointer-events-auto inline-flex items-center gap-3 rounded-full px-4 py-2.5 backdrop-blur-xl ring-1 shadow-2xl transition-all animate-in fade-in slide-in-from-bottom-2",
    variants: {
      success: "bg-emerald-950/40 ring-emerald-500/20",
      error: "bg-red-950/40 ring-red-500/20"
    },
    label: {
      base: "text-[13px] font-semibold tracking-wide",
      success: "text-emerald-100",
      error: "text-red-100"
    },
    message: "text-[12px] text-white/70 font-medium"
  };

  // Auto-hide
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => onClear(), duration);
    return () => clearTimeout(t);
  }, [toast, duration, onClear]);

  if (!toast) return null;

  const isSuccess = toast.type === "success";

  return (
    <div className={ui.wrapper}>
      <div className={`${ui.base} ${isSuccess ? ui.variants.success : ui.variants.error}`}>
        {/* Content */}
        <div className="flex items-baseline gap-2">
          <span className={`${ui.label.base} ${isSuccess ? ui.label.success : ui.label.error}`}>
            {isSuccess ? "Saved" : "Error"}
          </span>
          <span className={ui.message}>{toast.message}</span>
        </div>
      </div>
    </div>
  );
}