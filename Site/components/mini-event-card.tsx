"use client";

import { useState, useEffect } from "react";
import { auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, updateDoc, arrayUnion, arrayRemove, getFirestore, onSnapshot, collection, query, getDocs } from "firebase/firestore";

interface MiniEventCardProps {
    id?: string;
    title: string;
    description: string;
    image?: string;
    date: string;
    time: string;
    coordinates?: { lat: number; lng: number } | null;
    onCommentsClick?: () => void;
    onAttendanceClick?: () => void;
    onClick?: () => void;
}

export function MiniEventCard({
    id,
    title,
    description,
    image,
    date,
    time,
    coordinates,
    onCommentsClick,
    onAttendanceClick,
    onClick,
}: MiniEventCardProps) {
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [stats, setStats] = useState({ going: 0, maybe: 0, notGoing: 0, comments: 0 });

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setCurrentUser(u));
        return () => unsub();
    }, []);

    useEffect(() => {
        if (!id) return;

        const dbFull = getFirestore();
        const docRef = doc(dbFull, "events", id);

        const unsubscribe = onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                const going = data.goingUids || [];
                const maybe = data.maybeUids || [];
                const notGoing = data.notGoingUids || [];

                setStats(prev => ({
                    ...prev,
                    going: going.length,
                    maybe: maybe.length,
                    notGoing: notGoing.length,
                }));
            }
        });

        return () => unsubscribe();
    }, [id, currentUser]);

    // Separate listener for comments count
    useEffect(() => {
        if (!id) return;

        const dbFull = getFirestore();
        
        const countRepliesRecursively = async (commentPath: string, depth: number): Promise<number> => {
            if (depth >= 2) return 0;
            try {
                const repliesRef = collection(dbFull, commentPath, "replies");
                const repliesSnapshot = await getDocs(repliesRef);
                let count = repliesSnapshot.size;
                
                for (const replyDoc of repliesSnapshot.docs) {
                    const nestedPath = `${commentPath}/replies/${replyDoc.id}`;
                    count += await countRepliesRecursively(nestedPath, depth + 1);
                }
                
                return count;
            } catch (error) {
                console.error("Error counting replies:", error);
                return 0;
            }
        };

        const updateCommentCount = async () => {
            try {
                const commentsRef = collection(dbFull, "events", id, "comments");
                const commentsSnapshot = await getDocs(commentsRef);
                let totalCount = commentsSnapshot.size;
                
                for (const commentDoc of commentsSnapshot.docs) {
                    const commentPath = `events/${id}/comments/${commentDoc.id}`;
                    totalCount += await countRepliesRecursively(commentPath, 0);
                }
                
                setStats(prev => ({
                    ...prev,
                    comments: totalCount
                }));
            } catch (error) {
                console.error("Error updating comment count:", error);
            }
        };

        const commentsRef = collection(dbFull, "events", id, "comments");
        const q = query(commentsRef);

        const unsubscribe = onSnapshot(q, () => {
            updateCommentCount();
        });

        // Initial count
        updateCommentCount();

        return () => unsubscribe();
    }, [id]);

    const getTimeUntilLabel = () => {
        if (!date || !time) return "--";

        const target = new Date(`${date}T${time}:00`);
        const now = new Date();
        const diffMs = target.getTime() - now.getTime();

        if (!Number.isFinite(diffMs)) return "--";
        if (diffMs <= 0) return "0m";

        const totalMinutes = Math.round(diffMs / 60000);
        const days = Math.floor(totalMinutes / (60 * 24));
        const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
        const minutes = totalMinutes % 60;

        if (days > 0) return `${days}d`;
        if (hours > 0) return `${hours}h`;
        return `${minutes}m`;
    };

    const timeUntilLabel = getTimeUntilLabel();

    const [imgError, setImgError] = useState(false);

    return (
        <div
            className="relative aspect-square w-full cursor-pointer overflow-hidden rounded-[20px] border border-white/10 bg-neutral-900 ring-1 ring-white/5"
            onClick={onClick}
        >
            {/* Image Background */}
            {image && !imgError ? (
                <img
                    src={image}
                    alt={title}
                    className="h-full w-full object-cover"
                    onError={() => setImgError(true)}
                />
            ) : coordinates ? (
                <div className="h-full w-full bg-neutral-800 relative">
                    <iframe
                        src={`https://www.google.com/maps?q=${coordinates.lat},${coordinates.lng}&z=15&output=embed`}
                        className="h-full w-full border-0 pointer-events-none"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        title="Event location"
                    />
                    {/* Overlay to ensure clicks go to the card, not the iframe */}
                    <div className="absolute inset-0 z-10" />
                </div>
            ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900">
                    <span className="text-neutral-600 text-sm">No image</span>
                </div>
            )}

            {/* Date/Time Overlay - Top */}
            <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
                <div className="rounded-full border border-white/20 bg-black/60 px-3 py-1.5 backdrop-blur-md shadow-sm">
                    <p className="text-[10px] font-semibold text-white">{date}</p>
                </div>
                {time && (
                    <div className="rounded-full border border-white/20 bg-black/60 px-3 py-1.5 backdrop-blur-md shadow-sm">
                        <p className="text-[10px] font-semibold text-white">{time}</p>
                    </div>
                )}
            </div>

            {/* Content Overlay - Bottom with Liquid Glass Effect */}
            <div className="absolute inset-x-0 bottom-0 h-16 bg-black/40 backdrop-blur-xl border-t border-white/10 px-3 py-2 flex flex-col justify-end">
                {/* Title */}
                <h3 className="text-xs font-bold leading-tight text-white line-clamp-1 mb-0.5 drop-shadow-md">
                    {title}
                </h3>

                {/* Description */}
                {description && (
                    <p className="text-[10px] text-white/90 line-clamp-1 leading-snug mb-1 drop-shadow-sm font-medium">
                        {description}
                    </p>
                )}
                {/* Action Buttons */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 text-xs text-white/90 font-medium drop-shadow-sm">
                        {/* Comments */}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onCommentsClick?.();
                            }}
                            className="flex items-center gap-1 hover:text-white transition"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                <path fillRule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902.848.137 1.705.248 2.57.331v3.443a.75.75 0 001.28.53l3.58-3.579a.78.78 0 01.527-.224 41.202 41.202 0 005.183-.5c1.437-.232 2.43-1.49 2.43-2.903V5.426c0-1.413-.993-2.67-2.43-2.902A41.289 41.289 0 0010 2zm0 7a1 1 0 100-2 1 1 0 000 2zM8 8a1 1 0 11-2 0 1 1 0 012 0zm5 1a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                            <span>{stats.comments}</span>
                        </button>

                        {/* Attendees */}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onAttendanceClick?.();
                            }}
                            className="flex items-center gap-1 hover:text-white transition"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                <path d="M1 8.25a1.25 1.25 0 112.5 0v7.5a1.25 1.25 0 11-2.5 0v-7.5zM11 3V1.7c0-.268.14-.526.395-.607A2 2 0 0114 3c0 .995-.182 1.948-.514 2.826-.204.54.166 1.174.744 1.174h2.52c1.243 0 2.261 1.01 2.146 2.247a23.864 23.864 0 01-1.341 5.974C17.153 16.323 16.072 17 14.9 17h-3.192a3 3 0 01-1.341-.317l-2.734-1.366A3 3 0 006.292 15H5V8h.963c.685 0 1.258-.483 1.612-1.068a4.011 4.011 0 012.166-1.73c.432-.143.853-.386 1.011-.814.16-.432.248-.9.248-1.388z" />
                            </svg>
                            <span>{stats.going + stats.maybe}</span>
                        </button>

                        {/* Time Left */}
                        <div className="flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
                            </svg>
                            <span>{timeUntilLabel}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
// End of component
