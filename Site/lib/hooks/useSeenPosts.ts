import { useState, useEffect } from "react";
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import { bulkMarkSeenInCache, getSessionSeenPosts } from "../seen/seen-cache";

const SEEN_POSTS_LIMIT = 500; // Reduced from 2000
const TIME_WINDOW_DAYS = 7; // Only load posts seen in last 7 days

export interface UseSeenPostsResult {
    seenPostIds: Set<string>;
    loading: boolean;
    error: string | null;
}

/**
 * Load user's seen posts from Firestore with optimizations:
 * - Filters by campus (reduces scope)
 * - Only loads posts seen in last 7 days (time window)
 * - Limits to 500 posts max
 * - Merges with localStorage cache
 * 
 * @param uid - Current user ID
 * @param campusId - Current campus ID (for filtering)
 * @returns Set of seen post IDs
 */
export function useSeenPosts(uid: string | null, campusId?: string): UseSeenPostsResult {
    const [seenPostIds, setSeenPostIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!uid) {
            setLoading(false);
            return;
        }

        let isMounted = true;

        async function loadSeenPosts() {
            try {
                setLoading(true);
                setError(null);

                // Start with session cache (already seen this session)
                const sessionSeen = getSessionSeenPosts();

                // Build Firestore query with filters
                const seenPostsRef = collection(db, `users/${uid}/seenPosts`);

                // Calculate time window (7 days ago)
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - TIME_WINDOW_DAYS);
                const timeWindowStart = Timestamp.fromDate(sevenDaysAgo);

                let q;
                if (campusId) {
                    // Filter by campus AND time window
                    q = query(
                        seenPostsRef,
                        where("campusId", "==", campusId),
                        where("seenAt", ">=", timeWindowStart),
                        orderBy("seenAt", "desc"),
                        limit(SEEN_POSTS_LIMIT)
                    );
                } else {
                    // Just time window (no campus filter)
                    q = query(
                        seenPostsRef,
                        where("seenAt", ">=", timeWindowStart),
                        orderBy("seenAt", "desc"),
                        limit(SEEN_POSTS_LIMIT)
                    );
                }

                const snapshot = await getDocs(q);

                if (!isMounted) return;

                const firestorePostIds = snapshot.docs.map(doc => doc.id);

                // Merge Firestore results with session cache
                const combinedSeen = new Set([...sessionSeen, ...firestorePostIds]);

                setSeenPostIds(combinedSeen);

                // Populate localStorage cache for cross-session persistence
                if (uid) {
                    bulkMarkSeenInCache(uid, firestorePostIds);
                }

            } catch (err: any) {
                console.error("Error loading seen posts:", err);
                if (isMounted) {
                    setError(err?.message || "Failed to load seen posts");
                    // Fallback to session cache only
                    setSeenPostIds(getSessionSeenPosts());
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        loadSeenPosts();

        return () => {
            isMounted = false;
        };
    }, [uid, campusId]);

    return { seenPostIds, loading, error };
}
