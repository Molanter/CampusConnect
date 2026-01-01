"use client";

import { useState, useEffect } from "react";
import { Post } from "@/lib/posts";
import { format } from "date-fns";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { CalendarIcon, MapPinIcon, CheckCircleIcon, QuestionMarkCircleIcon, XCircleIcon } from "@heroicons/react/24/solid";
import { ArrowTopRightOnSquareIcon, ChatBubbleOvalLeftIcon, HandThumbUpIcon } from "@heroicons/react/24/outline";
import { onAuthStateChanged } from "firebase/auth";
import { doc, updateDoc, arrayUnion, arrayRemove, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

interface EventHeroProps {
    post: Post;
}

const libraries: ("places" | "geometry" | "drawing" | "visualization")[] = ["places"];

export function EventHero({ post }: EventHeroProps) {
    const {
        id,
        title,
        imageUrls,
        coordinates,
        date,
        startTime,
        endTime,
        isEvent,
        locationLabel,
        locationUrl,
        authorName,
        authorAvatarUrl,
        authorUsername,
        likes = [],
        goingUids = [],
        maybeUids = [],
    } = post;

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [status, setStatus] = useState<"going" | "maybe" | "not_going" | null>(null);
    const [stats, setStats] = useState({
        going: goingUids.length,
        maybe: maybeUids.length,
        likes: likes.length
    });

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
        libraries: libraries,
    });

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u: any) => setCurrentUser(u));
        return () => unsub();
    }, []);

    // Sync stats
    useEffect(() => {
        if (!id) return;

        const unsub = onSnapshot(doc(db, "events", id), (snap: any) => {
            if (snap.exists()) {
                const data = snap.data();
                setStats({
                    going: (data.goingUids || []).length,
                    maybe: (data.maybeUids || []).length,
                    likes: (data.likes || []).length,
                });

                if (currentUser) {
                    const going = data.goingUids || [];
                    const maybe = data.maybeUids || [];
                    const notGoing = data.notGoingUids || [];
                    if (going.includes(currentUser.uid)) setStatus("going");
                    else if (maybe.includes(currentUser.uid)) setStatus("maybe");
                    else if (notGoing.includes(currentUser.uid)) setStatus("not_going");
                    else setStatus(null);
                }
            }
        });
        return () => unsub();
    }, [id, currentUser]);

    const handleStatusChange = async (newStatus: "going" | "maybe" | "not_going" | null) => {
        if (!id || !currentUser) return;
        const oldStatus = status;
        if (newStatus === oldStatus) return; // Toggle off if same clicked? Or strict tabs? Let's assume strict set.

        // Optimistic
        setStatus(newStatus);

        try {

            const ref = doc(db, "events", id);
            const updates: any = {};

            if (oldStatus === "going") updates.goingUids = arrayRemove(currentUser.uid);
            else if (oldStatus === "maybe") updates.maybeUids = arrayRemove(currentUser.uid);
            else if (oldStatus === "not_going") updates.notGoingUids = arrayRemove(currentUser.uid);

            if (newStatus === "going") updates.goingUids = arrayUnion(currentUser.uid);
            else if (newStatus === "maybe") updates.maybeUids = arrayUnion(currentUser.uid);
            else if (newStatus === "not_going") updates.notGoingUids = arrayUnion(currentUser.uid);

            await updateDoc(ref, updates);
        } catch (e) {
            console.error(e);
            setStatus(oldStatus);
        }
    };

    const handleAddToCalendar = () => {
        if (!date || !startTime) return;
        const start = new Date(`${date}T${startTime}:00`);
        const end = endTime ? new Date(`${date}T${endTime}:00`) : new Date(start.getTime() + 3600000);
        const fmt = (d: Date) => d.toISOString().replace(/-|:|\.\d+/g, "");
        const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title || "")}&dates=${fmt(start)}/${fmt(end)}&details=${encodeURIComponent(post.content || "")}&location=${encodeURIComponent(locationLabel || "")}`;
        window.open(url, '_blank');
    };

    const hasImage = imageUrls && imageUrls.length > 0;
    const bgImage = hasImage ? imageUrls[0] : null;

    // Derived Status Label
    const getEventLabel = () => {
        if (!date) return null;
        const now = new Date();
        const start = new Date(`${date}T${startTime || "00:00"}:00`);
        if (now > start && (!endTime || now < new Date(`${date}T${endTime || "23:59"}:00`))) return "LIVE";
        if (now > start) return "PAST";
        return "UPCOMING";
    };
    const eventLabel = getEventLabel();

    const formattedDate = date ? format(new Date(date), "MMM d") : "";

    return (
        <div className="relative overflow-hidden rounded-[32px] border border-white/5 bg-[#1C1C1E]/60 backdrop-blur-xl transition-all">
            <div className="flex flex-col md:flex-row">
                {/* Content Side (Top or Left) */}
                <div className="flex flex-1 flex-col p-6">

                    {/* Top Row: Chip & Date */}
                    <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {eventLabel && (
                                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide ${eventLabel === "LIVE" ? "bg-red-500/20 text-red-500 animate-pulse" :
                                    eventLabel === "UPCOMING" ? "bg-blue-500/20 text-blue-400" :
                                        "bg-neutral-500/20 text-neutral-400"
                                    }`}>
                                    {eventLabel}
                                </span>
                            )}
                            {formattedDate && (
                                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-neutral-300">
                                    {formattedDate} • {startTime}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Title */}
                    <h1 className="text-2xl font-bold leading-tight text-white md:text-3xl">
                        {title}
                    </h1>

                    {/* Host & Stats Row */}
                    <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-neutral-400">
                        {/* Host */}
                        <div className="flex items-center gap-2">
                            <div className="h-6 w-6 overflow-hidden rounded-full bg-neutral-700">
                                {authorAvatarUrl ? <img src={authorAvatarUrl} className="h-full w-full object-cover object-center" /> : <div className="h-full w-full bg-gradient-to-br from-blue-500 to-purple-500" />}
                            </div>
                            <span className="font-medium text-neutral-300">{authorName}</span>
                        </div>

                        {/* Dot */}
                        <span className="text-neutral-600">•</span>

                        {/* Stats */}
                        <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1">
                                <HandThumbUpIcon className="h-4 w-4" /> {stats.likes}
                            </span>
                            {isEvent && (
                                <span className="flex items-center gap-1">
                                    <CheckCircleIcon className="h-4 w-4 text-neutral-500" /> {stats.going}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-8 flex flex-wrap gap-3">
                        {isEvent ? (
                            <button
                                onClick={() => handleStatusChange(status === "going" ? null : "going")}
                                className={`flex-1 min-w-[120px] rounded-full px-5 py-3 text-sm font-bold transition-all shadow-lg active:scale-95 ${status === "going"
                                    ? "bg-blue-600 text-white shadow-blue-500/25 hover:bg-blue-500"
                                    : "bg-white text-black hover:bg-neutral-200"
                                    }`}
                            >
                                {status === "going" ? "✓ I'm Going" : "I'm Going"}
                            </button>
                        ) : (
                            // Non-event like action
                            <button className="flex-1 min-w-[120px] rounded-full bg-white px-5 py-3 text-sm font-bold text-black shadow-lg hover:bg-neutral-200 active:scale-95">
                                Like Post
                            </button>
                        )}

                        <button
                            onClick={handleAddToCalendar}
                            className="flex h-[44px] w-[44px] items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition-colors hover:bg-white/10 active:scale-95"
                            title="Add to Calendar"
                        >
                            <CalendarIcon className="h-5 w-5" />
                        </button>

                        {(locationUrl || coordinates) && (
                            <a
                                href={locationUrl || `https://www.google.com/maps/search/?api=1&query=${coordinates?.lat},${coordinates?.lng}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex h-[44px] w-[44px] items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition-colors hover:bg-white/10 active:scale-95"
                                title="Open in Maps"
                            >
                                <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                            </a>
                        )}
                    </div>
                </div>

                {/* Media Side (Right or Bottom) */}
                <div className="h-48 w-full md:h-auto md:w-[320px]">
                    {hasImage && bgImage ? (
                        <div className="h-full w-full">
                            <img src={bgImage} className="h-full w-full object-cover md:rounded-r-[32px] md:rounded-bl-none" alt="" />
                        </div>
                    ) : (coordinates && isLoaded) ? (
                        <GoogleMap
                            mapContainerStyle={{ width: '100%', height: '100%' }}
                            center={coordinates}
                            zoom={15}
                            options={{
                                disableDefaultUI: true,
                                zoomControl: false,
                                draggable: false,
                            }}
                        >
                            <Marker position={coordinates} />
                        </GoogleMap>
                    ) : (
                        <div className="flex h-full w-full items-center justify-center bg-white/5 text-neutral-500">
                            <div className="text-center">
                                <MapPinIcon className="mx-auto h-8 w-8 opacity-20" />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
