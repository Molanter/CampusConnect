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
        description: postDescription,
        content: postContent,
        imageUrls,
        type,
        date,
        startTime,
        coordinates,
        likes = [],
        editCount = 0,
    } = post;

    const isEvent = type === "event";

    const content = postDescription || postContent || "";

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

    const hasMedia = (imageUrls && imageUrls.length > 0) || (coordinates && isLoaded);

    // Media Rendering (returns null for text-only)
    const renderMedia = () => {
        const primaryImage = imageUrls && imageUrls.length > 0 ? imageUrls[0] : null;

        if (primaryImage) {
            return (
                <img
                    src={primaryImage}
                    alt={title || "Post image"}
                    className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
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
                            styles: [
                                { featureType: "all", elementType: "geometry", stylers: [{ color: "#242f3e" }] },
                                { featureType: "all", elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
                                { featureType: "all", elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
                                // Simplified for brevity as in original
                            ]
                        }}
                    >
                        <Marker position={coordinates} />
                    </GoogleMap>
                </div>
            );
        }

        return null; // For text-only posts
    };

    return (
        <article
            onClick={handleCardClick}
            className={`group relative aspect-square w-full cursor-pointer overflow-hidden rounded-[24px] border border-secondary/10 shadow-sm transition-all active:scale-[0.98] ${hasMedia
                ? "bg-[#1C1C1E] hover:border-secondary/30"
                : "bg-gradient-to-br from-white/[0.08] to-white/[0.03] hover:border-secondary/20"
                }`}
        >
            {/* 1. Media Layer (if exists) */}
            {hasMedia && (
                <div className="absolute inset-0 h-full w-full bg-secondary">
                    {renderMedia()}
                </div>
            )}

            {/* 2. Text-Only Content Layer (if no media) */}
            {!hasMedia && (
                <div className="flex h-full w-full items-center justify-center p-6 text-center">
                    <div className="relative z-10 space-y-2">
                        {isEvent && title && (
                            <h3 className="line-clamp-1 text-[13px] font-bold uppercase tracking-wider text-white/40">
                                {title}
                            </h3>
                        )}
                        <p className="line-clamp-4 text-[16px] font-medium leading-[1.4] text-white/90">
                            {content?.trim() || <span className="text-white/20 italic">No text</span>}
                        </p>
                    </div>
                    {/* Subtle Background Glyph */}
                    <div className="absolute -right-2 -top-2 opacity-[0.03]">
                        <ChatBubbleLeftIcon className="h-24 w-24 text-white" />
                    </div>
                </div>
            )}

            {/* 3. Overlays Layer */}

            {/* Top Overlay: Date/Time */}
            {dateTime && (
                <div className={`absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-[11px] font-medium text-white backdrop-blur-md shadow-sm ${hasMedia ? "bg-black/40" : "bg-white/10"
                    }`}>
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
            <div className={`absolute inset-x-0 bottom-0 z-20 flex flex-col justify-end pb-3 pt-12 px-3.5 ${hasMedia ? "bg-gradient-to-t from-black/90 via-black/60 to-transparent" : "bg-transparent"
                }`}>

                {/* Media-Post Text Snippet */}
                {hasMedia && (
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
                )}

                {/* Unified Actions Row (matches feed style) */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); /* visual only in compact */ }}
                            className={`flex items-center gap-1 transition-colors ${isLiked ? "text-amber-400" : "text-white/60 hover:text-white"
                                }`}
                        >
                            {isLiked ? (
                                <HeartIconSolid className="h-[18px] w-[18px]" />
                            ) : (
                                <HeartIcon className="h-[18px] w-[18px]" />
                            )}
                            <span className="text-xs font-semibold tabular-nums leading-none">
                                {likeCount || 0}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onCommentsClick) onCommentsClick();
                            }}
                            className="flex items-center gap-1 text-white/60 transition hover:text-white"
                        >
                            <ChatBubbleLeftIcon className="h-[17px] w-[17px]" />
                            <span className="text-xs font-semibold tabular-nums leading-none">
                                {post.commentsCount || 0}
                            </span>
                        </button>

                        {editCount > 0 && (
                            <div className="flex items-center gap-1 text-white/60">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="h-[17px] w-[17px]">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                                </svg>
                                <span className="text-xs font-semibold tabular-nums leading-none">
                                    {editCount}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Detail Indicator for events */}
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
