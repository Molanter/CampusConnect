// lib/events.ts

export type Mood = "Chill" | "Social" | "Date night" | "Party" | "Outdoors" | "Food";
export type BudgetFilter = "Any" | "Free" | "$" | "$$" | "$$$";
export type TimeFilter = "Any" | "Now" | "Next 2h" | "Tonight";
export type DistanceFilter = "Any" | "Walkable" | "Short ride";

export type Event = {
  id: number;
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
  description?: string;
  images?: string[];
  hostName?: string;
  hostAvatarUrl?: string;
};

export const mockEvents: Event[] = [
  {
    id: 1,
    title: "Open-air wine bar",
    venue: "Third Street Terrace",
    distanceMinutesWalk: 5,
    mood: ["Chill", "Date night"],
    priceLevel: "$$",
    timeWindow: "Now – 10:30 PM",
    isLiveNow: true,
    endsInMinutes: 90,
    lat: 44.9778,
    lng: -93.265,
    description: "Enjoy a relaxing evening on the terrace with a curated selection of wines and light bites. Perfect for a date night or catching up with friends.",
    images: ["https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?q=80&w=2940&auto=format&fit=crop"],
    hostName: "Sarah J.",
    hostAvatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=1887&auto=format&fit=crop",
  },
  {
    id: 2,
    title: "Live DJ + no cover",
    venue: "Concrete Room",
    distanceMinutesWalk: 8,
    mood: ["Party", "Social"],
    priceLevel: "$",
    timeWindow: "11:00 PM – 2:00 AM",
    isLiveNow: false,
    endsInMinutes: 0,
    lat: 44.9785,
    lng: -93.27,
    description: "Local DJ spinning house and techno all night. No cover charge, great vibes, and cheap drinks.",
    images: ["https://images.unsplash.com/photo-1570125909232-eb263c188f7e?q=80&w=2941&auto=format&fit=crop"],
    hostName: "Mike T.",
  },
  {
    id: 3,
    title: "Street tacos stand",
    venue: "Pine & 7th",
    distanceMinutesWalk: 3,
    mood: ["Food", "Chill"],
    priceLevel: "$",
    timeWindow: "Now – 1:00 AM",
    isLiveNow: true,
    endsInMinutes: 60,
    lat: 44.9765,
    lng: -93.262,
    description: "Best street tacos in town. Al pastor, carne asada, and veggie options available. Grab a quick bite!",
    images: ["https://images.unsplash.com/photo-1565299585323-38d6b0865b47?q=80&w=2880&auto=format&fit=crop"],
    hostName: "Taco King",
  },
  {
    id: 4,
    title: "Board game night",
    venue: "Tabletop Nook",
    distanceMinutesWalk: 11,
    mood: ["Chill", "Social"],
    priceLevel: "$$",
    timeWindow: "7:00 – 10:00 PM",
    isLiveNow: false,
    endsInMinutes: 0,
    lat: 44.9792,
    lng: -93.259,
    description: "Bring your own games or play ours! Friendly atmosphere, snacks available. Newcomers welcome.",
    images: ["https://images.unsplash.com/photo-1632501641765-e568d28b0015?q=80&w=2874&auto=format&fit=crop"],
    hostName: "Tabletop Club",
  },
];

export const moodFilters: Mood[] = [
  "Chill",
  "Social",
  "Date night",
  "Party",
  "Outdoors",
  "Food",
];