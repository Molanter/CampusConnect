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
                const q = query(commentsRef, orderBy("createdAt", "asc"), limit(PAGE_SIZE));
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
                orderBy("createdAt", "asc"),
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
        const container = scrollContainerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            if (scrollHeight - scrollTop - clientHeight < 200) {
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
            const q = query(commentsRef, orderBy("createdAt", "asc"));
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
            <div className="flex h-full flex-col">
                {/* Composer Section - Compact Threads Style */}
                <div className="shrink-0 space-y-2 px-1.5 pt-1 pb-3">
                    {replyTarget && (
                        <div className="flex items-center justify-between rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1.5 text-xs text-amber-200">
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
                            placeholder="Write comment"
                            className="w-full rounded-full border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/40 focus:border-white/20 focus:bg-white/[0.07] focus:outline-none"
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

                {/* Comments List - Threads Style */}
                <div ref={scrollContainerRef} className="flex-1 overflow-y-auto min-h-0 scrollbar-hide">
                    {comments.some(c => c.isHidden) && (
                        <div className="px-4 pt-3 pb-2">
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
                        <div className="px-4 py-6 text-sm text-neutral-500">
                            Loading comments...
                        </div>
                    ) : comments.length === 0 ? (
                        <div className="px-4 py-6 text-sm text-neutral-500">
                            No comments yet. Be the first!
                        </div>
                    ) : (
                        <div className="space-y-0">
                            {comments.map((comment) => (
                                <div key={comment.id} className="px-4 py-3">
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
