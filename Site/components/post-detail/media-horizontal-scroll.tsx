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

    // Responsive height: h-[180px] on mobile/narrow, h-[200px] on desktop
    const mediaHeightClass = isNarrow ? "h-[180px]" : "h-[180px] md:h-[200px]";

    return (
        <div className={`flex w-full justify-start gap-3 overflow-hidden rounded-[24px] ${totalItems > 1 ? "overflow-x-auto pb-1 snap-x snap-mandatory" : ""} scrollbar-hide ${noPadding ? '' : 'px-2'} ${className}`}>
            {/* Map Item - Fixed Responsive Height */}
            {hasMap && (
                <div
                    onClick={(e) => {
                        if (onClick) {
                            e.stopPropagation();
                            onClick();
                        }
                    }}
                    className={`${mediaHeightClass} ${images.length === 0 ? `w-full ${fullWidth ? '' : 'max-w-[450px]'}` : 'aspect-square'} shrink-0 snap-start overflow-hidden rounded-[24px] border border-white/5 bg-neutral-900 shadow-lg relative mx-0 ${onClick ? 'cursor-pointer hover:brightness-[1.05] transition-all' : ''}`}
                >
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
                        <div className="flex h-full w-full items-center justify-center bg-neutral-800">
                            <MapPinIcon className="h-12 w-12 text-neutral-500" />
                        </div>
                    )}
                    <div className="absolute top-3 left-3 px-3 py-1 bg-black/60 backdrop-blur-md rounded-full text-xs font-semibold text-white border border-white/10">
                        Location
                    </div>
                </div>
            )}

            {/* Image Items - Fixed Responsive Height */}
            {images.map((url, index) => {
                const isSinglePhoto = !hasMap && images.length === 1;

                if (isSinglePhoto) {
                    return (
                        <div
                            key={index}
                            onClick={(e) => {
                                if (onClick) {
                                    e.stopPropagation();
                                    onClick();
                                }
                            }}
                            className={`flex justify-start items-start ${mediaHeightClass} ${fullWidth ? '' : 'max-w-full'} ${onClick ? 'cursor-pointer group' : ''}`}
                        >
                            <div className="h-full w-auto overflow-hidden rounded-[24px] border border-white/5 bg-neutral-900 shadow-lg mx-0 group-hover:brightness-[1.05] transition-all">
                                <img
                                    src={url}
                                    alt={`Event media ${index + 1}`}
                                    className="h-full w-auto max-w-full object-contain block"
                                />
                            </div>
                        </div>
                    );
                }

                return (
                    <img
                        key={index}
                        src={url}
                        alt={`Event media ${index + 1}`}
                        onClick={(e) => {
                            if (onClick) {
                                e.stopPropagation();
                                onClick();
                            }
                        }}
                        className={`${mediaHeightClass} w-auto object-contain max-w-none shrink-0 ${!hasMap && index === 0 ? "snap-start" : "snap-center"} rounded-[24px] border border-white/5 bg-neutral-900 shadow-lg mx-0 ${onClick ? 'cursor-pointer hover:brightness-[1.05] transition-all' : ''}`}
                    />
                );
            })}
        </div>
    );
}
