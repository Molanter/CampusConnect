"use client";

import { useState, useEffect } from "react";
import { Post } from "@/lib/posts";
import { useRouter } from "next/navigation";
import {
    HeartIcon,
    ChatBubbleLeftIcon,
    ArrowTopRightOnSquareIcon
} from "@heroicons/react/24/outline";
import { HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";

interface CompactPostCardProps {
    post: Post;
    onCommentsClick?: () => void;
    onAttendanceClick?: () => void;
    onClick?: () => void;
}

const mapContainerStyle = {
    width: "100%",
    height: "100%",
};

export function CompactPostCard({
    post,
    onCommentsClick,
    onAttendanceClick,
    onClick,
}: CompactPostCardProps) {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<any>(null);

    const {
        id,
        title,
        content,
        imageUrls,
        isEvent,
        date,
        startTime,
        coordinates,
        likes = [],
    } = post;

    const isLiked = currentUser ? likes.includes(currentUser.uid) : false;
    const likeCount = likes.length;

    // Shared ID to prevent runtime conflict
    const { isLoaded } = useJsApiLoader({
        id: "google-map-script",
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
        libraries: ["places"],
    });

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setCurrentUser(u));
        return () => unsub();
    }, []);

    const handleCardClick = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button')) return;

        if (onClick) {
            onClick();
        } else {
            router.push(isEvent ? `/events/${id}` : `/posts/${id}`);
        }
    };

    // Date Formatting for Overlay
    const getFormattedDateTime = () => {
        if (!date) return null;
        try {
            const dateObj = new Date(date + "T12:00:00");
            const month = dateObj.toLocaleDateString("en-US", { month: "short" });
            const day = dateObj.getDate();
            const dateStr = `${month} ${day}`;

            let timeStr = "";
            if (startTime) {
                const [hours, minutes] = startTime.split(':').map(Number);
                const suffix = hours >= 12 ? "PM" : "AM";
                const h = hours % 12 || 12;
                timeStr = `${h}:${minutes.toString().padStart(2, '0')} ${suffix}`;
            }

            return { dateStr, timeStr };
        } catch (e) {
            return null;
        }
    };

    const dateTime = isEvent ? getFormattedDateTime() : null;

    // Media Rendering
    const renderMedia = () => {
        const primaryImage = imageUrls && imageUrls.length > 0 ? imageUrls[0] : null;

        if (primaryImage) {
            return (
                <img
                    src={primaryImage}
                    alt={title || "Post image"}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
            );
        }

        if (coordinates && isLoaded) {
            return (
                <div className="h-full w-full pointer-events-none grayscale-[30%] group-hover:grayscale-0 transition-all duration-500">
                    <GoogleMap
                        mapContainerStyle={mapContainerStyle}
                        center={coordinates}
                        zoom={15}
                        options={{
                            disableDefaultUI: true,
                            zoomControl: false,
                            streetViewControl: false,
                            mapTypeControl: false,
                            fullscreenControl: false,
                            draggable: false,
                            // Dark mode map styles could be added here for better aesthetic
                            styles: [
                                {
                                    featureType: "all",
                                    elementType: "geometry",
                                    stylers: [{ color: "#242f3e" }]
                                },
                                {
                                    featureType: "all",
                                    elementType: "labels.text.stroke",
                                    stylers: [{ color: "#242f3e" }]
                                },
                                {
                                    featureType: "all",
                                    elementType: "labels.text.fill",
                                    stylers: [{ color: "#746855" }]
                                },
                                // ... truncated purely for brevity, standard dark map
                            ]
                        }}
                    >
                        <Marker position={coordinates} />
                    </GoogleMap>
                </div>
            );
        }

        // Fallback Gradient
        return (
            <div className="h-full w-full bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center p-4">
                {/* Icon or simplified placeholder */}
                <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center text-white/20">
                    <ArrowTopRightOnSquareIcon className="h-6 w-6" />
                </div>
            </div>
        );
    };

    return (
        <article
            onClick={handleCardClick}
            className="group relative aspect-square w-full cursor-pointer overflow-hidden rounded-[24px] border border-white/10 bg-[#1C1C1E] shadow-sm transition-all hover:border-white/20 hover:shadow-md active:scale-[0.98]"
        >
            {/* 1. Full Media Layer */}
            <div className="absolute inset-0 h-full w-full bg-neutral-900">
                {renderMedia()}
            </div>

            {/* 2. Overlays Layer */}

            {/* Top Overlay: Date/Time (Top Right as requested) */}
            {dateTime && (
                <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] font-medium text-white backdrop-blur-md shadow-sm">
                    <span>{dateTime.dateStr}</span>
                    {dateTime.timeStr && (
                        <>
                            <span className="opacity-60">•</span>
                            <span>{dateTime.timeStr}</span>
                        </>
                    )}
                </div>
            )}

            {/* Bottom Overlay: Content + Actions */}
            <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/60 to-transparent pb-3 pt-12 px-3.5">

                {/* Text Content */}
                <div className="mb-2.5">
                    {isEvent && title ? (
                        <h3 className="mb-0.5 line-clamp-1 text-[15px] font-semibold text-white drop-shadow-sm">
                            {title}
                        </h3>
                    ) : null}

                    <p className="line-clamp-2 text-[13px] leading-relaxed text-neutral-200 drop-shadow-sm">
                        {content || (imageUrls && imageUrls.length > 0 ? "View image" : "View details")}
                    </p>
                </div>

                {/* Action Buttons Row */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); /* visual */ }}
                            className={`group/btn flex items-center gap-1.5 transition-colors ${isLiked ? "text-[#ffb200]" : "text-neutral-300 hover:text-white"
                                }`}
                        >
                            {isLiked ? (
                                <HeartIconSolid className="h-4 w-4 drop-shadow-md" />
                            ) : (
                                <HeartIcon className="h-4 w-4 drop-shadow-md transition-transform group-hover/btn:scale-110" />
                            )}
                            <span className="text-xs font-medium drop-shadow-md">{likeCount || 0}</span>
                        </button>

                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onCommentsClick) onCommentsClick();
                            }}
                            className="group/btn flex items-center gap-1.5 text-neutral-300 transition hover:text-white"
                        >
                            <ChatBubbleLeftIcon className="h-4 w-4 drop-shadow-md transition-transform group-hover/btn:scale-110" />
                            <span className="text-xs font-medium drop-shadow-md">Comments</span>
                        </button>
                    </div>

                    {/* Detail Indicator */}
                    {isEvent && (
                        <button
                            type="button"
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20"
                        >
                            <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            </div>
        </article>
    );
}
