import { useState, useCallback, useMemo, useEffect } from "react";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface LocationPickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectLocation: (location: {
        name: string;
        address: string;
        lat: number;
        lng: number;
    }) => void;
}

const containerStyle = {
    width: "100%",
    height: "100%",
};

const defaultCenter = {
    lat: 40.7128, // New York default
    lng: -74.006,
};

const libraries: ("places" | "geometry" | "drawing" | "visualization")[] = ["places"];

export default function LocationPicker({
    isOpen,
    onClose,
    onSelectLocation,
}: LocationPickerProps) {
    const { isLoaded } = useJsApiLoader({
        id: "google-map-script",
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
        libraries: libraries,
    });

    const [map, setMap] = useState<google.maps.Map | null>(null);
    const [markerPosition, setMarkerPosition] = useState<google.maps.LatLngLiteral | null>(null);
    const [selectedAddress, setSelectedAddress] = useState<string>("");

    const onLoad = useCallback((map: google.maps.Map) => {
        setMap(map);
    }, []);

    const onUnmount = useCallback(() => {
        setMap(null);
    }, []);

    const onMapClick = useCallback(async (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
            const lat = e.latLng.lat();
            const lng = e.latLng.lng();
            setMarkerPosition({ lat, lng });

            // Reverse geocode
            try {
                const geocoder = new google.maps.Geocoder();
                const response = await geocoder.geocode({ location: { lat, lng } });
                if (response.results[0]) {
                    setSelectedAddress(response.results[0].formatted_address);
                } else {
                    setSelectedAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
                }
            } catch (error) {
                console.error("Geocoding failed", error);
                setSelectedAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
            }
        }
    }, []);

    const handleConfirm = () => {
        if (markerPosition) {
            // Extract a short name from address (e.g., first part) or use generic
            const shortName = selectedAddress.split(",")[0];
            onSelectLocation({
                name: shortName,
                address: selectedAddress,
                lat: markerPosition.lat,
                lng: markerPosition.lng,
            });
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="relative h-[80vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-[#1C1C1E] ring-1 ring-white/10 shadow-2xl flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 p-4">
                    <h3 className="text-lg font-bold text-white">Select Location</h3>
                    <button
                        onClick={onClose}
                        className="rounded-full p-2 text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
                    >
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>

                {/* Map Container */}
                <div className="relative flex-1 bg-neutral-900">
                    {isLoaded ? (
                        <GoogleMap
                            mapContainerStyle={containerStyle}
                            center={defaultCenter}
                            zoom={13}
                            onLoad={onLoad}
                            onUnmount={onUnmount}
                            onClick={onMapClick}
                            options={{
                                styles: [
                                    {
                                        elementType: "geometry",
                                        stylers: [{ color: "#242f3e" }],
                                    },
                                    {
                                        elementType: "labels.text.stroke",
                                        stylers: [{ color: "#242f3e" }],
                                    },
                                    {
                                        elementType: "labels.text.fill",
                                        stylers: [{ color: "#746855" }],
                                    },
                                    // ... more dark mode styles can be added
                                ],
                                disableDefaultUI: false,
                                streetViewControl: false,
                                mapTypeControl: false,
                            }}
                        >
                            {markerPosition && <Marker position={markerPosition} />}
                        </GoogleMap>
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-neutral-500">
                            Loading Maps...
                        </div>
                    )}

                    {/* Instructions Overlay */}
                    {!markerPosition && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-sm font-medium text-white backdrop-blur-md pointer-events-none">
                            Click on the map to drop a pin
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-white/10 p-4 bg-[#1C1C1E]">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 truncate text-sm text-neutral-400">
                            {selectedAddress || "No location selected"}
                        </div>
                        <button
                            onClick={handleConfirm}
                            disabled={!markerPosition}
                            className="rounded-full bg-blue-600 px-6 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Confirm Location
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
