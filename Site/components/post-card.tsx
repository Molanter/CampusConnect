import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";

import {
    CalendarIcon,
    HandThumbDownIcon,
    HandThumbUpIcon,
    HeartIcon,
    QuestionMarkCircleIcon,
} from "@heroicons/react/24/solid";
import {
    EllipsisVerticalIcon,
    FlagIcon,
    HeartIcon as HeartIconOutline,
    PencilIcon,
    TrashIcon,
} from "@heroicons/react/24/outline";

import { onAuthStateChanged } from "firebase/auth";
import { arrayRemove, arrayUnion, collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";

import { auth, db } from "../lib/firebase";
import { Post } from "../lib/posts";
import { useRightSidebar } from "./right-sidebar-context";
import { useUserProfile } from "./user-profiles-context";
import { useClubProfile } from "./club-profiles-context";
import { formatDistanceToNow } from "date-fns";

type AttendanceStatus = "going" | "maybe" | "not_going" | null;

// Constant for consistent action icon sizing
const ACTION_ICON = "h-5 w-5";

interface PostCardProps {
    post: Post;
    onCommentsClick?: () => void;
    onAttendanceClick?: () => void;
    onDetailsClick?: () => void;
    onLikesClick?: () => void;
    onEditClick?: () => void;
    previewMode?: boolean;
    hideMediaGrid?: boolean;
    hideCommentPreview?: boolean;
    variant?: "default" | "threads";
    onDeleted?: () => void;
}

export function PostCard({
    post,
    onCommentsClick,
    onAttendanceClick,
    onDetailsClick,
    onLikesClick,
    onEditClick,
    previewMode = false,
    hideMediaGrid = false,
    hideCommentPreview = true, // keep off here; your original had preview complexity
    variant = "threads",
    onDeleted,
}: PostCardProps) {
    const router = useRouter();

    const {
        id,
        content: description,
        imageUrls: images = [],
        date,
        startTime: time = "",
        authorId,
        likes = [],
        isEvent,
        createdAt,
        clubId,
    } = post;

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [status, setStatus] = useState<AttendanceStatus>(null);
    const [attendanceMenuOpen, setAttendanceMenuOpen] = useState(false);

    const [isLiked, setIsLiked] = useState(false);
    const [likesCount, setLikesCount] = useState(likes.length);
    const [likeAnimating, setLikeAnimating] = useState(false);

    const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);

    // Calculate total comments (comments + replies)
    const [commentsCount, setCommentsCount] = useState((post.commentsCount || 0) + (post.repliesCommentsCount || 0));

    // Live going count
    const [goingCount, setGoingCount] = useState((post.goingUids || []).length);
    const [maybeCount, setMaybeCount] = useState((post.maybeUids || []).length);

    const descriptionRef = useRef<HTMLDivElement>(null);
    const [displayText, setDisplayText] = useState(description);
    const [isTruncated, setIsTruncated] = useState(false);

    const profile = useUserProfile(authorId);
    const clubProfile = useClubProfile(clubId && clubId !== "" ? clubId : undefined);
    const isClubPost = !!(clubId && clubId !== "");

    const displayedName = profile?.displayName || "User";
    const displayedPhotoUrl = profile?.photoURL || null;
    const currentUsername = profile?.username;

    const hasMedia = images.length > 0;
    const lineLimit = hasMedia ? 3 : 5;

    // Sidebar context (safe fallback)
    let openView: any = () => { };
    let sidebarVisible = false;
    let isNarrow = false;
    try {
        const sidebar = useRightSidebar();
        openView = sidebar.openView;
        sidebarVisible = sidebar.isVisible;
        isNarrow = sidebar.isNarrow;
    } catch { }

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setCurrentUser(u));
        return () => unsub();
    }, []);

    // Live likes
    useEffect(() => {
        if (!id || previewMode) return;

        const postRef = doc(db, "posts", id);
        const unsubscribe = onSnapshot(postRef, (snap) => {
            if (!snap.exists()) return;
            const data = snap.data();
            const nextLikes: string[] = data.likes || [];
            setLikesCount(nextLikes.length);
            if (currentUser) setIsLiked(nextLikes.includes(currentUser.uid));

            // Sync comments count
            const totalComments = (data.commentsCount || 0) + (data.repliesCommentsCount || 0);
            setCommentsCount(totalComments);
        });

        return () => unsubscribe();
    }, [id, previewMode, currentUser]);

    // Live attendance
    useEffect(() => {
        if (!id || previewMode) return;

        const postRef = doc(db, "posts", id);
        const unsubscribe = onSnapshot(postRef, (snap) => {
            if (!snap.exists()) return;
            const data = snap.data();

            const going: string[] = data.goingUids || [];
            const maybe: string[] = data.maybeUids || [];
            const notGoing: string[] = data.notGoingUids || [];

            setGoingCount(going.length);
            setMaybeCount(maybe.length);

            if (currentUser) {
                if (going.includes(currentUser.uid)) setStatus("going");
                else if (maybe.includes(currentUser.uid)) setStatus("maybe");
                else if (notGoing.includes(currentUser.uid)) setStatus("not_going");
                else setStatus(null);
            }
        });

        return () => unsubscribe();
    }, [id, previewMode, currentUser]);

    // Truncation (kept)
    useEffect(() => {
        const checkTruncation = () => {
            const el = descriptionRef.current;
            if (!el || !description) return;

            const styles = window.getComputedStyle(el);
            const lineHeight = parseFloat(styles.lineHeight);
            if (isNaN(lineHeight)) return;

            const maxHeight = lineHeight * lineLimit;

            const measureEl = document.createElement("div");
            measureEl.style.width = `${el.clientWidth}px`;
            measureEl.style.fontSize = styles.fontSize;
            measureEl.style.lineHeight = styles.lineHeight;
            measureEl.style.fontFamily = styles.fontFamily;
            measureEl.style.fontWeight = styles.fontWeight;
            measureEl.style.letterSpacing = styles.letterSpacing;
            measureEl.style.whiteSpace = styles.whiteSpace;
            measureEl.style.wordBreak = styles.wordBreak;
            measureEl.style.padding = styles.padding;
            measureEl.style.boxSizing = styles.boxSizing;
            measureEl.style.visibility = "hidden";
            measureEl.style.position = "absolute";
            measureEl.style.zIndex = "-9999";
            document.body.appendChild(measureEl);

            measureEl.textContent = description;
            if (measureEl.scrollHeight <= maxHeight + 1) {
                setIsTruncated(false);
                setDisplayText(description);
                document.body.removeChild(measureEl);
                return;
            }

            let low = 0;
            let high = description.length;
            let best = 0;
            const spaceBuffer = "\u00A0".repeat(24);

            while (low <= high) {
                const mid = Math.floor((low + high) / 2);
                measureEl.textContent = `${description.slice(0, mid).trim()}...${spaceBuffer}show more`;
                if (measureEl.scrollHeight <= maxHeight + 1) {
                    best = mid;
                    low = mid + 1;
                } else {
                    high = mid - 1;
                }
            }

            const truncatedText = description.slice(0, best);
            const lastSpaceIndex = truncatedText.lastIndexOf(" ");
            const snapPoint = lastSpaceIndex > 0 ? lastSpaceIndex : best;

            setIsTruncated(true);
            setDisplayText(description.slice(0, snapPoint).trim());
            document.body.removeChild(measureEl);
        };

        checkTruncation();
        const ro = new ResizeObserver(checkTruncation);
        if (descriptionRef.current) ro.observe(descriptionRef.current);
        return () => ro.disconnect();
    }, [description, lineLimit]);

    const timeLabel = (() => {
        if (isEvent) {
            if (!date) return null;
            const startTime = (time || "00:00").split("-")[0].trim();
            const target = new Date(`${date}T${startTime}:00`);
            const diffMs = target.getTime() - Date.now();
            if (!Number.isFinite(diffMs)) return null;
            if (diffMs <= 0) return "expired";
            const totalMinutes = Math.round(diffMs / 60000);
            const days = Math.floor(totalMinutes / (60 * 24));
            const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
            const minutes = totalMinutes % 60;
            if (days > 0) return `${days}d`;
            if (hours > 0) return `${hours}h`;
            return `${minutes}m`;
        }

        if (!createdAt) return "now";
        const dt = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
        if (isNaN(dt.getTime())) return "now";

        const distance = formatDistanceToNow(dt, { addSuffix: false });
        if (distance.includes("less than a minute")) return "now";
        return distance
            .replace("about ", "")
            .replace(" hours", "h")
            .replace(" hour", "h")
            .replace(" minutes", "m")
            .replace(" minute", "m")
            .replace(" days", "d")
            .replace(" day", "d")
            .replace(" months", "mo")
            .replace(" month", "mo")
            .replace(" years", "y")
            .replace(" year", "y");
    })();

    const handleToggleLike = async () => {
        if (previewMode) return;

        if (!id || !currentUser) return;

        setLikeAnimating(true);
        setTimeout(() => setLikeAnimating(false), 140);

        const originalIsLiked = isLiked;
        const originalCount = likesCount;

        setIsLiked(!isLiked);
        setLikesCount((p) => (isLiked ? p - 1 : p + 1));

        try {
            await updateDoc(doc(db, "posts", id), {
                likes: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
            });
        } catch (e) {
            console.error("Error toggling like:", e);
            setIsLiked(originalIsLiked);
            setLikesCount(originalCount);
        }
    };

    const handleStatusChange = async (newStatus: AttendanceStatus) => {
        if (!id || !currentUser || previewMode) return;
        if (status === newStatus) return;

        const oldStatus = status;
        setStatus(newStatus);

        try {
            const updates: any = {};
            if (oldStatus === "going") updates.goingUids = arrayRemove(currentUser.uid);
            if (oldStatus === "maybe") updates.maybeUids = arrayRemove(currentUser.uid);
            if (oldStatus === "not_going") updates.notGoingUids = arrayRemove(currentUser.uid);

            if (newStatus === "going") updates.goingUids = arrayUnion(currentUser.uid);
            if (newStatus === "maybe") updates.maybeUids = arrayUnion(currentUser.uid);
            if (newStatus === "not_going") updates.notGoingUids = arrayUnion(currentUser.uid);

            await updateDoc(doc(db, "posts", id), updates);
        } catch (e) {
            console.error("Error updating attendance:", e);
            setStatus(oldStatus);
        }
    };

    const handleDeletePost = async () => {
        if (!id || previewMode) return;
        if (!confirm(`Are you sure you want to delete this ${isEvent ? "event" : "post"}?`)) return;

        try {
            await deleteDoc(doc(db, "posts", id));
            onDeleted?.();
            setOptionsMenuOpen(false);
        } catch (e) {
            console.error("Delete error:", e);
            alert("Failed to delete post.");
        }
    };

    const isOwner = !!currentUser && currentUser.uid === authorId;

    // ===== Threads variant (your feed uses this) =====
    if (variant === "threads") {
        return (
            <div className={`relative border-b border-secondary/30 ${isNarrow ? "py-2.5" : "py-3"}`}>
                <div className="flex items-start gap-2.5">
                    {/* Avatar */}
                    <div className="shrink-0 self-start">
                        {isClubPost ? (
                            <Link href={`/clubs/${clubId}`} onClick={(e) => e.stopPropagation()}>
                                <div className="h-10 w-10 overflow-hidden rounded-[12px] bg-surface-2 ring-1 ring-secondary/30 aspect-square shadow-sm">
                                    {clubProfile?.avatarUrl ? (
                                        <img src={clubProfile.avatarUrl} alt={clubProfile.name || "Club"} className="!h-full !w-full object-cover object-center" />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-foreground/10 text-sm font-bold text-foreground">
                                            {clubProfile?.name ? clubProfile.name.charAt(0).toUpperCase() : "C"}
                                        </div>
                                    )}
                                </div>
                            </Link>
                        ) : (
                            <Link href={`/user/${authorId}`} onClick={(e) => e.stopPropagation()}>
                                <div className="h-10 w-10 overflow-hidden rounded-full bg-surface-2 ring-1 ring-secondary/30 aspect-square">
                                    {displayedPhotoUrl ? (
                                        <img src={displayedPhotoUrl} alt={displayedName} className="!h-full !w-full object-cover object-center" />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-foreground/10 text-sm font-bold text-foreground">
                                            {displayedName ? displayedName.charAt(0).toUpperCase() : "U"}
                                        </div>
                                    )}
                                </div>
                            </Link>
                        )}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                                    {isClubPost ? (
                                        <>
                                            <Link href={`/clubs/${clubId}`} onClick={(e) => e.stopPropagation()} className="truncate text-sm font-semibold text-foreground hover:underline">
                                                {clubProfile?.name || "Club"}
                                            </Link>
                                            <span className="text-xs text-muted truncate">
                                                by @{currentUsername || (displayedName ? displayedName.toLowerCase().replace(/\s+/g, "") : "user")}
                                            </span>
                                        </>
                                    ) : (
                                        <Link href={`/user/${authorId}`} onClick={(e) => e.stopPropagation()} className="truncate text-sm font-semibold text-foreground hover:underline">
                                            {displayedName}
                                            {currentUsername && <span className="ml-1 text-xs text-muted">@{currentUsername}</span>}
                                        </Link>
                                    )}

                                    <span className="text-xs text-muted shrink-0">•</span>
                                    <span className="text-xs text-muted shrink-0">{timeLabel || (date ? date : "now")}</span>
                                </div>
                            </div>
                        </div>

                        {/* Body */}
                        {description && (
                            <div className="mt-0.5">
                                <div
                                    ref={descriptionRef}
                                    onClick={onDetailsClick}
                                    className={`whitespace-pre-wrap text-sm leading-relaxed text-foreground ${onDetailsClick ? "cursor-pointer" : ""}`}
                                >
                                    {isTruncated ? (
                                        <span>
                                            {displayText}...{" "}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDetailsClick?.();
                                                }}
                                                className="font-medium text-muted hover:text-foreground"
                                            >
                                                show more
                                            </button>
                                        </span>
                                    ) : (
                                        description
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Media - shrink-to-content, reduced height */}
                        {!hideMediaGrid && images.length > 0 && (
                            <div className={description ? "mt-2 mb-2" : "mt-2.5 mb-2"}>
                                {images.length === 1 ? (
                                    // Single image: inline-block to fit content
                                    <div className="inline-block max-w-full overflow-hidden cc-radius-24 ring-1 ring-inset ring-secondary/20 bg-secondary">
                                        <img
                                            src={images[0]}
                                            alt=""
                                            className={`block h-auto w-auto max-h-[180px] sm:max-h-[220px] md:max-h-[240px] max-w-full object-contain ${onDetailsClick ? "cursor-pointer" : ""}`}
                                            onClick={(e) => {
                                                if (!onDetailsClick) return;
                                                e.stopPropagation();
                                                onDetailsClick();
                                            }}
                                        />
                                    </div>
                                ) : (
                                    // Multiple images: horizontal scroll of inline-block tiles
                                    <div className="cc-media-scroll">
                                        <div className="cc-media-scroll-inner">
                                            {images.slice(0, 4).map((src, idx) => (
                                                <div
                                                    key={src + idx}
                                                    className="inline-block shrink-0 overflow-hidden cc-radius-24 ring-1 ring-inset ring-secondary/20 bg-secondary"
                                                >
                                                    <img
                                                        src={src}
                                                        alt=""
                                                        className={`block h-auto w-auto max-h-[180px] sm:max-h-[220px] md:max-h-[240px] max-w-full object-contain ${onDetailsClick ? "cursor-pointer" : ""}`}
                                                        onClick={(e) => {
                                                            if (!onDetailsClick) return;
                                                            e.stopPropagation();
                                                            onDetailsClick();
                                                        }}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="mt-[-4px] ml-[-8px] flex items-center gap-0">
                            {/* Like */}
                            <div className={`flex h-7 items-center justify-center rounded-full hover:bg-secondary/20 transition-colors ${likesCount > 0 ? "gap-1 px-1.5" : "w-7"}`}>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleLike();
                                    }}
                                    className="group flex items-center justify-center"
                                >
                                    {isLiked ? (
                                        <HeartIcon className={`${ACTION_ICON} text-brand transition-colors`} />
                                    ) : (
                                        <HeartIconOutline className={`${ACTION_ICON} text-secondary group-hover:text-foreground transition-colors`} />
                                    )}
                                </button>

                                {likesCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onLikesClick?.();
                                        }}
                                        className="flex items-center text-secondary"
                                    >
                                        <span className="text-xs">{likesCount}</span>
                                    </button>
                                )}
                            </div>

                            {/* Comments */}
                            <div className={`flex h-7 items-center justify-center rounded-full text-secondary hover:bg-secondary/20 hover:text-foreground transition-colors ${commentsCount > 0 ? "gap-1 px-1.5" : "w-7"}`}>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onCommentsClick?.(); }}
                                    className="group flex items-center justify-center w-full h-full"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className={`${ACTION_ICON} text-secondary group-hover:text-foreground transition-colors`}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.633 9-8.4375 0-4.805-4.03-8.4375-9-8.4375-4.97 0-9 3.6325-9 8.4375 0 2.457 1.056 4.675 2.76 6.223.109.1.18.232.2.378l.583 3.996a.25.25 0 00.322.253l3.655-1.428a.56.56 0 01.373-.02c.365.103.743.176 1.127.2.062.003.125.006.188.006z" />
                                    </svg>
                                    {commentsCount > 0 && (
                                        <span className="text-xs font-medium text-secondary ml-1">
                                            {commentsCount}
                                        </span>
                                    )}
                                </button>
                            </div>

                            {/* Attendance (events only) */}
                            {isEvent && (
                                <div className="relative">
                                    <div className={`flex h-7 items-center justify-center rounded-full hover:bg-secondary/20 transition-colors ${(status === "maybe" ? maybeCount : goingCount) > 0 ? "gap-1 px-1.5" : "w-7"}`}>
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setAttendanceMenuOpen((v) => !v);
                                            }}
                                            className="group flex items-center justify-center w-full h-full cursor-pointer"
                                        >
                                            {status === "going" ? (
                                                <HandThumbUpIcon className={`${ACTION_ICON} text-green-600 dark:text-green-400`} />
                                            ) : status === "maybe" ? (
                                                <QuestionMarkCircleIcon className={`${ACTION_ICON} text-yellow-600 dark:text-yellow-400`} />
                                            ) : status === "not_going" ? (
                                                <HandThumbDownIcon className={`${ACTION_ICON} text-red-600 dark:text-red-400`} />
                                            ) : (
                                                <CalendarIcon className={`${ACTION_ICON} text-secondary group-hover:text-foreground transition-colors`} />
                                            )}
                                            {(status === "maybe" ? maybeCount : goingCount) > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        // Ensure openView exists and is callable before using
                                                        if (openView && typeof openView === 'function') {
                                                            openView("attendance", { id });
                                                        }
                                                    }}
                                                    className="text-xs font-medium text-secondary ml-1 hover:text-foreground hover:underline decoration-secondary/30 transition-colors"
                                                >
                                                    {status === "maybe" ? maybeCount : goingCount}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {attendanceMenuOpen && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setAttendanceMenuOpen(false)} />
                                            <div className="absolute bottom-full left-0 z-50 mb-2 min-w-[160px] overflow-hidden cc-radius-menu cc-glass-strong">
                                                <div className="p-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); handleStatusChange(status === "going" ? null : "going"); setAttendanceMenuOpen(false); }}
                                                        className={`flex w-full items-center justify-between rounded-full px-3 py-2 text-sm hover:bg-secondary/20 transition-colors ${status === "going" ? "text-foreground" : "text-secondary hover:text-foreground"}`}
                                                    >
                                                        <span className="font-medium">Going</span>
                                                        <HandThumbUpIcon className={`h-4 w-4 text-green-600 dark:text-green-400 ${status === "going" ? "opacity-100" : "opacity-0"}`} />
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); handleStatusChange(status === "maybe" ? null : "maybe"); setAttendanceMenuOpen(false); }}
                                                        className={`flex w-full items-center justify-between rounded-full px-3 py-2 text-sm hover:bg-secondary/20 transition-colors ${status === "maybe" ? "text-foreground" : "text-secondary hover:text-foreground"}`}
                                                    >
                                                        <span className="font-medium">Maybe</span>
                                                        <QuestionMarkCircleIcon className={`h-4 w-4 text-yellow-600 dark:text-yellow-400 ${status === "maybe" ? "opacity-100" : "opacity-0"}`} />
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); handleStatusChange(status === "not_going" ? null : "not_going"); setAttendanceMenuOpen(false); }}
                                                        className={`flex w-full items-center justify-between rounded-full px-3 py-2 text-sm hover:bg-secondary/20 transition-colors ${status === "not_going" ? "text-foreground" : "text-secondary hover:text-foreground"}`}
                                                    >
                                                        <span className="font-medium">Not Going</span>
                                                        <HandThumbDownIcon className={`h-4 w-4 text-red-600 dark:text-red-400 ${status === "not_going" ? "opacity-100" : "opacity-0"}`} />
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* 3-dots menu (moved from header) */}
                            {!previewMode && (
                                <div className="relative">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-secondary/20 transition-colors">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOptionsMenuOpen((v) => !v);
                                            }}
                                            className="group flex h-7 w-7 items-center justify-center"
                                        >
                                            <EllipsisVerticalIcon className={`${ACTION_ICON} text-secondary group-hover:text-foreground transition-colors`} />
                                        </button>
                                    </div>

                                    {optionsMenuOpen && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setOptionsMenuOpen(false)} />
                                            <div className="absolute bottom-full right-0 z-50 mb-2 min-w-[180px] overflow-hidden cc-radius-menu cc-glass-strong">
                                                <div className="p-1.5">
                                                    {isOwner && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setOptionsMenuOpen(false);
                                                                if (onEditClick) onEditClick();
                                                                else router.push(`/posts/${post.id}/edit`);
                                                            }}
                                                            className="flex w-full items-center justify-between rounded-full px-3 py-2 text-sm text-foreground hover:bg-secondary/20 transition-colors"
                                                        >
                                                            <span className="font-medium">Edit</span>
                                                            <PencilIcon className="h-4 w-4" />
                                                        </button>
                                                    )}

                                                    {isOwner && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeletePost();
                                                            }}
                                                            className="flex w-full items-center justify-between rounded-full px-3 py-2 text-sm text-red-600 hover:bg-red-500/10 dark:text-red-400"
                                                        >
                                                            <span className="font-medium">Delete</span>
                                                            <TrashIcon className="h-4 w-4" />
                                                        </button>
                                                    )}

                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openView("report", { id, type: isEvent ? "event" : "post" });
                                                            setOptionsMenuOpen(false);
                                                        }}
                                                        className="flex w-full items-center justify-between rounded-full px-3 py-2 text-sm text-secondary hover:bg-secondary/20 hover:text-foreground transition-colors"
                                                    >
                                                        <span className="font-medium">Report</span>
                                                        <FlagIcon className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* leave preview off here to avoid dead complexity */}
                        {!hideCommentPreview && null}
                    </div>
                </div>
            </div>
        );
    }

    // Fallback: keep default variant simple (theme-safe)
    return (
        <div className="cc-section">
            <div className="text-sm font-semibold text-foreground">{displayedName}</div>
            {description && <div className="mt-1 text-sm text-foreground">{description}</div>}
        </div>
    );
}