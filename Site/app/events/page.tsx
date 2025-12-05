"use client";

import { useEffect, useState } from "react";
import {
  Event,
  Mood,
  BudgetFilter,
  TimeFilter,
  DistanceFilter,
  mockEvents,
} from "../../lib/events";
import { collection, getDocs, query, orderBy } from "firebase/firestore/lite";
import { db } from "../../lib/firebase";
import { FiltersBar } from "../../components/filters-bar";

import { useRightSidebar } from "../../components/right-sidebar-context";

import { ExploreEventCard } from "../../components/explore-event-card";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";

const mapContainerStyle = {
  width: "100%",
  height: "400px",
};

const libraries: ("places" | "geometry" | "drawing" | "visualization")[] = ["places"];

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>(mockEvents);
  const [campusEvents, setCampusEvents] = useState<any[]>([]);
  const [campusEventsLoading, setCampusEventsLoading] = useState(false);
  const [activeMood, setActiveMood] = useState<Mood | "Any">("Chill");
  const [activeBudget, setActiveBudget] = useState<BudgetFilter>("Any");
  const [activeTime, setActiveTime] = useState<TimeFilter>("Any");
  const [activeDistance, setActiveDistance] = useState<DistanceFilter>("Any");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const { openView } = useRightSidebar();

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries: libraries,
  });

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setError("Location is not available in this browser. Showing demo spots.");
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });

          const res = await fetch("/api/suggest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              mood: activeMood === "Any" ? null : activeMood,
              budget: "any",
              timeWindow: "now-2h",
            }),
          });

          const data = await res.json();
          console.log("API /api/suggest response:", data);

          if (res.ok && Array.isArray(data.events) && data.events.length > 0) {
            setEvents(data.events);
            setError(null);
          } else if (res.ok) {
            setError("No live suggestions from API, showing demo spots.");
            setEvents(mockEvents);
          } else {
            setError(data.error || "Failed to fetch suggestions. Showing demo spots.");
            setEvents(mockEvents);
          }
        } catch (err: any) {
          console.error("Error fetching suggestions:", err);
          setError("Something went wrong while fetching suggestions. Showing demo spots.");
          setEvents(mockEvents);
        } finally {
          setLoading(false);
        }
      },
      (geoError) => {
        setError(geoError.message || "Location permission denied. Showing demo spots.");
        setLoading(false);
        setEvents(mockEvents);
      }
    );
  }, []);

  // Fetch campus events from Firestore
  useEffect(() => {
    const fetchCampusEvents = async () => {
      try {
        setCampusEventsLoading(true);
        const eventsRef = collection(db, "events");
        const q = query(eventsRef, orderBy("date", "asc"));
        const snap = await getDocs(q);

        const items = snap.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || "Untitled event",
            description: data.description || "",
            venue: data.locationLabel || "Location",
            lat: data.coordinates?.lat,
            lng: data.coordinates?.lng,
            images: data.imageUrls || [],
            date: data.date || "Date",
            timeWindow: data.startTime ? `${data.startTime}${data.endTime ? ` - ${data.endTime}` : ""}` : "Time",
            hostName: data.hostDisplayName || "Host",
            hostAvatarUrl: data.hostPhotoURL,
            // Add required fields for Event type
            mood: ["Social"] as Mood[],
            priceLevel: "$" as const,
            isLiveNow: false,
            distanceMinutesWalk: 10,
            endsInMinutes: 120,
          };
        });

        setCampusEvents(items);
      } catch (err) {
        console.error("Error loading campus events:", err);
      } finally {
        setCampusEventsLoading(false);
      }
    };

    fetchCampusEvents();
  }, []);

  const filteredEvents = events.filter((event) => {
    const moodOk =
      activeMood === "Any" ? true : event.mood.includes(activeMood as Mood);

    const budgetOk =
      activeBudget === "Any"
        ? true
        : activeBudget === "Free"
          ? event.priceLevel === "Free"
          : event.priceLevel === activeBudget;

    const lowerTime = event.timeWindow.toLowerCase();
    const timeOk =
      activeTime === "Any"
        ? true
        : activeTime === "Now" || activeTime === "Next 2h"
          ? event.isLiveNow
          : activeTime === "Tonight"
            ? lowerTime.includes("tonight")
            : true;

    const distanceOk =
      activeDistance === "Any"
        ? true
        : activeDistance === "Walkable"
          ? event.distanceMinutesWalk <= 30
          : event.distanceMinutesWalk > 30;

    return moodOk && budgetOk && timeOk && distanceOk;
  });

  // Filter out past campus events
  const activeCampusEvents = campusEvents.filter((event) => {
    if (!event.date || !event.timeWindow) return true;

    // Try to extract end time from timeWindow
    const timeParts = event.timeWindow.split('-').map((t: string) => t.trim());
    const endTime = timeParts.length > 1 ? timeParts[1] : timeParts[0];

    const eventEnd = new Date(`${event.date}T${endTime}:00`);
    return eventEnd.getTime() > Date.now();
  });

  // Calculate map center - prioritize user location
  const mapCenter = userLocation || (filteredEvents.length > 0 && filteredEvents[0].lat && filteredEvents[0].lng
    ? { lat: filteredEvents[0].lat, lng: filteredEvents[0].lng }
    : { lat: 44.9778, lng: -93.265 });

  return (
    <div className="flex h-full w-full flex-col gap-6 max-w-2xl mx-auto">
      {/* Header & Filters */}
      <section className="flex w-full flex-col gap-4">
        {/* Top header card */}
        <header className="rounded-3xl border border-white/10 bg-white/5 px-6 py-5 text-xs text-slate-200 backdrop-blur-md shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-amber-400/80 font-bold">
                Explore
              </p>
              <p className="mt-1 text-xl font-bold text-white tracking-tight">
                What&apos;s happening
              </p>
              <p className="mt-1.5 text-[13px] text-slate-400 leading-relaxed max-w-md">
                Discover events around you. Filter by mood, budget, and time to find your vibe.
              </p>
            </div>
            <div className="flex flex-col items-end gap-2 text-[11px]">
              <span className={`rounded-full border px-3 py-1 font-medium ${loading ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"}`}>
                {loading ? "Searching..." : "Live Updates"}
              </span>
            </div>
          </div>
        </header>

        {/* Filters strip */}
        <div className="rounded-3xl border border-white/10 bg-black/20 px-4 py-3 backdrop-blur-sm">
          <FiltersBar
            activeMood={activeMood}
            setActiveMood={setActiveMood}
            activeBudget={activeBudget}
            setActiveBudget={setActiveBudget}
            activeTime={activeTime}
            setActiveTime={setActiveTime}
            activeDistance={activeDistance}
            setActiveDistance={setActiveDistance}
          />
        </div>
      </section>

      {/* Map Section */}
      <section className="w-full">
        <div className="rounded-3xl overflow-hidden border border-white/10 bg-neutral-900 shadow-xl">
          {isLoaded && filteredEvents.some(e => e.lat && e.lng) ? (
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={mapCenter}
              zoom={13}
              options={{
                disableDefaultUI: true,
                zoomControl: true,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
                styles: [
                  {
                    elementType: "geometry",
                    stylers: [{ color: "#1d2c4d" }]
                  },
                  {
                    elementType: "labels.text.fill",
                    stylers: [{ color: "#8ec3b9" }]
                  },
                  {
                    elementType: "labels.text.stroke",
                    stylers: [{ color: "#1a3646" }]
                  },
                  {
                    featureType: "administrative.country",
                    elementType: "geometry.stroke",
                    stylers: [{ color: "#4b6878" }]
                  },
                  {
                    featureType: "administrative.land_parcel",
                    elementType: "labels.text.fill",
                    stylers: [{ color: "#64779e" }]
                  },
                  {
                    featureType: "administrative.province",
                    elementType: "geometry.stroke",
                    stylers: [{ color: "#4b6878" }]
                  },
                  {
                    featureType: "landscape.man_made",
                    elementType: "geometry.stroke",
                    stylers: [{ color: "#334e87" }]
                  },
                  {
                    featureType: "landscape.natural",
                    elementType: "geometry",
                    stylers: [{ color: "#023e58" }]
                  },
                  {
                    featureType: "poi",
                    elementType: "geometry",
                    stylers: [{ color: "#283d6a" }]
                  },
                  {
                    featureType: "poi",
                    elementType: "labels.text.fill",
                    stylers: [{ color: "#6f9ba5" }]
                  },
                  {
                    featureType: "poi",
                    elementType: "labels.text.stroke",
                    stylers: [{ color: "#1d2c4d" }]
                  },
                  {
                    featureType: "poi.park",
                    elementType: "geometry.fill",
                    stylers: [{ color: "#023e58" }]
                  },
                  {
                    featureType: "poi.park",
                    elementType: "labels.text.fill",
                    stylers: [{ color: "#3C7680" }]
                  },
                  {
                    featureType: "road",
                    elementType: "geometry",
                    stylers: [{ color: "#304a7d" }]
                  },
                  {
                    featureType: "road",
                    elementType: "labels.text.fill",
                    stylers: [{ color: "#98a5be" }]
                  },
                  {
                    featureType: "road",
                    elementType: "labels.text.stroke",
                    stylers: [{ color: "#1d2c4d" }]
                  },
                  {
                    featureType: "road.highway",
                    elementType: "geometry",
                    stylers: [{ color: "#2c6675" }]
                  },
                  {
                    featureType: "road.highway",
                    elementType: "geometry.stroke",
                    stylers: [{ color: "#255763" }]
                  },
                  {
                    featureType: "road.highway",
                    elementType: "labels.text.fill",
                    stylers: [{ color: "#b0d5df" }]
                  },
                  {
                    featureType: "road.highway",
                    elementType: "labels.text.stroke",
                    stylers: [{ color: "#023e58" }]
                  },
                  {
                    featureType: "transit",
                    elementType: "labels.text.fill",
                    stylers: [{ color: "#98a5be" }]
                  },
                  {
                    featureType: "transit",
                    elementType: "labels.text.stroke",
                    stylers: [{ color: "#1d2c4d" }]
                  },
                  {
                    featureType: "transit.line",
                    elementType: "geometry.fill",
                    stylers: [{ color: "#283d6a" }]
                  },
                  {
                    featureType: "transit.station",
                    elementType: "geometry",
                    stylers: [{ color: "#3a4762" }]
                  },
                  {
                    featureType: "water",
                    elementType: "geometry",
                    stylers: [{ color: "#0e1626" }]
                  },
                  {
                    featureType: "water",
                    elementType: "labels.text.fill",
                    stylers: [{ color: "#4e6d70" }]
                  }
                ]
              }}
            >
              {/* Campus events markers */}
              {campusEvents.map((event) =>
                event.lat && event.lng ? (
                  <Marker
                    key={`campus-${event.id}`}
                    position={{ lat: event.lat, lng: event.lng }}
                    title={event.title}
                  />
                ) : null
              )}

              {/* Filtered events markers */}
              {filteredEvents.map((event) =>
                event.lat && event.lng ? (
                  <Marker
                    key={event.id}
                    position={{ lat: event.lat, lng: event.lng }}
                    title={event.title}
                  />
                ) : null
              )}
            </GoogleMap>
          ) : (
            <div className="h-[400px] flex items-center justify-center bg-neutral-900">
              <p className="text-neutral-500 text-sm">
                {!isLoaded ? "Loading map..." : "No locations to display"}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Event Lists */}
      <section className="flex-1 space-y-6">
        {/* Campus Events */}
        {activeCampusEvents.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-2 py-2 mb-2">
              <h3 className="text-sm font-semibold text-amber-400">Campus Events</h3>
              <span className="text-xs text-slate-400">{activeCampusEvents.length} event{activeCampusEvents.length === 1 ? "" : "s"}</span>
            </div>
            <div className="space-y-3">
              {activeCampusEvents.map((event) => (
                <ExploreEventCard
                  key={`campus-${event.id}`}
                  id={event.id}
                  title={event.title}
                  description={event.description || ""}
                  image={(event.images && event.images[0]) || undefined}
                  date={event.date}
                  time={event.timeWindow}
                  location={event.venue}
                  coordinates={event.lat && event.lng ? { lat: event.lat, lng: event.lng } : null}
                  onCommentsClick={() => openView("comments", event)}
                  onAttendanceClick={() => openView("attendance", event)}
                  onDetailsClick={() => openView("details", event)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Found Nearby */}
        <div>
          <div className="flex items-center justify-between px-2 py-2 mb-2">
            <h3 className="text-sm font-semibold text-emerald-400">Found Nearby</h3>
            <span className="text-xs text-slate-400">
              {filteredEvents.length} result{filteredEvents.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="space-y-3">
            {filteredEvents.map((event) => (
              <ExploreEventCard
                key={event.id}
                id={event.id.toString()}
                title={event.title}
                description={event.description || ""}
                image={(event.images && event.images[0]) || undefined}
                date="Today"
                time={event.timeWindow}
                location={event.venue}
                coordinates={event.lat && event.lng ? { lat: event.lat, lng: event.lng } : null}
                showOpenLabel={true}
                onCommentsClick={() => openView("comments", event)}
                onAttendanceClick={() => openView("attendance", event)}
                onDetailsClick={() => openView("details", event)}
              />
            ))}
          </div>

          {filteredEvents.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-slate-500">No events found matching your filters.</p>
              <button
                onClick={() => {
                  setActiveMood("Any");
                  setActiveBudget("Any");
                  setActiveTime("Any");
                  setActiveDistance("Any");
                }}
                className="mt-4 text-amber-400 hover:text-amber-300 text-sm font-medium"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}