"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc, getFirestore } from "firebase/firestore";
import { AttendanceCard } from "@/components/attendance-card";
import { useRightSidebar } from "@/components/right-sidebar-context";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

type Event = {
    id: string;
    title: string;
    description?: string | null;
    date?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    locationLabel?: string | null;
    hostDisplayName?: string | null;
    hostUsername?: string | null;
    hostPhotoURL?: string | null;
    imageUrls?: string[] | null;
    coordinates?: { lat: number; lng: number } | null;
};

export default function EventDetailPage() {
    const params = useParams();
    const eventId = params.id as string;
    const [event, setEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const { openView } = useRightSidebar();

    useEffect(() => {
        if (!eventId) return;

        const loadEvent = async () => {
            try {
                setLoading(true);
                const dbFull = getFirestore();
                const docRef = doc(dbFull, "events", eventId);
                const snap = await getDoc(docRef);

                if (snap.exists()) {
                    const data = snap.data();
                    setEvent({
                        id: snap.id,
                        title: data.title || "Untitled",
                        description: data.description || null,
                        date: data.date || null,
                        startTime: data.startTime || null,
                        endTime: data.endTime || null,
                        locationLabel: data.locationLabel || null,
                        hostDisplayName: data.hostDisplayName || null,
                        hostUsername: data.hostUsername || null,
                        hostPhotoURL: data.hostPhotoURL || null,
                        imageUrls: data.imageUrls || null,
                        coordinates: data.coordinates || null,
                    });
                } else {
                    setError("Event not found");
                }
            } catch (err) {
                console.error("Error loading event", err);
                setError("Failed to load event");
            } finally {
                setLoading(false);
            }
        };

        void loadEvent();
    }, [eventId]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center text-neutral-300">
                Loading event...
            </div>
        );
    }

    if (error || !event) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-4 text-neutral-300">
                <p>{error || "Event not found"}</p>
                <Link
                    href="/"
                    className="rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm text-white hover:bg-white/20 transition"
                >
                    Back to feed
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-950 px-4 py-8 text-neutral-50">
            <div className="mx-auto w-full max-w-xl space-y-6">
                {/* Back Button */}
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition"
                >
                    <ArrowLeftIcon className="h-4 w-4" />
                    <span>Back to feed</span>
                </Link>

                {/* Event Card */}
                <AttendanceCard
                    id={event.id}
                    title={event.title}
                    description={event.description || ""}
                    images={event.imageUrls || []}
                    date={event.date || "Date"}
                    time={event.startTime ? `${event.startTime}${event.endTime ? ` - ${event.endTime}` : ""}` : "Time"}
                    location={event.locationLabel || "Location"}
                    hostName={event.hostDisplayName || "Host"}
                    hostUsername={event.hostUsername || undefined}
                    hostAvatarUrl={event.hostPhotoURL}
                    coordinates={event.coordinates}
                    onCommentsClick={() => openView("comments", event)}
                    onAttendanceClick={() => openView("attendance", event)}
                    onDetailsClick={() => openView("details", event)}
                />
            </div>
        </div>
    );
}
