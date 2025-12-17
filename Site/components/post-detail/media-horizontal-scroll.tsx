"use client";

import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { Post } from "@/lib/posts";
import { MapPinIcon } from "@heroicons/react/24/outline";

interface MediaHorizontalScrollProps {
    post: Post;
    noPadding?: boolean;
    className?: string;
}

const libraries: ("places" | "geometry" | "drawing" | "visualization")[] = ["places"];

export function MediaHorizontalScroll({ post, noPadding = false, className = "" }: MediaHorizontalScrollProps) {
    const { coordinates, imageUrls } = post;
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
        <div className={`flex w-full justify-start gap-3 overflow-hidden rounded-[24px] ${totalItems > 1 ? "overflow-x-auto pb-4 snap-x snap-mandatory" : ""} scrollbar-hide ${noPadding ? '' : 'px-2'} ${className}`}>
            {/* Map Item - Fixed Aspect Ratio (Square) unless it's the only item, then post width */}
            {hasMap && (
                <div className={`${images.length === 0 ? 'aspect-[16/9] h-auto w-full max-w-[450px] @3xl:w-[450px]' : 'h-[250px] aspect-square'} shrink-0 snap-center overflow-hidden rounded-[24px] border border-white/5 bg-neutral-900 shadow-lg relative mx-0`}>
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

            {/* Image Items - Variable Width, Full Height (unless single item) */}
            {images.map((url, index) => {
                const isSinglePhoto = !hasMap && images.length === 1;

                if (isSinglePhoto) {
                    return (
                        <div key={index} className="w-full max-w-[450px] aspect-[16/9] flex justify-start items-start">
                            <div className="h-fit max-h-full w-fit max-w-full overflow-hidden rounded-[24px] border border-white/5 bg-neutral-900 shadow-lg mx-0">
                                <img
                                    src={url}
                                    alt={`Event media ${index + 1}`}
                                    className="max-h-full w-auto object-contain"
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
                        className="h-[250px] w-auto object-contain max-w-none shrink-0 snap-center rounded-[24px] border border-white/5 bg-neutral-900 shadow-lg mx-0"
                    />
                );
            })}
        </div>
    );
}
