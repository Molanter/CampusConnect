"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
    limit,
    startAfter,
    increment,
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
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [globalAdmins, setGlobalAdmins] = useState<string[]>([]);
    const [eventOwnerUid, setEventOwnerUid] = useState<string | null>(null);
    const [reportTarget, setReportTarget] = useState<CommentRecord | null>(null);
    const [showHidden, setShowHidden] = useState(false);

    // Pagination state
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const PAGE_SIZE = 20;

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

    // Load replies for a single comment (one level only)
    const loadRepliesForComment = async (commentId: string): Promise<CommentRecord[]> => {
        try {
            const repliesRef = collection(db, "posts", data.id, "comments", commentId, "replies");
            const q = query(repliesRef, orderBy("createdAt", "asc"));
            const snapshot = await getDocs(q);

            const replies: CommentRecord[] = await Promise.all(
                snapshot.docs.map(async (docSnap) => {
                    const replyData = docSnap.data() as any;
                    const authorUid = replyData.uid ?? replyData.authorUid ?? null;

                    let authorName = "Someone";
                    let authorUsername = null;
                    let authorPhotoURL = null;

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
                            console.error("Error fetching reply author:", err);
                        }
                    }

                    return {
                        id: docSnap.id,
                        text: replyData.text ?? "",
                        authorName,
                        authorUsername,
                        authorUid,
                        authorPhotoURL,
                        createdAt: replyData.createdAt?.toDate?.() ?? null,
                        updatedAt: replyData.updatedAt?.toDate?.() ?? null,
                        editCount: replyData.editCount ?? 0,
                        editedAt: replyData.editedAt?.toDate?.() ?? null,
                        likes: replyData.likes ?? [],
                        replies: [], // No nested replies
                        depth: 1,
                        parentPath: [commentId],
                        reportCount: 0,
                        isHidden: false,
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
                setCommentsLoading(true);
                const commentsRef = collection(db, "posts", data.id, "comments");
                const q = query(commentsRef, orderBy("createdAt", "desc"), limit(PAGE_SIZE));
                const snapshot = await getDocs(q);

                if (snapshot.empty) {
                    setComments([]);
                    setCommentsLoading(false);
                    setHasMore(false);
                    return;
                }

                const topLevelComments: CommentRecord[] = await Promise.all(
                    snapshot.docs.map(async (docSnap) => {
                        const payload = docSnap.data() as any;
                        const authorUid = payload.uid ?? payload.authorUid ?? null;

                        let authorName = "Someone";
                        let authorUsername = null;
                        let authorPhotoURL = null;

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

                        // Load replies for this comment
                        const replies = await loadRepliesForComment(docSnap.id);

                        return {
                            id: docSnap.id,
                            text: payload.text ?? "",
                            authorName,
                            authorUsername,
                            authorUid,
                            authorPhotoURL,
                            createdAt: payload.createdAt?.toDate?.() ?? null,
                            updatedAt: payload.updatedAt?.toDate?.() ?? null,
                            editCount: payload.editCount ?? 0,
                            editedAt: payload.editedAt?.toDate?.() ?? null,
                            likes: payload.likes ?? [],
                            replies: replies,
                            depth: 0,
                            parentPath: [],
                            reportCount: 0,
                            isHidden: false,
                        } as CommentRecord;
                    })
                );

                setComments(topLevelComments);
                setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
                setHasMore(snapshot.docs.length === PAGE_SIZE);
                setCommentsLoading(false);
            } catch (error) {
                console.error("Error loading comments:", error);
                setCommentsLoading(false);
            }
        };

        loadComments();
    }, [data?.id]);

    // Load more comments (pagination)
    const loadMoreComments = async () => {
        if (!data?.id || !hasMore || isLoadingMore || !lastDoc) return;

        try {
            setIsLoadingMore(true);
            const commentsRef = collection(db, "posts", data.id, "comments");
            const q = query(
                commentsRef,
                orderBy("createdAt", "desc"),
                startAfter(lastDoc),
                limit(PAGE_SIZE)
            );
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                setHasMore(false);
                setIsLoadingMore(false);
                return;
            }

            const newComments: CommentRecord[] = await Promise.all(
                snapshot.docs.map(async (docSnap) => {
                    const payload = docSnap.data() as any;
                    const authorUid = payload.uid ?? payload.authorUid ?? null;

                    let authorName = "Someone";
                    let authorUsername = null;
                    let authorPhotoURL = null;

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

                    const replies = await loadRepliesForComment(docSnap.id);

                    return {
                        id: docSnap.id,
                        text: payload.text ?? "",
                        authorName,
                        authorUsername,
                        authorUid,
                        authorPhotoURL,
                        createdAt: payload.createdAt?.toDate?.() ?? null,
                        updatedAt: payload.updatedAt?.toDate?.() ?? null,
                        editCount: payload.editCount ?? 0,
                        editedAt: payload.editedAt?.toDate?.() ?? null,
                        likes: payload.likes ?? [],
                        replies: replies,
                        depth: 0,
                        parentPath: [],
                        reportCount: 0,
                        isHidden: false,
                    } as CommentRecord;
                })
            );

            setComments(prev => [...prev, ...newComments]);
            setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
            setHasMore(snapshot.docs.length === PAGE_SIZE);
            setIsLoadingMore(false);
        } catch (error) {
            console.error("Error loading more comments:", error);
            setIsLoadingMore(false);
        }
    };

    // Scroll listener for infinite scroll
    useEffect(() => {
        const container = scrollContainerRef.current?.closest('.overflow-y-auto');
        if (!container) return;

        const handleScroll = (e: any) => {
            const target = e.target;
            const { scrollTop, scrollHeight, clientHeight } = target;
            if (scrollHeight - scrollTop - clientHeight < 300) {
                loadMoreComments();
            }
        };

        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, [hasMore, isLoadingMore, lastDoc]);

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
        // One-level replies only
        if (comment.depth === 0) {
            // Top-level comment
            return `posts/${data?.id}/comments/${comment.id}`;
        } else {
            // Reply (depth 1)
            const parentId = comment.parentPath?.[0];
            return `posts/${data?.id}/comments/${parentId}/replies/${comment.id}`;
        }
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
            const commentsRef = collection(db, "posts", data.id, "comments");
            const q = query(commentsRef, orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);

            const topLevelComments: CommentRecord[] = await Promise.all(
                snapshot.docs.map(async (docSnap) => {
                    const payload = docSnap.data() as any;
                    const authorUid = payload.authorUid ?? payload.uid ?? null;

                    let authorName = "Someone";
                    let authorUsername = null;
                    let authorPhotoURL = null;

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

                    const replies = await loadRepliesForComment(docSnap.id);

                    return {
                        id: docSnap.id,
                        text: payload.text ?? "",
                        authorName,
                        authorUsername,
                        authorUid,
                        authorPhotoURL,
                        createdAt: payload.createdAt?.toDate?.() ?? null,
                        updatedAt: payload.updatedAt?.toDate?.() ?? null,
                        editCount: payload.editCount ?? 0,
                        editedAt: payload.editedAt?.toDate?.() ?? null,
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
                editCount: increment(1),
                editedAt: serverTimestamp(),
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
                // One-level replies only - reply to top-level comment
                if (replyTarget.depth !== 0) {
                    console.error("Cannot reply to a reply");
                    setSending(false);
                    return;
                }
                // Save to the replies subcollection of the top-level comment
                targetRef = collection(db, "posts", data.id, "comments", replyTarget.id, "replies");
            } else {
                // Top-level comment
                targetRef = collection(db, "posts", data.id, "comments");
            }

            const payload: any = {
                text: newComment.trim(),
                authorUid: currentUser.uid,
                postId: data.id, // For collectionGroup queries and navigation
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
                                eventTitle: data.title || "",
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
        // Only allow replying to top-level comments (depth 0)
        if (comment.depth === 0) {
            setReplyTarget(comment);
        }
    };

    return (
        <>
            <div className="relative" ref={scrollContainerRef}>
                {/* Composer Section - Sticky and Transparent */}
                <div className="sticky top-0 z-20 space-y-2 pb-3 -mx-2 px-2">
                    <AnimatePresence>
                        {replyTarget && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="flex items-center justify-between rounded-full border border-brand/30 bg-brand/10 px-3 py-1.5 text-xs text-brand mb-2 cc-glass-strong"
                            >
                                <span>Replying to {replyTarget.authorName}</span>
                                <button
                                    type="button"
                                    className="text-brand/80 hover:text-brand font-bold"
                                    onClick={() => setReplyTarget(null)}
                                >
                                    Clear
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="relative flex items-center w-full h-[48px]">
                        <motion.div
                            layout
                            animate={{ marginRight: newComment.trim().length > 0 ? 56 : 0 }}
                            transition={{
                                type: "spring",
                                stiffness: 260,
                                damping: 28,
                                mass: 0.8,
                                delay: newComment.trim().length > 0 ? 0 : 0.1 // Delayed expansion on disappear
                            }}
                            className="cc-glass-strong flex-1 h-full rounded-full border cc-header-item-stroke shadow-sm flex items-center"
                        >
                            <div className="relative flex-1 flex items-center px-5 h-full">
                                <input
                                    type="text"
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSend())}
                                    placeholder="Write comment"
                                    className="flex-1 bg-transparent outline-none text-foreground placeholder-secondary text-base h-full"
                                />
                            </div>
                        </motion.div>
                        <AnimatePresence>
                            {newComment.trim().length > 0 && (
                                <motion.button
                                    initial={{ opacity: 0, scale: 0.2 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.2 }}
                                    whileTap={{ scale: 0.92 }}
                                    transition={{
                                        type: "spring",
                                        stiffness: 260,
                                        damping: 25,
                                        mass: 0.8,
                                        delay: 0.08 // Small delay for the pop
                                    }}
                                    onClick={handleSend}
                                    disabled={sending}
                                    className="absolute right-0 h-full aspect-square flex items-center justify-center rounded-full bg-brand shadow-lg text-white hover:brightness-105"
                                >
                                    <PaperAirplaneIcon className="h-5 w-5" />
                                </motion.button>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Comments List */}
                <div className="min-h-0">
                    {comments.some(c => c.isHidden) && (
                        <div className="pt-3 pb-2">
                            <button
                                type="button"
                                onClick={() => setShowHidden(!showHidden)}
                                className="text-xs text-muted hover:text-secondary"
                            >
                                {showHidden ? "Hide" : "Show"} hidden comments (reported 10+ times)
                            </button>
                        </div>
                    )}
                    {commentsLoading ? (
                        <div className="py-6 text-sm text-muted text-center">
                            Loading comments...
                        </div>
                    ) : comments.length === 0 ? (
                        <div className="py-6 text-sm text-muted text-center">
                            No comments yet. Be the first!
                        </div>
                    ) : (
                        <div className="space-y-0 divide-y divide-secondary/10">
                            {comments.map((comment) => (
                                <div key={comment.id} className="py-3">
                                    <CommentMessage
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
                                </div>
                            ))}
                        </div>
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
