"use client";

import { motion } from "framer-motion";

export type PostTab = "details" | "comments" | "attendance" | "likes";

interface PostTabsProps {
    activeTab: PostTab;
    onChange: (tab: PostTab) => void;
}

export function PostTabs({ activeTab, onChange }: PostTabsProps) {
    const tabs: { id: PostTab; label: string }[] = [
        { id: "details", label: "Details" },
        { id: "comments", label: "Comments" },
        { id: "attendance", label: "Attendance" },
        { id: "likes", label: "Likes" },
    ];

    return (
        <div className="no-scrollbar w-full overflow-x-auto">
            <div className="flex gap-8 border-b border-white/10 px-2 justify-center">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onChange(tab.id)}
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
                                layoutId="activeTabIndicatorPost"
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
