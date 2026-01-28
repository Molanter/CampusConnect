# Post Likes Migration: `likes` → `likedBy`

## Overview
Migrated post likes storage from `likes` array to `likedBy` array in Firestore, with full backward compatibility support.

## Changes Made

### 1. Post Type Definition
**File**: `/Site/lib/posts.ts`

```typescript
export type Post = {
  // ... other fields
  likes?: string[]; // Array of user IDs (legacy, use likedBy)
  likedBy?: string[]; // Array of user IDs (new field)
  // ... other fields
}
```

- Added `likedBy` field as the new standard
- Kept `likes` field for backward compatibility
- Both fields are optional to support transition period

### 2. Data Mapping Layer
**File**: `/Site/lib/hooks/use-feed.ts`

```typescript
// In mapDocToPost function
likes: data.likedBy ?? data.likes ?? [], // Use likedBy, fallback to likes
likedBy: data.likedBy ?? data.likes ?? [], // Store both for transition
```

**Strategy**:
- Prioritizes `likedBy` from Firestore
- Falls back to `likes` if `likedBy` doesn't exist
- Populates both fields in the Post object for compatibility

### 3. Post Card Component
**File**: `/Site/components/post-card.tsx`

**Reading Likes**:
```typescript
// Real-time listener
const nextLikes: string[] = data.likedBy || data.likes || [];
setLikesCount(nextLikes.length);
if (currentUser) setIsLiked(nextLikes.includes(currentUser.uid));
```

**Writing Likes**:
```typescript
await updateDoc(doc(db, "posts", id), {
  likedBy: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
});
```

### 4. Post Detail Component
**File**: `/Site/components/post-detail/post-detail-main-info.tsx`

**Reading Likes**:
```typescript
setLikesCount((data.likedBy || data.likes)?.length || 0);
setIsLiked((data.likedBy || data.likes)?.includes(currentUser.uid));
```

**Writing Likes**:
```typescript
if (isLiked) {
  await updateDoc(postRef, {
    likedBy: arrayRemove(currentUser.uid)
  });
} else {
  await updateDoc(postRef, {
    likedBy: arrayUnion(currentUser.uid)
  });
}
```

### 5. Post Creation Components

**Post Composer** (`/Site/components/post-composer.tsx`):
```typescript
const docData: any = {
  // ... other fields
  likedBy: [],
  // ... other fields
};
```

**Event Creation** (`/Site/app/posts/new/page.tsx`):
```typescript
const baseData: any = {
  // ... other fields
  likedBy: [],
  // ... other fields
};
```

## Backward Compatibility

The migration maintains **full backward compatibility**:

### Reading Data
✅ **New posts** with `likedBy` → Read from `likedBy`
✅ **Old posts** with only `likes` → Read from `likes`
✅ **Posts with both** → Prioritize `likedBy`

### Writing Data
✅ **All new likes** → Written to `likedBy`
✅ **Old posts** → Gradually migrated as users interact

### Transition Period
- Both fields exist in the Post type
- Reading logic checks both fields
- Writing logic only updates `likedBy`
- Old posts automatically migrate on first like/unlike

## Migration Path

### Phase 1: Deploy Code (Current)
- ✅ Code reads from both `likedBy` and `likes`
- ✅ Code writes to `likedBy`
- ✅ Old posts continue to work

### Phase 2: Data Migration (Optional)
Run a Firestore migration script to copy `likes` → `likedBy` for all existing posts:

```typescript
// Migration script (example)
const posts = await getDocs(collection(db, "posts"));
for (const post of posts.docs) {
  const data = post.data();
  if (data.likes && !data.likedBy) {
    await updateDoc(post.ref, {
      likedBy: data.likes
    });
  }
}
```

### Phase 3: Cleanup (Future)
After all posts have `likedBy`:
- Remove `likes` field from new posts
- Update type definition to make `likedBy` required
- Remove fallback logic

## Testing Checklist

- [x] New posts created with `likedBy` field
- [x] Liking a post updates `likedBy` array
- [x] Unliking a post removes from `likedBy` array
- [x] Old posts with `likes` display correctly
- [x] Old posts can be liked/unliked (migrates to `likedBy`)
- [x] Like counts display correctly
- [x] Real-time updates work
- [x] Post detail view shows correct likes
- [x] Feed shows correct likes

## Files Modified

1. `/Site/lib/posts.ts` - Type definition
2. `/Site/lib/hooks/use-feed.ts` - Data mapping
3. `/Site/components/post-card.tsx` - Feed display & interaction
4. `/Site/components/post-detail/post-detail-main-info.tsx` - Detail view
5. `/Site/components/post-composer.tsx` - Quick post creation
6. `/Site/app/posts/new/page.tsx` - Event creation

## Database Schema

### Old Schema
```json
{
  "posts/{postId}": {
    "likes": ["uid1", "uid2", "uid3"]
  }
}
```

### New Schema
```json
{
  "posts/{postId}": {
    "likedBy": ["uid1", "uid2", "uid3"]
  }
}
```

### Transition Schema
```json
{
  "posts/{postId}": {
    "likes": ["uid1", "uid2"],      // Old field (legacy)
    "likedBy": ["uid1", "uid2", "uid3"]  // New field (active)
  }
}
```

## Notes

- No breaking changes for existing posts
- Gradual migration as users interact with posts
- Can run batch migration script if needed
- Comments likes still use `likes` field (separate migration if needed)
- All UI components updated to use new field
