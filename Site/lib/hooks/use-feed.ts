import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    startAfter,
    DocumentData,
    QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../firebase"; // Assuming firebase.ts is in lib/
import { Post } from "../posts"; // Assuming posts.ts is in lib/

const POSTS_PER_PAGE = 15;

// Map Firestore doc to Post type
export const mapDocToPost = (doc: QueryDocumentSnapshot<DocumentData>): Post => {
    const data = doc.data();

    if (data.clubId || data.club_id || data.communityId || data.hostClubId) {
        console.log(`[useFeed Debug] Mapping post ${doc.id} with club data:`, {
            clubId: data.clubId,
            club_id: data.club_id,
            communityId: data.communityId,
            hostClubId: data.hostClubId,
            raw: data
        });
    }

    return {
        id: doc.id,
        title: data.title,
        content: data.content ?? data.description ?? "",
        imageUrls: (Array.isArray(data.imageUrls) ? data.imageUrls : null) ?? (data.imageUrl ? [data.imageUrl] : []),
        isEvent: data.isEvent ?? true,
        date: data.date ?? undefined,
        startTime: data.startTime ?? undefined,
        endTime: data.endTime ?? undefined,
        locationLabel: data.locationLabel ?? undefined,
        coordinates: data.coordinates ?? undefined,
        authorId: data.authorId ?? data.hostUserId ?? "",
        authorName: data.authorName ?? data.hostDisplayName ?? "Unknown",
        authorUsername: data.authorUsername ?? data.hostUsername,
        authorAvatarUrl: data.authorAvatarUrl ?? data.hostPhotoURL,
        likes: data.likes ?? [],
        createdAt: data.createdAt,
        editCount: data.editCount ?? 0,

        // Pass other fields if strictly needed by Post type
        goingUids: data.goingUids,
        maybeUids: data.maybeUids,
        notGoingUids: data.notGoingUids,

        // Club info
        clubId: data.clubId,
        clubName: data.clubName,
        clubAvatarUrl: data.clubAvatarUrl,

        // Moderation fields
        visibility: data.visibility,
        reportCount: data.reportCount,
        reportedAt: data.reportedAt,
        hiddenAt: data.hiddenAt,
        hiddenBy: data.hiddenBy,
        moderationNote: data.moderationNote,
        ownerUid: data.ownerUid ?? data.authorId,
    } as Post;
};

// Helper to filter posts by visibility
// Shows posts that are either "visible" OR don't have a visibility field (legacy posts)
// Shows "under_review" posts only to the owner
// Hides "hidden" posts from everyone
export const shouldShowPostInFeed = (post: Post, currentUserUid?: string): boolean => {
    // If no visibility field, it's a legacy post - show it
    if (!post.visibility) return true;

    // Always show visible posts
    if (post.visibility === "visible") return true;

    // Show under_review posts only to the owner
    if (post.visibility === "under_review" && currentUserUid && post.authorId === currentUserUid) {
        return true;
    }

    // Hide all other statuses (hidden, etc.)
    return false;
};

