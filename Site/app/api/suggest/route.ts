import { NextResponse } from "next/server";

type Mood = "Chill" | "Social" | "Date night" | "Party" | "Outdoors" | "Food";
type Budget = "Free" | "$" | "$$" | "$$$" | "any";

type Event = {
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
};

type GooglePlace = {
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
  currentOpeningHours?: {
    openNow?: boolean;
  };
  priceLevel?: number | string;
  types?: string[];
};

const DEFAULT_RADIUS_METERS = 3000; // 3km

// Straight-line fallback distance (if Distance Matrix fails)
function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371000; // meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function inferMood(types: string[] | undefined): Mood[] {
  if (!types) return ["Chill"];
  const t = types;
  const moods = new Set<Mood>();

  if (t.includes("bar") || t.includes("night_club")) {
    moods.add("Party");
    moods.add("Social");
  }
  if (t.includes("restaurant") || t.includes("cafe") || t.includes("meal_takeaway")) {
    moods.add("Food");
    moods.add("Chill");
  }
  if (t.includes("park") || t.includes("tourist_attraction")) {
    moods.add("Outdoors");
    moods.add("Chill");
  }
  if (t.includes("movie_theater") || t.includes("museum")) {
    moods.add("Date night");
    moods.add("Chill");
  }

  if (moods.size === 0) {
    moods.add("Chill");
  }

  return Array.from(moods);
}

function inferPriceLevel(
  priceLevel?: number | string,
  types?: string[]
): "Free" | "$" | "$$" | "$$$" {
  // If Google explicitly gives a numeric level, honor that.
  if (typeof priceLevel === "number") {
    if (priceLevel === 0 || priceLevel === 1) return "$";
    if (priceLevel === 2) return "$$";
    if (priceLevel >= 3) return "$$$";
    return "$$";
  }

  // If Google explicitly gives a string level, map it.
  if (typeof priceLevel === "string") {
    const v = priceLevel.toUpperCase();
    if (v.includes("INEXPENSIVE") || v.includes("PRICE_LEVEL_INEXPENSIVE")) return "$";
    if (v.includes("MODERATE") || v.includes("PRICE_LEVEL_MODERATE")) return "$$";
    if (
      v.includes("EXPENSIVE") ||
      v.includes("VERY_EXPENSIVE") ||
      v.includes("PRICE_LEVEL_EXPENSIVE") ||
      v.includes("PRICE_LEVEL_VERY_EXPENSIVE")
    )
      return "$$$";
  }

  // No explicit price level from Google: infer from place types.
  const freeLikeTypes = new Set([
    "park",
    "tourist_attraction",
    "campground",
    "natural_feature",
    "place_of_worship",
  ]);
  if (types && types.some((t) => freeLikeTypes.has(t))) {
    return "Free";
  }

  // Default when we don't know: mid-range
  return "$$";
}

function matchesBudget(
  eventPrice: "Free" | "$" | "$$" | "$$$",
  budget: Budget
): boolean {
  if (budget === "any") return true;
  if (budget === "Free") return eventPrice === "Free";
  return eventPrice === budget;
}

