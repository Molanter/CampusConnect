"use client";

import { BellIcon, XMarkIcon, ChevronLeftIcon, PaperAirplaneIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { useRightSidebar } from "./right-sidebar-context";
import { useEffect, useState, useRef, useMemo } from "react";
import { UserRow } from "./user-row";
import { auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

// Note: We now use the full firebase/firestore SDK across the project to support real-time listeners.
// The db instance from lib/firebase.ts is already configured with the full SDK.
// We import from "firebase/firestore" for real-time listeners and other features.

import {
    collection,
    query,
    orderBy,
    onSnapshot,
    addDoc,
    doc,
    getDoc,
    updateDoc,
    arrayUnion,
    arrayRemove,
    serverTimestamp,
    increment,
    where,
    getDocs,
    deleteDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { CommentMessage, type CommentRecord } from "./comment-message";
import { fetchGlobalAdminEmails, isGlobalAdmin } from "@/lib/admin-utils";
import { ReportSheet } from "./report-sheet";
import { CommentsView } from "./comments-view";

// ... existing code ...

export function RightSidebar({ headerVisible = false }: { headerVisible?: boolean }) {
    const { isVisible, view, data, toggle, showNotifications, sidebarWidth, setSidebarWidth } = useRightSidebar();
    const [mounted, setMounted] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [isTablet, setIsTablet] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Always reset to default width of 300px on mount
        setSidebarWidth(300);

        // Detect mobile and tablet
        const checkViewport = () => {
            const width = window.innerWidth;
            setIsMobile(width < 768);
            setIsTablet(width >= 768 && width <= 1024);
        };

        checkViewport();
        window.addEventListener('resize', checkViewport);
        return () => window.removeEventListener('resize', checkViewport);
    }, [setSidebarWidth]);

    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            const newWidth = window.innerWidth - e.clientX - 12; // 12px for right margin
            const minWidth = 320; // Minimum width
            const maxWidth = 800; // Maximum width
            const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
            setSidebarWidth(clampedWidth);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, sidebarWidth]);

    if (!mounted) return null;

    // Mobile bottom sheet
    if (isMobile) {
        if (!isVisible) {
            // Show only bell button when sidebar is closed
            return (
                <button
                    onClick={toggle}
                    className="fixed right-5 bottom-5 z-50 flex h-[60px] w-[60px] items-center justify-center rounded-full bg-black/40 backdrop-blur-2xl text-white shadow-[0_8px_32px_rgba(0,0,0,0.2)] ring-1 ring-inset ring-white/10 transition-transform active:animate-bell-tap animate-fade-slide-in"
                >
                    <BellIcon className="h-6 w-6" />
                </button>
            );
        }

        return (
            <>
                {/* Backdrop */}
                <div
                    className="fixed inset-0 bg-black/30 z-40 animate-backdrop-fade-in"
                    onClick={toggle}
                />

                {/* Bell Button - Bottom Right (always visible) */}
                <button
                    onClick={toggle}
                    className="fixed right-5 bottom-5 z-[60] flex h-[60px] w-[60px] items-center justify-center rounded-full bg-black/40 backdrop-blur-2xl text-white shadow-[0_8px_32px_rgba(0,0,0,0.2)] ring-1 ring-inset ring-white/10 transition-transform active:animate-bell-tap"
                >
                    <XMarkIcon className="h-6 w-6" />
                </button>

                {/* Bottom Sheet */}
                <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col bg-[#121212]/40 backdrop-blur-3xl rounded-t-[2rem] border-t border-white/10 shadow-[0_-20px_60px_rgba(0,0,0,0.9)] max-h-[85vh] animate-slide-up pb-20">
                    {/* Handle */}
                    <div className="flex justify-center py-3">
                        <div className="w-10 h-1 bg-white/20 rounded-full" />
                    </div>

                    {/* Header */}
                    <div className="flex items-center justify-between px-5 pb-3 border-b border-white/5">
                        <div className="flex items-center gap-2">
                            {view !== "notifications" && (
                                <button
                                    onClick={showNotifications}
                                    className="mr-1 rounded-full p-1 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
                                >
                                    <ChevronLeftIcon className="h-5 w-5" />
                                </button>
                            )}
                            <h2 className="text-lg font-semibold text-white">
                                {view === "notifications" && "Notifications"}
                                {view === "comments" && "Comments"}
                                {view === "details" && "Event Details"}
                                {view === "attendance" && "Guest List"}
                                {view === "report" && "Report Content"}
                                {view === "likes" && "Likes"}
                            </h2>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto px-2 py-4">
                        {view === "notifications" && <NotificationsView />}
                        {view === "comments" && <CommentsView data={data} />}
                        {view === "details" && <EventDetailsView data={data} />}
                        {view === "attendance" && <AttendanceView data={data} />}
                        {view === "report" && <ReportView data={data} />}
                        {view === "likes" && <LikesView data={data} />}
                    </div>
                </div>
            </>
        );
    }

    // Desktop/Tablet: Bell button in top-right when sidebar is closed - REMOVED per user request
    if (!isVisible) {
        return null;
    }

    // Desktop/Tablet sidebar
    return (
        <>
            {isResizing && (
                <div className="fixed inset-0 z-50 cursor-ew-resize" />
            )}
            <aside
                className={`fixed bottom-3 right-3 z-40 flex flex-col rounded-[1.8rem] border border-white/10 bg-[#121212]/40 shadow-[0_30px_80px_rgba(0,0,0,0.9)] backdrop-blur-3xl ${headerVisible ? 'top-[80px]' : 'top-3'}`}
                style={{ width: `${sidebarWidth}px` }}
            >
                {/* Resize Handle */}
                <div
                    className="absolute -left-1 top-0 bottom-0 w-3 cursor-ew-resize group z-10"
                    onMouseDown={() => setIsResizing(true)}
                >
                    <div className="absolute left-1 top-0 bottom-0 w-px bg-white/5 group-hover:bg-white/20 transition-colors" />
                    <div className="absolute left-0.5 top-1/2 -translate-y-1/2 w-1 h-16 bg-white/20 group-hover:bg-white/40 rounded-full transition-colors" />
                </div>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                    <div className="flex items-center gap-2">
                        {view !== "notifications" && (
                            <button
                                onClick={showNotifications}
                                className="mr-1 rounded-full p-1 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
                            >
                                <ChevronLeftIcon className="h-5 w-5" />
                            </button>
                        )}
                        <h2 className="font-semibold text-white">
                            {view === "notifications" && "Notifications"}
                            {view === "comments" && "Comments"}
                            {view === "details" && "Event Details"}
                            {view === "attendance" && "Guest List"}
                            {view === "report" && "Report Content"}
                            {view === "likes" && "Likes"}
                        </h2>
                    </div>
                    <button
                        onClick={toggle}
                        className="rounded-full p-2 text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
                    >
                        <BellIcon className="h-6 w-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-2">
                    {view === "notifications" && <NotificationsView />}
                    {view === "comments" && <CommentsView data={data} />}
                    {view === "details" && <EventDetailsView data={data} />}
                    {view === "attendance" && <AttendanceView data={data} />}
                    {view === "report" && <ReportView data={data} />}
                    {view === "likes" && <LikesView data={data} />}
                </div>
            </aside>
        </>
    );
}

