"use client";

import { useEffect } from "react";
import { CheckCircleIcon, ExclamationCircleIcon } from "@heroicons/react/20/solid";

export type ToastType = "success" | "error";

export interface ToastData {
  type: ToastType;
  message: string;
}

interface ToastProps {
  toast: ToastData | null;
  onClear: () => void;
  duration?: number;
}

export default function Toast({ toast, onClear, duration = 4000 }: ToastProps) {
  // UI Definitions - Inverted Modern Capsule Style
  const ui = {
    wrapper: "pointer-events-none fixed inset-x-0 bottom-8 z-[100] flex justify-center px-4",
    base: "pointer-events-auto inline-flex items-center gap-2.5 rounded-full shadow-2xl transition-all duration-300 ease-out animate-in slide-in-from-bottom-4 fade-in px-4 py-2.5",
    variants: {
      success: "bg-foreground",
      error: "bg-foreground"
    },
    iconWrapper: "shrink-0",
    icon: {
      success: "h-5 w-5 text-green-500",
      error: "h-5 w-5 text-red-500"
    },
    message: "text-[15px] font-semibold leading-tight text-background"
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
        {/* Icon */}
        <div className={ui.iconWrapper}>
          {isSuccess ? (
            <CheckCircleIcon className={ui.icon.success} />
          ) : (
            <ExclamationCircleIcon className={ui.icon.error} />
          )}
        </div>

        {/* Content */}
        <span className={ui.message}>{toast.message}</span>
      </div>
    </div>
  );
}