// Call Distance Matrix API to get walking durations (seconds) for all places
async function getWalkingDurationsSeconds(
  originLat: number,
  originLng: number,
  destinations: { lat: number; lng: number }[],
  apiKey: string
): Promise<(number | null)[]> {
  if (!destinations.length) return [];

  const params = new URLSearchParams();
  params.set("origins", `${originLat},${originLng}`);
  params.set(
    "destinations",
    destinations.map((d) => `${d.lat},${d.lng}`).join("|")
  );
  params.set("mode", "walking");
  params.set("key", apiKey);

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`;
  console.log("Distance Matrix request URL:", url);

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    console.error("Distance Matrix error:", res.status, text);
    return new Array(destinations.length).fill(null);
  }

  const json = await res.json();
  console.log("Distance Matrix raw response:", JSON.stringify(json, null, 2));

  const row = json.rows?.[0];
  if (!row || !Array.isArray(row.elements)) {
    return new Array(destinations.length).fill(null);
  }

  return row.elements.map((el: any) =>
    el.status === "OK" && el.duration?.value != null ? el.duration.value : null
  );
}

function mapPlaceToEvent(
  place: GooglePlace,
  index: number,
  userLat: number,
  userLng: number,
  walkingDurationSeconds?: number | null
): Event {
  const lat = place.location?.latitude ?? userLat;
  const lng = place.location?.longitude ?? userLng;

  let distanceMinutesWalk: number;
  if (walkingDurationSeconds != null) {
    distanceMinutesWalk = Math.max(1, Math.round(walkingDurationSeconds / 60));
  } else {
    const distanceMeters = haversineDistanceMeters(userLat, userLng, lat, lng);
    const WALKING_SPEED_M_PER_MIN = 83.3;
    const walkMinutesRaw = distanceMeters / WALKING_SPEED_M_PER_MIN;
    distanceMinutesWalk = Math.max(3, Math.round(walkMinutesRaw));
  }

  const openNow = place.currentOpeningHours?.openNow ?? false;

  let timeWindow = "Closed for now";
  let endsInMinutes = 0;
  if (openNow) {
    timeWindow = "Open now · ~2 hours";
    endsInMinutes = 120;
  }

  const title = place.displayName?.text ?? "Nearby place";

  // Infer initial price level from Google data and types
  let priceLevel = inferPriceLevel(place.priceLevel, place.types);

  // If Google didn't explicitly give a paid level and the name looks like a park,
  // force it to "Free" as a UX heuristic.
  if (
    priceLevel !== "Free" &&
    title.toLowerCase().includes("park") &&
    (!place.priceLevel || place.priceLevel === 0)
  ) {
    priceLevel = "Free";
  }

  return {
    id: index + 1,
    title,
    venue: place.formattedAddress ?? "Nearby",
    distanceMinutesWalk,
    mood: inferMood(place.types),
    priceLevel,
    timeWindow,
    isLiveNow: openNow,
    endsInMinutes,
    lat,
    lng,
    };
}

export async function POST(req: Request) {
  const GOOGLE_API_KEY =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

  if (!GOOGLE_API_KEY) {
    return NextResponse.json(
      {
        error:
          "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY / GOOGLE_MAPS_API_KEY is not configured in .env.local",
      },
      { status: 500 }
    );
  }

  console.log("---- /api/suggest called ----");
  const body = await req.json();
  console.log("Request body:", body);

  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const mood = (body.mood as Mood | null) ?? null;
  const budget = (body.budget as Budget | null) ?? "any";
  const radius = Number(body.radius ?? DEFAULT_RADIUS_METERS);

  console.log("Parsed params:", { lat, lng, mood, budget, radius });

  if (!lat || !lng) {
    return NextResponse.json(
      { error: "Missing or invalid lat/lng in request body" },
      { status: 400 }
    );
  }

  const placesUrl = "https://places.googleapis.com/v1/places:searchNearby";

  const payload = {
    locationRestriction: {
      circle: {
        center: {
          latitude: lat,
          longitude: lng,
        },
        radius: radius,
      },
    },
    includedTypes: [
      "bar",
      "night_club",
      "restaurant",
      "cafe",
      "meal_takeaway",
      "park",
      "tourist_attraction",
    ],
    maxResultCount: 20,
    rankPreference: "DISTANCE",
  };

  console.log(
    "Sending Google Places request with payload:",
    JSON.stringify(payload, null, 2)
  );

  try {
    const res = await fetch(placesUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask":
          "places.displayName,places.formattedAddress,places.location,places.currentOpeningHours.openNow,places.types,places.priceLevel",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Google Places error:", res.status, text);
      return NextResponse.json(
        { error: "Failed to fetch nearby places" },
        { status: 502 }
      );
    }

    const json = await res.json();
    console.log("Google Places raw response:", JSON.stringify(json, null, 2));
    const places: GooglePlace[] = (json.places ?? []) as GooglePlace[];

    // Build destinations for Distance Matrix
    const destinations = places.map((place) => ({
      lat: place.location?.latitude ?? lat,
      lng: place.location?.longitude ?? lng,
    }));

    // Get real walking durations (seconds)
    const walkingDurations = await getWalkingDurationsSeconds(
      lat,
      lng,
      destinations,
      GOOGLE_API_KEY
    );

    // Map places to events, using real walking time where available
    let events = places.map((place, index) =>
      mapPlaceToEvent(place, index, lat, lng, walkingDurations[index])
    );

    // Filter by budget
    events = events.filter((e) => matchesBudget(e.priceLevel, budget));

    // Mood-based ranking with open places always on top
    if (mood) {
      events.sort((a, b) => {
        // Open vs closed: open always first
        if (a.isLiveNow && !b.isLiveNow) return -1;
        if (!a.isLiveNow && b.isLiveNow) return 1;

        const aHas = a.mood.includes(mood);
        const bHas = b.mood.includes(mood);
        if (aHas && !bHas) return -1;
        if (!aHas && bHas) return 1;

        return a.distanceMinutesWalk - b.distanceMinutesWalk;
      });
    } else {
      events.sort((a, b) => {
        // Open vs closed: open always first
        if (a.isLiveNow && !b.isLiveNow) return -1;
        if (!a.isLiveNow && b.isLiveNow) return 1;

        return a.distanceMinutesWalk - b.distanceMinutesWalk;
      });
    }

    // Limit results
    events = events.slice(0, 8);

    console.log("---- end /api/suggest ----");
    return NextResponse.json({ events });
  } catch (err) {
    console.error("Error calling Google Places or Distance Matrix:", err);
    return NextResponse.json(
      { error: "Failed to fetch suggestions" },
      { status: 500 }
    );
  }
}