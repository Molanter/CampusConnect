"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, updateDoc, arrayUnion, arrayRemove, onSnapshot, collection, query, getDocs } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

interface ExplorePostCardProps {
    id?: string;
    title: string;
    description: string;
    image?: string;
    date: string;
    time: string;
    location: string;
    coordinates?: { lat: number; lng: number } | null;
    showOpenLabel?: boolean; // If true, show "OPEN" instead of countdown
    onCommentsClick?: () => void;
    onAttendanceClick?: () => void;
    onDetailsClick?: () => void;
}

export function ExplorePostCard({
    id,
    title,
    description,
    image,
    date,
    time,
    location,
    coordinates,
    showOpenLabel = false,
    onCommentsClick,
    onAttendanceClick,
    onDetailsClick,
}: ExplorePostCardProps) {
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [stats, setStats] = useState({ going: 0, maybe: 0, notGoing: 0, comments: 0 });
    const [imgError, setImgError] = useState(false);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setCurrentUser(u));
        return () => unsub();
    }, []);

    useEffect(() => {
        if (!id) return;


        const docRef = doc(db, "posts", id);

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



        const countRepliesRecursively = async (commentPath: string, depth: number): Promise<number> => {
            if (depth >= 2) return 0;
            try {
                const repliesRef = collection(db, commentPath, "replies");
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
                const commentsRef = collection(db, "events", id, "comments");
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

        const commentsRef = collection(db, "events", id, "comments");
        const q = query(commentsRef);

        const unsubscribe = onSnapshot(q, () => {
            updateCommentCount();
        });

        // Initial count
        updateCommentCount();

        return () => unsubscribe();
    }, [id]);

    const getEventStatus = () => {
        if (!date || !time) return { type: 'live' as const, label: 'OPEN' };

        // Try to parse the time - could be a single time or a range
        const timeParts = time.split('-').map(t => t.trim());
        const startTime = timeParts[0];
        const endTime = timeParts[1];

        // Validate time format (HH:MM)
        const timeRegex = /^\d{1,2}:\d{2}$/;
        if (!timeRegex.test(startTime)) {
            return { type: 'live' as const, label: 'OPEN' };
        }

        const now = new Date();
        const eventStart = new Date(`${date}T${startTime}:00`);

        // Check if date is valid
        if (isNaN(eventStart.getTime())) {
            return { type: 'live' as const, label: 'OPEN' };
        }

        // Check if event is live
        if (endTime && timeRegex.test(endTime)) {
            const eventEnd = new Date(`${date}T${endTime}:00`);
            if (!isNaN(eventEnd.getTime()) && now >= eventStart && now <= eventEnd) {
                return { type: 'live' as const, label: 'LIVE' };
            }
        }

        // Calculate time until event
        const diffMs = eventStart.getTime() - now.getTime();
        if (diffMs <= 0) return { type: 'past' as const, label: 'Past' };

        const totalMinutes = Math.round(diffMs / 60000);
        const days = Math.floor(totalMinutes / (60 * 24));
        const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
        const minutes = totalMinutes % 60;

        if (days > 0) return { type: 'countdown' as const, label: `in ${days}d ${hours}h` };
        if (hours > 0) return { type: 'countdown' as const, label: `in ${hours}h ${minutes}m` };
        return { type: 'countdown' as const, label: `in ${minutes}m` };
    };

    const eventStatus = getEventStatus();

    return (
        <div
            className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-md shadow-lg cursor-pointer hover:bg-white/8 transition-colors"
            onClick={onDetailsClick}
        >
            {/* Left: Event Info */}
            <div className="flex flex-1 flex-col min-w-0">
                {/* Title and Time Until */}
                <div className="flex items-baseline justify-between gap-3 mb-1">
                    <h3 className="text-lg font-bold text-white truncate leading-tight flex-1">
                        {title}
                    </h3>
                    <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-full shrink-0 ${eventStatus.type === 'live'
                        ? 'bg-red-500/20 text-red-400 animate-pulse'
                        : showOpenLabel && eventStatus.type === 'countdown'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : eventStatus.type === 'countdown'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-neutral-500/20 text-neutral-400'
                        }`}>
                        {eventStatus.type === 'live'
                            ? '● LIVE'
                            : showOpenLabel && eventStatus.type === 'countdown'
                                ? 'OPEN'
                                : eventStatus.label}
                    </span>
                </div>

                {/* Location & Date/Time Row */}
                <div className="flex items-center gap-4 text-sm text-neutral-300 mb-2">
                    <div className="flex items-center gap-1.5 truncate flex-1">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-neutral-400 shrink-0">
                            <path fillRule="evenodd" d="m9.69 18.933.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.976.544l.062.029.018.008.006.003zM10 11.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" clipRule="evenodd" />
                        </svg>
                        <span className="truncate">{location}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-neutral-400 shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                            <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
                        </svg>
                        <span>{date}</span>
                    </div>
                </div>

                {/* Time */}
                <p className="text-sm text-neutral-400 font-medium">
                    {time}
                </p>
            </div>
        </div>
    );
}
