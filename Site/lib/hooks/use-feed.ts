import { useState, useEffect, useCallback, useRef } from "react";
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
const mapDocToPost = (doc: QueryDocumentSnapshot<DocumentData>): Post => {
    const data = doc.data();
    return {
        id: doc.id,
        title: data.title ?? (data.isEvent ? "Untitled Event" : undefined),
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
    } as Post;
};

export function useFeed(user: any) {
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
    const getTodayStr = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    const todayStr = getTodayStr();

    const fetchPosts = useCallback(async (isInitial = false) => {
        if (!user) return;
        try {
            setLoading(true);
            setError(null);

            const postsRef = collection(db, "posts");
            let newPosts: Post[] = [];
            let lastVisible: QueryDocumentSnapshot<DocumentData> | null = null;
            let hitEndOfMainFeed = false;

            if (isInitial) {
                // --- 1. Fetch Today's Events (Only on initial load) ---
                const todayQuery = query(
                    postsRef,
                    where("isEvent", "==", true),
                    where("date", "==", todayStr),
                    orderBy("createdAt", "desc") // Sort today's events by creation too? Or start time? Defaulting to creation for now or whatever index is easier.
                    // Note: multiple inequality/equality might need composite index.
                    // valid: isEvent==true, date==todayStr, orderBy date (redundant), orderBy createdAt
                );

                // --- 2. Fetch Initial Batch of Main Feed ---
                // We want everything NOT today (or duplicates handled in code) and NOT expired.
                // It's hard to exclude "today" AND "expired" in one query with 'createdAt' sort.
                // Strategy: Query by createdAt desc. Filter client-side.
                // We probably need to fetch slightly more to account for filtering.
                const feedQuery = query(
                    postsRef,
                    orderBy("createdAt", "desc"),
                    limit(POSTS_PER_PAGE * 2) // Fetch extra to handle filtering
                );

                const [todaySnap, feedSnap] = await Promise.all([
                    getDocs(todayQuery),
                    getDocs(feedQuery)
                ]);

                const todayItems = todaySnap.docs.map(mapDocToPost);

                // Filter feed items
                const feedItemsRaw = feedSnap.docs.map(doc => ({ post: mapDocToPost(doc), doc }));
                const validFeedItems = feedItemsRaw.filter(({ post }) => {
                    // Exclude if it's already in todayItems
                    if (post.date === todayStr && post.isEvent) return false;
                    // Exclude if it's expired (date < todayStr)
                    if (post.isEvent && post.date && post.date < todayStr) return false;
                    return true;
                });

                // Combine
                // Take only POSTS_PER_PAGE from the valid feed items to start? Or just dump them all?
                // Let's take up to POSTS_PER_PAGE
                const initialFeedPortion = validFeedItems.slice(0, POSTS_PER_PAGE);

                newPosts = [...todayItems, ...initialFeedPortion.map(x => x.post)];

                // Set lastDoc for pagination
                // If we used some feed items, the cursor is the last one we used.
                if (initialFeedPortion.length > 0) {
                    lastVisible = initialFeedPortion[initialFeedPortion.length - 1].doc;
                } else {
                    // If no feed items found (or all filtered out), we might need to fetch more immediately or switch to expired.
                    // For simplicity, if we got nothing valid, we mark main feed done?
                    // Actually, if existing feed is empty, we might just be done with main feed.
                    if (feedSnap.empty) {
                        hitEndOfMainFeed = true;
                    } else {
                        // We fetched docs but filtered them all out? 
                        // We should probably optimize this, but for now, let's just use the last fetched doc as cursor
                        // even if we didn't show it, so we can move forward.
                        lastVisible = feedSnap.docs[feedSnap.docs.length - 1];
                    }
                }

                setIsBrowsingExpired(false);
                setPosts(newPosts);

            } else {
                // --- Load More ---
                if (isBrowsingExpired) {
                    // Fetching Expired
                    const expiredQuery = query(
                        postsRef,
                        where("isEvent", "==", true),
                        where("date", "<", todayStr),
                        orderBy("date", "desc"),
                        startAfter(lastDocRef.current),
                        limit(POSTS_PER_PAGE)
                    );
                    const snap = await getDocs(expiredQuery);
                    if (!snap.empty) {
                        newPosts = snap.docs.map(mapDocToPost);
                        lastVisible = snap.docs[snap.docs.length - 1];
                    } else {
                        setHasMore(false);
                    }
                } else {
                    // Fetching Main Feed
                    // Use current cursor
                    if (!lastDocRef.current) {
                        // Should not happen if isInitial was false, unless main feed was empty initially
                        hitEndOfMainFeed = true;
                    } else {
                        const nextQuery = query(
                            postsRef,
                            orderBy("createdAt", "desc"),
                            startAfter(lastDocRef.current),
                            limit(POSTS_PER_PAGE * 2)
                        );
                        const snap = await getDocs(nextQuery);

                        if (snap.empty) {
                            hitEndOfMainFeed = true;
                        } else {
                            const itemsRaw = snap.docs.map(doc => ({ post: mapDocToPost(doc), doc }));
                            // Filter
                            const validItems = itemsRaw.filter(({ post }) => {
                                if (post.date === todayStr && post.isEvent) return false; // Already shown at top
                                if (post.isEvent && post.date && post.date < todayStr) return false; // Expired
                                return true;
                            });
                            // Note: We scan through the *entire* batch for cursor progression
                            lastVisible = snap.docs[snap.docs.length - 1];

                            newPosts = validItems.map(x => x.post);
                        }
                    }
                }
            }

            // Handle transition to Expired if Main Feed finished
            if (hitEndOfMainFeed && !isBrowsingExpired) {
                console.log("Main feed finished. Switching to Expired events.");
                setIsBrowsingExpired(true);
                // Important: We do NOT set cursor here for the next phase.
                // We want the expired query to start from the top (closest to today).
                // So we must clear the cursor so the 'expired' block doesn't use the 'main feed' cursor.
                // However, we can't clear it here effectively if we want to "continue" immediately?
                // Actually, if we switch phase, the next "Load More" click/trigger will call fetchPosts.
                // It will see isBrowsingExpired=true.
                // It will try to use lastDocRef.current.
                // We must invalidate lastDocRef.current if it belongs to the previous phase!
                lastDocRef.current = null;

                if (newPosts.length === 0) {
                    // Try to verify if there are any expired events immediately so we don't show "End of results" prematurely
                    // But for simplicity/stability, let's just let the user hit "load more" again or let the observer trigger again.
                    // The observer might stop if 'hasMore' is true but no posts added? 
                    // No, if newPosts=0, observer stays intersecting?
                    // Let's force a re-fetch of expired immediately if main feed yielded 0?
                    // For now, let's trust the observer to trigger again if we returned 0 posts but hasMore=true.
                    // To ensure observer triggers, we might need a tiny timeout or just rely on react.
                }
            }

            if (lastVisible) {
                console.log("Setting cursor to:", lastVisible.id, "Has Date:", lastVisible.data().date);
                lastDocRef.current = lastVisible;
            }

            if (!isInitial) {
                setPosts(prev => {
                    const existingIds = new Set(prev.map(p => p.id));
                    const uniqueNew = newPosts.filter(p => !existingIds.has(p.id));
                    console.log(`Adding ${uniqueNew.length} new posts (${newPosts.length - uniqueNew.length} duplicates filtered)`);
                    return [...prev, ...uniqueNew];
                });
            } else {
                setPosts(newPosts);
            }

        } catch (err: any) {
            console.error("Error loading posts", err);
            setError(err?.message || "Could not load posts.");
        } finally {
            setLoading(false);
        }
    }, [user, isBrowsingExpired, todayStr]);

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