export function useFeed(user: any, targetUserId?: string) {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);

    // Keep track of the last doc for pagination
    const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

    // Phase tracking: 0 = Today+Main, 1 = Main Continued, 2 = Expired
    // Actually, simpler:
    // We'll have a flag 'browsingExpired' to switch query modes when main feed runs out.
    const [isBrowsingExpired, setIsBrowsingExpired] = useState(false);

    // Helper to format today YYYY-MM-DD in local time
    const memoizedTodayStr = useMemo(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }, []);

    const fetchPosts = useCallback(async (isInitial = false) => {
        if (!user) return;
        try {
            setLoading(true);
            setError(null);

            const fetchFromCollection = async (collName: string, cursor: QueryDocumentSnapshot<DocumentData> | null) => {
                const collRef = collection(db, collName);

                // todayDocs
                let todayDocs: QueryDocumentSnapshot<DocumentData>[] = [];
                if (isInitial) {
                    try {
                        // Simple query first to avoid index issues
                        let todayQ = query(
                            collRef,
                            where("isEvent", "==", true),
                            where("date", "==", memoizedTodayStr),
                            limit(50)
                        );

                        if (targetUserId) {
                            todayQ = query(todayQ, where("authorId", "==", targetUserId));
                        }

                        const snap = await getDocs(todayQ);
                        todayDocs = snap.docs;
                    } catch (e) {
                        console.warn(`[useFeed] Today query failed for ${collName}:`, e);
                    }
                }

                // mainDocs
                let feedSnap;
                try {
                    // Try with orderBy first (best UX)
                    let feedQ;
                    if (isInitial) {
                        feedQ = query(collRef, orderBy("createdAt", "desc"), limit(POSTS_PER_PAGE));
                    } else if (cursor) {
                        feedQ = query(collRef, orderBy("createdAt", "desc"), startAfter(cursor), limit(POSTS_PER_PAGE));
                    } else {
                        feedQ = query(collRef, orderBy("createdAt", "desc"), limit(POSTS_PER_PAGE));
                    }

                    if (targetUserId) {
                        feedQ = query(feedQ, where("authorId", "==", targetUserId));
                    }

                    feedSnap = await getDocs(feedQ);
                } catch (e: any) {
                    console.warn(`[useFeed] Main query with orderBy failed for ${collName}, falling back to simple query:`, e);
                    // Fallback: simple query (no orderBy)
                    let simpleQ;
                    if (isInitial) {
                        simpleQ = query(collRef, limit(POSTS_PER_PAGE * 2));
                    } else if (cursor) {
                        simpleQ = query(collRef, startAfter(cursor), limit(POSTS_PER_PAGE * 2));
                    } else {
                        simpleQ = query(collRef, limit(POSTS_PER_PAGE * 2));
                    }

                    if (targetUserId) {
                        simpleQ = query(simpleQ, where("authorId", "==", targetUserId));
                    }

                    feedSnap = await getDocs(simpleQ);
                }

                return { todayDocs, feedDocs: feedSnap.docs, empty: feedSnap.empty };
            };

            // 1. Try 'posts'
            let { todayDocs, feedDocs, empty } = await fetchFromCollection("posts", lastDocRef.current);

            // 2. Fallback to 'events' if no posts found at all on initial load
            if (isInitial && empty) {
                console.log("[useFeed] No data in 'posts', checking 'events' collection...");
                const fallback = await fetchFromCollection("events", null);
                todayDocs = fallback.todayDocs;
                feedDocs = fallback.feedDocs;
                empty = fallback.empty;
            }

            const todayPosts = todayDocs.map(mapDocToPost).filter(p => shouldShowPostInFeed(p, user.uid));
            const feedPostsRaw = feedDocs.map(doc => ({ post: mapDocToPost(doc), doc }));

            // Filter by visibility client-side to include legacy posts and owner's under_review posts
            const visibleFeedPosts = feedPostsRaw.filter(x => shouldShowPostInFeed(x.post, user.uid));

            // Deduplicate (Today's events might be in the feed too)
            const todayIds = new Set(todayPosts.map(p => p.id));
            const uniqueFeed = visibleFeedPosts.filter(x => !todayIds.has(x.post.id));

            let newPosts = [...todayPosts, ...uniqueFeed.map(x => x.post)];

            // Final safety filter: remove duplicates already in state if not initial
            if (!isInitial) {
                setPosts(prev => {
                    const existingIds = new Set(prev.map(p => p.id));
                    const uniqueNew = newPosts.filter(p => !existingIds.has(p.id));
                    return [...prev, ...uniqueNew];
                });
            } else {
                setPosts(newPosts);
            }

            if (feedDocs.length > 0) {
                lastDocRef.current = feedDocs[feedDocs.length - 1];
                setHasMore(true);
            } else {
                setHasMore(false);
            }

        } catch (err: any) {
            console.error("Error loading posts", err);
            setError(err?.message || "Could not load posts.");
        } finally {
            setLoading(false);
        }
    }, [user, memoizedTodayStr]);

    // Trigger initial fetch when user is available
    useEffect(() => {
        if (user?.uid) {
            // Reset state on user change
            setPosts([]);
            setHasMore(true);
            setIsBrowsingExpired(false);
            lastDocRef.current = null;
            // potential race condition if isBrowsingExpired was true, fetchPosts might be old version?
            // But we just set it false. React batches updates.
            // But fetchPosts is a useCallback depending on it.
            // It won't update immediately in this closure. 
            // We need to bypass the callback dependency issue or force a fresh fetch.
            // Actually, if we pass 'true' (isInitial), fetchPosts IGNORES isBrowsingExpired and does the Initial logic!
            // So safely calling the current version of fetchPosts(true) works fine.

            // However, we must ensure we don't loop. 
            // We remove fetchPosts from dependency array and depend only on user.uid.
            fetchPosts(true);
        } else {
            setLoading(false);
        }
    }, [user?.uid]); // Removed fetchPosts dependency to prevent loop

    return { posts, loading, error, hasMore, fetchMore: () => fetchPosts(false), refresh: () => fetchPosts(true) };
}
