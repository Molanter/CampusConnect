"use client";

import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { Post } from "@/lib/posts";
import { MapPinIcon } from "@heroicons/react/24/outline";

interface PostMediaStripProps {
    post: Post;
}

const libraries: ("places" | "geometry" | "drawing" | "visualization")[] = ["places"];

export function PostMediaStrip({ post }: PostMediaStripProps) {
    const { coordinates, imageUrls } = post;
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
        libraries: libraries,
    });

    const hasMap = !!coordinates;
    const images = imageUrls || [];

    // Square map card, centered

    if (hasMap) {
        return (
            <div className="mx-auto aspect-square w-full max-w-md overflow-hidden rounded-[32px] border border-secondary/10 bg-neutral-900 shadow-lg">
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
            </div>
        );
    }

    // If no map but images, show first image as square (or maybe just keep strip? 
    // Requirement was "Change the map...". I'll assume standard strip if no map, or square image.
    // Let's go with square image to be consistent with layout changes.
    if (images.length > 0) {
        return (
            <div className="mx-auto aspect-square w-full max-w-md overflow-hidden rounded-[32px] border border-secondary/10 bg-neutral-900 shadow-lg">
                <img src={images[0]} alt="Event Media" className="h-full w-full object-cover" />
            </div>
        );
    }

    return null;
}
