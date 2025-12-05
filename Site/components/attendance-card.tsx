import { useState, useEffect } from "react";
import { HandThumbUpIcon, HandThumbDownIcon, QuestionMarkCircleIcon, HeartIcon } from "@heroicons/react/24/solid";
import { HeartIcon as HeartIconOutline } from "@heroicons/react/24/outline";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, updateDoc, arrayUnion, arrayRemove, getFirestore, onSnapshot, collection, query, getDocs, orderBy, limit, getDoc } from "firebase/firestore";
import Link from "next/link";
import { CommentMessage } from "./comment-message";
import { fetchGlobalAdminEmails, isGlobalAdmin } from "../lib/admin-utils";

// Using full firestore SDK for real-time listeners as established in RightSidebar
// If this causes issues with "lite" usage elsewhere, we might need to consolidate.
// But usually importing "firebase/firestore" works alongside "lite" if the app is initialized correctly.
// Ideally we should use one SDK, but for this feature set (real-time), full SDK is better.

type AttendanceStatus = "going" | "maybe" | "not_going" | null;

interface AttendanceCardProps {
    id?: string;
    title: string;
    description: string;
    images?: string[];
    date: string;
    time: string;
    location: string;
    hostName?: string;
    hostUsername?: string;
    hostAvatarUrl?: string | null;
    coordinates?: { lat: number; lng: number } | null;
    compact?: boolean;
    onCommentsClick?: () => void;
    onAttendanceClick?: () => void;
    onDetailsClick?: () => void;
}

import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";

const mapContainerStyle = {
    width: "100%",
    height: "100%",
};

const libraries: ("places" | "geometry" | "drawing" | "visualization")[] = ["places"];

