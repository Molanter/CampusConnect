// components/GooglePlacesMap.tsx
"use client";

import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { useMemo } from "react";
import { Event } from "../lib/events"; // adjust path if needed

export type GooglePlacesMapProps = {
  events: Event[];
  userLocation: { lat: number; lng: number } | null;
};

export function GooglePlacesMap({ events, userLocation }: GooglePlacesMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
    libraries: ["places"],
  });

  const center = useMemo(() => {
    if (userLocation) {
      return { lat: userLocation.lat, lng: userLocation.lng };
    }
    // fallback center if location not available
    return { lat: 44.9778, lng: -93.2650 };
  }, [userLocation]);

  if (!apiKey) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-red-400">
        Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-red-400">
        Failed to load map (see console).
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-slate-400">
        Loading map…
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={{ width: "100%", height: "100%" }}
      center={center}
      zoom={14}
      options={{
        disableDefaultUI: true,
        clickableIcons: true,
      }}
    >
      {/* User location marker */}
      {userLocation && (
        <Marker
          position={{
            lat: userLocation.lat,
            lng: userLocation.lng,
          }}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            scale: 6,
            fillColor: "#3b82f6",
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: "white",
          }}
        />
      )}

      {/* Event markers */}
      {events.map((event) => (
        <Marker
          key={event.id}
          position={{
            lat: event.lat,
            lng: event.lng,
          }}
        />
      ))}
    </GoogleMap>
  );
}