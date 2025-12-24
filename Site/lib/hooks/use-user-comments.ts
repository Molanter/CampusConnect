"use client";

import { useState, useEffect } from "react";
import {
    collectionGroup,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    getDocs,
    DocumentSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";

export type UserComment = {
    id: string;
    text: string;
    authorId?: string;
    authorUid?: string;
    postId: string;
    createdAt: any;
    likes: string[];
};

export function useUserComments(userId: string | null) {
    const [comments, setComments] = useState<UserComment[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(false);
    const [lastCommentDoc, setLastCommentDoc] = useState<DocumentSnapshot | null>(null);
    const [lastReplyDoc, setLastReplyDoc] = useState<DocumentSnapshot | null>(null);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const PAGE_SIZE = 15;

    const processDocs = (docs: any[]): UserComment[] => {
        return docs.map((doc) => {
            const data = doc.data();
            // Path structure: posts/{postId}/comments/{commentId} 
            // OR posts/{postId}/comments/{commentId}/replies/{replyId}
            let postIdFromPath = "";
            const pathSegments = doc.ref.path.split('/');
            if (pathSegments[0] === 'posts') {
                postIdFromPath = pathSegments[1];
            }

            return {
                id: doc.id,
                ...data,
                postId: data.postId || postIdFromPath,
            } as UserComment;
        });
    };

    // Initial load
    useEffect(() => {
        if (!userId) {
            setComments([]);
            setLoading(false);
            setHasMore(false);
            return;
        }

        const loadInitialComments = async () => {
            try {
                setLoading(true);

                // Query 1: Top-level comments
                const qComments = query(
                    collectionGroup(db, "comments"),
                    where("authorUid", "==", userId),
                    orderBy("createdAt", "desc"),
                    limit(PAGE_SIZE)
                );

                // Query 2: Replies
                const qReplies = query(
                    collectionGroup(db, "replies"),
                    where("authorUid", "==", userId),
                    orderBy("createdAt", "desc"),
                    limit(PAGE_SIZE)
                );

                const [snapComments, snapReplies] = await Promise.all([
                    getDocs(qComments),
                    getDocs(qReplies)
                ]);

                const combined = [
                    ...processDocs(snapComments.docs),
                    ...processDocs(snapReplies.docs)
                ].sort((a, b) => {
                    const timeA = a.createdAt?.toMillis?.() || 0;
                    const timeB = b.createdAt?.toMillis?.() || 0;
                    return timeB - timeA;
                });

                setComments(combined);
                setLastCommentDoc(snapComments.docs[snapComments.docs.length - 1] || null);
                setLastReplyDoc(snapReplies.docs[snapReplies.docs.length - 1] || null);
                setHasMore(snapComments.docs.length === PAGE_SIZE || snapReplies.docs.length === PAGE_SIZE);
                setLoading(false);
            } catch (error) {
                console.error("Error loading user comments:", error);
                setLoading(false);
            }
        };

        loadInitialComments();
    }, [userId]);

    // Load more
    const loadMore = async () => {
        if (!userId || !hasMore || isLoadingMore) return;

        try {
            setIsLoadingMore(true);

            const queries = [];
            if (lastCommentDoc) {
                queries.push(getDocs(query(
                    collectionGroup(db, "comments"),
                    where("authorUid", "==", userId),
                    orderBy("createdAt", "desc"),
                    startAfter(lastCommentDoc),
                    limit(PAGE_SIZE)
                )));
            } else {
                queries.push(Promise.resolve({ docs: [] }));
            }

            if (lastReplyDoc) {
                queries.push(getDocs(query(
                    collectionGroup(db, "replies"),
                    where("authorUid", "==", userId),
                    orderBy("createdAt", "desc"),
                    startAfter(lastReplyDoc),
                    limit(PAGE_SIZE)
                )));
            } else {
                queries.push(Promise.resolve({ docs: [] }));
            }

            const [snapComments, snapReplies] = await Promise.all(queries);

            const newItems = [
                ...processDocs((snapComments as any).docs),
                ...processDocs((snapReplies as any).docs)
            ].sort((a, b) => {
                const timeA = a.createdAt?.toMillis?.() || 0;
                const timeB = b.createdAt?.toMillis?.() || 0;
                return timeB - timeA;
            });

            setComments((prev) => [...prev, ...newItems]);
            if ((snapComments as any).docs.length > 0) {
                setLastCommentDoc((snapComments as any).docs[(snapComments as any).docs.length - 1]);
            }
            if ((snapReplies as any).docs.length > 0) {
                setLastReplyDoc((snapReplies as any).docs[(snapReplies as any).docs.length - 1]);
            }
            setHasMore((snapComments as any).docs.length === PAGE_SIZE || (snapReplies as any).docs.length === PAGE_SIZE);
            setIsLoadingMore(false);
        } catch (error) {
            console.error("Error loading more comments:", error);
            setIsLoadingMore(false);
        }
    };

    return {
        comments,
        loading,
        hasMore,
        loadMore,
        isLoadingMore,
    };
}
