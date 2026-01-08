"use client";

import React from "react";
import { CheckIcon } from "@heroicons/react/24/outline";

export default function TestToastPage() {
    return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-black text-white selection:bg-white/20">
            <div className="flex flex-col items-center gap-8 animate-in fade-in zoom-in-95 duration-1000 ease-out">

                {/* Minimal Status Indicator */}
                <div className="group relative flex h-24 w-24 items-center justify-center rounded-full border border-white/5 bg-white/[0.02] ring-1 ring-white/10 transition-all duration-700 hover:scale-105 hover:bg-white/[0.04]">
                    <div className="absolute inset-0 rounded-full bg-white/5 blur-2xl transition-opacity duration-700 opacity-20 group-hover:opacity-40"></div>
                    <CheckIcon className="h-8 w-8 text-neutral-400/80 transition-colors duration-500 group-hover:text-white/90" strokeWidth={1.5} />
                </div>

                {/* Typography */}
                <div className="space-y-4 text-center">
                    <h1 className="text-2xl font-light tracking-[0.2em] text-white/90 uppercase">
                        System Optimized
                    </h1>
                    <div className="flex items-center justify-center gap-3 text-[13px] font-medium tracking-wide text-neutral-600">
                        <span className="flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                        </span>
                        <span>TOAST MODULE ACTIVE</span>
                        <span className="text-neutral-800">|</span>
                        <span>V.2.0.4</span>
                    </div>
                </div>
            </div>

            {/* Subtle footer */}
            <div className="fixed bottom-12 text-[10px] tracking-widest text-neutral-800 uppercase">
                Campus Connect &bull; UI/UX
            </div>
        </div>
    );
}
