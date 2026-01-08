/**
 * Two-tier cache for seen posts:
 * 1. In-memory Set for current session (fast, volatile)
 * 2. localStorage with TTL for cross-session persistence
 */

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const STORAGE_KEY_PREFIX = "seenPostsCache:";

interface SeenPostEntry {
    timestamp: number;
}

interface SeenPostsCache {
    [postId: string]: SeenPostEntry;
}

// In-memory cache (per session)
const sessionCache = new Set<string>();

/**
 * Get localStorage key for a specific user
 */
function getStorageKey(uid: string): string {
    return `${STORAGE_KEY_PREFIX}${uid}`;
}

/**
 * Load seen posts from localStorage
 */
function loadFromLocalStorage(uid: string): SeenPostsCache {
    if (typeof window === "undefined") return {};

    try {
        const key = getStorageKey(uid);
        const data = localStorage.getItem(key);
        if (!data) return {};

        const cache: SeenPostsCache = JSON.parse(data);
        const now = Date.now();

        // Filter out expired entries
        const fresh: SeenPostsCache = {};
        for (const [postId, entry] of Object.entries(cache)) {
            if (now - entry.timestamp < CACHE_TTL_MS) {
                fresh[postId] = entry;
            }
        }

        return fresh;
    } catch (error) {
        console.error("Error loading seen cache:", error);
        return {};
    }
}

/**
 * Save seen posts to localStorage
 */
function saveToLocalStorage(uid: string, cache: SeenPostsCache): void {
    if (typeof window === "undefined") return;

    try {
        const key = getStorageKey(uid);
        localStorage.setItem(key, JSON.stringify(cache));
    } catch (error) {
        console.error("Error saving seen cache:", error);
    }
}

/**
 * Check if a post is marked as seen in cache
 */
export function isPostSeenInCache(uid: string, postId: string): boolean {
    // Check session cache first (fastest)
    if (sessionCache.has(postId)) {
        return true;
    }

    // Check localStorage
    const cache = loadFromLocalStorage(uid);
    const entry = cache[postId];

    if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
        // Promote to session cache
        sessionCache.add(postId);
        return true;
    }

    return false;
}

/**
 * Mark a post as seen in cache
 */
export function markPostSeenInCache(uid: string, postId: string): void {
    // Add to session cache
    sessionCache.add(postId);

    // Add to localStorage
    const cache = loadFromLocalStorage(uid);
    cache[postId] = { timestamp: Date.now() };
    saveToLocalStorage(uid, cache);
}

/**
 * Bulk add seen posts to cache (used after loading from Firestore)
 */
export function bulkMarkSeenInCache(uid: string, postIds: string[]): void {
    const cache = loadFromLocalStorage(uid);
    const timestamp = Date.now();

    postIds.forEach(postId => {
        sessionCache.add(postId);
        cache[postId] = { timestamp };
    });

    saveToLocalStorage(uid, cache);
}

/**
 * Clear cache for a user (e.g., on logout)
 */
export function clearSeenCache(uid: string): void {
    sessionCache.clear();

    if (typeof window !== "undefined") {
        try {
            localStorage.removeItem(getStorageKey(uid));
        } catch (error) {
            console.error("Error clearing seen cache:", error);
        }
    }
}

/**
 * Get all cached seen post IDs for current session
 */
export function getSessionSeenPosts(): Set<string> {
    return new Set(sessionCache);
}
