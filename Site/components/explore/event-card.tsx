"use client";

import { Post } from "@/lib/posts";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ChevronRightIcon, MapPinIcon } from "@heroicons/react/24/outline";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";

const libraries: ("places" | "geometry" | "drawing" | "visualization")[] = ["places"];

const mapStyles = [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
    { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
    { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
    { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
    { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
    { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
    { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] }
];

interface EventCardProps {
    event: Post;
}

export function EventCard({ event }: EventCardProps) {
    const router = useRouter();

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
        libraries: libraries,
    });

    const {
        id,
        title,
        content,
        imageUrls,
        date,
        startTime,
        locationLabel,
    } = event;

    // Formatting Date
    const formattedDate = date ? format(new Date(date), "MMM d") : "";
    const formattedTime = startTime || "";

    const bgImage = (imageUrls && imageUrls.length > 0 && imageUrls[0]) ? imageUrls[0] : null;
    const coordinates = event.coordinates;

    return (
        <div
            onClick={() => router.push(`/posts/${id}`)}
            className="group relative flex aspect-video w-[280px] shrink-0 flex-col justify-between overflow-hidden rounded-3xl border border-white/5 bg-[#050510] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:scale-[1.01] hover:border-white/10 hover:shadow-lg hover:shadow-indigo-900/10 active:scale-[0.98] cursor-pointer"
        >
            {/* Background Layer (Full Bleed) */}
            <div className="absolute inset-0 z-0 select-none pointer-events-none">
                {bgImage ? (
                    <img
                        src={bgImage}
                        alt={title || "Event"}
                        className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                    />
                ) : (coordinates && isLoaded) ? (
                    // Google Map View
                    <div className="h-full w-full">
                        <GoogleMap
                            mapContainerStyle={{ width: '100%', height: '100%' }}
                            center={coordinates}
                            zoom={15}
                            options={{
                                disableDefaultUI: true,
                                zoomControl: false,
                                streetViewControl: false,
                                mapTypeControl: false,
                                fullscreenControl: false,
                                draggable: false,
                                styles: mapStyles,
                            }}
                        >
                            <Marker position={coordinates} />
                        </GoogleMap>
                    </div>
                ) : (
                    // Map Fallback: Visible Dark Map Pattern
                    <div className="h-full w-full bg-[#1A1A1A] relative overflow-hidden">
                        {/* Street Grid - Primary Arteries (Brigther) */}
                        <div
                            className="absolute inset-0 transform scale-125"
                            style={{
                                backgroundImage: `
                                    linear-gradient(#333 3px, transparent 3px),
                                    linear-gradient(90deg, #333 3px, transparent 3px)
                                `,
                                backgroundSize: '60px 60px',
                                backgroundPosition: 'center'
                            }}
                        />
                        {/* Street Grid - Secondary Roads */}
                        <div
                            className="absolute inset-0"
                            style={{
                                backgroundImage: `
                                    linear-gradient(#2A2A2A 1px, transparent 1px),
                                    linear-gradient(90deg, #2A2A2A 1px, transparent 1px)
                                `,
                                backgroundSize: '20px 20px',
                                opacity: 0.6
                            }}
                        />
                        {/* Center Pin */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="relative">
                                <span className="absolute -inset-2 animate-ping rounded-full bg-red-500/40 opacity-75 duration-1000"></span>
                                <div className="relative rounded-full bg-red-500/20 p-2.5 backdrop-blur-md ring-1 ring-red-500/40">
                                    <MapPinIcon className="h-6 w-6 text-red-500 drop-shadow-[0_4px_8px_rgba(239,68,68,0.5)]" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Gradient Overlays for Readability */}
                {/* Top Scrim (for Date Pill) */}
                <div className="absolute top-0 inset-x-0 h-[35%] bg-gradient-to-b from-black/50 via-black/20 to-transparent z-0 pointer-events-none" />

                {/* Bottom Scrim (Unified Blur Gradient) */}
                <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/55 via-black/25 to-transparent backdrop-blur-[2px] z-0 pointer-events-none" />

                {/* Subtle Brand Tint */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 mix-blend-overlay opacity-30 pointer-events-none" />
            </div>

            {/* Content Layer */}
            <div className="relative z-10 flex h-full flex-col p-5">

                {/* Top Right: Date Pill */}
                {formattedDate && (
                    <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5 rounded-full bg-white/25 px-2.5 py-1 font-medium text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_2px_4px_rgba(0,0,0,0.1)] ring-1 ring-white/20 backdrop-blur-md transition-all group-hover:bg-white/30">
                        <span className="text-[10px] tracking-wide text-zinc-50 shadow-black drop-shadow-sm">{formattedDate}</span>
                        {formattedTime && (
                            <>
                                <span className="text-[6px] text-white/40">●</span>
                                <span className="text-[10px] tracking-wide text-zinc-50 shadow-black drop-shadow-sm">{formattedTime}</span>
                            </>
                        )}
                    </div>
                )}

                {/* Main Content: Title & Details Grouped */}
                <div className="mt-auto flex flex-col gap-1.5 pt-4">
                    <h3 className="line-clamp-2 text-lg font-bold tracking-tight text-white drop-shadow-md leading-tight">
                        {title || "Untitled"}
                    </h3>

                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#ffb200] transition-colors group-hover:brightness-110">
                            View Details
                        </span>
                        <ChevronRightIcon className="h-3 w-3 text-[#ffb200] transition-transform group-hover:translate-x-0.5 group-hover:brightness-110" />
                    </div>
                </div>
            </div>
        </div>
    );
}
