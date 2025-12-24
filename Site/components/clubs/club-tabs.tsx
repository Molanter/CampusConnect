"use client";

export type ClubTab = "posts" | "events" | "members" | "about";

interface ClubTabsProps {
    activeTab: ClubTab;
    onTabChange: (tab: ClubTab) => void;
    isNarrow?: boolean;
}

export function ClubTabs({ activeTab, onTabChange, isNarrow = false }: ClubTabsProps) {
    const tabs: { id: ClubTab; label: string }[] = [
        { id: "posts", label: "Posts" },
        { id: "events", label: "Events" },
        { id: "members", label: "Members" },
        { id: "about", label: "About" },
    ];

    return (
        <div className="w-full">
            <div className={`flex w-full items-center overflow-x-auto pb-2 scrollbar-hide ${isNarrow ? "justify-start" : "justify-start md:justify-center md:pb-0"}`}>
                <div className="flex min-w-max items-center gap-1 rounded-2xl border border-white/5 bg-white/[0.02] p-1 backdrop-blur-sm">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={`relative min-w-[100px] rounded-xl px-4 py-2 text-sm font-medium transition-all ${activeTab === tab.id
                                ? "bg-white/10 text-white shadow-sm"
                                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]"
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
