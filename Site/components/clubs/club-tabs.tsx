"use client";

import { motion } from "framer-motion";

export type ClubTab = "posts" | "events" | "members" | "about";

interface ClubTabsProps {
    activeTab: ClubTab;
    onTabChange: (tab: ClubTab) => void;
}

export function ClubTabs({ activeTab, onTabChange }: ClubTabsProps) {
    const tabs: { id: ClubTab; label: string }[] = [
        { id: "posts", label: "Posts" },
        { id: "events", label: "Events" },
        { id: "members", label: "Members" },
        { id: "about", label: "About" },
    ];

    const activeIndex = tabs.findIndex((t) => t.id === activeTab);

    return (
        <div className="relative mx-auto w-full max-w-2xl">
            <div className="flex items-center justify-center gap-1 rounded-full border border-white/10 bg-[#1C1C1E] p-1.5 ring-1 ring-white/5">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`relative z-10 flex-1 rounded-full py-2 text-sm font-medium transition-colors ${activeTab === tab.id
                            ? "text-white"
                            : "text-neutral-400 hover:text-neutral-200"
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}

                {/* Sliding indicator */}
                <motion.div
                    className="absolute left-1.5 top-1.5 h-[calc(100%-0.75rem)] rounded-full bg-[#3A3A3C] shadow-sm"
                    initial={false}
                    animate={{
                        width: `calc((100% - 0.75rem) / ${tabs.length})`,
                        x: `calc(${activeIndex} * (100% + 0px))`, // Simple x movement
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    style={{
                        // We use translateX for the actual movement, but let's use framer-motion's animate for it
                        left: "0.375rem", // 1.5 padding / 4 = 0.375rem? No, p-1.5 is 6px.
                    }}
                />
            </div>
        </div>
    );
}
