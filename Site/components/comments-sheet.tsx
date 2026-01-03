"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { CommentMessage, type CommentRecord } from "./comment-message";
import { fetchGlobalAdminEmails, isGlobalAdmin } from "@/lib/admin-utils";
import { ReportSheet } from "./report-sheet";

type CommentsSheetProps = {
  eventId: string;
  eventTitle: string;
  isWide: boolean;
  onClose: () => void;
  inline?: boolean;
};

type ReplyTarget = CommentRecord;

export function CommentsSheet({
  eventId,
  eventTitle,
  isWide,
  onClose,
  inline = false,
}: CommentsSheetProps) {
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [globalAdmins, setGlobalAdmins] = useState<string[]>([]);
  const [eventOwnerUid, setEventOwnerUid] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<CommentRecord | null>(null);
  const [showHidden, setShowHidden] = useState(false);



  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setCurrentUser(user));
    return () => unsub();
  }, []);

  // Helper to check if a comment should be hidden due to reports
  const checkReportCount = async (commentPath: string): Promise<number> => {
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
            replyPath,
            depth + 1,
            [...parentPathArray, docSnap.id]
          );

          // Fetch user data from users collection
          let authorName = "Someone";
          let authorUsername = null;
          let authorPhotoURL = null;

          if (data.authorUid) {
            try {
              const userDoc = await getDoc(doc(db, "users", data.authorUid));
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
          const reportCount = await checkReportCount(replyPath);
          const isHidden = reportCount >= 10;

          return {
            id: docSnap.id,
            text: data.text ?? "",
            authorName,
            authorUsername,
            authorUid: data.authorUid ?? null,
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
    const loadComments = async () => {
      try {
        const commentsRef = collection(db, "events", eventId, "comments");
        const q = query(commentsRef, orderBy("createdAt", "asc"));
        const snapshot = await getDocs(q);

        const topLevelComments: CommentRecord[] = await Promise.all(
          snapshot.docs.map(async (docSnap) => {
            const data = docSnap.data() as any;
            const commentPath = `events/${eventId}/comments/${docSnap.id}`;
            const replies = await loadRepliesRecursive(commentPath, 0, [docSnap.id]);

            // Fetch user data from users collection
            let authorName = "Someone";
            let authorUsername = null;
            let authorPhotoURL = null;

            if (data.authorUid) {
              try {
                const userDoc = await getDoc(doc(db, "users", data.authorUid));
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
            const reportCount = await checkReportCount(commentPath);
            const isHidden = reportCount >= 10;

            return {
              id: docSnap.id,
              text: data.text ?? "",
              authorName,
              authorUsername,
              authorUid: data.authorUid ?? null,
              authorPhotoURL,
              createdAt: data.createdAt?.toDate?.() ?? null,
              updatedAt: data.updatedAt?.toDate?.() ?? null,
              likes: data.likes ?? [],
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
        setLoading(false);
      } catch (error) {
        console.error("Error loading comments:", error);
        setLoading(false);
      }
    };

    loadComments();

    // Refresh every 5 seconds to pick up new replies
    const interval = setInterval(loadComments, 5000);
    return () => clearInterval(interval);
  }, [db, eventId, showHidden]);

  useEffect(() => {
    fetchGlobalAdminEmails().then(setGlobalAdmins).catch(() => setGlobalAdmins([]));
  }, []);

  useEffect(() => {
    const loadEvent = async () => {
      try {
        const ref = doc(db, "events", eventId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setEventOwnerUid((snap.data() as any)?.hostUserId ?? null);
        }
      } catch (error) {
        console.error("Error loading event owner:", error);
      }
    };
    loadEvent();
  }, [db, eventId]);

  const userIsGlobalAdmin = useMemo(
    () => isGlobalAdmin(currentUser?.email, globalAdmins),
    [currentUser?.email, globalAdmins]
  );

  const canDeleteComment = (comment: CommentRecord) => {
    if (!currentUser) return false;
    return (
      comment.authorUid === currentUser.uid ||
      eventOwnerUid === currentUser.uid ||
      userIsGlobalAdmin
    );
  };

  const handleToggleLike = async (comment: CommentRecord) => {
    if (!currentUser) return;
    const path = buildCommentPath(comment);
    const pathSegments = path.split('/');
    const commentRef = doc(db, pathSegments[0], pathSegments[1], ...pathSegments.slice(2));
    const alreadyLiked = comment.likes?.includes(currentUser.uid);

    try {
      await updateDoc(commentRef, {
        likes: alreadyLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
      });

      // Reload to reflect like
      const loadComments = async () => {
        try {
          const commentsRef = collection(db, "events", eventId, "comments");
          const q = query(commentsRef, orderBy("createdAt", "asc"));
          const snapshot = await getDocs(q);

          const topLevelComments: CommentRecord[] = await Promise.all(
            snapshot.docs.map(async (docSnap) => {
              const data = docSnap.data() as any;
              const commentPath = `events/${eventId}/comments/${docSnap.id}`;
              const replies = await loadRepliesRecursive(commentPath, 0, [docSnap.id]);

              // Fetch user data from users collection
              let authorName = "Someone";
              let authorUsername = null;
              let authorPhotoURL = null;

              if (data.authorUid) {
                try {
                  const userDoc = await getDoc(doc(db, "users", data.authorUid));
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
                text: data.text ?? "",
                authorName,
                authorUsername,
                authorUid: data.authorUid ?? null,
                authorPhotoURL,
                createdAt: data.createdAt?.toDate?.() ?? null,
                updatedAt: data.updatedAt?.toDate?.() ?? null,
                likes: data.likes ?? [],
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
      await loadComments();
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
      // Get the comment path to store the report in the comment's subcollection
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
        eventId,
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

  const buildCommentPath = (comment: CommentRecord): string => {
    const parentPath = comment.parentPath || [];
    if (parentPath.length === 0) {
      // Top-level comment
      return `events/${eventId}/comments/${comment.id}`;
    }

    // Nested reply
    let path = `events/${eventId}/comments/${parentPath[0]}`;
    for (let i = 1; i < parentPath.length; i++) {
      path += `/replies/${parentPath[i]}`;
    }
    path += `/replies/${comment.id}`;
    return path;
  };

  const handleDelete = async (comment: CommentRecord) => {
    try {
      const path = buildCommentPath(comment);
      const pathSegments = path.split('/');
      await deleteDoc(doc(db, pathSegments[0], pathSegments[1], ...pathSegments.slice(2)));

      // Reload to reflect deletion
      const loadComments = async () => {
        try {
          const commentsRef = collection(db, "events", eventId, "comments");
          const q = query(commentsRef, orderBy("createdAt", "asc"));
          const snapshot = await getDocs(q);

          const topLevelComments: CommentRecord[] = await Promise.all(
            snapshot.docs.map(async (docSnap) => {
              const data = docSnap.data() as any;
              const commentPath = `events/${eventId}/comments/${docSnap.id}`;
              const replies = await loadRepliesRecursive(commentPath, 0, [docSnap.id]);

              // Fetch user data from users collection
              let authorName = "Someone";
              let authorUsername = null;
              let authorPhotoURL = null;

              if (data.authorUid) {
                try {
                  const userDoc = await getDoc(doc(db, "users", data.authorUid));
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
                text: data.text ?? "",
                authorName,
                authorUsername,
                authorUid: data.authorUid ?? null,
                authorPhotoURL,
                createdAt: data.createdAt?.toDate?.() ?? null,
                updatedAt: data.updatedAt?.toDate?.() ?? null,
                likes: data.likes ?? [],
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
      await loadComments();
    } catch (error) {
      console.error("Error deleting comment:", error);
    }
  };

  const handleEdit = async (comment: CommentRecord, newText: string) => {
    try {
      const path = buildCommentPath(comment);
      const pathSegments = path.split('/');
      await updateDoc(doc(db, pathSegments[0], pathSegments[1], ...pathSegments.slice(2)), {
        text: newText,
        updatedAt: serverTimestamp(),
      });

      // Reload to reflect edit
      const loadComments = async () => {
        try {
          const commentsRef = collection(db, "events", eventId, "comments");
          const q = query(commentsRef, orderBy("createdAt", "asc"));
          const snapshot = await getDocs(q);

          const topLevelComments: CommentRecord[] = await Promise.all(
            snapshot.docs.map(async (docSnap) => {
              const data = docSnap.data() as any;
              const commentPath = `events/${eventId}/comments/${docSnap.id}`;
              const replies = await loadRepliesRecursive(commentPath, 0, [docSnap.id]);

              // Fetch user data from users collection
              let authorName = "Someone";
              let authorUsername = null;
              let authorPhotoURL = null;

              if (data.authorUid) {
                try {
                  const userDoc = await getDoc(doc(db, "users", data.authorUid));
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
                text: data.text ?? "",
                authorName,
                authorUsername,
                authorUid: data.authorUid ?? null,
                authorPhotoURL,
                createdAt: data.createdAt?.toDate?.() ?? null,
                updatedAt: data.updatedAt?.toDate?.() ?? null,
                likes: data.likes ?? [],
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
      await loadComments();
    } catch (error) {
      console.error("Error editing comment:", error);
    }
  };

  const handleReply = (comment: CommentRecord) => {
    setReplyTarget(comment);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || !currentUser) return;

    // Build the correct path based on whether this is a reply or top-level comment
    let targetRef;
    if (replyTarget) {
      // This is a reply - save to the replies subcollection
      const parentPath = replyTarget.parentPath || [];
      let basePath = `events/${eventId}/comments/${parentPath[0] || replyTarget.id}`;

      // If there are nested levels, build the path
      for (let i = 1; i < parentPath.length; i++) {
        basePath += `/replies/${parentPath[i]}`;
      }

      targetRef = collection(db, basePath, "replies");
    } else {
      // Top-level comment
      targetRef = collection(db, "events", eventId, "comments");
    }

    const payload: any = {
      text: trimmed,
      authorUid: currentUser.uid,
      createdAt: serverTimestamp(),
      likes: [],
    };

    const mentions = trimmed.match(/@(\w+)/g);
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
              eventId,
              eventTitle,
              text: trimmed,
              createdAt: serverTimestamp(),
              read: false,
            });
          }
        }
      } catch (error) {
        console.error("Error sending mention notifications:", error);
      }
    }

    try {
      await addDoc(targetRef, payload);
      setInput("");
      setReplyTarget(null);

      // Reload comments to show the new reply
      const loadComments = async () => {
        try {
          const commentsRef = collection(db, "events", eventId, "comments");
          const q = query(commentsRef, orderBy("createdAt", "asc"));
          const snapshot = await getDocs(q);

          const topLevelComments: CommentRecord[] = await Promise.all(
            snapshot.docs.map(async (docSnap) => {
              const data = docSnap.data() as any;
              const commentPath = `events/${eventId}/comments/${docSnap.id}`;
              const replies = await loadRepliesRecursive(commentPath, 0, [docSnap.id]);

              // Fetch user data from users collection
              let authorName = "Someone";
              let authorUsername = null;
              let authorPhotoURL = null;

              if (data.authorUid) {
                try {
                  const userDoc = await getDoc(doc(db, "users", data.authorUid));
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
                text: data.text ?? "",
                authorName,
                authorUsername,
                authorUid: data.authorUid ?? null,
                authorPhotoURL,
                createdAt: data.createdAt?.toDate?.() ?? null,
                updatedAt: data.updatedAt?.toDate?.() ?? null,
                likes: data.likes ?? [],
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
      await loadComments();
    } catch (error) {
      console.error("Error posting comment:", error);
    }
  };

  const listContent = (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Comments
          </p>
          <h2 className="text-sm font-semibold text-foreground line-clamp-1">
            {eventTitle}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-secondary/10 px-3 py-1 text-[11px] text-foreground hover:bg-secondary/20 transition-colors"
        >
          Close
        </button>
      </div>

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

      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {loading && (
          <p className="text-xs text-neutral-500">Loading comments...</p>
        )}
        {!loading && comments.length === 0 && (
          <p className="text-xs text-neutral-500">
            No comments yet. Be the first to share something.
          </p>
        )}
        {!loading &&
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
              canDelete={canDeleteComment(comment)}
              onReply={handleReply}
              onLike={handleToggleLike}
              onReport={handleReport}
              onDelete={handleDelete}
              onEdit={handleEdit}
              depth={0}
            />
          ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-3xl border border-secondary/15 bg-surface-2 p-4">
        {replyTarget && (
          <div className="flex items-center justify-between rounded-2xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-200">
            <div>
              Replying to <span className="font-semibold">{replyTarget.authorName}</span>
            </div>
            <button
              type="button"
              className="text-amber-200/70 hover:text-amber-100"
              onClick={() => setReplyTarget(null)}
            >
              Clear
            </button>
          </div>
        )}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          className="w-full rounded-3xl border border-white/10 bg-transparent px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:border-white/30 focus:outline-none"
          placeholder="Write a message... mention someone with @username"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-neutral-200 disabled:opacity-50"
            disabled={!input.trim() || !currentUser}
          >
            Send
          </button>
        </div>
      </form>
    </>
  );

  if (inline) {
    return (
      <>
        <div className="flex h-full w-full flex-col rounded-3xl border border-white/10 bg-neutral-950/90 px-4 py-4">
          {listContent}
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

  const containerBase =
    "fixed inset-0 z-40 flex bg-black/40 backdrop-blur-sm";

  const innerClasses = isWide
    ? "ml-auto mr-4 my-4 flex h-[90vh] w-full max-w-lg flex-col rounded-3xl border border-secondary/15 bg-background px-4 py-4"
    : "mx-auto mb-0 mt-auto flex h-[70vh] w-full max-w-lg flex-col rounded-t-3xl border border-secondary/15 bg-background px-4 py-4";

  return (
    <>
      <div className={containerBase} aria-modal="true" role="dialog">
        <div className={innerClasses}>{listContent}</div>
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