function NotificationsView() {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<any>(null);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setCurrentUser(u));
        return () => unsub();
    }, []);

    useEffect(() => {
        if (!currentUser) return;

        const q = query(
            collection(db, "users", currentUser.uid, "notifications"),
            orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot: any) => {
            const notifs = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
            setNotifications(notifs);
            setLoading(false);
        }, (error: any) => {
            // Handle permission denied silently or show empty
            console.log("Notifications permission error (expected if rules are restrictive):", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);

    if (loading) {
        return <div className="text-center text-sm text-neutral-500 py-10">Loading...</div>;
    }

    if (notifications.length === 0) {
        return (
            <div className="flex flex-col gap-4">
                <div className="text-center text-sm text-neutral-500 py-10">
                    No new notifications
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            {notifications.map((notif) => (
                <div key={notif.id} className="flex items-start gap-3 rounded-2xl bg-white/5 p-3 border border-white/5">
                    <div className="shrink-0 pt-1">
                        <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <p className="text-sm text-white">
                            <span className="font-bold">{notif.fromName}</span> mentioned you in a comment:
                        </p>
                        <p className="text-xs text-neutral-400 line-clamp-2 italic">"{notif.text}"</p>
                        <p className="text-[10px] text-neutral-500 mt-1">
                            {notif.eventTitle} • {notif.createdAt?.toDate?.()?.toLocaleDateString()}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
}



function EventDetailsView({ data }: { data: any }) {
    if (!data) {
        return <div className="text-neutral-500 text-sm">No event selected.</div>;
    }

    // Calculate time until event or if it's live
    const getEventStatus = () => {
        if (!data.date || !data.startTime) return null;

        const now = new Date();
        const eventStart = new Date(`${data.date}T${data.startTime}:00`);

        // Check if event is live
        if (data.endTime) {
            const eventEnd = new Date(`${data.date}T${data.endTime}:00`);
            if (now >= eventStart && now <= eventEnd) {
                return { type: 'live' as const };
            }
        }

        // Calculate time until event
        const diffMs = eventStart.getTime() - now.getTime();
        if (diffMs <= 0) return null;

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
        <div className="flex flex-col gap-6">
            {/* Event Title */}
            <div>
                <h3 className="text-2xl font-bold text-white mb-2">{data.title || (data.isEvent ? "Event Title" : "Post Details")}</h3>
                {(data.description || data.content) && (
                    <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">
                        {data.description || data.content}
                    </p>
                )}
            </div>

            {/* Date & Time */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">When</h4>
                    {eventStatus && (
                        <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-full ${eventStatus.type === 'live'
                            ? 'bg-red-500/20 text-red-400 animate-pulse'
                            : 'bg-amber-500/20 text-amber-400'
                            }`}>
                            {eventStatus.type === 'live' ? '● LIVE' : eventStatus.label}
                        </span>
                    )}
                </div>
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-neutral-300">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-neutral-400">
                            <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">{data.date || "Date not set"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-neutral-300">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-neutral-400">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">
                            {data.startTime && data.endTime
                                ? `${data.startTime} - ${data.endTime}`
                                : data.startTime
                                    ? `${data.startTime}${data.endTime ? ` - ${data.endTime}` : ""}`
                                    : data.timeWindow || data.time || "Time not set"}
                        </span>
                    </div>
                </div>
            </div>

            {/* Location with Map */}
            {(data.locationLabel || data.venue || data.location) && (
                <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Where</h4>
                    <div className="flex items-start gap-2 text-sm text-neutral-300 mb-3">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-neutral-400 mt-0.5">
                            <path fillRule="evenodd" d="m9.69 18.933.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.976.544l.062.029.018.008.006.003zM10 11.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">{data.locationLabel || data.venue || data.location}</span>
                    </div>

                    {/* Map */}
                    {data.coordinates?.lat && data.coordinates?.lng && (
                        <div className="w-full h-48 rounded-2xl overflow-hidden border border-white/10">
                            <iframe
                                src={`https://www.google.com/maps?q=${data.coordinates.lat},${data.coordinates.lng}&z=15&output=embed`}
                                className="w-full h-full border-0"
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                                title="Event location"
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Host / Author */}
            {(data.hostUserId || data.hostDisplayName || data.authorId || data.authorName) && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        {data.hostUserId || data.authorId ? (
                            <UserRow uid={data.hostUserId || data.authorId} />
                        ) : (
                            <UserRow
                                userData={{
                                    displayName: data.hostDisplayName || data.authorName,
                                    username: data.hostUsername || data.authorUsername,
                                    photoURL: data.hostPhotoURL || data.authorAvatarUrl
                                }}
                            />
                        )}
                        <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
                            {data.isEvent ? "Host" : "Author"}
                        </span>
                    </div>
                </div>
            )}

            {/* Campus / Category */}
            {data.campusName && (
                <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400">Campus</h4>
                    <p className="text-sm text-neutral-300 font-medium">{data.campusName}</p>
                </div>
            )}

            {/* Images Gallery */}
            {(data.images || data.imageUrls) && ((data.images && data.images.length > 0) || (data.imageUrls && data.imageUrls.length > 0)) && (
                <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-pink-400">Photos</h4>
                    <div className="space-y-2">
                        {(data.images || data.imageUrls).map((img: string, i: number) => (
                            <img
                                key={i}
                                src={img}
                                alt={`Event photo ${i + 1}`}
                                className="w-full rounded-2xl border border-white/10 object-contain bg-neutral-900"
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function AttendanceView({ data }: { data: any }) {
    const [attendance, setAttendance] = useState<{
        going: string[];
        maybe: string[];
        notGoing: string[];
    }>({ going: [], maybe: [], notGoing: [] });
    const [currentUser, setCurrentUser] = useState<any>(null);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setCurrentUser(u));
        return () => unsub();
    }, []);

    useEffect(() => {
        if (!data?.id) return;

        const docRef = doc(db, "posts", data.id);

        const unsubscribe = onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
                const d = snap.data();
                setAttendance({
                    going: d.goingUids || [],
                    maybe: d.maybeUids || [],
                    notGoing: d.notGoingUids || []
                });
            }
        }, (error) => {
            console.error("Error fetching attendance:", error);
        });

        return () => unsubscribe();
    }, [data?.id]);

    return (
        <div className="flex flex-col gap-6">
            {/* Going */}
            <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-green-400">
                    Going ({attendance.going.length})
                </h3>
                {attendance.going.length === 0 ? (
                    <p className="text-xs text-neutral-500">No one yet</p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {attendance.going.map(uid => (
                            <UserRow key={uid} uid={uid} />
                        ))}
                    </div>
                )}
            </div>

            {/* Maybe */}
            <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-orange-400">
                    Maybe ({attendance.maybe.length})
                </h3>
                {attendance.maybe.length === 0 ? (
                    <p className="text-xs text-neutral-500">No one yet</p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {attendance.maybe.map(uid => (
                            <UserRow key={uid} uid={uid} />
                        ))}
                    </div>
                )}
            </div>

            {/* Not Going */}
            <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-red-400">
                    Not Going ({attendance.notGoing.length})
                </h3>
                {attendance.notGoing.length === 0 ? (
                    <p className="text-xs text-neutral-500">No one yet</p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {attendance.notGoing.map(uid => (
                            <UserRow key={uid} uid={uid} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// Helper for UserRow to support "onlyAvatar" mode if needed, 
// but since I can't modify UserRow right now, I'll just use it as is.
// Wait, I should update UserRow to support `onlyAvatar` or just style it here.
// I'll just use the standard UserRow for now.

const REPORT_REASONS = [
    "Spam or misleading",
    "Harassment or hate speech",
    "Inappropriate content",
    "False information",
    "Violence or dangerous content",
    "Other",
];

function ReportView({ data }: { data: any }) {
    const { close } = useRightSidebar();
    const [selectedReason, setSelectedReason] = useState<string | null>(null);
    const [details, setDetails] = useState("");
    const [pending, setPending] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setCurrentUser(u));
        return () => unsub();
    }, []);

    const handleSubmit = async () => {
        if (!selectedReason || pending || !data?.id || !currentUser) return;

        setPending(true);
        try {
            const reportRef = collection(db, "reports");

            await addDoc(reportRef, {
                targetId: data.id,
                targetType: data.type || "unknown", // 'post', 'comment', 'event'
                reason: selectedReason,
                details: details.trim(),
                reportedByUid: currentUser.uid,
                createdAt: serverTimestamp(),
                status: "pending"
            });

            setSubmitted(true);
            setTimeout(() => {
                close();
            }, 2000);
        } catch (error) {
            console.error("Error submitting report:", error);
        } finally {
            setPending(false);
        }
    };

    if (!data) return <div className="text-neutral-500 text-sm">No content selected.</div>;

    if (submitted) {
        return (
            <div className="flex flex-col items-center justify-center py-10 gap-4 animate-in fade-in zoom-in">
                <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center text-green-500">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                </div>
                <h3 className="text-xl font-bold text-white">Report Submitted</h3>
                <p className="text-neutral-400 text-center text-sm px-6">
                    Thank you for keeping our community safe. We will review this content shortly.
                </p>
                <button
                    onClick={close}
                    className="mt-4 px-6 py-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors text-sm font-medium"
                >
                    Close
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h3 className="text-lg font-bold text-white mb-2">Why are you reporting this?</h3>
                <p className="text-sm text-neutral-400">
                    Your report is anonymous. If someone is in immediate danger, call local emergency services - don't wait.
                </p>
            </div>

            <div className="space-y-2">
                {REPORT_REASONS.map((reason) => (
                    <button
                        key={reason}
                        type="button"
                        className={`w-full rounded-2xl border p-4 text-left transition-colors ${selectedReason === reason
                            ? "border-white bg-white/10 text-white"
                            : "border-white/10 text-neutral-300 hover:border-white/20 hover:bg-white/5"
                            }`}
                        onClick={() => setSelectedReason(reason)}
                        disabled={pending}
                    >
                        {reason}
                    </button>
                ))}
            </div>

            {selectedReason === "Other" && (
                <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-300">
                        Additional details (optional)
                    </label>
                    <textarea
                        className="w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-sm text-white placeholder-neutral-500 focus:border-white/30 focus:outline-none min-h-[100px]"
                        placeholder="Provide more information..."
                        value={details}
                        onChange={(e) => setDetails(e.target.value)}
                        disabled={pending}
                    />
                </div>
            )}

            <div className="pt-2">
                <button
                    type="button"
                    className="w-full rounded-full bg-red-600 py-3.5 font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                    onClick={handleSubmit}
                    disabled={!selectedReason || pending}
                >
                    {pending ? "Submitting..." : "Submit Report"}
                </button>
            </div>
        </div>
    );
}

function LikesView({ data }: { data: any }) {
    const [likers, setLikers] = useState<string[]>([]);

    useEffect(() => {
        if (!data?.id) return;

        // Unified 'posts' collection for all items (events are posts)
        const docRef = doc(db, "posts", data.id);

        const unsubscribe = onSnapshot(docRef, (snap: any) => {
            if (snap.exists()) {
                const d = snap.data();
                // Use 'likes' array, fallback to 'likedByUids' for legacy
                setLikers(d.likes || d.likedByUids || []);
            }
        }, (error: any) => {
            console.error("Error fetching likes:", error);
        });

        return () => unsubscribe();
    }, [data?.id]);

    return (
        <div className="flex flex-col gap-6">
            <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    Liked by ({likers.length})
                </h3>
                {likers.length === 0 ? (
                    <p className="text-xs text-neutral-500">No likes yet</p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {likers.map(uid => (
                            <UserRow key={uid} uid={uid} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
