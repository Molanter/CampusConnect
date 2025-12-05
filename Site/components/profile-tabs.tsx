"use client";

import { useState } from "react";

type Tab = "my-events" | "attended" | "comments";

interface ProfileTabsProps {
    activeTab: Tab;
    onTabChange: (tab: Tab) => void;
}

export function ProfileTabs({ activeTab, onTabChange }: ProfileTabsProps) {
    const tabs: { id: Tab; label: string }[] = [
        { id: "my-events", label: "My Events" },
        { id: "attended", label: "Attended" },
        { id: "comments", label: "Comments" },
    ];

    const activeIndex = tabs.findIndex((t) => t.id === activeTab);

    return (
        <div className="relative mx-auto w-full max-w-xl">
            <div className="flex items-center justify-center gap-1 rounded-full border border-white/10 bg-[#1C1C1E] p-1.5 ring-1 ring-white/5">
                {tabs.map((tab, index) => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`relative z-10 flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors ${activeTab === tab.id
                                ? "text-white"
                                : "text-neutral-400 hover:text-neutral-200"
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}

                {/* Sliding indicator */}
                <div
                    className="absolute left-1.5 top-1.5 h-[calc(100%-0.75rem)] rounded-full bg-[#3A3A3C] transition-all duration-300 ease-out"
                    style={{
                        width: `calc((100% - 0.75rem) / ${tabs.length})`,
                        transform: `translateX(${activeIndex * 100}%)`,
                    }}
                />
            </div>
        </div>
    );
}

export type { Tab };
