"use client";

import { Post } from "@/lib/posts";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { ChevronRightIcon, MapPinIcon } from "@heroicons/react/24/outline";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";

/* -----------------------------
   Google Maps setup
------------------------------ */

const libraries: ("places")[] = ["places"];

/* DARK map style (your existing one) */
const mapStylesDark = [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
];

/* LIGHT map style (Apple-like neutral) */
const mapStylesLight = [
    { elementType: "geometry", stylers: [{ color: "#f5f5f7" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#111827" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#e5e7eb" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#dbeafe" }] },
];

/* -----------------------------
   Component
------------------------------ */

interface EventCardProps {
    event: Post;
}

export function EventCard({ event }: EventCardProps) {
    const router = useRouter();
    const [isDark, setIsDark] = useState(false);

    /* Detect theme via html.dark */
    useEffect(() => {
        const root = document.documentElement;

        const updateTheme = () => {
            setIsDark(root.classList.contains("dark"));
        };

        updateTheme();

        const observer = new MutationObserver(updateTheme);
        observer.observe(root, { attributes: true, attributeFilter: ["class"] });

        return () => observer.disconnect();
    }, []);

    const { isLoaded } = useJsApiLoader({
        id: "google-map-script",
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
        libraries,
    });

    const {
        id,
        title,
        imageUrls,
        date,
        startTime,
        locationLabel,
        coordinates,
    } = event;

    const formattedDate = date ? format(new Date(date), "MMM d") : "";
    const formattedTime = startTime || "";
    const bgImage = imageUrls?.[0] ?? null;

    return (
        <div
            onClick={() => router.push(`/posts/${id}`)}
            className="group relative flex aspect-video w-[280px] shrink-0 flex-col justify-between overflow-hidden cc-radius-24 cc-section transition-all duration-300 hover:-translate-y-1 hover:shadow-lg cursor-pointer"
        >
            {/* Background */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                {bgImage ? (
                    <img
                        src={bgImage}
                        alt={title || "Event"}
                        className="!h-full !w-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                    />
                ) : coordinates && isLoaded ? (
                    <GoogleMap
                        mapContainerStyle={{ width: "100%", height: "100%" }}
                        center={coordinates}
                        zoom={15}
                        options={{
                            disableDefaultUI: true,
                            draggable: false,
                            styles: isDark ? mapStylesDark : mapStylesLight,
                        }}
                    >
                        <Marker position={coordinates} />
                    </GoogleMap>
                ) : (
                    /* Fallback map */
                    <div className="h-full w-full bg-secondary/10 flex items-center justify-center">
                        <MapPinIcon className="h-6 w-6 text-secondary" />
                    </div>
                )}

                {/* Readability gradients */}
                <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/40 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/50 to-transparent" />
            </div>

            {/* Content */}
            <div className="relative z-10 flex h-full flex-col p-4">
                {formattedDate && (
                    <div className="absolute top-3 right-3 cc-radius-menu cc-glass px-2.5 py-1 text-[10px] text-foreground shadow-sm">
                        {formattedDate}
                        {formattedTime && <span className="ml-1 opacity-60">• {formattedTime}</span>}
                    </div>
                )}

                <div className="mt-auto pb-10">
                    <h3 className="line-clamp-2 text-lg font-bold text-foreground leading-tight">
                        {title}
                    </h3>
                </div>

                <div className="absolute bottom-3 left-3">
                    <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 cc-glass transition-all group-hover:brightness-[0.9] dark:group-hover:brightness-110 shadow-sm">
                        <span className="text-xs font-bold text-brand">View Details</span>
                        <ChevronRightIcon className="h-3.5 w-3.5 text-brand transition-transform group-hover:translate-x-0.5" />
                    </div>
                </div>
            </div>
        </div>
    );
}