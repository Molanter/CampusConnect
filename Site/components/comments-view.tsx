"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { onAuthStateChanged } from "firebase/auth";
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
    where,
    getDocs,
    deleteDoc,
} from "firebase/firestore";
import { PaperAirplaneIcon } from "@heroicons/react/24/outline";
import { auth, db } from "@/lib/firebase";
import { fetchGlobalAdminEmails, isGlobalAdmin } from "@/lib/admin-utils";
import { CommentMessage, type CommentRecord } from "./comment-message";
import { ReportSheet } from "./report-sheet";

interface CommentsViewProps {
    data: any;
}

export function CommentsView({ data }: CommentsViewProps) {
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
    const checkReportCount = async (db: any, commentPath: string): Promise<number> => {
        try {
            // Construct collection reference by appending reports to the path
            const reportsPath = `${commentPath}/reports`;
            const pathSegments = reportsPath.split('/');
            const reportsRef = collection(db, pathSegments[0], pathSegments[1], ...pathSegments.slice(2));
            const snapshot = await getDocs(reportsRef);
            return snapshot.size;
        } catch (error) {
            console.error("Error checking report count:", error);
            return 0;
        }
    };

    // Helper to recursively load replies
    const loadRepliesRecursive = async (
        db: any,
        parentPath: string,
        depth: number,
        parentPathArray: string[]
    ): Promise<CommentRecord[]> => {
        if (depth >= 2) return [];

        try {
            const repliesRef = collection(db, parentPath, "replies");
            const q = query(repliesRef, orderBy("createdAt", "asc"));
            const snapshot = await getDocs(q);

            const replies: CommentRecord[] = await Promise.all(
                snapshot.docs.map(async (docSnap) => {
                    const data = docSnap.data() as any;
                    const replyPath = `${parentPath}/replies/${docSnap.id}`;
                    const nestedReplies = await loadRepliesRecursive(
                        db,
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
                            const userDoc = await getDoc(doc(db, "users", authorUid));
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
                    const reportCount = await checkReportCount(db, replyPath);
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
                const commentsRef = collection(db, "events", data.id, "comments");
                const q = query(commentsRef, orderBy("createdAt", "asc"));
                const snapshot = await getDocs(q);

                const topLevelComments: CommentRecord[] = await Promise.all(
                    snapshot.docs.map(async (docSnap) => {
                        const payload = docSnap.data() as any;
                        const commentPath = `events/${data.id}/comments/${docSnap.id}`;
                        const replies = await loadRepliesRecursive(db, commentPath, 0, [docSnap.id]);

                        // Fetch user data from users collection
                        let authorName = "Someone";
                        let authorUsername = null;
                        let authorPhotoURL = null;
                        const authorUid = payload.uid ?? payload.authorUid ?? null;

                        if (authorUid) {
                            try {
                                const userDoc = await getDoc(doc(db, "users", authorUid));
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
                        const reportCount = await checkReportCount(db, commentPath);
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
                const ref = doc(db, "events", data.id);
                const snap = await getDoc(ref);
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
            const commentsRef = collection(db, "events", data.id, "comments");
            const q = query(commentsRef, orderBy("createdAt", "asc"));
            const snapshot = await getDocs(q);

            const topLevelComments: CommentRecord[] = await Promise.all(
                snapshot.docs.map(async (docSnap) => {
                    const payload = docSnap.data() as any;
                    const commentPath = `events/${data.id}/comments/${docSnap.id}`;
                    const replies = await loadRepliesRecursive(db, commentPath, 0, [docSnap.id]);

                    // Fetch user data from users collection
                    let authorName = "Someone";
                    let authorUsername = null;
                    let authorPhotoURL = null;
                    const authorUid = payload.authorUid ?? payload.uid ?? null;

                    if (authorUid) {
                        try {
                            const userDoc = await getDoc(doc(db, "users", authorUid));
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
            const path = buildCommentPath(comment);
            const pathSegments = path.split('/');
            const ref = doc(db, pathSegments[0], pathSegments[1], ...pathSegments.slice(2));
            const alreadyLiked = comment.likes?.includes(currentUser.uid);
            await updateDoc(ref, {
                likes: alreadyLiked
                    ? arrayRemove(currentUser.uid)
                    : arrayUnion(currentUser.uid),
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
            const commentPath = buildCommentPath(reportTarget);
            const pathSegments = commentPath.split('/');
            const commentRef = doc(db, pathSegments[0], pathSegments[1], ...pathSegments.slice(2));

            // Add report to the comment's reports subcollection
            await addDoc(collection(commentRef, "reports"), {
                reason,
                details: details || null,
                reporterUid: currentUser.uid,
                reporterName: currentUser.displayName ?? currentUser.email ?? "User",
                createdAt: serverTimestamp(),
            });

            // Also add to global reports collection for admin review
            await addDoc(collection(db, "commentReports"), {
                eventId: data?.id,
                commentId: reportTarget.id,
                commentPath,
                commentText: reportTarget.text,
                reportedUid: reportTarget.authorUid ?? null,
                reporterUid: currentUser.uid,
                reporterName: currentUser.displayName ?? currentUser.email ?? "User",
                reason,
                details: details || null,
                createdAt: serverTimestamp(),
            });

            setReportTarget(null);
        } catch (error) {
            console.error("Error reporting comment:", error);
        }
    };

    const handleDelete = async (comment: CommentRecord) => {
        if (!data?.id) return;
        try {
            const path = buildCommentPath(comment);
            const pathSegments = path.split('/');
            await deleteDoc(doc(db, pathSegments[0], pathSegments[1], ...pathSegments.slice(2)));
            await reloadComments();
        } catch (error) {
            console.error("Error deleting comment:", error);
        }
    };

    const handleEdit = async (comment: CommentRecord, newText: string) => {
        if (!data?.id) return;
        try {
            const path = buildCommentPath(comment);
            const pathSegments = path.split('/');
            await updateDoc(doc(db, pathSegments[0], pathSegments[1], ...pathSegments.slice(2)), {
                text: newText,
                updatedAt: serverTimestamp(),
            });
            await reloadComments();
        } catch (error) {
            console.error("Error editing comment:", error);
        }
    };

    const handleSend = async () => {
        if (!newComment.trim() || !currentUser || !data?.id) return;
        setSending(false); // Wait, this was true in original? No, sending should be true.
        setSending(true);
        try {

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

                targetRef = collection(db, basePath, "replies");
            } else {
                // Top-level comment
                targetRef = collection(db, "events", data.id, "comments");
            }

            const payload: any = {
                text: newComment.trim(),
                authorUid: currentUser.uid,
                createdAt: serverTimestamp(),
                likes: [],
            };

            const mentions = newComment.match(/@(\w+)/g);
            if (mentions) {
                try {
                    for (const mention of mentions) {
                        const username = mention.substring(1);
                        const usersRef = collection(db, "users");
                        const q = query(usersRef, where("username", "==", username));
                        const snap = await getDocs(q);

                        if (!snap.empty) {
                            const targetUser = snap.docs[0];
                            const notifRef = collection(db, "users", targetUser.id, "notifications");
                            await addDoc(notifRef, {
                                type: "mention",
                                fromUid: currentUser.uid,
                                fromName: currentUser.displayName || "Someone",
                                eventId: data.id,
                                eventTitle: data.title || "Event",
                                text: newComment.trim(),
                                createdAt: serverTimestamp(),
                                read: false,
                            });
                        }
                    }
                } catch (err) {
                    console.error("Error sending notifications:", err);
                }
            }

            await addDoc(targetRef, payload);
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
                <div className="shrink-0 space-y-2 pb-4 pt-2 border-b border-white/5 bg-neutral-950 z-10">
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

                <div className="flex-1 space-y-4 py-4 overflow-y-auto min-h-0 scrollbar-hide">
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
