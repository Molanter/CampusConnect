"use client";

import { useState, useEffect } from "react";
import {
    HeartIcon,
    PencilIcon,
    TrashIcon,
    FlagIcon,
    EllipsisVerticalIcon,
    CheckBadgeIcon,
    EyeIcon
} from "@heroicons/react/24/solid";
import {
    HeartIcon as HeartIconOutline,
    TrashIcon as TrashIconOutline,
    EyeIcon as EyeIconOutline
} from "@heroicons/react/24/outline";
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
import { CalendarIcon, MapPinIcon, BuildingLibraryIcon, MegaphoneIcon } from "@heroicons/react/24/outline";
import { useUserProfile } from "@/components/user-profiles-context";
import { useClubProfile } from "@/components/club-profiles-context";
import { useRightSidebar } from "@/components/right-sidebar-context";

interface PostDetailMainInfoProps {
    post: Post;
}

type AttendanceStatus = "going" | "maybe" | "not_going" | null;

// Constants for consistent action sizing (matches Feed PostCard)
const ACTION_BUTTON_HEIGHT = "h-8";
const ACTION_ICON = "h-5 w-5";
const HOVER_BG = "hover:bg-secondary/20";

export function PostDetailMainInfo({ post }: PostDetailMainInfoProps) {
    const router = useRouter();
    const { openView } = useRightSidebar();
    const {
        id,
        title,
        description: postDescription,
        content: postContent,
        authorName: hostName,
        authorUsername: hostUsername,
        authorAvatarUrl: hostAvatarUrl,
        authorId,
        likes = [],
        type,
        createdAt,
        date,
        startTime: time = "",
        locationLabel: location,
        locationUrl,
        coordinates,
        mood = [],
        priceLevel,
        clubId,
        editCount = 0,
        campusName,
        campusAvatarUrl,
        ownerType,
        isVerified,
        seenCount = 0,
    } = post;

    const isEvent = type === "event";
    const isAnnouncement = type === "announcement";

    const description = postDescription || postContent || "";

    const profile = useUserProfile(authorId);
    const clubProfile = useClubProfile(clubId && clubId !== "" ? clubId : undefined);

    const effectiveOwnerType = ownerType || (clubId ? "club" : campusName ? "campus" : "personal");
    const isClubPost = effectiveOwnerType === "club";
    const isCampusPost = effectiveOwnerType === "campus";

    const displayedName = profile?.displayName || "User";
    const displayedPhotoUrl = profile?.photoURL || null;
    const currentUsername = profile?.username;

    // Helper function: full-text announcement highlight (Option A)
    const getHighlightedText = (text: string, shouldHighlight: boolean) => {
        if (!shouldHighlight || !text) return text;

        // Wrap ENTIRE announcement text in one highlight span
        return <span className="mark-announce">{text}</span>;
    };

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
    const [liveSeenCount, setLiveSeenCount] = useState(seenCount);
    const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
    const [locationMenuOpen, setLocationMenuOpen] = useState(false);

    // CRITICAL: We enter club branding mode if we have a clubId,
    // regardless of whether the profile is loaded yet.
    // const isClubPost = !!(clubId && clubId !== ""); // This line is now redundant due to effectiveOwnerType

    useEffect(() => {
        if (clubId && clubId !== "") {
            console.log(`%c[PostDetail Debug] Post ${post.id} has clubId: ${clubId}`, 'background: #222; color: #ffb200; font-weight: bold');
            console.log(`[PostDetail Debug] Post ${post.id} clubProfile:`, clubProfile);
            console.log(`[PostDetail Debug] Post ${post.id} isClubPost: ${isClubPost}`);
            console.log(`[PostDetail Debug] Full Post Object:`, post);
        }
    }, [post.id, clubId, clubProfile, isClubPost, post]);

    // Final display values with fallbacks - strict "no-stale" policy
    // const displayedName = profile?.displayName || "User"; // Redundant
    // const displayedPhotoUrl = profile?.photoURL || null; // Redundant
    // const currentUsername = profile?.username; // Redundant

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
                setLiveSeenCount(data.seenCount || 0);
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
        <div className="space-y-4">
            {/* Header: Authorship Row (Synchronized with Feed PostCard) */}
            <div className="flex items-center gap-3">
                <div className="shrink-0">
                    {isCampusPost ? (
                        <div className="h-10 w-10 flex items-center justify-center relative flex-shrink-0">
                            {campusAvatarUrl ? (
                                <img src={campusAvatarUrl} alt={campusName} className="absolute inset-0 !h-full !w-full block object-cover object-center" />
                            ) : (
                                <BuildingLibraryIcon className="h-6 w-6 text-secondary" />
                            )}
                        </div>
                    ) : isClubPost ? (
                        <Link href={`/clubs/${clubId}`}>
                            <div className="h-10 w-10 flex items-center justify-center relative flex-shrink-0">
                                {clubProfile?.avatarUrl ? (
                                    <img src={clubProfile.avatarUrl} alt={clubProfile.name || "Club"} className="absolute inset-0 !h-full !w-full block object-cover object-center" />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-foreground/10 text-sm font-bold text-foreground">
                                        {clubProfile?.name ? clubProfile.name.charAt(0).toUpperCase() : "C"}
                                    </div>
                                )}
                            </div>
                        </Link>
                    ) : (
                        <Link href={`/user/${authorId}`}>
                            <div className="h-10 w-10 overflow-hidden rounded-full border border-secondary/30 bg-surface-2 aspect-square shadow-sm relative">
                                {displayedPhotoUrl ? (
                                    <img
                                        src={displayedPhotoUrl}
                                        alt={displayedName}
                                        className="absolute inset-0 !h-full !w-full block object-cover object-center"
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-surface-3 text-sm font-bold text-foreground">
                                        {displayedName.charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>
                        </Link>
                    )}
                </div>

                {/* Name/Info Column */}
                <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {isCampusPost ? (
                            <>
                                <div className="flex items-center gap-1 min-w-0">
                                    <span className="text-[14px] font-bold text-foreground truncate">
                                        {campusName || "Campus"}
                                    </span>
                                    <CheckBadgeIcon className="h-3.5 w-3.5 text-brand shrink-0" />
                                </div>
                                <span className="text-xs text-muted truncate">
                                    by @{currentUsername || (displayedName ? displayedName.toLowerCase().replace(/\s+/g, "") : "user")}
                                </span>
                            </>
                        ) : isClubPost ? (
                            <>
                                <Link href={`/clubs/${clubId}`} className="text-sm font-bold text-foreground hover:underline decoration-secondary/30 flex items-center gap-1">
                                    {clubProfile?.name || "Club"}
                                    {isVerified && (
                                        <CheckBadgeIcon className="h-3.5 w-3.5 text-brand shrink-0" />
                                    )}
                                </Link>
                                <span className="text-xs text-muted truncate">
                                    by @{currentUsername || (displayedName ? displayedName.toLowerCase().replace(/\s+/g, '') : "user")}
                                </span>
                            </>
                        ) : (
                            <Link
                                href={`/user/${authorId}`}
                                className="flex items-center gap-1.5 hover:underline decoration-secondary/30 truncate group"
                            >
                                <span className="text-sm font-bold text-foreground truncate">
                                    {displayedName}
                                </span>
                                {currentUsername && (
                                    <span className="text-xs text-muted truncate group-hover:text-foreground">
                                        @{currentUsername}
                                    </span>
                                )}
                            </Link>
                        )}
                        <span className="text-xs text-muted shrink-0">
                            • {createdAt?.toDate ? formatDistanceToNow(createdAt.toDate(), { addSuffix: false }).replace("about ", "") : "now"}
                        </span>
                    </div>
                </div>
            </div>

            {/* Post/Event Title and Text */}
            <div className="space-y-1.5">
                {title && (
                    <h1 className="text-[18px] font-bold text-foreground leading-tight">
                        {title}
                    </h1>
                )}
                {description && (
                    <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/90">
                        {isAnnouncement ? getHighlightedText(description, true) : description}
                    </div>
                )}
            </div>

            {/* Actions Row (Matched to Feed PostCard) */}
            <div className={`flex items-center gap-0 ml-[-8px] ${isAnnouncement ? "mt-2.5" : "mt-[-2px]"}`}>
                {/* Like Button */}
                <div className={`flex ${ACTION_BUTTON_HEIGHT} items-center justify-center rounded-full ${HOVER_BG} transition-colors ${likesCount > 0 ? "gap-1 px-2" : "w-8"}`}>
                    <button
                        onClick={handleToggleLike}
                        className={`group flex items-center justify-center ${isLiked ? "text-brand" : "text-secondary hover:text-foreground"}`}
                    >
                        {isLiked ? (
                            <HeartIcon className={`${ACTION_ICON} ${likeAnimating ? "animate-like-pop" : ""}`} />
                        ) : (
                            <HeartIconOutline className={`${ACTION_ICON}`} />
                        )}
                    </button>
                    {likesCount > 0 && (
                        <span className="text-xs font-medium text-secondary">
                            {likesCount}
                        </span>
                    )}
                </div>

                {/* Comment Button (Visual only here, functionally used in detail) */}
                <div className={`flex ${ACTION_BUTTON_HEIGHT} items-center justify-center rounded-full text-secondary ${HOVER_BG} hover:text-foreground transition-colors ${stats.comments > 0 ? "gap-1 px-2" : "w-8"}`}>
                    <div className="flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className={ACTION_ICON}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.633 9-8.4375 0-4.805-4.03-8.4375-9-8.4375-4.97 0-9 3.6325-9 8.4375 0 2.457 1.056 4.675 2.76 6.223.109.1.18.232.2.378l.583 3.996a.25.25 0 00.322.253l3.655-1.428a.56.56 0 01.373-.02c.365.103.743.176 1.127.2.062.003.125.006.188.006z" />
                        </svg>
                    </div>
                    {stats.comments > 0 && (
                        <span className="text-xs font-medium text-secondary">
                            {stats.comments}
                        </span>
                    )}
                </div>

                {/* Share Button */}
                <button
                    onClick={handleShare}
                    className={`flex ${ACTION_BUTTON_HEIGHT} w-8 items-center justify-center rounded-full text-secondary ${HOVER_BG} hover:text-foreground transition-colors`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className={ACTION_ICON}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                </button>

                {/* Edit Count */}
                {editCount > 0 && (
                    <button
                        onClick={(e) => {
                            if (isOwner) {
                                e.stopPropagation();
                                router.push(`/posts/${id}/edit`);
                            }
                        }}
                        className={`flex ${ACTION_BUTTON_HEIGHT} items-center justify-center rounded-full px-2 text-secondary transition-colors gap-1.5 ${isOwner ? "hover:bg-secondary/20 hover:text-foreground cursor-pointer" : "cursor-default"}`}
                    >
                        <PencilIcon className={ACTION_ICON} />
                        <span className="text-xs font-medium">{editCount}</span>
                    </button>
                )}

                {/* View Count (Owner only) */}
                {isOwner && (
                    <div className={`flex ${ACTION_BUTTON_HEIGHT} items-center justify-center rounded-full px-2 text-secondary transition-colors gap-1.5 cursor-default`}>
                        <EyeIconOutline className={ACTION_ICON} />
                        <span className="text-xs font-medium">{liveSeenCount}</span>
                    </div>
                )}

                {/* More Options */}
                <div className="relative">
                    <button
                        onClick={() => setOptionsMenuOpen(!optionsMenuOpen)}
                        className={`flex ${ACTION_BUTTON_HEIGHT} px-3 w-auto items-center justify-center rounded-full text-secondary hover:bg-secondary/20 hover:text-foreground transition-all outline-none focus:outline-none ring-0 focus:ring-0 ${optionsMenuOpen ? "bg-secondary/20 text-foreground" : ""}`}
                    >
                        <EllipsisVerticalIcon className={ACTION_ICON} />
                    </button>
                    {optionsMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setOptionsMenuOpen(false)} />
                            <div className="absolute top-full right-0 z-50 mt-2 min-w-[160px] origin-top-right overflow-hidden cc-glass-strong cc-radius-menu shadow-xl">
                                <div className="flex flex-col gap-0.5 p-1.5">
                                    {isOwner && (
                                        <>
                                            <button
                                                onClick={() => {
                                                    setOptionsMenuOpen(false);
                                                    router.push(`/posts/${id}/edit`);
                                                }}
                                                className="flex w-full items-center justify-between rounded-full px-3.5 py-2 text-[13px] text-foreground hover:bg-secondary/15 transition-colors"
                                            >
                                                <span>Edit</span>
                                                <PencilIcon className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                onClick={handleDeletePost}
                                                className="flex w-full items-center justify-between rounded-full px-3.5 py-2 text-[13px] text-red-500 hover:bg-red-500/10 transition-colors"
                                            >
                                                <span>Delete</span>
                                                <TrashIconOutline className="h-3.5 w-3.5" />
                                            </button>
                                        </>
                                    )}
                                    <button
                                        className="flex w-full items-center justify-between rounded-full px-3.5 py-2 text-[13px] text-secondary hover:bg-secondary/15 hover:text-foreground transition-colors"
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
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted">Info</h4>

                    <div className="space-y-3 px-0.5">
                        {/* Date & Time Row */}
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 text-sm min-w-0">
                                <CalendarIcon className="h-4 w-4 text-muted shrink-0" />
                                <span className="font-semibold text-foreground/80 truncate">
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
                                        <span className="shrink-0 bg-surface-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-muted uppercase tracking-tighter">
                                            in {label}
                                        </span>
                                    );
                                } catch (e) { return null; }
                            })()}
                        </div>

                        {/* Location Row */}
                        <div className="relative">
                            <button
                                onClick={() => setLocationMenuOpen(!locationMenuOpen)}
                                className={`flex items-start gap-2.5 text-sm w-full text-left rounded-lg transition-colors group ${locationMenuOpen ? "bg-secondary/10" : "hover:bg-secondary/5"}`}
                            >
                                <MapPinIcon className={`h-4 w-4 shrink-0 mt-0.5 transition-colors ${locationMenuOpen ? "text-brand" : "text-muted group-hover:text-foreground"}`} />
                                <div className="flex flex-col min-w-0 py-0.5">
                                    <span className={`font-semibold truncate transition-colors ${locationMenuOpen ? "text-brand" : "text-foreground/80 group-hover:text-foreground"}`}>
                                        {location || "TBA"}
                                    </span>
                                </div>
                            </button>

                            {locationMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setLocationMenuOpen(false)} />
                                    <div className="absolute left-0 bottom-full z-50 mb-2 min-w-[200px] origin-bottom-left overflow-hidden cc-glass-strong cc-radius-menu shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200 border border-secondary/10">
                                        <div className="flex flex-col gap-0.5 p-1.5">
                                            <a
                                                href={coordinates ? `https://maps.apple.com/?ll=${coordinates.lat},${coordinates.lng}&q=${encodeURIComponent(location || "Location")}` : (locationUrl?.includes("apple") ? locationUrl : `https://maps.apple.com/?q=${encodeURIComponent(location || "Location")}`)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={() => setLocationMenuOpen(false)}
                                                className="flex w-full items-center justify-between rounded-full px-4 py-2.5 text-[13px] font-medium text-foreground hover:bg-secondary/15 transition-colors"
                                            >
                                                <span>Open in Apple Maps</span>
                                                <svg className="h-4 w-4 text-secondary/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                                                    <line x1="8" y1="2" x2="8" y2="18" />
                                                    <line x1="16" y1="6" x2="16" y2="22" />
                                                </svg>
                                            </a>
                                            <div className="h-px bg-secondary/10 mx-2" />
                                            <a
                                                href={coordinates ? `https://www.google.com/maps/search/?api=1&query=${coordinates.lat},${coordinates.lng}` : (locationUrl?.includes("google") || locationUrl?.includes("goo.gl") ? locationUrl : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location || "Location")}`)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={() => setLocationMenuOpen(false)}
                                                className="flex w-full items-center justify-between rounded-full px-4 py-2.5 text-[13px] font-medium text-foreground hover:bg-secondary/15 transition-colors"
                                            >
                                                <span>Open in Google Maps</span>
                                                <svg className="h-4 w-4 text-secondary/70" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z" />
                                                </svg>
                                            </a>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Attendance Picker (iOS Segmented Control) */}
                    <div className="flex p-0.5 bg-surface-2 rounded-full border border-secondary/20 mt-2">
                        <button
                            onClick={() => handleStatusChange("going")}
                            className={`flex-1 flex items-center justify-center py-2 rounded-full text-[13px] font-semibold transition-all duration-200 ${status === "going"
                                ? "bg-foreground text-background shadow-sm"
                                : "text-secondary hover:text-foreground"
                                }`}
                        >
                            Going
                        </button>
                        <button
                            onClick={() => handleStatusChange("maybe")}
                            className={`flex-1 flex items-center justify-center py-2 rounded-full text-[13px] font-semibold transition-all duration-200 ${status === "maybe"
                                ? "bg-foreground text-background shadow-sm"
                                : "text-secondary hover:text-foreground"
                                }`}
                        >
                            Maybe
                        </button>
                        <button
                            onClick={() => handleStatusChange("not_going")}
                            className={`flex-1 flex items-center justify-center py-2 rounded-full text-[13px] font-semibold transition-all duration-200 ${status === "not_going"
                                ? "bg-foreground text-background shadow-sm"
                                : "text-secondary hover:text-foreground"
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
                        <span className="text-[12px] font-medium text-muted border border-secondary/20 px-2 py-0.5 rounded-md">
                            {priceLevel}
                        </span>
                    )}
                    {mood.map(m => (
                        <span key={m} className="text-[12px] font-medium text-muted">
                            #{m.toLowerCase().replace(/\s+/g, '')}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

