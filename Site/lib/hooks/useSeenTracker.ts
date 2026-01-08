import { useEffect, useRef } from "react";
import { markPostSeenOnce } from "../seen/markPostSeenOnce";
import { isPostSeenInCache, markPostSeenInCache } from "../seen/seen-cache";

interface UseSeenTrackerParams {
    postId: string;
    uid: string | null;
    campusId: string | null;
    isPreview?: boolean;
    threshold?: number;
    debounceMs?: number;
}

// Global rate limiter: max 60 marks per minute
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const markTimestamps: number[] = [];

function checkRateLimit(): boolean {
    const now = Date.now();

    // Remove timestamps older than 1 minute
    while (markTimestamps.length > 0 && markTimestamps[0] < now - RATE_LIMIT_WINDOW_MS) {
        markTimestamps.shift();
    }

    // Check if under limit
    if (markTimestamps.length >= RATE_LIMIT_MAX) {
        console.warn("[Seen Tracker] Rate limit exceeded (60/min), skipping mark");
        return false;
    }

    markTimestamps.push(now);
    return true;
}

/**
 * Hook to track when a post becomes visible and mark it as seen
 * 
 * Features:
 * - IntersectionObserver with configurable threshold
 * - 600ms debounce to avoid marking during quick scrolls
 * - Cache check (localStorage + session) to prevent duplicate writes
 * - Rate limiting (60 marks per minute) to prevent runaway loops
 * - Session-based deduplication
 * 
 * @param params - Configuration for seen tracking
 * @returns ref to attach to the post container
 */
export function useSeenTracker({
    postId,
    uid,
    campusId,
    isPreview = false,
    threshold = 0.5,
    debounceMs = 600,
}: UseSeenTrackerParams) {
    const containerRef = useRef<HTMLDivElement>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const hasTriggeredRef = useRef(false);
    const observerRef = useRef<IntersectionObserver | null>(null);

    useEffect(() => {
        // Don't track in preview mode or if missing required data
        if (!postId || !uid || !campusId || isPreview) return;

        // Check cache FIRST (before creating observer)
        // This includes both localStorage and session cache
        if (isPostSeenInCache(uid, postId) || hasTriggeredRef.current) {
            return;
        }

        const element = containerRef.current;
        if (!element) return;

        const handleIntersection = (entries: IntersectionObserverEntry[]) => {
            const entry = entries[0];

            if (!entry.isIntersecting) {
                // Clear debounce if scrolling away
                if (debounceTimerRef.current) {
                    clearTimeout(debounceTimerRef.current);
                    debounceTimerRef.current = null;
                }
                return;
            }

            // Post is visible - debounce before marking
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }

            debounceTimerRef.current = setTimeout(async () => {
                // Double-check we haven't already marked (cache might have updated)
                if (hasTriggeredRef.current || isPostSeenInCache(uid, postId)) {
                    return;
                }

                // Check rate limit
                if (!checkRateLimit()) {
                    return;
                }

                hasTriggeredRef.current = true;

                console.log(`[Seen Tracker] Marking post ${postId} as seen`);

                // Mark in cache immediately (optimistic)
                markPostSeenInCache(uid, postId);

                // Write to Firestore (Cloud Function will increment seenCount)
                const result = await markPostSeenOnce({ uid, postId, campusId });

                if (!result.didWrite && result.error) {
                    console.warn(`[Seen Tracker] Failed to mark post ${postId}:`, result.error);
                    // Don't clear hasTriggeredRef - we still don't want to retry
                }

                // Disconnect observer after successful mark
                if (observerRef.current) {
                    observerRef.current.disconnect();
                }
            }, debounceMs);
        };

        // Create observer only once
        if (!observerRef.current) {
            observerRef.current = new IntersectionObserver(handleIntersection, {
                threshold,
                rootMargin: "0px",
            });
        }

        if (observerRef.current) {
            observerRef.current.observe(element);
        }

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
                observerRef.current = null; // Clear ref to prevent stale observer reuse
            }
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [postId, uid, campusId, isPreview, threshold, debounceMs]);

    return containerRef;
}