export function AttendanceCard({
    id,
    title,
    description,
    images = [],
    date,
    time,
    location,
    hostName = "You",
    hostUsername,
    hostAvatarUrl,
    coordinates,
    compact = false,
    onCommentsClick,
    onAttendanceClick,
    onDetailsClick,
}: AttendanceCardProps) {
    const [status, setStatus] = useState<AttendanceStatus>(null);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [stats, setStats] = useState({ going: 0, maybe: 0, notGoing: 0, comments: 0 });
    const [previewComment, setPreviewComment] = useState<any>(null);
    const [hasMoreComments, setHasMoreComments] = useState(false);
    const [isLiked, setIsLiked] = useState(false);
    const [likesCount, setLikesCount] = useState(0);
    const [hostPhotoUrl, setHostPhotoUrl] = useState<string | null>(hostAvatarUrl || null);
    const [canDeleteComments, setCanDeleteComments] = useState(false);
    const [contextMenuOpen, setContextMenuOpen] = useState(false);
    const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
    const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
    const [attendanceMenuOpen, setAttendanceMenuOpen] = useState(false);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setCurrentUser(u));
        return () => unsub();
    }, []);

    // Helper to reload preview comment
    const loadPreviewComment = async () => {
        if (!id) return;

        try {
            const dbFull = getFirestore();
            const commentsRef = collection(dbFull, "events", id, "comments");
            const q = query(commentsRef, orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);

            if (snapshot.size > 0) {
                // Find comment with most replies or likes
                let bestComment: any = null;
                let bestScore = -1;

                for (const docSnap of snapshot.docs) {
                    const data = docSnap.data();

                    // Always fetch author data from users collection for most accurate info
                    let authorName = data.authorName ?? "Someone";
                    let authorPhotoURL = data.authorPhotoURL ?? null;
                    let authorUsername = data.authorUsername ?? null;

                    const targetUid = data.authorUid || data.uid;

                    if (targetUid) {
                        try {
                            const userDoc = await getDoc(doc(dbFull, "users", targetUid));
                            if (userDoc.exists()) {
                                const userData = userDoc.data();
                                authorName = userData.displayName || userData.username || "Someone";
                                authorPhotoURL = userData.photoURL || null;
                                authorUsername = userData.username || null;
                            }
                        } catch (err) {
                            console.error("Error fetching author data:", err);
                        }
                    }

                    const repliesRef = collection(dbFull, "events", id, "comments", docSnap.id, "replies");
                    const repliesSnapshot = await getDocs(repliesRef);

                    // Load replies recursively
                    const replies = [];
                    for (const replyDoc of repliesSnapshot.docs) {
                        const replyData = replyDoc.data();

                        // Always fetch reply author data from users collection
                        let replyAuthorName = replyData.authorName ?? "Someone";
                        let replyAuthorPhoto = replyData.authorPhotoURL ?? null;
                        let replyAuthorUsername = replyData.authorUsername ?? null;

                        if (replyData.authorUid) {
                            try {
                                const userDoc = await getDoc(doc(dbFull, "users", replyData.authorUid));
                                if (userDoc.exists()) {
                                    const userData = userDoc.data();
                                    replyAuthorName = userData.displayName || userData.username || "Someone";
                                    replyAuthorPhoto = userData.photoURL || null;
                                    replyAuthorUsername = userData.username || null;
                                }
                            } catch (err) {
                                console.error("Error fetching reply author data:", err);
                            }
                        }

                        replies.push({
                            id: replyDoc.id,
                            text: replyData.text ?? "",
                            authorName: replyAuthorName,
                            authorUid: replyData.authorUid ?? null,
                            authorPhotoURL: replyAuthorPhoto,
                            authorUsername: replyAuthorUsername,
                            createdAt: replyData.createdAt?.toDate ? replyData.createdAt.toDate() : null,
                            updatedAt: replyData.updatedAt?.toDate ? replyData.updatedAt.toDate() : null,
                            likes: replyData.likes ?? [],
                            parentPath: [docSnap.id],
                            replies: [], // Can load nested if needed
                        });
                    }

                    // Sort replies by likes (descending) and take only the top 1
                    replies.sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));
                    const topReply = replies.slice(0, 1);

                    const score = (data.likes?.length || 0) + (repliesSnapshot.size * 2);

                    if (score > bestScore) {
                        bestScore = score;
                        bestComment = {
                            id: docSnap.id,
                            text: data.text ?? "",
                            authorName,
                            authorUid: data.authorUid ?? null,
                            authorPhotoURL,
                            authorUsername,
                            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
                            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : null,
                            likes: data.likes ?? [],
                            replies: topReply,
                            replyCount: repliesSnapshot.size,
                        };
                    }
                }

                if (!bestComment && snapshot.docs.length > 0) {
                    const fallbackData = snapshot.docs[0].data();

                    // Always fetch author data for fallback comment
                    let fallbackAuthorName = fallbackData.authorName ?? "Someone";
                    let fallbackAuthorPhoto = fallbackData.authorPhotoURL ?? null;
                    let fallbackAuthorUsername = fallbackData.authorUsername ?? null;

                    if (fallbackData.authorUid) {
                        try {
                            const userDoc = await getDoc(doc(dbFull, "users", fallbackData.authorUid));
                            if (userDoc.exists()) {
                                const userData = userDoc.data();
                                fallbackAuthorName = userData.displayName || userData.username || "Someone";
                                fallbackAuthorPhoto = userData.photoURL || null;
                                fallbackAuthorUsername = userData.username || null;
                            }
                        } catch (err) {
                            console.error("Error fetching fallback author data:", err);
                        }
                    }

                    bestComment = {
                        id: snapshot.docs[0].id,
                        text: fallbackData.text ?? "",
                        authorName: fallbackAuthorName,
                        authorUid: fallbackData.authorUid ?? null,
                        authorPhotoURL: fallbackAuthorPhoto,
                        authorUsername: fallbackAuthorUsername,
                        createdAt: fallbackData.createdAt?.toDate ? fallbackData.createdAt.toDate() : null,
                        updatedAt: fallbackData.updatedAt?.toDate ? fallbackData.updatedAt.toDate() : null,
                        likes: fallbackData.likes ?? [],
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

    // Load host photo from Firestore if not provided
    useEffect(() => {
        if (!id || hostAvatarUrl) return;

        const loadHostPhoto = async () => {
            try {
                const dbFull = getFirestore();
                const eventRef = doc(dbFull, "events", id);
                const eventSnap = await getDoc(eventRef);

                if (eventSnap.exists()) {
                    const eventData = eventSnap.data();
                    const hostId = eventData.hostUserId;

                    if (hostId) {
                        const userRef = doc(dbFull, "users", hostId);
                        const userSnap = await getDoc(userRef);

                        if (userSnap.exists()) {
                            const userData = userSnap.data();
                            setHostPhotoUrl(userData.photoURL || null);
                        }
                    }
                }
            } catch (error) {
                console.error("Error loading host photo:", error);
            }
        };

        loadHostPhoto();
    }, [id, hostAvatarUrl]);

    // Load preview comment (one with most replies or likes)
    useEffect(() => {
        if (!id) return;
        loadPreviewComment();
    }, [id]);

    // Load and track likes for the event
    useEffect(() => {
        if (!id) return;

        const dbFull = getFirestore();
        const eventRef = doc(dbFull, "events", id);

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

    const handleStatusChange = async (newStatus: AttendanceStatus) => {
        if (!id || !currentUser) return;
        if (status === newStatus) return; // No change

        // Optimistic update
        const oldStatus = status;
        setStatus(newStatus);

        try {
            const dbFull = getFirestore();
            const docRef = doc(dbFull, "events", id);

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
        }
    };

    const [likeAnimating, setLikeAnimating] = useState(false);

    const handleToggleLike = async () => {
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
            const dbFull = getFirestore();
            const eventRef = doc(dbFull, "events", id);

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
            const isEventOwner = currentUser.uid === hostUsername; // Adjust as needed

            // Or if they're a global admin
            const globalAdmins = await fetchGlobalAdminEmails();
            const isAdmin = isGlobalAdmin(currentUser.email || "", globalAdmins);

            setCanDeleteComments(isEventOwner || isAdmin);
        };

        checkPermissions();
    }, [currentUser, hostUsername]);

    // Comment action handlers
    const handleCommentReply = (comment: any) => {
        // Open comments sheet with reply context
        onCommentsClick?.();
    };

    const handleCommentLike = async (comment: any) => {
        if (!id || !currentUser) return;
        try {
            const dbFull = getFirestore();

            // Build path correctly for nested replies
            let commentPath: string;
            const parentPath = comment.parentPath || [];

            if (parentPath.length === 0) {
                // Top-level comment
                commentPath = `events/${id}/comments/${comment.id}`;
            } else {
                // Nested reply - build path incrementally
                commentPath = `events/${id}/comments/${parentPath[0]}`;
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
            const commentRef = doc(dbFull, pathSegments[0], pathSegments[1], ...pathSegments.slice(2));
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
            return <img key={`img-${index}`} src={item} alt="" className={className} />;
        } else {
            // Map Item
            if (!isLoaded) return <div key="map-loading" className={`${className} bg-neutral-800 animate-pulse`} />;
            return (
                <div key="map-view" className={`${className} relative overflow-hidden`}>
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
        if (!date || !time) return "--";

        // Expecting date as yyyy-mm-dd and time as hh:mm (24h)
        // Handle time ranges like "20:59 - 21:59" by extracting the start time
        const startTime = time.split('-')[0].trim();
        const target = new Date(`${date}T${startTime}:00`);
        const now = new Date();
        const diffMs = target.getTime() - now.getTime();

        if (!Number.isFinite(diffMs)) return "--";

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

    const timeUntilLabel = getTimeUntilLabel();

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
            return (
                <div className="flex aspect-[4/3] w-full items-center justify-center rounded-[22px] border border-white/[0.06] bg-[#0D0D0D] shadow-[0_6px_20px_rgba(0,0,0,0.35)] text-neutral-600 transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.04]">
                    <span className="text-sm">No Image or Location</span>
                </div>
            );
        }

        if (mediaItems.length === 1) {
            return (
                <div className="w-full overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#0D0D0D] shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.04]">
                    {typeof mediaItems[0] === 'string' ? (
                        <img
                            src={mediaItems[0]}
                            alt={title}
                            className="h-auto w-full object-cover"
                        />
                    ) : (
                        <div className="aspect-[4/3] w-full">
                            {renderMediaItem(mediaItems[0], 0, "h-full w-full object-cover")}
                        </div>
                    )}
                </div>
            );
        }

        if (mediaItems.length === 2) {
            return (
                <div className="grid aspect-[4/3] w-full grid-cols-2 gap-3">
                    <div className="h-full w-full overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#0D0D0D] shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.04]">
                        {renderMediaItem(mediaItems[0], 0, "h-full w-full object-cover")}
                    </div>
                    <div className="h-full w-full overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#0D0D0D] shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.04]">
                        {renderMediaItem(mediaItems[1], 1, "h-full w-full object-cover")}
                    </div>
                </div>
            );
        }

        if (mediaItems.length === 3) {
            return (
                <div className="grid w-full grid-cols-2 gap-3">
                    <div className="flex flex-col gap-3">
                        <div className="relative aspect-square w-full overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#0D0D0D] shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.04]">
                            {renderMediaItem(mediaItems[0], 0, "absolute inset-0 h-full w-full object-cover")}
                        </div>
                        <div className="relative aspect-square w-full overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#0D0D0D] shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.04]">
                            {renderMediaItem(mediaItems[1], 1, "absolute inset-0 h-full w-full object-cover")}
                        </div>
                    </div>
                    <div className="relative h-full w-full overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#0D0D0D] shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.04]">
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
                        <div className="relative aspect-square w-full overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#0D0D0D] shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.04]">
                            {renderMediaItem(mediaItems[0], 0, "absolute inset-0 h-full w-full object-cover")}
                        </div>
                        <div className="relative aspect-square w-full overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#0D0D0D] shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.04]">
                            {renderMediaItem(mediaItems[2], 2, "absolute inset-0 h-full w-full object-cover")}
                        </div>
                    </div>
                    <div className="flex flex-col gap-3">
                        <div className="relative aspect-square w-full overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#0D0D0D] shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.04]">
                            {renderMediaItem(mediaItems[1], 1, "absolute inset-0 h-full w-full object-cover")}
                        </div>
                        <div className="relative aspect-square w-full overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#0D0D0D] shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.04]">
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
                        <div className="relative aspect-square w-full overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#0D0D0D] shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.04]">
                            {primaryNonMap[0] &&
                                renderMediaItem(primaryNonMap[0], 0, "absolute inset-0 h-full w-full object-cover")}
                        </div>
                        <div className="relative aspect-square w-full overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#0D0D0D] shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.04]">
                            {primaryNonMap[1] &&
                                renderMediaItem(primaryNonMap[1], 1, "absolute inset-0 h-full w-full object-cover")}
                        </div>
                    </div>
                    <div className="flex flex-col gap-3">
                        {/* Map pinned to top-right */}
                        <div className="relative aspect-square w-full overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#0D0D0D] shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.04]">
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
                    <div className="relative aspect-square w-full overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#0D0D0D] shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.04]">
                        {renderMediaItem(mediaItems[0], 0, "absolute inset-0 h-full w-full object-cover")}
                    </div>
                    <div className="relative aspect-square w-full overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#0D0D0D] shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.04]">
                        {renderMediaItem(mediaItems[2], 2, "absolute inset-0 h-full w-full object-cover")}
                    </div>
                </div>
                <div className="flex flex-col gap-3">
                    <div className="relative aspect-square w-full overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#0D0D0D] shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-all duration-300 hover:scale-[1.01] hover:brightness-[1.04]">
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
        : "flex w-full min-w-[350px] max-w-[450px] flex-col gap-4 font-sans";

    // Context menu handlers
    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
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

    const isEventOwner = currentUser?.uid === hostUsername; // Adjust if needed

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

    return (
        <div
            className={containerClasses}
            onContextMenu={handleContextMenu}
            onTouchStart={handleLongPressStart}
            onTouchEnd={handleLongPressEnd}
            onTouchMove={handleLongPressEnd}
        >
            {/* Media Grid - No Background */}
            <div>
                {renderImages()}
            </div>

            {/* Info Box */}
            <div
                className={`bg-[#1C1C1E] ring-1 ring-white/5 ${compact ? "rounded-[28px] p-4" : "rounded-[32px] p-5"
                    }`}
            >
                {/* Title and Date/Time */}
                <div className={`flex items-start justify-between gap-4 ${compact ? "mb-1.5" : "mb-2"}`}>
                    <h3
                        onClick={onDetailsClick}
                        className={`font-bold leading-tight text-white ${compact ? "text-[20px]" : "text-[22px]"
                            } ${onDetailsClick ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
                    >
                        {title || "Event Title"}
                    </h3>
                    <span className="text-xs font-medium text-neutral-400">
                        {date && time ? `${date} • ${time}` : (date || time || "Date & Time")}
                    </span>
                </div>

                {/* Description */}
                {description && (
                    <p
                        onClick={onDetailsClick}
                        className={`mb-2 text-sm text-neutral-300 line-clamp-2 ${onDetailsClick ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
                    >
                        {description}
                    </p>
                )}

                {/* User Info and Stats with Attendance Picker */}
                <div className="flex items-center gap-3">
                    {/* User Avatar */}
                    <div
                        className={`shrink-0 overflow-hidden rounded-full bg-neutral-700 ring-2 ring-[#1C1C1E] ${compact ? "h-9 w-9" : "h-10 w-10"
                            }`}
                    >
                        {hostPhotoUrl ? (
                            <img src={hostPhotoUrl} alt={hostName} className="h-full w-full object-cover" />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-bold text-white">
                                {hostName ? hostName.charAt(0).toUpperCase() : "U"}
                            </div>
                        )}
                    </div>

                    {/* VStack: Name and Stats */}
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                        {/* Name */}
                        <span className="truncate text-sm font-semibold text-white">
                            <span className={hostUsername ? "hidden sm:inline" : ""}>{hostName}</span>
                            {hostUsername && <span className="sm:hidden">@{hostUsername}</span>}
                        </span>

                        {/* HStack: Stats */}
                        <div className="flex items-center justify-start gap-3 text-xs leading-tight text-neutral-400">
                            {/* Comments */}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCommentsClick?.();
                                }}
                                className="flex items-center gap-1 text-neutral-400 hover:text-neutral-100"
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
                                className="flex items-center gap-1 text-neutral-400 hover:text-neutral-100"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                    <path d="M1 8.25a1.25 1.25 0 112.5 0v7.5a1.25 1.25 0 11-2.5 0v-7.5zM11 3V1.7c0-.268.14-.526.395-.607A2 2 0 0114 3c0 .995-.182 1.948-.514 2.826-.204.54.166 1.174.744 1.174h2.52c1.243 0 2.261 1.01 2.146 2.247a23.864 23.864 0 01-1.341 5.974C17.153 16.323 16.072 17 14.9 17h-3.192a3 3 0 01-1.341-.317l-2.734-1.366A3 3 0 006.292 15H5V8h.963c.685 0 1.258-.483 1.612-1.068a4.011 4.011 0 012.166-1.73c.432-.143.853-.386 1.011-.814.16-.432.248-.9.248-1.388z" />
                                </svg>
                                <span>{stats.going + stats.maybe}</span>
                            </button>

                            {/* Likes */}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleLike();
                                }}
                                className={`flex items-center gap-1 transition-colors ${isLiked ? 'text-amber-400' : 'text-neutral-400 hover:text-amber-400'
                                    }`}
                            >
                                {isLiked ? (
                                    <HeartIcon className={`h-4 w-4 ${likeAnimating ? "animate-like-pop" : ""}`} />
                                ) : (
                                    <HeartIconOutline className={`h-4 w-4 ${likeAnimating ? "animate-like-pop" : ""}`} />
                                )}
                                <span>{likesCount}</span>
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

                    {/* Attendance Picker */}
                    {/* Small screens: Menu button */}
                    <div className="sm:hidden relative">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setAttendanceMenuOpen(!attendanceMenuOpen);
                            }}
                            className={`flex items-center justify-center rounded-full bg-[#2C2C2E] p-2 transition-colors ${attendanceStatus.color}`}
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
                                <div className="absolute right-0 top-full mt-2 z-40 w-36 rounded-xl border border-white/10 bg-[#1C1C1E] shadow-[0_10px_30px_rgba(0,0,0,0.6)] backdrop-blur-xl">
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
                                            {status === "going" && (
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 ml-auto text-amber-400">
                                                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                                </svg>
                                            )}
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
                                            {status === "maybe" && (
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 ml-auto text-amber-400">
                                                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                                </svg>
                                            )}
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
                                            {status === "not_going" && (
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 ml-auto text-amber-400">
                                                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Large screens: Full picker */}
                    <div className="hidden sm:flex shrink-0 rounded-full bg-[#2C2C2E] p-1">
                        <button
                            onClick={() => handleStatusChange("going")}
                            className={`flex flex-1 items-center justify-center rounded-full px-3 py-2 transition-all ${status === "going"
                                ? "bg-[#3A3A3C] text-white shadow-sm"
                                : "text-neutral-400 hover:text-white"
                                }`}
                            title="Going"
                        >
                            <HandThumbUpIcon className="h-4 w-4" />
                        </button>
                        <div className="w-[1px] bg-white/5 my-2" />
                        <button
                            onClick={() => handleStatusChange("maybe")}
                            className={`flex flex-1 items-center justify-center rounded-full px-3 py-2 transition-all ${status === "maybe"
                                ? "bg-[#3A3A3C] text-white shadow-sm"
                                : "text-neutral-400 hover:text-white"
                                }`}
                            title="Maybe"
                        >
                            <QuestionMarkCircleIcon className="h-4 w-4" />
                        </button>
                        <div className="w-[1px] bg-white/5 my-2" />
                        <button
                            onClick={() => handleStatusChange("not_going")}
                            className={`flex flex-1 items-center justify-center rounded-full px-3 py-2 transition-all ${status === "not_going"
                                ? "bg-[#3A3A3C] text-white shadow-sm"
                                : "text-neutral-400 hover:text-white"
                                }`}
                            title="No"
                        >
                            <HandThumbDownIcon className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Comment Preview */}
                {previewComment && (
                    <div className="mt-3 pt-3 border-t border-white/5">
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
                                className="mt-3 flex items-center gap-1 text-xs font-medium text-neutral-400/60 hover:text-neutral-400 active:text-neutral-300 transition-colors duration-150"
                            >
                                View all comments
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                                    <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                                </svg>
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
                                <HeartIcon className="h-5 w-5 text-amber-400" />
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
                                    window.location.href = `/events/${id}/edit`;
                                }}
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-white/5 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                </svg>
                                <span>Edit Event</span>
                            </button>
                        )}

                        {/* Report */}
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

                        {/* Delete (only if owner) */}
                        {isEventOwner && (
                            <>
                                <div className="my-1 border-t border-white/5" />
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm('Are you sure you want to delete this event?')) {
                                            // Delete event logic
                                            closeContextMenu();
                                        }
                                    }}
                                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                    </svg>
                                    <span>Delete Event</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
