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

    return (
        <div className="no-scrollbar w-full overflow-x-auto">
            <div className="flex gap-8 border-b border-white/10">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className="group relative pb-3 text-sm font-medium transition-colors"
                    >
                        <span
                            className={`relative z-10 ${activeTab === tab.id
                                ? "text-white"
                                : "text-zinc-400 group-hover:text-zinc-200"
                                }`}
                        >
                            {tab.label}
                        </span>

                        {activeTab === tab.id && (
                            <motion.div
                                layoutId="activeTabIndicator"
                                className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-[#ffb200]"
                                initial={false}
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
}
