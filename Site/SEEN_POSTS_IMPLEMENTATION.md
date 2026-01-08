# Seen Posts Implementation - Technical Documentation

## Overview
This implementation replaces the array-based `posts.seenBy[]` approach with a scalable subcollection-based architecture that minimizes Firestore reads/writes and ensures exactly-once semantics.

## Architecture

### Data Model

#### Old (Deprecated)
```
posts/{postId}
  - seenBy: string[] // ❌ Causes hot writes, limited to 1MB
```

#### New (Current)
```
users/{uid}/seenPosts/{postId}
  - seenAt: Timestamp
  - campusId: string

posts/{postId}
  - seenCount: number  // Atomic counter
```

## Components

### 1. Core Functions

#### `markPostSeenOnce(params)`
**File:** `lib/seen/markPostSeenOnce.ts`

Transaction-based function ensuring exactly-once semantics:
- Reads `users/{uid}/seenPosts/{postId}`
- If exists → no-op (returns `{ didWrite: false }`)
- If missing → creates seen record + increments `seenCount`

**Cost:** 2 reads + 2 writes per unique user-post combination
**Deduplication:** Built-in via transaction check

#### `seen-cache.ts`
**File:** `lib/seen/seen-cache.ts`

Two-tier caching system:
1. **Session cache** (in-memory Set) - Ultra-fast, cleared on reload
2. **localStorage cache** (7-day TTL) - Persists across sessions

**Functions:**
- `isPostSeenInCache(uid, postId)` - Check if cached
- `markPostSeenInCache(uid, postId)` - Add to cache
- `bulkMarkSeenInCache(uid, postIds[])` - Populate after Firestore load
- `clearSeenCache(uid)` - Clear on logout

**Cost Savings:** Prevents redundant Firestore reads/writes for already-seen posts

### 2. React Hooks

#### `useSeenPosts(uid, campusId?)`
**File:** `lib/hooks/useSeenPosts.ts`

Bulk-loads user's seen posts on mount:
- Query: `users/{uid}/seenPosts` ordered by `seenAt desc`, limit 2000
- Optional campus filter via `where('campusId', '==', campusId)`
- Returns: `Set<string>` of seen post IDs
- Side effect: Populates localStorage cache

**Cost:** 1 read per seen post (up to 2000), runs ONCE per session

#### `useSeenTracker(config)`
**File:** `lib/hooks/useSeenTracker.ts`

Tracks post visibility with IntersectionObserver:
- **Threshold:** 0.5 (post 50% visible)
- **Debounce:** 600ms (prevents marking during quick scrolls)
- **Cache check:** Skips if already in cache
- **Session guard:** `hasTriggeredRef` prevents double-marking

**Returns:** `containerRef` to attach to post container

**Cost:** 0 reads/writes if cached, 2 reads + 2 writes if new

### 3. Component Updates

#### PostCard
**File:** `components/post-card.tsx`

- **Removed:** Old `seenBy` tracking effect
- **Added:** `useSeenTracker` hook
- **Ref:** Passed to main container div

#### HomePage (Feed)
**File:** `app/page.tsx`

- **Added:** `useSeenPosts` hook to load seen IDs
- **Filter logic:** Uses `seenPostIds.has(post.id)` instead of `seenBy.includes(uid)`
- **UI:** Separates unseen/seen posts with "You're all caught up" spacer

## Firestore Costs Analysis

### Scenario: User scrolls feed with 50 posts

#### Old Implementation (seenBy array)
- **Per post seen:** 1 read (to get current seenBy) + 1 write (arrayUnion)
- **Total for 50 posts:** 50 reads + 50 writes = **100 operations**
- **Issues:**
  - Hot document (posts gets many writes)
  - Re-marks posts on reload (no persistence)
  - Array size limits (1MB document)

#### New Implementation (subcollection)
- **Initial load:** 1 query for seen posts (~2000 docs = 2000 reads) ← ONCE per session
- **Marking unseenseen posts (assume 30 new):**
  - Per post: 1 read (check if exists) + 2 writes (seen doc + seenCount)
  - Total: 30 reads + 60 writes = **90 operations**
- **Cached posts (assume 20 already seen):** **0 operations**
- **Session total:** 2000 + 90 = **2090 operations** (first session)
- **Subsequent sessions with cache:** **90 operations** (only new posts)

#### Long-term savings
After initial load, subsequent sessions benefit from cache:
- **With cache hit rate of 80%:** 10 new posts → 30 operations
- **vs. Old:** 50 operations every time

### Read/Write Optimization Summary

| Operation | Old (seenBy) | New (subcollection) | Savings |
|-----------|--------------|---------------------|---------|
| Check if seen | O(n) array scan | O(1) Set lookup | ✅ Faster |
| Mark as seen | Hot write to post | Isolated write to user doc | ✅ Scalable |
| Reload behavior | Re-marks everything | Cache prevents re-marking | ✅ Massive |
| Concurrent users | Array contention | Isolated transactions | ✅ Safe |

## Security

### Firestore Rules
**File:** `firestore.rules.seen.example`

Key protections:
1. Users can only create/read their own `seenPosts/*` docs
2. Once created, seenPosts docs cannot be updated/deleted
3. `seenCount` can only increment by +1 (prevents abuse)
4. Post creation must set `seenCount: 0`

### Optional: Cloud Function (Recommended for production)
Move `seenCount` increment to server-side:

```javascript
exports.onSeenPostCreated = functions.firestore
  .document('users/{uid}/seenPosts/{postId}')
  .onCreate(async (snap, context) => {
    const { postId } = context.params;
    const postRef = admin.firestore().doc(`posts/${postId}`);
    await postRef.update({
      seenCount: admin.firestore.FieldValue.increment(1)
    });
  });
```

**Benefits:**
- Guaranteed exactly-once increment
- Client can't manipulate seenCount
- Simpler client rules

## Migration Guide

### Phase 1: Deploy new code
1. ✅ Deploy files created in this implementation
2. ✅ Update Firestore rules
3. New posts get `seenCount: 0`
4. Old posts still have `seenBy` (ignored)

### Phase 2: User adoption
- Users naturally create `seenPosts` docs as they browse
- No data migration needed
- Old `seenBy` can remain (unused)

### Phase 3: Cleanup (optional, after 90 days)
```javascript
// Firestore Admin SDK - remove old seenBy fields
const posts = await admin.firestore().collection('posts').get();
const batch = admin.firestore().batch();
posts.docs.forEach(doc => {
  batch.update(doc.ref, { seenBy: admin.firestore.FieldValue.delete() });
});
await batch.commit();
```

## Testing Checklist

- [ ] User sees a post → `seenPosts` doc created
- [ ] `seenCount` increments from 0 → 1
- [ ] Refresh page → post appears in "seen" section
- [ ] No duplicate writes on scroll up/down
- [ ] localStorage cache persists across tabs
- [ ] Offline → online reconnect doesn't duplicate

## Performance Monitoring

Add to your analytics:
```typescript
// In markPostSeenOnce
console.log('[Seen Tracking] Stats:', {
  didWrite: result.didWrite,
  cacheHit: !result.didWrite,
  timestamp: Date.now()
});
```

Track metrics:
- Cache hit rate (should be >80% after initial session)
- Average marks per session (should decrease over time)
- Transaction failures (should be <1%)

## Support

For issues or questions, check:
1. Browser console for `[Seen Tracker]` logs
2. Firestore console > `users/{uid}/seenPosts` for created docs
3. Post documents > `seenCount` field

## License
Part of CampusConnect codebase
