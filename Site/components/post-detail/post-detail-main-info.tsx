"use client";

import { useState, useEffect } from "react";
import {
    HeartIcon,
    PencilIcon,
    TrashIcon,
    FlagIcon,
    EllipsisVerticalIcon
} from "@heroicons/react/24/solid";
import { HeartIcon as HeartIconOutline } from "@heroicons/react/24/outline";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
    doc,
    updateDoc,
    arrayUnion,
    arrayRemove,
    onSnapshot,
    increment,
    deleteDoc
} from "firebase/firestore";
import Link from "next/link";
import { Post } from "@/lib/posts";
import { format, formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import { getDoc } from "firebase/firestore";
import { CalendarIcon, MapPinIcon } from "@heroicons/react/24/outline";
import { useUserProfile } from "@/components/user-profiles-context";
import { useClubProfile } from "@/components/club-profiles-context";
import { useRightSidebar } from "@/components/right-sidebar-context";

interface PostDetailMainInfoProps {
    post: Post;
}

type AttendanceStatus = "going" | "maybe" | "not_going" | null;

export function PostDetailMainInfo({ post }: PostDetailMainInfoProps) {
    const router = useRouter();
    const { openView } = useRightSidebar();
    const {
        id,
        title,
        content: description,
        authorName: hostName,
        authorUsername: hostUsername,
        authorAvatarUrl: hostAvatarUrl,
        authorId,
        likes = [],
        isEvent,
        createdAt,
        date,
        startTime: time = "",
        locationLabel: location,
        locationUrl,
        mood = [],
        priceLevel,
        clubId
    } = post;

    const [status, setStatus] = useState<AttendanceStatus>(null);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [stats, setStats] = useState({
        going: post.goingUids?.length || 0,
        maybe: post.maybeUids?.length || 0,
        notGoing: post.notGoingUids?.length || 0,
        comments: (post.commentsCount || 0) + (post.repliesCommentsCount || 0)
    });
    const [isLiked, setIsLiked] = useState(false);
    const [likesCount, setLikesCount] = useState(likes.length);
    const [likeAnimating, setLikeAnimating] = useState(false);
    const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);

    const profile = useUserProfile(authorId);
    const clubProfile = useClubProfile(clubId && clubId !== "" ? clubId : undefined);

    // CRITICAL: We enter club branding mode if we have a clubId, 
    // regardless of whether the profile is loaded yet.
    const isClubPost = !!(clubId && clubId !== "");

    useEffect(() => {
        if (clubId && clubId !== "") {
            console.log(`%c[PostDetail Debug] Post ${post.id} has clubId: ${clubId}`, 'background: #222; color: #ffb200; font-weight: bold');
            console.log(`[PostDetail Debug] Post ${post.id} clubProfile:`, clubProfile);
            console.log(`[PostDetail Debug] Post ${post.id} isClubPost: ${isClubPost}`);
            console.log(`[PostDetail Debug] Full Post Object:`, post);
        }
    }, [post.id, clubId, clubProfile, isClubPost, post]);

    // Final display values with fallbacks - strict "no-stale" policy
    const displayedName = profile?.displayName || "User";
    const displayedPhotoUrl = profile?.photoURL || null;
    const currentUsername = profile?.username;

    // Sync auth state
    useEffect(() => {
        return onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
        });
    }, []);

    // Listen for real-time updates
    useEffect(() => {
        if (!id) return;
        return onSnapshot(doc(db, "posts", id), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setStats({
                    going: data.goingUids?.length || 0,
                    maybe: data.maybeUids?.length || 0,
                    notGoing: data.notGoingUids?.length || 0,
                    comments: (data.commentsCount || 0) + (data.repliesCommentsCount || 0)
                });
                setLikesCount(data.likes?.length || 0);
                if (currentUser) {
                    setIsLiked(data.likes?.includes(currentUser.uid));
                    if (data.goingUids?.includes(currentUser.uid)) setStatus("going");
                    else if (data.maybeUids?.includes(currentUser.uid)) setStatus("maybe");
                    else if (data.notGoingUids?.includes(currentUser.uid)) setStatus("not_going");
                    else setStatus(null);
                }
            }
        });
    }, [id, currentUser]);

    const handleToggleLike = async () => {
        if (!currentUser || !id) return;
        setLikeAnimating(true);
        setTimeout(() => setLikeAnimating(false), 500);

        const postRef = doc(db, "posts", id);
        try {
            if (isLiked) {
                await updateDoc(postRef, {
                    likes: arrayRemove(currentUser.uid)
                });
            } else {
                await updateDoc(postRef, {
                    likes: arrayUnion(currentUser.uid)
                });
            }
        } catch (err) {
            console.error("Like error:", err);
        }
    };

    const handleStatusChange = async (newStatus: AttendanceStatus) => {
        if (!currentUser || !id) return;

        const postRef = doc(db, "posts", id);
        try {
            // Remove from all first
            await updateDoc(postRef, {
                goingUids: arrayRemove(currentUser.uid),
                maybeUids: arrayRemove(currentUser.uid),
                notGoingUids: arrayRemove(currentUser.uid)
            });

            // Add to new if not null
            if (newStatus === "going") {
                await updateDoc(postRef, { goingUids: arrayUnion(currentUser.uid) });
            } else if (newStatus === "maybe") {
                await updateDoc(postRef, { maybeUids: arrayUnion(currentUser.uid) });
            } else if (newStatus === "not_going") {
                await updateDoc(postRef, { notGoingUids: arrayUnion(currentUser.uid) });
            }
        } catch (err) {
            console.error("Attendance error:", err);
        }
    };

    const handleShare = async () => {
        const url = window.location.href;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'CampusConnect Post',
                    url: url
                });
            } catch (err) {
                console.log("Share cancelled or failed", err);
            }
        } else {
            navigator.clipboard.writeText(url);
            alert("Link copied to clipboard!");
        }
    };

    const handleDeletePost = async () => {
        if (!id) return;
        if (confirm(`Are you sure you want to delete this ${isEvent ? 'event' : 'post'}?`)) {
            try {
                await deleteDoc(doc(db, "posts", id));
                router.push('/');
            } catch (err) {
                console.error("Delete error:", err);
                alert("Failed to delete post.");
            }
        }
    };

    const timeLabel = createdAt?.seconds
        ? formatDistanceToNow(new Date(createdAt.seconds * 1000)) + " ago"
        : "";

    const isOwner = currentUser?.uid === authorId;

    return (
        <div className="space-y-2.5 text-leading-none">
            {/* Header: Chat-style Author row */}
            <div className="flex items-center gap-3">
                {isClubPost ? (
                    <Link href={`/clubs/${clubId}`}>
                        <div className="shrink-0">
                            <div className="h-9 w-9 overflow-hidden rounded-full bg-neutral-800 ring-1 ring-white/10">
                                {clubProfile?.avatarUrl ? (
                                    <img src={clubProfile.avatarUrl} alt={clubProfile.name || "Club"} className="h-full w-full object-cover" />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white">
                                        {clubProfile?.name ? clubProfile.name.charAt(0).toUpperCase() : (clubId ? "C" : "?")}
                                    </div>
                                )}
                            </div>
                        </div>
                    </Link>
                ) : (
                    <Link href={`/user/${authorId}`}>
                        <div className="shrink-0">
                            <div className="h-9 w-9 overflow-hidden rounded-full bg-neutral-800 ring-1 ring-white/10">
                                {displayedPhotoUrl ? (
                                    <img
                                        src={displayedPhotoUrl}
                                        alt={displayedName}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-700 to-neutral-800 text-sm font-bold text-white">
                                        {displayedName.charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>
                        </div>
                    </Link>
                )}

                <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {isClubPost ? (
                            <>
                                <Link href={`/clubs/${clubId}`} className="text-[14px] font-bold text-white/90 hover:underline decoration-white/30">
                                    {clubProfile?.name || "Club"}
                                </Link>
                                <Link href={`/user/${authorId}`} className="text-[13px] text-white/40 hover:text-white/60 truncate">
                                    by {currentUsername || (displayedName ? displayedName.toLowerCase().replace(/\s+/g, '') : "user")}
                                </Link>
                            </>
                        ) : (
                            <Link
                                href={`/user/${authorId}`}
                                className="flex items-center gap-1.5 hover:underline decoration-white/30 truncate group"
                            >
                                <span className="text-[14px] font-bold text-white/90 truncate">
                                    {displayedName}
                                </span>
                                {currentUsername && (
                                    <>
                                        <span className="text-[13px] text-white/40 truncate group-hover:text-white/60">
                                            @{currentUsername}
                                        </span>
                                    </>
                                )}
                            </Link>
                        )}
                        <span className="text-[13px] text-white/30 shrink-0">
                            • {createdAt?.toDate ? formatDistanceToNow(createdAt.toDate(), { addSuffix: true }).replace("about ", "") : "just now"}
                        </span>
                    </div>
                </div>
            </div>

            {/* Post/Event Title and Text */}
            <div className="space-y-1">
                {title && (
                    <h1 className="text-[17px] font-bold text-white/90 leading-tight">
                        {title}
                    </h1>
                )}
                {description && (
                    <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-white/80">
                        {description}
                    </div>
                )}
            </div>

            {/* Actions Row (Compact) */}
            <div className="flex items-center gap-1 ml-[-8px]">
                {/* Like Button */}
                <div className={`flex h-8 items-center justify-center rounded-full hover:bg-white/[0.08] ${likesCount > 0 ? "gap-1.5 px-2" : "w-8"}`}>
                    <button
                        onClick={handleToggleLike}
                        className={`flex items-center justify-center ${isLiked ? "text-[#ffb200]" : "text-white/70 hover:text-white"}`}
                    >
                        {isLiked ? (
                            <HeartIcon className="h-4 w-4" />
                        ) : (
                            <HeartIconOutline className="h-4 w-4" />
                        )}
                    </button>
                    {likesCount > 0 && (
                        <span className="text-[13px] font-medium text-white/50">
                            {likesCount}
                        </span>
                    )}
                </div>

                {/* Comment Button */}
                <div className={`flex h-8 items-center justify-center rounded-full text-white/70 hover:bg-white/[0.08] ${stats.comments > 0 ? "gap-1.5 px-2" : "w-8"}`}>
                    <div className="flex items-center justify-center hover:text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.633 9-8.4375 0-4.805-4.03-8.4375-9-8.4375-4.97 0-9 3.6325-9 8.4375 0 2.457 1.056 4.675 2.76 6.223.109.1.18.232.2.378l.583 3.996a.25.25 0 00.322.253l3.655-1.428a.56.56 0 01.373-.02c.365.103.743.176 1.127.2.062.003.125.006.188.006z" />
                        </svg>
                    </div>
                    {stats.comments > 0 && (
                        <span className="text-[13px] font-medium text-white/50">
                            {stats.comments}
                        </span>
                    )}
                </div>

                {/* Share Button */}
                <button
                    onClick={handleShare}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:bg-white/[0.08] hover:text-white"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                </button>

                {/* More Options */}
                <div className="relative">
                    <button
                        onClick={() => setOptionsMenuOpen(!optionsMenuOpen)}
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:bg-white/[0.08] hover:text-white ${optionsMenuOpen ? "bg-white/[0.08] text-white" : ""}`}
                    >
                        <EllipsisVerticalIcon className="h-4 w-4" />
                    </button>
                    {optionsMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setOptionsMenuOpen(false)} />
                            <div className="absolute top-full right-0 z-50 mt-2 min-w-[160px] origin-top-right overflow-hidden rounded-xl border border-white/10 bg-neutral-900 shadow-xl backdrop-blur-xl">
                                <div className="flex flex-col gap-0.5 p-1.5">
                                    {isOwner && (
                                        <>
                                            <button
                                                onClick={() => { setOptionsMenuOpen(false); }}
                                                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] text-white hover:bg-white/5"
                                            >
                                                <span>Edit</span>
                                                <PencilIcon className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                onClick={handleDeletePost}
                                                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] text-red-400 hover:bg-white/5"
                                            >
                                                <span>Delete</span>
                                                <TrashIcon className="h-3.5 w-3.5" />
                                            </button>
                                        </>
                                    )}
                                    <button
                                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] text-white/70 hover:bg-white/5"
                                        onClick={() => {
                                            openView("report", { id: post.id, type: isEvent ? "event" : "post" });
                                            setOptionsMenuOpen(false);
                                        }}
                                    >
                                        <span>Report</span>
                                        <FlagIcon className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Event Info (Thread-style Info list) */}
            {isEvent && (
                <div className="pt-1.5 space-y-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/30">Info</h4>

                    <div className="space-y-3 px-0.5">
                        {/* Date & Time Row */}
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 text-sm min-w-0">
                                <CalendarIcon className="h-4 w-4 text-white/40 shrink-0" />
                                <span className="font-semibold text-white/80 truncate">
                                    {date ? format(new Date(date), "EEEE, MMM d") : "TBA"}
                                    {time && ` at ${time}`}
                                </span>
                            </div>
                            {(() => {
                                if (!date || !time) return null;
                                try {
                                    const eventDateTime = new Date(`${date}T${time}`);
                                    const now = new Date();
                                    const diffMs = eventDateTime.getTime() - now.getTime();
                                    if (diffMs < 0) return null;
                                    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                                    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                                    const label = diffDays > 0 ? `${diffDays}d` : `${diffHours}h`;
                                    return (
                                        <span className="shrink-0 bg-white/5 px-2 py-0.5 rounded-full text-[10px] font-bold text-white/40 uppercase tracking-tighter">
                                            in {label}
                                        </span>
                                    );
                                } catch (e) { return null; }
                            })()}
                        </div>

                        {/* Location Row */}
                        <div className="flex items-start gap-2.5 text-sm">
                            <MapPinIcon className="h-4 w-4 text-white/40 shrink-0 mt-0.5" />
                            <div className="flex flex-col min-w-0">
                                <span className="font-semibold text-white/80 truncate">
                                    {location || "TBA"}
                                </span>
                                {locationUrl && (
                                    <a
                                        href={locationUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[12px] text-blue-400/80 hover:text-blue-400 hover:underline mt-0.5"
                                    >
                                        Open in Maps
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Attendance Picker (iOS Segmented Control) */}
                    <div className="flex p-0.5 bg-white/[0.04] backdrop-blur-lg rounded-full border border-white/10 mt-2">
                        <button
                            onClick={() => handleStatusChange("going")}
                            className={`flex-1 flex items-center justify-center py-2 rounded-full text-[13px] font-semibold transition-all duration-200 ${status === "going"
                                ? "bg-white text-black shadow-sm"
                                : "text-white/40 hover:text-white/60"
                                }`}
                        >
                            Going
                        </button>
                        <button
                            onClick={() => handleStatusChange("maybe")}
                            className={`flex-1 flex items-center justify-center py-2 rounded-full text-[13px] font-semibold transition-all duration-200 ${status === "maybe"
                                ? "bg-white text-black shadow-sm"
                                : "text-white/40 hover:text-white/60"
                                }`}
                        >
                            Maybe
                        </button>
                        <button
                            onClick={() => handleStatusChange("not_going")}
                            className={`flex-1 flex items-center justify-center py-2 rounded-full text-[13px] font-semibold transition-all duration-200 ${status === "not_going"
                                ? "bg-white text-black shadow-sm"
                                : "text-white/40 hover:text-white/60"
                                }`}
                        >
                            No
                        </button>
                    </div>
                </div>
            )}

            {/* Tags area (Lean) */}
            {(mood.length > 0 || priceLevel) && (
                <div className="flex flex-wrap gap-2 px-0.5 pt-1">
                    {priceLevel && (
                        <span className="text-[12px] font-medium text-white/30 border border-white/5 px-2 py-0.5 rounded-md">
                            {priceLevel}
                        </span>
                    )}
                    {mood.map(m => (
                        <span key={m} className="text-[12px] font-medium text-white/30">
                            #{m.toLowerCase().replace(/\s+/g, '')}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

