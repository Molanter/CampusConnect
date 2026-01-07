"use client";

import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { Post } from "@/lib/posts";
import { MapPinIcon } from "@heroicons/react/24/outline";

interface MediaHorizontalScrollProps {
    post: Post;
    noPadding?: boolean;
    className?: string;
    fullWidth?: boolean;
    onClick?: () => void;
    isNarrow?: boolean;
}

const libraries: ("places" | "geometry" | "drawing" | "visualization")[] = ["places"];

// Constant for consistent action icon sizing (matches Feed)
const ACTION_ICON = "h-5 w-5";

export function MediaHorizontalScroll({ post, noPadding = false, className = "", fullWidth = false, onClick, isNarrow = false }: MediaHorizontalScrollProps) {
    const { coordinates, imageUrls, id } = post;
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
        libraries: libraries,
    });

    const hasMap = !!coordinates;
    const images = imageUrls || [];

    // If no media at all, render nothing
    if (!hasMap && images.length === 0) {
        return null;
    }

    const totalItems = (hasMap ? 1 : 0) + images.length;

    return (
        <div className={`cc-media-scroll ${className}`}>
            <div className={`cc-media-scroll-inner ${noPadding ? '' : 'px-2'}`}>
                {/* Map Item */}
                {hasMap && (
                    <div
                        onClick={(e) => {
                            if (onClick) {
                                e.stopPropagation();
                                onClick();
                            }
                        }}
                        className={`inline-block shrink-0 snap-start overflow-hidden cc-radius-24 border border-secondary/10 bg-secondary relative mx-0 ${images.length === 0 ? "w-full" : "w-[240px] sm:w-[300px]"} ${onClick ? 'cursor-pointer hover:brightness-[1.05] transition-all' : ''}`}
                    >
                        <div className="h-[180px] sm:h-[220px] md:h-[240px] w-full">
                            {isLoaded && coordinates ? (
                                <GoogleMap
                                    mapContainerStyle={{ width: '100%', height: '100%' }}
                                    center={coordinates}
                                    zoom={15}
                                    options={{
                                        disableDefaultUI: true,
                                        zoomControl: false,
                                        draggable: false,
                                        clickableIcons: false,
                                    }}
                                >
                                    <Marker position={coordinates} />
                                </GoogleMap>
                            ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                    <MapPinIcon className="h-12 w-12 text-secondary/40" />
                                </div>
                            )}
                        </div>
                        <div className="absolute top-3 left-3 px-3 py-1 cc-glass-strong cc-radius-menu text-xs font-semibold text-foreground">
                            Location
                        </div>
                    </div>
                )}

                {/* Image Items */}
                {images.map((url, index) => {
                    return (
                        <div
                            key={index}
                            className="inline-block shrink-0 overflow-hidden cc-radius-24 border border-secondary/10 bg-secondary mx-0"
                            onClick={(e) => {
                                if (onClick) {
                                    e.stopPropagation();
                                    onClick();
                                }
                            }}
                        >
                            <img
                                src={url}
                                alt={`Event media ${index + 1}`}
                                className={`block h-auto w-auto max-h-[180px] sm:max-h-[220px] md:max-h-[240px] max-w-full object-contain ${onClick ? 'cursor-pointer hover:brightness-[1.05] transition-all' : ''}`}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
