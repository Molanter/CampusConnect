export type Mood = "Chill" | "Social" | "Date night" | "Party" | "Outdoors" | "Food";
export type BudgetFilter = "Free" | "$" | "$$" | "$$$" | "Any";
export type TimeFilter = "Now" | "Next 2h" | "Tonight" | "Any";
export type DistanceFilter = "Walkable" | "Short ride" | "Any";

export const moodFilters: Mood[] = [
    "Chill",
    "Social",
    "Date night",
    "Party",
    "Outdoors",
    "Food",
];

export type SuggestedEvent = {
    id: number | string;
    title: string;
    venue: string;
    distanceMinutesWalk: number;
    mood: Mood[];
    priceLevel: "Free" | "$" | "$$" | "$$$";
    timeWindow: string;
    isLiveNow: boolean;
    endsInMinutes: number;
    lat: number;
    lng: number;
    // Optional fields for detailed view
    description?: string;
    images?: string[];
    date?: string;
    hostName?: string;
    hostAvatarUrl?: string; // Changed from null | undefined union to optional string
};
