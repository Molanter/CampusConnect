import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { HandThumbUpIcon, HandThumbDownIcon, QuestionMarkCircleIcon, HeartIcon, CheckIcon, CheckBadgeIcon, XMarkIcon, CalendarIcon, UserGroupIcon } from "@heroicons/react/24/solid";
import { HeartIcon as HeartIconOutline, PencilIcon, EllipsisVerticalIcon, FlagIcon, TrashIcon } from "@heroicons/react/24/outline";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, updateDoc, arrayUnion, arrayRemove, onSnapshot, collection, query, getDocs, orderBy, limit, getDoc, deleteDoc } from "firebase/firestore";
import Link from "next/link";
import { CommentMessage } from "./comment-message";
import { fetchGlobalAdminEmails, isGlobalAdmin } from "../lib/admin-utils";
import { Post } from "../lib/posts";
import { useRightSidebar } from "./right-sidebar-context";

// Using full firestore SDK for real-time listeners as established in RightSidebar
// If this causes issues with "lite" usage elsewhere, we might need to consolidate.
// But usually importing "firebase/firestore" works alongside "lite" if the app is initialized correctly.
// Ideally we should use one SDK, but for this feature set (real-time), full SDK is better.

type AttendanceStatus = "going" | "maybe" | "not_going" | null;

interface PostCardProps {
    post: Post;
    compact?: boolean;
    onCommentsClick?: () => void;
    onAttendanceClick?: () => void;
    onDetailsClick?: () => void;
    onLikesClick?: () => void;
    onEditClick?: () => void;
    previewMode?: boolean;
    hideMediaPlaceholder?: boolean;
    displayId?: string; // Optional ID override for rendering variants
    hideMediaGrid?: boolean;
    hideCommentPreview?: boolean;

    hideDate?: boolean;
    fullWidth?: boolean;
    variant?: "default" | "threads";
    onDeleted?: () => void;
}

import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { MediaHorizontalScroll } from "@/components/post-detail/media-horizontal-scroll";
import { formatDistanceToNow } from "date-fns";
import { useUserProfile } from "./user-profiles-context";
import { useClubProfile } from "./club-profiles-context";

const mapContainerStyle = {
    width: "100%",
    height: "100%",
};

const libraries: ("places" | "geometry" | "drawing" | "visualization")[] = ["places"];

