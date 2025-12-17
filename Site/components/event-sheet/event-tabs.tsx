"use client";

interface EventTabsProps {
    activeTab: "details" | "discussion" | "attendees";
    onChange: (tab: "details" | "discussion" | "attendees") => void;
    isEvent: boolean;
}

export function EventTabs({ activeTab, onChange, isEvent }: EventTabsProps) {
    const tabs = [
        { id: "details", label: "Details" },
        { id: "discussion", label: "Discussion" },
        ...(isEvent ? [{ id: "attendees", label: "Attendees" }] : []),
    ] as const;

    return (
        <div className="flex w-full items-center rounded-xl bg-white/5 p-1 ring-1 ring-white/10">
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        onClick={() => onChange(tab.id as "details" | "discussion" | "attendees")}
                        className={`relative flex-1 rounded-lg py-2 text-sm font-medium transition-all ${isActive
                            ? "bg-neutral-800 text-white shadow-sm"
                            : "text-neutral-400 hover:bg-white/5 hover:text-white"
                            }`}
                    >
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
}
