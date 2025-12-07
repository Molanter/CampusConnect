"use client";

import { BellIcon, XMarkIcon, ChevronLeftIcon, PaperAirplaneIcon } from "@heroicons/react/24/outline";
import { useRightSidebar } from "./right-sidebar-context";
import { useEffect, useState, useRef, useMemo } from "react";
import { UserRow } from "./user-row";
import { auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

// Note: Using firestore/lite for some things but we need real-time listeners which lite doesn't support well for onSnapshot?
// Actually, standard firebase/firestore is needed for onSnapshot. 
// If the project uses firestore/lite globally, we might need to switch or import from "firebase/firestore" if available.
// Let's check if "firebase/firestore" is available or if we should stick to fetching.
// User request implies "fetch" but "real-time" is better for chat. 
// Given the imports in app/page.tsx use "firebase/firestore/lite", I will stick to "lite" and manual refresh or polling if needed, 
// OR I will try to use the full SDK if I can. 
// Wait, standard "firebase/firestore" is usually what's needed for onSnapshot.
// Let's assume we can use "firebase/firestore" for real-time features if the package is installed.
// If not, I'll implement with "lite" and manual fetch for now, but "onSnapshot" is not in "lite".
// I will try to import from "firebase/firestore" for the real-time parts. 
// If that fails, I'll fallback. But usually both are available.

import {
    getFirestore,
    collection as collectionFull,
    query as queryFull,
    orderBy as orderByFull,
    onSnapshot as onSnapshotFull,
    addDoc as addDocFull,
    doc as docFull,
    getDoc as getDocFull,
    updateDoc as updateDocFull,
    arrayUnion as arrayUnionFull,
    arrayRemove as arrayRemoveFull,
    serverTimestamp as serverTimestampFull,
    increment as incrementFull,
    where as whereFull,
    getDocs as getDocsFull,
    deleteDoc as deleteDocFull,
} from "firebase/firestore";
import { CommentMessage, type CommentRecord } from "./comment-message";
import { fetchGlobalAdminEmails, isGlobalAdmin } from "@/lib/admin-utils";
import { ReportSheet } from "./report-sheet";

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
                <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col bg-[#121212] rounded-t-[2rem] border-t border-white/10 shadow-[0_-20px_60px_rgba(0,0,0,0.9)] max-h-[85vh] animate-slide-up pb-20">
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
                            </h2>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto px-5 py-4">
                        {view === "notifications" && <NotificationsView />}
                        {view === "comments" && <CommentsView data={data} />}
                        {view === "details" && <EventDetailsView data={data} />}
                        {view === "attendance" && <AttendanceView data={data} />}
                    </div>
                </div>
            </>
        );
    }

    // Desktop/Tablet: Bell button in top-right when sidebar is closed
    if (!isVisible) {
        return (
            <button
                onClick={toggle}
                className="fixed right-6 top-6 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[#1C1C1E] text-white shadow-lg backdrop-blur-xl transition-transform hover:scale-105 active:scale-95"
            >
                <BellIcon className="h-6 w-6" />
            </button>
        );
    }

    // Desktop/Tablet sidebar
    return (
        <>
            {isResizing && (
                <div className="fixed inset-0 z-50 cursor-ew-resize" />
            )}
            <aside
                className={`fixed bottom-3 right-3 z-40 flex flex-col rounded-[1.8rem] border border-white/10 bg-[#121212] shadow-[0_30px_80px_rgba(0,0,0,0.9)] backdrop-blur-2xl ${headerVisible ? 'top-[80px]' : 'top-3'}`}
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
                <div className="flex-1 overflow-y-auto p-5">
                    {view === "notifications" && <NotificationsView />}
                    {view === "comments" && <CommentsView data={data} />}
                    {view === "details" && <EventDetailsView data={data} />}
                    {view === "attendance" && <AttendanceView data={data} />}
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

        const dbFull = getFirestore();
        const q = queryFull(
            collectionFull(dbFull, "users", currentUser.uid, "notifications"),
            orderByFull("createdAt", "desc")
        );

        const unsubscribe = onSnapshotFull(q, (snapshot) => {
            const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setNotifications(notifs);
            setLoading(false);
        }, (error) => {
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

function CommentsView({ data }: { data: any }) {
    const [comments, setComments] = useState<CommentRecord[]>([]);
    const [commentsLoading, setCommentsLoading] = useState(true);
    const [newComment, setNewComment] = useState("");
    const [sending, setSending] = useState(false);
    const [replyTarget, setReplyTarget] = useState<CommentRecord | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [globalAdmins, setGlobalAdmins] = useState<string[]>([]);
    const [eventOwnerUid, setEventOwnerUid] = useState<string | null>(null);
    const [reportTarget, setReportTarget] = useState<CommentRecord | null>(null);
    const [showHidden, setShowHidden] = useState(false);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setCurrentUser(u));
        return () => unsub();
    }, []);

    useEffect(() => {
        fetchGlobalAdminEmails().then(setGlobalAdmins).catch(() => setGlobalAdmins([]));
    }, []);

    // Helper to check if a comment should be hidden due to reports
    const checkReportCount = async (dbFull: any, commentPath: string): Promise<number> => {
        try {
            // Construct collection reference by appending reports to the path
            const reportsPath = `${commentPath}/reports`;
            const pathSegments = reportsPath.split('/');
            const reportsRef = collectionFull(dbFull, pathSegments[0], pathSegments[1], ...pathSegments.slice(2));
            const snapshot = await getDocsFull(reportsRef);
            return snapshot.size;
        } catch (error) {
            console.error("Error checking report count:", error);
            return 0;
        }
    };

    // Helper to recursively load replies
    const loadRepliesRecursive = async (
        dbFull: any,
        parentPath: string,
        depth: number,
        parentPathArray: string[]
    ): Promise<CommentRecord[]> => {
        if (depth >= 2) return [];

        try {
            const repliesRef = collectionFull(dbFull, parentPath, "replies");
            const q = queryFull(repliesRef, orderByFull("createdAt", "asc"));
            const snapshot = await getDocsFull(q);

            const replies: CommentRecord[] = await Promise.all(
                snapshot.docs.map(async (docSnap) => {
                    const data = docSnap.data() as any;
                    const replyPath = `${parentPath}/replies/${docSnap.id}`;
                    const nestedReplies = await loadRepliesRecursive(
                        dbFull,
                        replyPath,
                        depth + 1,
                        [...parentPathArray, docSnap.id]
                    );

                    // Fetch user data from users collection
                    let authorName = "Someone";
                    let authorUsername = null;
                    let authorPhotoURL = null;
                    const authorUid = data.uid ?? data.authorUid ?? null;

                    if (authorUid) {
                        try {
                            const userDoc = await getDocFull(docFull(dbFull, "users", authorUid));
                            if (userDoc.exists()) {
                                const userData = userDoc.data();
                                authorName = userData.displayName || userData.username || "Someone";
                                authorUsername = userData.username || null;
                                authorPhotoURL = userData.photoURL || null;
                            }
                        } catch (err) {
                            console.error("Error fetching user data:", err);
                        }
                    }

                    // Check report count
                    const reportCount = await checkReportCount(dbFull, replyPath);
                    const isHidden = reportCount >= 10;

                    return {
                        id: docSnap.id,
                        text: data.text ?? "",
                        authorName,
                        authorUsername,
                        authorUid,
                        authorPhotoURL,
                        createdAt: data.createdAt?.toDate?.() ?? null,
                        updatedAt: data.updatedAt?.toDate?.() ?? null,
                        likes: data.likes ?? [],
                        replies: nestedReplies,
                        depth: depth,
                        parentPath: parentPathArray,
                        reportCount,
                        isHidden,
                    } as CommentRecord;
                })
            );

            return replies;
        } catch (error) {
            console.error("Error loading replies:", error);
            return [];
        }
    };

    useEffect(() => {
        if (!data?.id) return;

        const loadComments = async () => {
            try {
                const dbFull = getFirestore();
                const commentsRef = collectionFull(dbFull, "events", data.id, "comments");
                const q = queryFull(commentsRef, orderByFull("createdAt", "asc"));
                const snapshot = await getDocsFull(q);

                const topLevelComments: CommentRecord[] = await Promise.all(
                    snapshot.docs.map(async (docSnap) => {
                        const payload = docSnap.data() as any;
                        const commentPath = `events/${data.id}/comments/${docSnap.id}`;
                        const replies = await loadRepliesRecursive(dbFull, commentPath, 0, [docSnap.id]);

                        // Fetch user data from users collection
                        let authorName = "Someone";
                        let authorUsername = null;
                        let authorPhotoURL = null;
                        const authorUid = payload.uid ?? payload.authorUid ?? null;

                        if (authorUid) {
                            try {
                                const userDoc = await getDocFull(docFull(dbFull, "users", authorUid));
                                if (userDoc.exists()) {
                                    const userData = userDoc.data();
                                    authorName = userData.displayName || userData.username || "Someone";
                                    authorUsername = userData.username || null;
                                    authorPhotoURL = userData.photoURL || null;
                                }
                            } catch (err) {
                                console.error("Error fetching user data:", err);
                            }
                        }

                        // Check report count
                        const reportCount = await checkReportCount(dbFull, commentPath);
                        const isHidden = reportCount >= 10;

                        return {
                            id: docSnap.id,
                            text: payload.text ?? "",
                            authorName,
                            authorUsername,
                            authorUid,
                            authorPhotoURL,
                            createdAt: payload.createdAt?.toDate?.() ?? null,
                            updatedAt: payload.updatedAt?.toDate?.() ?? null,
                            likes: payload.likes ?? [],
                            replies: replies,
                            depth: 0,
                            parentPath: [],
                            reportCount,
                            isHidden,
                        } as CommentRecord;
                    })
                );

                // Filter out hidden comments unless showHidden is true
                const visibleComments = showHidden
                    ? topLevelComments
                    : topLevelComments.filter(c => !c.isHidden);

                setComments(visibleComments);
                setCommentsLoading(false);
                setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 120);
            } catch (error) {
                console.error("Error loading comments:", error);
                setCommentsLoading(false);
            }
        };

        loadComments();

        // Refresh every 5 seconds to pick up new replies
        const interval = setInterval(loadComments, 5000);
        return () => clearInterval(interval);
    }, [data?.id, showHidden]);

    useEffect(() => {
        if (!data?.id) return;
        const loadOwner = async () => {
            try {
                const dbFull = getFirestore();
                const ref = docFull(dbFull, "events", data.id);
                const snap = await getDocFull(ref);
                if (snap.exists()) {
                    setEventOwnerUid((snap.data() as any)?.hostUserId ?? null);
                }
            } catch (error) {
                console.error("Error loading event owner:", error);
            }
        };
        loadOwner();
    }, [data?.id]);

    const userIsGlobalAdmin = useMemo(
        () => isGlobalAdmin(currentUser?.email, globalAdmins),
        [currentUser?.email, globalAdmins]
    );

    const buildCommentPath = (comment: CommentRecord): string => {
        const parentPath = comment.parentPath || [];
        if (parentPath.length === 0) {
            // Top-level comment
            return `events/${data?.id}/comments/${comment.id}`;
        }

        // Nested reply
        let path = `events/${data?.id}/comments/${parentPath[0]}`;
        for (let i = 1; i < parentPath.length; i++) {
            path += `/replies/${parentPath[i]}`;
        }
        path += `/replies/${comment.id}`;
        return path;
    };

    const canDelete = (comment: CommentRecord) => {
        if (!currentUser) return false;
        return (
            comment.authorUid === currentUser.uid ||
            eventOwnerUid === currentUser.uid ||
            userIsGlobalAdmin
        );
    };

    const reloadComments = async () => {
        if (!data?.id) return;
        try {
            const dbFull = getFirestore();
            const commentsRef = collectionFull(dbFull, "events", data.id, "comments");
            const q = queryFull(commentsRef, orderByFull("createdAt", "asc"));
            const snapshot = await getDocsFull(q);

            const topLevelComments: CommentRecord[] = await Promise.all(
                snapshot.docs.map(async (docSnap) => {
                    const payload = docSnap.data() as any;
                    const commentPath = `events/${data.id}/comments/${docSnap.id}`;
                    const replies = await loadRepliesRecursive(dbFull, commentPath, 0, [docSnap.id]);

                    // Fetch user data from users collection
                    let authorName = "Someone";
                    let authorUsername = null;
                    let authorPhotoURL = null;
                    const authorUid = payload.authorUid ?? payload.uid ?? null;

                    if (authorUid) {
                        try {
                            const userDoc = await getDocFull(docFull(dbFull, "users", authorUid));
                            if (userDoc.exists()) {
                                const userData = userDoc.data();
                                authorName = userData.displayName || userData.username || "Someone";
                                authorUsername = userData.username || null;
                                authorPhotoURL = userData.photoURL || null;
                            }
                        } catch (err) {
                            console.error("Error fetching user data:", err);
                        }
                    }

                    return {
                        id: docSnap.id,
                        text: payload.text ?? "",
                        authorName,
                        authorUsername,
                        authorUid,
                        authorPhotoURL,
                        createdAt: payload.createdAt?.toDate?.() ?? null,
                        updatedAt: payload.updatedAt?.toDate?.() ?? null,
                        likes: payload.likes ?? [],
                        replies: replies,
                        depth: 0,
                        parentPath: [],
                    } as CommentRecord;
                })
            );

            setComments(topLevelComments);
        } catch (error) {
            console.error("Error reloading comments:", error);
        }
    };

    const handleToggleLike = async (comment: CommentRecord) => {
        if (!currentUser || !data?.id) return;
        try {
            const dbFull = getFirestore();
            const path = buildCommentPath(comment);
            const pathSegments = path.split('/');
            const ref = docFull(dbFull, pathSegments[0], pathSegments[1], ...pathSegments.slice(2));
            const alreadyLiked = comment.likes?.includes(currentUser.uid);
            await updateDocFull(ref, {
                likes: alreadyLiked
                    ? arrayRemoveFull(currentUser.uid)
                    : arrayUnionFull(currentUser.uid),
            });
            await reloadComments();
        } catch (error) {
            console.error("Error toggling like:", error);
        }
    };

    const handleReport = async (comment: CommentRecord) => {
        if (!currentUser) return;
        setReportTarget(comment);
    };

    const submitReport = async (reason: string, details?: string) => {
        if (!currentUser || !reportTarget) return;
        try {
            const dbFull = getFirestore();
            const commentPath = buildCommentPath(reportTarget);
            const pathSegments = commentPath.split('/');
            const commentRef = docFull(dbFull, pathSegments[0], pathSegments[1], ...pathSegments.slice(2));

            // Add report to the comment's reports subcollection
            await addDocFull(collectionFull(commentRef, "reports"), {
                reason,
                details: details || null,
                reporterUid: currentUser.uid,
                reporterName: currentUser.displayName ?? currentUser.email ?? "User",
                createdAt: serverTimestampFull(),
            });

            // Also add to global reports collection for admin review
            await addDocFull(collectionFull(dbFull, "commentReports"), {
                eventId: data?.id,
                commentId: reportTarget.id,
                commentPath,
                commentText: reportTarget.text,
                reportedUid: reportTarget.authorUid ?? null,
                reporterUid: currentUser.uid,
                reporterName: currentUser.displayName ?? currentUser.email ?? "User",
                reason,
                details: details || null,
                createdAt: serverTimestampFull(),
            });

            setReportTarget(null);
        } catch (error) {
            console.error("Error reporting comment:", error);
        }
    };

    const handleDelete = async (comment: CommentRecord) => {
        if (!data?.id) return;
        try {
            const dbFull = getFirestore();
            const path = buildCommentPath(comment);
            const pathSegments = path.split('/');
            await deleteDocFull(docFull(dbFull, pathSegments[0], pathSegments[1], ...pathSegments.slice(2)));
            await reloadComments();
        } catch (error) {
            console.error("Error deleting comment:", error);
        }
    };

    const handleEdit = async (comment: CommentRecord, newText: string) => {
        if (!data?.id) return;
        try {
            const dbFull = getFirestore();
            const path = buildCommentPath(comment);
            const pathSegments = path.split('/');
            await updateDocFull(docFull(dbFull, pathSegments[0], pathSegments[1], ...pathSegments.slice(2)), {
                text: newText,
                updatedAt: serverTimestampFull(),
            });
            await reloadComments();
        } catch (error) {
            console.error("Error editing comment:", error);
        }
    };

    const handleSend = async () => {
        if (!newComment.trim() || !currentUser || !data?.id) return;
        setSending(true);
        try {
            const dbFull = getFirestore();

            // Build the correct path based on whether this is a reply or top-level comment
            let targetRef;
            if (replyTarget) {
                // This is a reply - save to the replies subcollection
                const parentPath = replyTarget.parentPath || [];
                let basePath = `events/${data.id}/comments/${parentPath[0] || replyTarget.id}`;

                // If there are nested levels, build the path
                for (let i = 1; i < parentPath.length; i++) {
                    basePath += `/replies/${parentPath[i]}`;
                }

                targetRef = collectionFull(dbFull, basePath, "replies");
            } else {
                // Top-level comment
                targetRef = collectionFull(dbFull, "events", data.id, "comments");
            }

            const payload: any = {
                text: newComment.trim(),
                authorUid: currentUser.uid,
                createdAt: serverTimestampFull(),
                likes: [],
            };

            const mentions = newComment.match(/@(\w+)/g);
            if (mentions) {
                try {
                    for (const mention of mentions) {
                        const username = mention.substring(1);
                        const usersRef = collectionFull(dbFull, "users");
                        const q = queryFull(usersRef, whereFull("username", "==", username));
                        const snap = await getDocsFull(q);

                        if (!snap.empty) {
                            const targetUser = snap.docs[0];
                            const notifRef = collectionFull(dbFull, "users", targetUser.id, "notifications");
                            await addDocFull(notifRef, {
                                type: "mention",
                                fromUid: currentUser.uid,
                                fromName: currentUser.displayName || "Someone",
                                eventId: data.id,
                                eventTitle: data.title || "Event",
                                text: newComment.trim(),
                                createdAt: serverTimestampFull(),
                                read: false,
                            });
                        }
                    }
                } catch (err) {
                    console.error("Error sending notifications:", err);
                }
            }

            await addDocFull(targetRef, payload);
            setNewComment("");
            setReplyTarget(null);
            await reloadComments();
        } catch (e) {
            console.error("Error sending comment:", e);
        } finally {
            setSending(false);
        }
    };

    const handleReply = (comment: CommentRecord) => {
        setReplyTarget(comment);
    };

    return (
        <>
            <div className="flex h-full flex-col">
                <div className="flex-1 space-y-4 pb-4">
                    {comments.some(c => c.isHidden) && (
                        <div className="mb-3">
                            <button
                                type="button"
                                onClick={() => setShowHidden(!showHidden)}
                                className="text-xs text-neutral-400 hover:text-neutral-300"
                            >
                                {showHidden ? "Hide" : "Show"} hidden comments (reported 10+ times)
                            </button>
                        </div>
                    )}
                    {commentsLoading ? (
                        <div className="text-center text-sm text-neutral-500 py-10">
                            Loading comments...
                        </div>
                    ) : comments.length === 0 ? (
                        <div className="text-center text-sm text-neutral-500 py-10">
                            No comments yet. Be the first!
                        </div>
                    ) : (
                        comments.map((comment) => (
                            <CommentMessage
                                key={comment.id}
                                comment={comment}
                                currentUserId={currentUser?.uid}
                                liked={
                                    !!currentUser && (comment.likes || []).includes(currentUser.uid)
                                }
                                likeCount={comment.likes?.length ?? 0}
                                canEdit={comment.authorUid === currentUser?.uid}
                                canDelete={canDelete(comment)}
                                onReply={handleReply}
                                onLike={handleToggleLike}
                                onReport={handleReport}
                                onDelete={handleDelete}
                                onEdit={handleEdit}
                                depth={0}
                            />
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="mt-auto space-y-2 pt-2">
                    {replyTarget && (
                        <div className="flex items-center justify-between rounded-2xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                            <span>Replying to {replyTarget.authorName}</span>
                            <button
                                type="button"
                                className="text-amber-100/80 hover:text-amber-50"
                                onClick={() => setReplyTarget(null)}
                            >
                                Clear
                            </button>
                        </div>
                    )}
                    <div className="relative flex items-center">
                        <input
                            type="text"
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSend())}
                            placeholder="Add a comment... Use @username to mention."
                            className="w-full rounded-full border border-white/10 bg-white/5 py-2.5 pl-4 pr-10 text-sm text-white placeholder-neutral-500 focus:border-white/20 focus:outline-none focus:ring-0"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!newComment.trim() || sending}
                            className="absolute right-1.5 rounded-full p-1.5 text-amber-300 hover:bg-white/10 disabled:opacity-50"
                        >
                            <PaperAirplaneIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>
            <ReportSheet
                isOpen={!!reportTarget}
                onClose={() => setReportTarget(null)}
                onSubmit={submitReport}
                commentAuthor={reportTarget?.authorName ?? ""}
            />
        </>
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

        const dbFull = getFirestore();
        const docRef = docFull(dbFull, "events", data.id);

        const unsubscribe = onSnapshotFull(docRef, (snap) => {
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