export function PostCard({
    post,
    compact = false,
    onCommentsClick,
    onAttendanceClick,
    onDetailsClick,
    onLikesClick,
    previewMode = false,
    hideMediaPlaceholder = false,
    hideMediaGrid = false,
    hideCommentPreview = false,

    hideDate = false,
    fullWidth = false,
    variant = "default",
    onEditClick,
    onDeleted,
}: PostCardProps) {
    const router = useRouter();
    // Deconstruct fields for easier access and backward compatibility logic
    const {
        id,
        title,
        content: description, // mapping content to description for now if description is missing
        imageUrls: images = [],
        date,
        startTime: time = "", // assuming startTime is the main time
        locationLabel: location,
        authorName: hostName = "You",
        authorUsername: hostUsername,
        authorAvatarUrl: hostAvatarUrl,
        authorId,
        coordinates,
        likes = [],
        isEvent,
        createdAt,
        editCount = 0,
        clubId,
    } = post;

    const [status, setStatus] = useState<AttendanceStatus>(null);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [stats, setStats] = useState({
        going: post.goingUids?.length || 0,
        maybe: post.maybeUids?.length || 0,
        notGoing: post.notGoingUids?.length || 0,
        comments: 0
    });
    const [previewComment, setPreviewComment] = useState<any>(null);
    const [hasMoreComments, setHasMoreComments] = useState(false);
    const [isLiked, setIsLiked] = useState(false);
    const [likesCount, setLikesCount] = useState(likes.length);
    const [canDeleteComments, setCanDeleteComments] = useState(false);
    const [contextMenuOpen, setContextMenuOpen] = useState(false);
    const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
    const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
    const [attendanceMenuOpen, setAttendanceMenuOpen] = useState(false);
    const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
    const descriptionRef = useRef<HTMLDivElement>(null);
    const [displayText, setDisplayText] = useState(description);
    const [isTruncated, setIsTruncated] = useState(false);

    const hasMedia = images.length > 0 || !!coordinates;
    const lineLimit = hasMedia ? 3 : 5;

    useEffect(() => {
        const checkTruncation = () => {
            const el = descriptionRef.current;
            if (!el || !description) return;

            const styles = window.getComputedStyle(el);
            const lineHeight = parseFloat(styles.lineHeight);
            if (isNaN(lineHeight)) return;

            const maxHeight = lineHeight * lineLimit;

            // Use a temporary div for measurement to avoid flickering
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
            measureEl.textContent = description;
            document.body.appendChild(measureEl);

            if (measureEl.scrollHeight <= maxHeight + 1) {
                setIsTruncated(false);
                setDisplayText(description);
                document.body.removeChild(measureEl);
                return;
            }

            // Binary search for the truncation point
            let low = 0;
            let high = description.length;
            let best = 0;

            // Increase the buffer to ensure a very pronounced gap like Threads.
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

            // Snap to the nearest word boundary to avoid cutting words in half
            const truncatedText = description.slice(0, best);
            const lastSpaceIndex = truncatedText.lastIndexOf(" ");
            const snapPoint = lastSpaceIndex > 0 ? lastSpaceIndex : best;

            setIsTruncated(true);
            setDisplayText(description.slice(0, snapPoint).trim());
            document.body.removeChild(measureEl);
        };

        checkTruncation();

        const observer = new ResizeObserver(() => {
            checkTruncation();
        });

        if (descriptionRef.current) {
            observer.observe(descriptionRef.current);
        }

        return () => {
            observer.disconnect();
        };
    }, [description, lineLimit, variant]);

    let openView: any = () => console.warn("RightSidebar context not available");
    let sidebarVisible = false;
    let isNarrow = false;
    try {
        const sidebar = useRightSidebar();
        openView = sidebar.openView;
        sidebarVisible = sidebar.isVisible;
        isNarrow = sidebar.isNarrow;
    } catch (e) {
        // Ignore error if context is missing (e.g. in isolation)
    }

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setCurrentUser(u));
        return () => unsub();
    }, []);

    // Helper to reload preview comment
    const loadPreviewComment = async () => {
        if (!id || previewMode) return;

        try {
            const commentsRef = collection(db, "posts", id, "comments");
            const q = query(commentsRef, orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);

            if (snapshot.size > 0) {
                // Find comment with most replies or likes
                let bestComment: any = null;
                let bestScore = -1;

                for (const docSnap of snapshot.docs) {
                    const data = docSnap.data();

                    const repliesRef = collection(db, "posts", id, "comments", docSnap.id, "replies");
                    const repliesSnapshot = await getDocs(repliesRef);

                    // Load replies (simplified)
                    const replies = repliesSnapshot.docs.map(replyDoc => {
                        const replyData = replyDoc.data();
                        return {
                            id: replyDoc.id,
                            text: replyData.text ?? "",
                            authorName: replyData.authorName ?? "Someone",
                            authorUid: replyData.authorUid ?? null,
                            authorPhotoURL: replyData.authorPhotoURL ?? null,
                            authorUsername: replyData.authorUsername ?? null,
                            createdAt: replyData.createdAt?.toDate ? replyData.createdAt.toDate() : null,
                            updatedAt: replyData.updatedAt?.toDate ? replyData.updatedAt.toDate() : null,
                            likes: replyData.likes ?? [],
                            parentPath: [docSnap.id],
                            replies: [],
                        };
                    });

                    // Sort replies by likes (descending) and take only the top 1
                    replies.sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));
                    const topReply = replies.slice(0, 1);

                    const score = (data.likes?.length || 0) + (repliesSnapshot.size * 2);

                    if (score > bestScore) {
                        bestScore = score;
                        bestComment = {
                            id: docSnap.id,
                            text: data.text ?? "",
                            authorName: data.authorName ?? "Someone",
                            authorUid: data.authorUid ?? null,
                            authorPhotoURL: data.authorPhotoURL ?? null,
                            authorUsername: data.authorUsername ?? null,
                            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
                            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : null,
                            likes: data.likes ?? [],
                            replies: topReply,
                            replyCount: repliesSnapshot.size,
                        };
                    }
                }

                if (!bestComment && snapshot.docs.length > 0) {
                    const fallbackData = snapshot.docs[0].id;
                    const data = snapshot.docs[0].data();
                    bestComment = {
                        id: snapshot.docs[0].id,
                        text: data.text ?? "",
                        authorName: data.authorName ?? "Someone",
                        authorUid: data.authorUid ?? null,
                        authorPhotoURL: data.authorPhotoURL ?? null,
                        authorUsername: data.authorUsername ?? null,
                        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
                        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : null,
                        likes: data.likes ?? [],
                        replies: [],
                    };
                }

                setPreviewComment(bestComment);
                setHasMoreComments(snapshot.size > 1);
            }
        } catch (error) {
            console.error("Error loading preview comment:", error);
        }
    };

    const profile = useUserProfile(authorId);
    const clubProfile = useClubProfile(clubId && clubId !== "" ? clubId : undefined);

    // CRITICAL: We enter club branding mode if we have a clubId, 
    // regardless of whether the profile is loaded yet.
    const isClubPost = !!(clubId && clubId !== "");

    // DEBUG: Club Posting Verification
    useEffect(() => {
        if (clubId && clubId !== "") {
            console.log(`%c[PostCard Debug] Post ${id} has clubId: ${clubId}`, 'background: #222; color: #ffb200; font-weight: bold');
            console.log(`[PostCard Debug] Post ${id} clubProfile:`, clubProfile);
            console.log(`[PostCard Debug] Post ${id} isClubPost: ${isClubPost}`);
            console.log(`[PostCard Debug] Full Post Object:`, post);
        }
    }, [id, clubId, clubProfile, isClubPost, post]);

    // Final display values with fallbacks - strict "no-stale" policy
    const displayedName = profile?.displayName || "User";
    const displayedPhotoUrl = profile?.photoURL || null;
    const currentUsername = profile?.username;

    // Load preview comment (one with most replies or likes)
    useEffect(() => {
        if (!id) return;
        loadPreviewComment();
    }, [id]);

    // Load and track likes for the event
    useEffect(() => {
        if (!id || previewMode) return;

        const eventRef = doc(db, "posts", id);

        const unsubscribe = onSnapshot(eventRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                const likes = data.likes || [];
                setLikesCount(likes.length);
                if (currentUser) {
                    setIsLiked(likes.includes(currentUser.uid));
                }
            }
        });

        return () => unsubscribe();
    }, [id, currentUser]);

    useEffect(() => {
        if (!id || previewMode) return;

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

                if (currentUser) {
                    if (going.includes(currentUser.uid)) setStatus("going");
                    else if (maybe.includes(currentUser.uid)) setStatus("maybe");
                    else if (notGoing.includes(currentUser.uid)) setStatus("not_going");
                    else setStatus(null);
                }
            }
        });

        return () => unsubscribe();
    }, [id, currentUser]);

    // Separate listener for comments count
    useEffect(() => {
        if (!id || previewMode) return;


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
                const commentsRef = collection(db, "posts", id, "comments");
                const commentsSnapshot = await getDocs(commentsRef);
                let totalCount = commentsSnapshot.size;

                for (const commentDoc of commentsSnapshot.docs) {
                    const commentPath = `posts/${id}/comments/${commentDoc.id}`;
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

        const commentsRef = collection(db, "posts", id, "comments");
        const q = query(commentsRef);

        const unsubscribe = onSnapshot(q, () => {
            updateCommentCount();
        });

        // Initial count
        updateCommentCount();

        return () => unsubscribe();
    }, [id]);

    const handleStatusChange = async (newStatus: AttendanceStatus) => {
        if (!id || !currentUser) return;
        if (status === newStatus) return; // No change

        // Optimistic update
        const oldStatus = status;
        setStatus(newStatus);

        // Update stats optimistically
        setStats(prev => {
            const newStats = { ...prev };

            // Decrement old status count
            if (oldStatus) {
                if (oldStatus === "going") newStats.going = Math.max(0, newStats.going - 1);
                if (oldStatus === "maybe") newStats.maybe = Math.max(0, newStats.maybe - 1);
                if (oldStatus === "not_going") newStats.notGoing = Math.max(0, newStats.notGoing - 1);
            }

            // Increment new status count
            if (newStatus) {
                if (newStatus === "going") newStats.going++;
                if (newStatus === "maybe") newStats.maybe++;
                if (newStatus === "not_going") newStats.notGoing++;
            }

            return newStats;
        });



        if (previewMode) return;

        try {
            const docRef = doc(db, "posts", id);

            const updates: any = {};

            // Remove from old list
            if (oldStatus === "going") updates.goingUids = arrayRemove(currentUser.uid);
            if (oldStatus === "maybe") updates.maybeUids = arrayRemove(currentUser.uid);
            if (oldStatus === "not_going") updates.notGoingUids = arrayRemove(currentUser.uid);

            // Add to new list
            if (newStatus === "going") updates.goingUids = arrayUnion(currentUser.uid);
            if (newStatus === "maybe") updates.maybeUids = arrayUnion(currentUser.uid);
            if (newStatus === "not_going") updates.notGoingUids = arrayUnion(currentUser.uid);

            await updateDoc(docRef, updates);
        } catch (err) {
            console.error("Error updating attendance:", err);
            setStatus(oldStatus); // Revert
            // Revert stats
            setStats(prev => {
                const newStats = { ...prev };
                if (oldStatus) {
                    if (oldStatus === "going") newStats.going++;
                    if (oldStatus === "maybe") newStats.maybe++;
                    if (oldStatus === "not_going") newStats.notGoing++;
                }
                if (newStatus) {
                    if (newStatus === "going") newStats.going--;
                    if (newStatus === "maybe") newStats.maybe--;
                    if (newStatus === "not_going") newStats.notGoing--;
                }
                return newStats;
            });
        }
    };

    const [likeAnimating, setLikeAnimating] = useState(false);

    const handleToggleLike = async () => {
        // In preview mode, just animate and toggle local state
        if (previewMode) {
            setLikeAnimating(true);
            setTimeout(() => setLikeAnimating(false), 140);
            setIsLiked(!isLiked);
            setLikesCount(prev => isLiked ? prev - 1 : prev + 1);
            return;
        }

        if (!id || !currentUser) return;

        // Trigger animation
        setLikeAnimating(true);
        setTimeout(() => setLikeAnimating(false), 140);

        // Optimistic update
        const originalIsLiked = isLiked;
        const originalLikesCount = likesCount;

        setIsLiked(!isLiked);
        setLikesCount(prev => isLiked ? prev - 1 : prev + 1);

        try {
            const eventRef = doc(db, "posts", id);

            await updateDoc(eventRef, {
                likes: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
            });
        } catch (error) {
            console.error("Error toggling like:", error);
            // Revert on error
            setIsLiked(originalIsLiked);
            setLikesCount(originalLikesCount);
        }
    };

    // Check if current user can delete comments (event owner or global admin)
    useEffect(() => {
        if (!currentUser) {
            setCanDeleteComments(false);
            return;
        }

        const checkPermissions = async () => {
            // User can delete if they're the event host
            const isEventOwner = currentUser.uid === authorId; // Adjust as needed

            // Or if they're a global admin
            const globalAdmins = await fetchGlobalAdminEmails();
            const isAdmin = isGlobalAdmin(currentUser.email || "", globalAdmins);

            setCanDeleteComments(isEventOwner || isAdmin);
        };

        checkPermissions();
    }, [currentUser, authorId]);

    // Comment action handlers
    const handleCommentReply = (comment: any) => {
        // Open comments sheet with reply context
        onCommentsClick?.();
    };

    const handleCommentLike = async (comment: any) => {
        if (!id || !currentUser) return;
        try {
            const dbAccess = db;

            // Build path correctly for nested replies
            let commentPath: string;
            const parentPath = comment.parentPath || [];

            if (parentPath.length === 0) {
                // Top-level comment
                commentPath = `posts/${id}/comments/${comment.id}`;
            } else {
                // Nested reply - build path incrementally
                commentPath = `posts/${id}/comments/${parentPath[0]}`;
                for (let i = 1; i < parentPath.length; i++) {
                    commentPath += `/replies/${parentPath[i]}`;
                }
                commentPath += `/replies/${comment.id}`;
            }

            console.log("DEBUG: handleCommentLike", {
                id,
                commentId: comment.id,
                parentPath: comment.parentPath,
                generatedPath: commentPath
            });

            const pathSegments = commentPath.split('/');
            const commentRef = doc(db, pathSegments[0], pathSegments[1], ...pathSegments.slice(2));
            const isLiked = comment.likes?.includes(currentUser.uid);

            // Optimistic update
            const originalPreviewComment = { ...previewComment };
            const updatedPreviewComment = { ...previewComment };

            // Helper to toggle like in a comment object
            const toggleLikeInObj = (obj: any) => {
                const currentLikes = obj.likes || [];
                if (isLiked) {
                    obj.likes = currentLikes.filter((uid: string) => uid !== currentUser.uid);
                } else {
                    obj.likes = [...currentLikes, currentUser.uid];
                }
                return obj;
            };

            if (updatedPreviewComment.id === comment.id) {
                // Updating the main preview comment
                toggleLikeInObj(updatedPreviewComment);
            } else if (updatedPreviewComment.replies) {
                // Updating a reply
                updatedPreviewComment.replies = updatedPreviewComment.replies.map((r: any) => {
                    if (r.id === comment.id) {
                        return toggleLikeInObj({ ...r });
                    }
                    return r;
                });
            }

            setPreviewComment(updatedPreviewComment);

            try {
                await updateDoc(commentRef, {
                    likes: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
                });
                // No need to reload, we already updated optimistically
                // But we can reload silently to ensure consistency if needed
                // loadPreviewComment(); 
            } catch (error) {
                console.error("Error toggling comment like:", error);
                // Revert on error
                setPreviewComment(originalPreviewComment);
            }
        } catch (error) {
            console.error("Error in handleCommentLike wrapper:", error);
        }
    };

    const handleCommentReport = async (comment: any) => {
        console.log("Report comment:", comment);
        // Open comments sheet or show report modal
        onCommentsClick?.();
    };

    const handleCommentDelete = async (comment: any) => {
        console.log("Delete comment:", comment);
        // Can be implemented if needed
    };

    const handleCommentEdit = async (comment: any, newText: string) => {
        console.log("Edit comment:", comment, newText);
        // Can be implemented if needed
    };

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
        libraries: libraries,
    });

    // console.log("AttendanceCard coordinates:", coordinates, "isLoaded:", isLoaded);

    const renderMediaItem = (item: string | { lat: number; lng: number }, index: number, className: string) => {
        if (typeof item === 'string') {
            return (
                <img
                    key={`img-${index}`}
                    src={item}
                    alt=""
                    className={`${className} ${onDetailsClick ? "cursor-pointer" : ""}`}
                    onClick={(e) => {
                        if (onDetailsClick) {
                            e.stopPropagation();
                            onDetailsClick();
                        }
                    }}
                />
            );
        } else {
            // Map Item
            if (!isLoaded) return <div key="map-loading" className={`${className} bg-neutral-800 animate-pulse`} />;
            return (
                <div
                    key="map-view"
                    className={`${className} relative overflow-hidden ${onDetailsClick ? "cursor-pointer" : ""}`}
                    onClick={(e) => {
                        if (onDetailsClick) {
                            e.stopPropagation();
                            onDetailsClick();
                        }
                    }}
                >
                    <GoogleMap
                        mapContainerStyle={mapContainerStyle}
                        center={item}
                        zoom={15}
                        options={{
                            disableDefaultUI: true,
                            zoomControl: false,
                            streetViewControl: false,
                            mapTypeControl: false,
                            fullscreenControl: false,
                            draggable: false, // Static-like feel for preview
                        }}
                    >
                        <Marker position={item} />
                    </GoogleMap>
                    {/* Overlay to prevent interaction if desired, or keep it interactive */}
                </div>
            );
        }
    };

    const mediaItems: (string | { lat: number; lng: number })[] = [...images];
    if (coordinates) {
        mediaItems.push(coordinates);
    }

    const getTimeUntilLabel = () => {
        if (!date) return null;

        // Expecting date as yyyy-mm-dd. If time is missing, default to 00:00
        const timeStr = time || "00:00";
        // Handle time ranges like "20:59 - 21:59" by extracting the start time
        const startTime = timeStr.split('-')[0].trim();
        const target = new Date(`${date}T${startTime}:00`);
        const now = new Date();
        const diffMs = target.getTime() - now.getTime();

        if (!Number.isFinite(diffMs)) return null;

        // If the event time has already passed, show expired
        if (diffMs <= 0) return "expired";

        const totalMinutes = Math.round(diffMs / 60000);
        const months = Math.floor(totalMinutes / (60 * 24 * 30));
        const days = Math.floor((totalMinutes % (60 * 24 * 30)) / (60 * 24));
        const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
        const minutes = totalMinutes % 60;

        // Show the most significant unit
        if (months > 0) {
            return `${months}m`;
        }
        if (days > 0) {
            return `${days}d`;
        }
        if (hours > 0) {
            return `${hours}h`;
        }
        return `${minutes}m`;
    };

    const getPostTimeLabel = () => {
        if (isEvent) {
            return getTimeUntilLabel();
        }

        if (!createdAt) return "now";

        const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
        if (isNaN(date.getTime())) return "now";

        // Shorten the formatDistanceToNow output
        // e.g. "about 2 hours" -> "2h", "less than a minute" -> "now"
        const distance = formatDistanceToNow(date, { addSuffix: false });

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
    };

    const timeLabel = getPostTimeLabel();

    const getStatusObj = () => {
        if (!date || !time) return { type: 'upcoming', label: 'UPCOMING' };

        const now = new Date();
        const start = new Date(`${date}T${time}`);
        // Default 2h duration if no end time
        // Note: We need endTime from post, but it wasn't deconstructed. 
        // Accessing post.endTime directly or adding to deconstruction.
        // Let's rely on adding it to deconstruction in the next step or access via post.endTime
        const end = post.endTime ? new Date(`${date}T${post.endTime}`) : new Date(start.getTime() + 2 * 60 * 60 * 1000);

        let type: 'live' | 'upcoming' | 'past' = 'upcoming';
        if (now > end) type = 'past';
        else if (now >= start) type = 'live';

        let label = "UPCOMING";
        if (type === 'live') label = "LIVE";
        else if (type === 'past') label = "ENDED";

        return { type, label };
    };

    const statusObj = getStatusObj();

    const renderOverflowBubbles = (items: (string | { lat: number; lng: number })[]) => {
        if (items.length === 0) return null;

        // Compact “more” tile: a small rounded square with thumbnail + count,
        // so the bottom-right grid item feels lighter and smaller.
        const firstImage = items.find((item) => typeof item === "string") as string | undefined;
        const remainingCount = items.length;

        return (
            <div className="relative aspect-square w-full flex items-center justify-center">
                <div className="relative h-16 w-16 sm:h-20 sm:w-20">
                    {firstImage ? (
                        <img
                            src={firstImage}
                            alt=""
                            className="h-full w-full rounded-[22px] border border-white/[0.06] bg-[#0D0D0D] shadow-[0_6px_20px_rgba(0,0,0,0.35)] object-cover transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.04]"
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center rounded-[22px] border border-white/[0.06] bg-[#0D0D0D] shadow-[0_6px_20px_rgba(0,0,0,0.35)] text-[11px] text-neutral-300 transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.04]">
                            More
                        </div>
                    )}

                    <div className="absolute -bottom-1 -right-1 rounded-full border border-white/20 bg-black/85 px-2 py-0.5 text-[10px] font-semibold text-white shadow-md shadow-black/60">
                        +{remainingCount}
                    </div>
                </div>
            </div>
        );
    };

    const renderImages = () => {
        if (mediaItems.length === 0) {
            return null;
        }

        if (mediaItems.length === 1) {
            return (
                <div className="w-full max-w-[450px] flex justify-start items-start">
                    <div className="h-fit w-fit max-w-full overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#0D0D0D] shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.04] mx-0">
                        {typeof mediaItems[0] === 'string' ? (
                            <img
                                src={mediaItems[0]}
                                alt={title}
                                className={`block w-auto h-auto max-w-full max-h-[500px] mx-0 object-contain ${onDetailsClick ? "cursor-pointer" : ""}`}
                                onClick={(e) => {
                                    if (onDetailsClick) {
                                        e.stopPropagation();
                                        onDetailsClick();
                                    }
                                }}
                            />
                        ) : (
                            <div
                                className={`aspect-[4/3] w-full ${onDetailsClick ? "cursor-pointer" : ""}`}
                                onClick={(e) => {
                                    if (onDetailsClick) {
                                        e.stopPropagation();
                                        onDetailsClick();
                                    }
                                }}
                            >
                                {renderMediaItem(mediaItems[0], 0, "h-full w-full object-cover")}
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        if (mediaItems.length === 2) {
            return (
                <div className="grid aspect-[4/3] w-full grid-cols-2 gap-3">
                    <div className="h-full w-full overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#0D0D0D] shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.04]">
                        {renderMediaItem(mediaItems[0], 0, "h-full w-full object-cover")}
                    </div>
                    <div className="h-full w-full overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#0D0D0D] shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.04]">
                        {renderMediaItem(mediaItems[1], 1, "h-full w-full object-cover")}
                    </div>
                </div>
            );
        }

        if (mediaItems.length === 3) {
            return (
                <div className="grid w-full grid-cols-2 gap-3">
                    <div className="flex flex-col gap-3">
                        <div className="relative aspect-square w-full overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#0D0D0D] shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.04]">
                            {renderMediaItem(mediaItems[0], 0, "absolute inset-0 h-full w-full object-cover")}
                        </div>
                        <div className="relative aspect-square w-full overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#0D0D0D] shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.04]">
                            {renderMediaItem(mediaItems[1], 1, "absolute inset-0 h-full w-full object-cover")}
                        </div>
                    </div>
                    <div className="relative h-full w-full overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#0D0D0D] shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.04]">
                        {renderMediaItem(mediaItems[2], 2, "absolute inset-0 h-full w-full object-cover")}
                    </div>
                </div>
            );
        }

        // 4 or more
        // For exactly 4 items, always show a simple 2x2 grid with no bubbles.
        if (mediaItems.length === 4) {
            return (
                <div className="grid w-full grid-cols-2 gap-3">
                    <div className="flex flex-col gap-3">
                        <div className="relative aspect-square w-full overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#0D0D0D] shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.04]">
                            {renderMediaItem(mediaItems[0], 0, "absolute inset-0 h-full w-full object-cover")}
                        </div>
                        <div className="relative aspect-square w-full overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#0D0D0D] shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.04]">
                            {renderMediaItem(mediaItems[2], 2, "absolute inset-0 h-full w-full object-cover")}
                        </div>
                    </div>
                    <div className="flex flex-col gap-3">
                        <div className="relative aspect-square w-full overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#0D0D0D] shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.04]">
                            {renderMediaItem(mediaItems[1], 1, "absolute inset-0 h-full w-full object-cover")}
                        </div>
                        <div className="relative aspect-square w-full overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#0D0D0D] shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.04]">
                            {renderMediaItem(mediaItems[3], 3, "absolute inset-0 h-full w-full object-cover")}
                        </div>
                    </div>
                </div>
            );
        }

        const hasMap = !!coordinates;
        const mapIndex = hasMap ? mediaItems.length - 1 : -1;

        // Special case: if map exists and there are 5+ media items, keep map in top-right,
        // and use bubbles only for extra images.
        if (hasMap && mediaItems.length >= 5) {
            const nonMapItems = mediaItems.filter((_, idx) => idx !== mapIndex);
            const primaryNonMap = nonMapItems.slice(0, 2); // top-left, bottom-left
            const bubbleItems = nonMapItems.slice(2); // extras go into bubbles

            return (
                <div className="grid w-full grid-cols-2 gap-3">
                    <div className="flex flex-col gap-3">
                        <div className="relative aspect-square w-full overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#0D0D0D] shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.04]">
                            {primaryNonMap[0] &&
                                renderMediaItem(primaryNonMap[0], 0, "absolute inset-0 h-full w-full object-cover")}
                        </div>
                        <div className="relative aspect-square w-full overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#0D0D0D] shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.04]">
                            {primaryNonMap[1] &&
                                renderMediaItem(primaryNonMap[1], 1, "absolute inset-0 h-full w-full object-cover")}
                        </div>
                    </div>
                    <div className="flex flex-col gap-3">
                        {/* Map pinned to top-right */}
                        <div className="relative aspect-square w-full overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#0D0D0D] shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.04]">
                            {renderMediaItem(mediaItems[mapIndex], mapIndex, "absolute inset-0 h-full w-full object-cover")}
                        </div>
                        {/* Bottom-right: bubbles for remaining images */}
                        {renderOverflowBubbles(bubbleItems)}
                    </div>
                </div>
            );
        }

        // Default 4+ layout (no map or <5 media items)
        const extraItems = mediaItems.slice(3);

        return (
            <div className="grid w-full grid-cols-2 gap-3">
                <div className="flex flex-col gap-3">
                    <div className="relative aspect-square w-full overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#0D0D0D] shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.04]">
                        {renderMediaItem(mediaItems[0], 0, "absolute inset-0 h-full w-full object-cover")}
                    </div>
                    <div className="relative aspect-square w-full overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#0D0D0D] shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.04]">
                        {renderMediaItem(mediaItems[2], 2, "absolute inset-0 h-full w-full object-cover")}
                    </div>
                </div>
                <div className="flex flex-col gap-3">
                    <div className="relative aspect-square w-full overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#0D0D0D] shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.04]">
                        {renderMediaItem(mediaItems[1], 1, "absolute inset-0 h-full w-full object-cover")}
                    </div>
                    {/* Bottom-right: bubbles for images that didn't fit */}
                    {renderOverflowBubbles(extraItems)}
                </div>
            </div>
        );
    };

    const containerClasses = compact
        ? "flex w-full max-w-md mx-auto flex-col gap-3 font-sans"
        : (fullWidth || isNarrow)
            ? "flex w-full flex-col gap-3 font-sans"
            : "flex w-full min-w-[350px] max-w-[600px] mx-auto items-start gap-3 font-sans border-b border-white/5 pb-4 mb-2";

    // Context menu handlers
    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenuPosition({ x: e.clientX, y: e.clientY });
        setContextMenuOpen(true);
    };

    const handleLongPressStart = (e: React.TouchEvent) => {
        const timer = setTimeout(() => {
            const touch = e.touches[0];
            setContextMenuPosition({ x: touch.clientX, y: touch.clientY });
            setContextMenuOpen(true);
        }, 500);
        setLongPressTimer(timer);
    };

    const handleLongPressEnd = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            setLongPressTimer(null);
        }
    };

    const closeContextMenu = () => {
        setContextMenuOpen(false);
    };

    const handleShare = () => {
        if (navigator.share && id) {
            navigator.share({
                title: title,
                text: description || undefined,
                url: window.location.origin + `/events/${id}`,
            }).catch(err => console.log("Share error:", err));
        } else if (id) {
            navigator.clipboard.writeText(window.location.origin + `/events/${id}`);
            alert("Link copied to clipboard!");
        }
        closeContextMenu();
    };

    const handleDeletePost = async () => {
        if (!id || previewMode) return;
        if (confirm(`Are you sure you want to delete this ${isEvent ? 'event' : 'post'}?`)) {
            try {
                await deleteDoc(doc(db, "posts", id));
                onDeleted?.();
                closeContextMenu();
                setOptionsMenuOpen(false);
            } catch (err) {
                console.error("Delete error:", err);
                alert("Failed to delete post.");
            }
        }
    };

    const isEventOwner = currentUser?.uid === authorId;

    // Get attendance status label and icon
    const getAttendanceStatus = () => {
        switch (status) {
            case "going":
                return { label: "Going", icon: <HandThumbUpIcon className="h-4 w-4" />, color: "text-green-400" };
            case "maybe":
                return { label: "Maybe", icon: <QuestionMarkCircleIcon className="h-4 w-4" />, color: "text-yellow-400" };
            case "not_going":
                return { label: "Not Going", icon: <HandThumbDownIcon className="h-4 w-4" />, color: "text-red-400" };
            default:
                return { label: "RSVP", icon: <QuestionMarkCircleIcon className="h-4 w-4" />, color: "text-neutral-400" };
        }
    };

    const attendanceStatus = getAttendanceStatus();

    // Close context menu when clicking outside
    useEffect(() => {
        if (contextMenuOpen) {
            const handleClick = () => closeContextMenu();
            document.addEventListener('click', handleClick);
            return () => document.removeEventListener('click', handleClick);
        }
    }, [contextMenuOpen]);

    const getEventTimeLabel = () => {
        if (!isEvent || !date || !time) return null;

        try {
            // Parse event date and time
            // date is YYYY-MM-DD, time is HH:mm
            const eventDateTime = new Date(`${date}T${time}`);
            const now = new Date();
            const diffMs = eventDateTime.getTime() - now.getTime();

            if (diffMs < 0) return null; // Expired

            const diffMins = Math.floor(diffMs / (1000 * 60));
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            if (diffDays > 0) return `in ${diffDays}d`;
            if (diffHours > 0) return `in ${diffHours}h`;
            return `in ${diffMins}m`;
        } catch (e) {
            return null;
        }
    };

    const eventTimeLabel = getEventTimeLabel();


    // Threads Variant Render
    if (variant === "threads") {
        return (
            <div
                className={`group relative border-b border-white/10 ${isNarrow ? 'py-2.5' : 'py-3'}`}
                onContextMenu={handleContextMenu}
                onTouchStart={handleLongPressStart}
                onTouchEnd={handleLongPressEnd}
                onTouchMove={handleLongPressEnd}
            >
                {/* Layout: Avatar + Content */}
                <div className="flex items-start gap-2.5">
                    {/* Avatar Column */}
                    <div className="shrink-0 self-start">
                        {isClubPost ? (
                            <Link href={`/clubs/${clubId}`} onClick={(e) => e.stopPropagation()}>
                                <div className={`h-10 w-10 overflow-hidden rounded-full ${clubProfile?.avatarUrl?.toLowerCase().endsWith('.png') ? 'bg-transparent' : 'bg-neutral-700'}`}>
                                    {clubProfile?.avatarUrl ? (
                                        <img src={clubProfile.avatarUrl} alt={clubProfile.name} className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white">
                                            {clubProfile?.name ? clubProfile.name.charAt(0).toUpperCase() : (clubId ? "C" : "?")}
                                        </div>
                                    )}
                                </div>
                            </Link>
                        ) : (
                            <Link href={`/user/${authorId}`} onClick={(e) => e.stopPropagation()}>
                                <div className={`h-10 w-10 overflow-hidden rounded-full ${displayedPhotoUrl?.toLowerCase().endsWith('.png') ? 'bg-transparent' : 'bg-neutral-700'}`}>
                                    {displayedPhotoUrl ? (
                                        <img src={displayedPhotoUrl} alt={displayedName} className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-bold text-white">
                                            {displayedName ? displayedName.charAt(0).toUpperCase() : "U"}
                                        </div>
                                    )}
                                </div>
                            </Link>
                        )}
                    </div>

                    {/* Content Column */}
                    <div className="min-w-0 flex-1 space-y-0">
                        {/* Header: Username, Timestamp, Menu */}
                        <div className="flex flex-col min-w-0">
                            <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                                {isClubPost ? (
                                    <>
                                        <Link
                                            href={`/clubs/${clubId}`}
                                            onClick={(e) => e.stopPropagation()}
                                            className="flex-shrink-0 hover:underline decoration-white/30"
                                        >
                                            <span className="text-sm font-semibold text-white">
                                                {clubProfile?.name || "Club"}
                                            </span>
                                        </Link>
                                        <Link
                                            href={`/user/${authorId}`}
                                            onClick={(e) => e.stopPropagation()}
                                            className="text-xs text-white/40 hover:text-white/60 truncate"
                                        >
                                            by {currentUsername || (displayedName ? displayedName.toLowerCase().replace(/\s+/g, '') : "user")}
                                        </Link>
                                    </>
                                ) : (
                                    <Link
                                        href={`/user/${authorId}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="flex min-w-0 items-center gap-1.5 hover:underline decoration-white/30 group"
                                    >
                                        <span className="truncate text-sm font-semibold text-white">
                                            {displayedName}
                                        </span>
                                        {currentUsername && (
                                            <>
                                                <span className="text-xs text-white/40 truncate">
                                                    @{currentUsername}
                                                </span>
                                            </>
                                        )}
                                    </Link>
                                )}
                                <span className="text-xs text-white/30 shrink-0">•</span>
                                <div className="text-xs text-white/40 shrink-0">
                                    {eventTimeLabel || timeLabel || (date ? date : "now")}
                                </div>
                                {post.visibility === "under_review" && (
                                    <>
                                        <span className="text-xs text-white/30 shrink-0">•</span>
                                        <span className="px-2 py-0.5 rounded-md bg-yellow-500/20 text-yellow-400 text-xs font-medium shrink-0">
                                            Under Review
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Body: Description */}
                        {description && (
                            <div className="relative">
                                <div
                                    ref={descriptionRef}
                                    onClick={onDetailsClick}
                                    className={`mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-white/90 ${onDetailsClick ? "cursor-pointer" : ""}`}
                                >
                                    {isTruncated ? (
                                        <div className="inline">
                                            <span>{displayText}... </span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDetailsClick?.();
                                                }}
                                                className="inline font-medium text-white/40 hover:text-white/60"
                                            >
                                                show more
                                            </button>
                                        </div>
                                    ) : (
                                        description
                                    )}
                                </div>
                            </div>
                        )}

                        {!hideMediaGrid && (
                            <div className={description ? "mt-0.5 mb-2" : "mt-2.5 mb-2"}>
                                <MediaHorizontalScroll
                                    post={post}
                                    noPadding
                                    fullWidth={!previewMode && !sidebarVisible}
                                    onClick={onDetailsClick}
                                    isNarrow={isNarrow}
                                />
                            </div>
                        )}

                        <div className="mt-[-4px] flex items-center gap-0 ml-[-8px]">
                            {/* Like Button & Count */}
                            <div className={`flex h-7 items-center justify-center rounded-full hover:bg-white/[0.08] ${likesCount > 0 ? "gap-1 px-1.5" : "w-7"}`}>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleLike();
                                    }}
                                    className={`flex items-center justify-center ${isLiked ? "text-[#ffb200]" : "text-white/70 hover:text-white"}`}
                                >
                                    {isLiked ? (
                                        <HeartIcon className={`h-4 w-4 ${likeAnimating ? "animate-like-pop" : ""}`} />
                                    ) : (
                                        <HeartIconOutline className={`h-4 w-4 ${likeAnimating ? "animate-like-pop" : ""}`} />
                                    )}
                                </button>
                                {likesCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onLikesClick?.();
                                        }}
                                        className="flex items-center text-white/60"
                                    >
                                        <span className="text-xs">{likesCount}</span>
                                    </button>
                                )}
                            </div>

                            {/* Comment Button & Count */}
                            <div className={`flex h-7 items-center justify-center rounded-full text-white/70 hover:bg-white/[0.08] ${(() => {
                                const totalComments = (post.commentsCount || 0) + (post.repliesCommentsCount || 0);
                                const displayCount = totalComments > 0 ? totalComments : (stats.comments || 0);
                                return displayCount > 0 ? "gap-1 px-2" : "w-7";
                            })()}`}>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onCommentsClick?.(); }}
                                    className="flex items-center justify-center hover:text-white"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.633 9-8.4375 0-4.805-4.03-8.4375-9-8.4375-4.97 0-9 3.6325-9 8.4375 0 2.457 1.056 4.675 2.76 6.223.109.1.18.232.2.378l.583 3.996a.25.25 0 00.322.253l3.655-1.428a.56.56 0 01.373-.02c.365.103.743.176 1.127.2.062.003.125.006.188.006z" />
                                    </svg>
                                </button>
                                {(() => {
                                    const totalComments = (post.commentsCount || 0) + (post.repliesCommentsCount || 0);
                                    const displayCount = totalComments > 0 ? totalComments : (stats.comments || 0);
                                    if (displayCount <= 0) return null;
                                    return (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onCommentsClick?.();
                                            }}
                                            className="flex items-center text-white/60"
                                        >
                                            <span className="text-xs">{displayCount}</span>
                                        </button>
                                    );
                                })()}
                            </div>

                            {/* Attendance Menu (Events only) */}
                            {isEvent && (
                                <div className="relative">
                                    <div className={`flex h-7 items-center justify-center rounded-full hover:bg-white/[0.08] ${(() => {
                                        const count = status === "not_going" ? stats.notGoing : status === "maybe" ? stats.maybe : stats.going;
                                        return (count && count > 0) ? "gap-1 px-2" : "w-7";
                                    })()} ${status ? "text-white" : "text-white/70"}`}>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setAttendanceMenuOpen(!attendanceMenuOpen);
                                            }}
                                            className={`flex items-center justify-center ${!status ? "hover:text-white" : ""}`}
                                        >
                                            {status === "going" ? (
                                                <HandThumbUpIcon className="h-4 w-4 text-green-400" />
                                            ) : status === "maybe" ? (
                                                <QuestionMarkCircleIcon className="h-4 w-4 text-yellow-400" />
                                            ) : status === "not_going" ? (
                                                <HandThumbDownIcon className="h-4 w-4 text-red-400" />
                                            ) : (
                                                <CalendarIcon className="h-4 w-4" />
                                            )}
                                        </button>
                                        {(() => {
                                            const count = status === "not_going" ? stats.notGoing
                                                : status === "maybe" ? stats.maybe
                                                    : stats.going;
                                            if (!count || count <= 0) return null;
                                            return (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onAttendanceClick?.();
                                                    }}
                                                    className="flex items-center text-white/60"
                                                >
                                                    <span className="text-xs">{count}</span>
                                                </button>
                                            );
                                        })()}
                                    </div>

                                    {/* Attendance Dropdown Menu */}
                                    {attendanceMenuOpen && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setAttendanceMenuOpen(false); }} />
                                            <div className="absolute bottom-full left-0 z-50 mb-2 min-w-[160px] animate-in fade-in zoom-in-95 origin-bottom-left overflow-hidden rounded-xl border border-white/10 bg-[#1C1C1E]/90 shadow-xl backdrop-blur-xl duration-100">
                                                <div className="flex flex-col gap-0.5 p-1.5">
                                                    <button type="button" onClick={(e) => { e.stopPropagation(); handleStatusChange(status === "going" ? null : "going"); setAttendanceMenuOpen(false); }} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${status === "going" ? "bg-white/10 text-white" : "text-neutral-300 hover:bg-white/5 hover:text-white"}`}>
                                                        <span className="font-medium">Going</span>
                                                        <HandThumbUpIcon className={`h-4 w-4 ${status === "going" ? "opacity-100" : "opacity-0"}`} />
                                                    </button>
                                                    <button type="button" onClick={(e) => { e.stopPropagation(); handleStatusChange(status === "maybe" ? null : "maybe"); setAttendanceMenuOpen(false); }} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${status === "maybe" ? "bg-white/10 text-white" : "text-neutral-300 hover:bg-white/5 hover:text-white"}`}>
                                                        <span className="font-medium">Maybe</span>
                                                        <QuestionMarkCircleIcon className={`h-4 w-4 ${status === "maybe" ? "opacity-100" : "opacity-0"}`} />
                                                    </button>
                                                    <button type="button" onClick={(e) => { e.stopPropagation(); handleStatusChange(status === "not_going" ? null : "not_going"); setAttendanceMenuOpen(false); }} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${status === "not_going" ? "bg-white/10 text-white" : "text-neutral-300 hover:bg-white/5 hover:text-white"}`}>
                                                        <span className="font-medium">Not Going</span>
                                                        <HandThumbDownIcon className={`h-4 w-4 ${status === "not_going" ? "opacity-100" : "opacity-0"}`} />
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Share Button */}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleShare();
                                }}
                                className="flex h-7 w-7 items-center justify-center rounded-full text-white/70 hover:bg-white/[0.08] hover:text-white"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                                </svg>
                            </button>

                            {/* Options Menu */}
                            {!previewMode && (
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setOptionsMenuOpen(!optionsMenuOpen); }}
                                        className={`flex h-7 w-7 items-center justify-center rounded-full text-white/60 hover:bg-white/[0.08] hover:text-white ${optionsMenuOpen ? "bg-white/[0.08] text-white" : ""}`}
                                    >
                                        <EllipsisVerticalIcon className="h-4 w-4" />
                                    </button>
                                    {optionsMenuOpen && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOptionsMenuOpen(false); }} />
                                            <div className="absolute bottom-full right-0 z-50 mb-2 min-w-[160px] animate-in fade-in zoom-in-95 origin-bottom-right overflow-hidden rounded-xl border border-white/10 bg-[#1C1C1E]/90 shadow-xl backdrop-blur-xl duration-100">
                                                <div className="flex flex-col gap-0.5 p-1.5">
                                                    {isEventOwner && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onEditClick?.();
                                                                setOptionsMenuOpen(false);
                                                            }}
                                                            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-white transition-colors hover:bg-white/5"
                                                        >
                                                            <span className="font-medium">Edit</span>
                                                            <PencilIcon className="h-4 w-4" />
                                                        </button>
                                                    )}

                                                    {isEventOwner && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeletePost();
                                                            }}
                                                            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-red-400 transition-colors hover:bg-white/5 hover:text-red-300"
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
                                                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-neutral-400 transition-colors hover:bg-white/5 hover:text-white"
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
                    </div>
                </div>
            </div >
        );
    }

    return (
        <div
            className={containerClasses}
            onContextMenu={handleContextMenu}
            onTouchStart={handleLongPressStart}
            onTouchEnd={handleLongPressEnd}
            onTouchMove={handleLongPressEnd}
        >
            {/* Left Column: Avatar */}
            <div className="shrink-0">
                {isClubPost ? (
                    <Link href={`/clubs/${clubId}`} onClick={(e) => e.stopPropagation()}>
                        <div
                            className={`overflow-hidden rounded-full ring-2 ring-[#1C1C1E] transition-opacity hover:opacity-80 ${compact ? "h-9 w-9" : "h-10 w-10"} ${clubProfile?.avatarUrl?.toLowerCase().endsWith('.png') ? 'bg-transparent' : 'bg-neutral-700'}`}
                        >
                            {clubProfile?.avatarUrl ? (
                                <img src={clubProfile.avatarUrl} alt={clubProfile.name || "Club"} className="h-full w-full object-cover" />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white">
                                    {clubProfile?.name ? clubProfile.name.charAt(0).toUpperCase() : (clubId ? "C" : "?")}
                                </div>
                            )}
                        </div>
                    </Link>
                ) : (
                    <Link href={`/user/${authorId}`} onClick={(e) => e.stopPropagation()}>
                        <div
                            className={`overflow-hidden rounded-full ring-2 ring-[#1C1C1E] transition-opacity hover:opacity-80 ${compact ? "h-9 w-9" : "h-10 w-10"} ${displayedPhotoUrl?.toLowerCase().endsWith('.png') ? 'bg-transparent' : 'bg-neutral-700'}`}
                        >
                            {displayedPhotoUrl ? (
                                <img src={displayedPhotoUrl} alt={displayedName} className="h-full w-full object-cover" />
                            ) : (
                                !hideMediaPlaceholder && (
                                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-bold text-white">
                                        {displayedName ? displayedName.charAt(0).toUpperCase() : "U"}
                                    </div>
                                )
                            )}
                        </div>
                    </Link>
                )}
            </div>

            {/* Right Column: Content */}
            <div className="flex min-w-0 flex-1 flex-col gap-0">
                {/* Header: Name | Time | Menu */}
                <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col leading-tight">
                        <div className="flex items-center gap-2">
                            {isClubPost ? (
                                <>
                                    <Link href={`/clubs/${clubId}`} onClick={(e) => e.stopPropagation()} className="truncate text-sm font-bold text-white hover:underline flex items-center gap-1">
                                        {clubProfile?.name || "Club"}
                                        {clubProfile?.isVerified && (
                                            <CheckBadgeIcon className="h-4 w-4 text-blue-500 shrink-0" />
                                        )}
                                    </Link>
                                    {clubProfile?.handle && (
                                        <span className="text-xs text-neutral-500 truncate">@{clubProfile.handle}</span>
                                    )}
                                </>
                            ) : (
                                <Link href={`/user/${authorId}`} onClick={(e) => e.stopPropagation()} className="truncate text-sm font-bold text-white hover:underline">
                                    <span className={currentUsername ? "hidden sm:inline" : ""}>{displayedName}</span>
                                    {currentUsername && <span className="sm:hidden">@{currentUsername}</span>}
                                </Link>
                            )}
                            <span className="text-neutral-500 text-xs">•</span>
                            <div className="text-xs text-neutral-500">
                                {eventTimeLabel || timeLabel || (date ? date : "now")}
                            </div>
                            {post.visibility === "under_review" && (
                                <>
                                    <span className="text-neutral-500 text-xs">•</span>
                                    <span className="px-2 py-0.5 rounded-md bg-yellow-500/20 text-yellow-400 text-xs font-medium">
                                        Under Review
                                    </span>
                                </>
                            )}
                        </div>
                        {isClubPost && (
                            <Link
                                href={`/user/${authorId}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-[11px] text-neutral-500 hover:text-neutral-400 mt-0.5"
                            >
                                by @{currentUsername || displayedName.toLowerCase().replace(/\s+/g, '')}
                            </Link>
                        )}
                    </div>

                    {/* Context Menu Trigger */}
                    {!previewMode && (
                        <button
                            type="button"
                            onClick={handleContextMenu}
                            className="-mt-1 text-neutral-500 hover:text-white"
                        >
                            <EllipsisVerticalIcon className="h-5 w-5" />
                        </button>
                    )}
                </div>

                {/* Description */}
                {description && (
                    <div className="relative">
                        <div
                            ref={descriptionRef}
                            onClick={onDetailsClick}
                            className={`mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-100 ${onDetailsClick ? "cursor-pointer" : ""}`}
                        >
                            {isTruncated ? (
                                <div className="inline">
                                    <span>{displayText}... </span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDetailsClick?.();
                                        }}
                                        className="inline font-medium text-white/40 hover:text-white/60"
                                    >
                                        show more
                                    </button>
                                </div>
                            ) : (
                                description
                            )}
                        </div>
                    </div>
                )}

                {/* Media Grid */}
                {!hideMediaGrid && (
                    <div className={description ? "mt-1 mb-2" : "mt-2.5 mb-2"}>
                        {renderImages()}
                    </div>
                )}

                {/* Actions Footer */}
                <div className="flex items-center justify-between mt-[-4px] max-w-[400px]">
                    {/* Comments */}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onCommentsClick?.();
                        }}
                        className="flex items-center gap-1.5 text-neutral-500 hover:text-blue-400 group transition-colors"
                    >
                        <div className="p-1.5 rounded-full group-hover:bg-blue-500/10 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                            </svg>
                        </div>
                        <span className="text-sm">{stats.comments > 0 ? stats.comments : ""}</span>
                    </button>

                    {/* Attendees (Events only) - Using Arrows for cycle */}
                    {isEvent && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onAttendanceClick?.();
                            }}
                            className="flex items-center gap-1.5 text-neutral-500 hover:text-green-400 group transition-colors"
                        >
                            <div className="p-1.5 rounded-full group-hover:bg-green-500/10 transition-colors">
                                <UserGroupIcon className="h-[18px] w-[18px]" />
                            </div>
                            <span className="text-sm">{stats.going + stats.maybe > 0 ? stats.going + stats.maybe : ""}</span>
                        </button>
                    )}

                    {/* Likes */}
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleToggleLike();
                            }}
                            className={`p-1.5 rounded-full transition-colors active:scale-90 ${isLiked ? 'text-[#ffb200] hover:bg-[#ffb200]/10' : 'text-neutral-500 hover:text-[#ffb200] hover:bg-[#ffb200]/10'}`}
                        >
                            {isLiked ? (
                                <HeartIcon className={`h-[18px] w-[18px] ${likeAnimating ? "animate-like-pop" : ""}`} />
                            ) : (
                                <HeartIconOutline className={`h-[18px] w-[18px] ${likeAnimating ? "animate-like-pop" : ""}`} />
                            )}
                        </button>
                        {likesCount > 0 && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onLikesClick?.();
                                }}
                                className={`text-sm font-medium hover:underline ${isLiked ? 'text-[#ffb200]' : 'text-neutral-500 hover:text-white'}`}
                            >
                                {likesCount}
                            </button>
                        )}
                    </div>

                    {/* Share */}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleShare();
                        }}
                        className="flex items-center gap-1.5 text-neutral-500 hover:text-white group transition-colors"
                    >
                        <div className="p-1.5 rounded-full group-hover:bg-white/10 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
                                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                                <polyline points="16 6 12 2 8 6" />
                                <line x1="12" y1="2" x2="12" y2="15" />
                            </svg>
                        </div>
                    </button>

                    {/* Attendance Status (Current User) */}
                    {isEvent && (
                        <div className="relative">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setAttendanceMenuOpen(!attendanceMenuOpen);
                                }}
                                className={`flex items-center justify-center rounded-full p-1.5 transition-colors hover:bg-white/10 ${attendanceStatus.color}`}
                            >
                                {attendanceStatus.icon}
                            </button>
                            {/* Dropdown Menu */}
                            {attendanceMenuOpen && (
                                <>
                                    <div
                                        className="fixed inset-0 z-30"
                                        onClick={() => setAttendanceMenuOpen(false)}
                                    />
                                    <div className="absolute right-0 bottom-full mb-2 z-40 w-36 rounded-xl border border-white/10 bg-[#1C1C1E] shadow-[0_10px_30px_rgba(0,0,0,0.6)] backdrop-blur-xl">
                                        <div className="py-1">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleStatusChange("going");
                                                    setAttendanceMenuOpen(false);
                                                }}
                                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white/5 transition-colors"
                                            >
                                                <HandThumbUpIcon className="h-4 w-4 text-green-400" />
                                                <span>Going</span>
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleStatusChange("maybe");
                                                    setAttendanceMenuOpen(false);
                                                }}
                                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white/5 transition-colors"
                                            >
                                                <QuestionMarkCircleIcon className="h-4 w-4 text-yellow-400" />
                                                <span>Maybe</span>
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleStatusChange("not_going");
                                                    setAttendanceMenuOpen(false);
                                                }}
                                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white/5 transition-colors"
                                            >
                                                <HandThumbDownIcon className="h-4 w-4 text-red-400" />
                                                <span>Not Going</span>
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Comment Preview */}
                {!hideCommentPreview && previewComment && (
                    <div className="mt-2 pt-2 border-t border-white/5">
                        <CommentMessage
                            comment={previewComment}
                            currentUserId={currentUser?.uid}
                            liked={!!currentUser && (previewComment.likes || []).includes(currentUser.uid)}
                            likeCount={previewComment.likes?.length ?? 0}
                            canEdit={previewComment.authorUid === currentUser?.uid}
                            canDelete={canDeleteComments}
                            onReply={handleCommentReply}
                            onLike={handleCommentLike}
                            onReport={handleCommentReport}
                            onDelete={handleCommentDelete}
                            onEdit={handleCommentEdit}
                            depth={0}
                        />

                        {hasMoreComments && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCommentsClick?.();
                                }}
                                className="mt-2 flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                Show more comments
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Context Menu */}
            {contextMenuOpen && (
                <div
                    className="fixed z-50 w-56 rounded-2xl border border-white/10 bg-[#1C1C1E] shadow-[0_20px_60px_rgba(0,0,0,0.8)] backdrop-blur-xl"
                    style={{
                        top: contextMenuPosition.y,
                        left: contextMenuPosition.x,
                        transform: 'translate(-50%, -8px)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="py-2">
                        {/* Like */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleToggleLike();
                                closeContextMenu();
                            }}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/5 transition-colors"
                        >
                            {isLiked ? (
                                <HeartIcon className="h-5 w-5 text-[#ffb200]" />
                            ) : (
                                <HeartIconOutline className="h-5 w-5" />
                            )}
                            <span>{isLiked ? 'Unlike' : 'Like'}</span>
                        </button>

                        {/* Share */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleShare();
                            }}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/5 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                            </svg>
                            <span>Share</span>
                        </button>

                        {/* Edit (only if owner) */}
                        {isEventOwner && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    closeContextMenu();
                                    // Navigate to edit page
                                    window.location.href = isEvent ? `/posts/${id}/edit` : `/posts/${id}/edit`; // Unified to /posts for editing
                                }}
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/5 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                </svg>
                                <span>{isEvent ? 'Edit Event' : 'Edit Post'}</span>
                            </button>
                        )}

                        {/* Report */}
                        {!previewMode && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    closeContextMenu();
                                    // Open report modal or navigate to report page
                                    alert('Report functionality coming soon');
                                }}
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/5 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
                                </svg>
                                <span>Report</span>
                            </button>
                        )}

                        {/* Delete (only if owner) */}
                        {isEventOwner && (
                            <>
                                <div className="my-1 border-t border-white/5" />
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeletePost();
                                    }}
                                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                                >
                                    <TrashIcon className="h-5 w-5" />
                                    <span>{isEvent ? 'Delete Event' : 'Delete Post'}</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
