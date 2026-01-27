# Post Display Data Migration - Using Direct Firestore Fields

## Overview
Migrated post display logic from fetching author/club/campus data by ID to using data stored directly in the post document. This improves performance by eliminating unnecessary Firestore reads.

---

## Problem Statement

**Before**: Posts stored only IDs, requiring additional Firestore queries:
- `authorId` → fetch from `users/{authorId}` for name, photo, username
- `clubId` → fetch from `clubs/{clubId}` for name, avatar
- `campusId` → fetch from `campuses/{campusId}` for name, logo

**After**: Posts store display data directly:
- `authorDisplayName`, `authorPhotoURL`, `authorUsername` stored in post
- `clubName`, `clubAvatarUrl` stored in post
- `campusName`, `campusAvatarUrl` stored in post
- `ownerName`, `ownerPhotoURL` for generic owner display

---

## Changes Made

### 1. Updated Post Type Definition
**File**: `/Site/lib/posts.ts`

```typescript
export type Post = {
    // Core Post fields
    authorId: string;
    authorName: string;
    authorUsername?: string;
    authorAvatarUrl?: string | null;
    
    // NEW: Display fields from Firestore
    authorDisplayName?: string;  // Display name from Firestore
    authorPhotoURL?: string;     // Photo URL from Firestore
    
    // NEW: Owner fields (for display)
    ownerName?: string;          // Owner's display name
    ownerPhotoURL?: string;      // Owner's photo URL

    // Club Branding
    clubId?: string;
    clubName?: string;           // Now used directly
    clubAvatarUrl?: string;      // Now used directly
    isVerified?: boolean;

    // Campus fields
    campusId?: string;
    campusName?: string;         // Now used directly
    campusAvatarUrl?: string;    // Now used directly
    
    // ... other fields
}
```

### 2. Updated Data Mapping
**File**: `/Site/lib/hooks/use-feed.ts`

```typescript
export const mapDocToPost = (doc: QueryDocumentSnapshot<DocumentData>): Post => {
    const data = doc.data();
    
    return {
        // ... coordinate and time conversions
        
        authorId: data.authorId ?? data.hostUserId ?? "",
        authorName: data.authorName ?? data.hostDisplayName ?? "Unknown",
        authorUsername: data.authorUsername ?? data.hostUsername,
        authorAvatarUrl: data.authorAvatarUrl ?? data.hostPhotoURL,
        
        // NEW: Map display fields from Firestore
        authorDisplayName: data.authorDisplayName,
        authorPhotoURL: data.authorPhotoURL,
        ownerName: data.ownerName,
        ownerPhotoURL: data.ownerPhotoURL,
        
        // ... rest of mapping
    } as Post;
};
```

### 3. Updated PostCard Component
**File**: `/Site/components/post-card.tsx`

**Removed**:
```typescript
// ❌ OLD: Fetch data by ID
import { useUserProfile } from "./user-profiles-context";
import { useClubProfile } from "./club-profiles-context";
import { useCampusProfile } from "./campus-profiles-context";

const profile = useUserProfile(authorId);
const clubProfile = useClubProfile(clubId);
const campusProfile = useCampusProfile(campusId);

const displayedName = profile?.displayName || "User";
const displayedPhotoUrl = profile?.photoURL || null;
const currentUsername = profile?.username;
```

**Added**:
```typescript
// ✅ NEW: Use data directly from post
const displayedName = post.authorDisplayName || post.ownerName || post.authorName || "User";
const displayedPhotoUrl = post.authorPhotoURL || post.ownerPhotoURL || post.authorAvatarUrl || null;
const currentUsername = post.authorUsername;
```

**Updated Rendering**:
```typescript
// Campus posts
{isCampusPost ? (
    <div className="h-10 w-10 flex items-center justify-center relative flex-shrink-0">
        {campusAvatarUrl ? (  // ✅ Direct from post
            <img src={campusAvatarUrl} alt={campusName} />
        ) : (
            <BuildingLibraryIcon />
        )}
    </div>
) : isClubPost ? (
    // Club posts
    <div className="h-10 w-10 flex items-center justify-center relative flex-shrink-0">
        {clubAvatarUrl ? (  // ✅ Direct from post
            <img src={clubAvatarUrl} alt={clubName || "Club"} />
        ) : (
            <div>{clubName ? clubName.charAt(0).toUpperCase() : "C"}</div>
        )}
    </div>
) : (
    // Personal posts
    <div className="h-10 w-10 overflow-hidden rounded-full">
        {displayedPhotoUrl ? (  // ✅ Direct from post
            <img src={displayedPhotoUrl} alt={displayedName} />
        ) : (
            <div>{displayedName.charAt(0).toUpperCase()}</div>
        )}
    </div>
)}
```

### 4. Updated PostDetailMainInfo Component
**File**: `/Site/components/post-detail/post-detail-main-info.tsx`

Same changes as PostCard:
- Removed profile fetching hooks
- Use data directly from post model
- Updated all rendering to use post fields

---

## Firestore Document Structure

### Example Post Document
```json
{
  "id": "post123",
  "type": "post",
  "ownerType": "personal",
  
  // Author/Owner Display Data (NEW)
  "authorId": "KDlX6UxIXwReCp2WSjNZ21f84z82",
  "authorDisplayName": "Edgars Yarmolatiy",
  "authorPhotoURL": "https://firebasestorage.googleapis.com/...",
  "authorUsername": "molanter",
  "ownerName": "Edgars Yarmolatiy",
  "ownerPhotoURL": "https://firebasestorage.googleapis.com/...",
  
  // Club Data (if club post)
  "clubId": "club123",
  "clubName": "Chess Club",
  "clubAvatarUrl": "https://...",
  "isVerified": true,
  
  // Campus Data (if campus post)
  "campusId": "7UD2B4W58PQ5yVI6CXR7",
  "campusName": "University of Minnesota",
  "campusAvatarUrl": "https://...",
  
  // Post Content
  "description": "Some example edited post here.",
  "imageUrls": [],
  "likedBy": [],
  "seenCount": 1,
  "visibility": "visible",
  "createdAt": "2026-01-20T22:26:53Z",
  "editedAt": "2026-01-20T23:09:19Z",
  "editCount": 1
}
```

---

## Benefits

### 1. **Performance Improvement**
- **Before**: 1 post read + 1-3 additional reads (author, club, campus)
- **After**: 1 post read only
- **Savings**: 50-75% reduction in Firestore reads

### 2. **Faster Rendering**
- No waiting for profile data to load
- Immediate display of names and photos
- No loading states needed

### 3. **Simplified Code**
- Removed 3 context providers from components
- Removed 3 hook calls per post
- Cleaner, more maintainable code

### 4. **Better Offline Support**
- All display data available immediately
- No dependency on additional network requests

### 5. **Reduced Costs**
- Fewer Firestore document reads
- Lower bandwidth usage

---

## Data Flow Comparison

### Before (Old Approach)
```
Firestore Post Document
         ↓
    Post Object
    (authorId, clubId, campusId)
         ↓
    Component Renders
         ↓
    useUserProfile(authorId)  ──→  Fetch users/{authorId}
    useClubProfile(clubId)    ──→  Fetch clubs/{clubId}
    useCampusProfile(campusId)──→  Fetch campuses/{campusId}
         ↓
    Display with fetched data
```

### After (New Approach)
```
Firestore Post Document
(includes authorDisplayName, clubName, etc.)
         ↓
    Post Object
    (all display data included)
         ↓
    Component Renders
         ↓
    Display immediately
```

---

## Migration Considerations

### Backward Compatibility
The code maintains backward compatibility with old posts:

```typescript
// Fallback chain for display name
const displayedName = 
    post.authorDisplayName ||  // NEW field (preferred)
    post.ownerName ||          // NEW field (alternative)
    post.authorName ||         // OLD field (fallback)
    "User";                    // Default

// Fallback chain for photo
const displayedPhotoUrl = 
    post.authorPhotoURL ||     // NEW field (preferred)
    post.ownerPhotoURL ||      // NEW field (alternative)
    post.authorAvatarUrl ||    // OLD field (fallback)
    null;                      // Default
```

### Data Consistency
When creating/editing posts, ensure all display fields are populated:

```typescript
// Example: Creating a post
const postData = {
    authorId: user.uid,
    authorDisplayName: user.displayName,
    authorPhotoURL: user.photoURL,
    authorUsername: user.username,
    ownerName: user.displayName,
    ownerPhotoURL: user.photoURL,
    // ... other fields
};
```

---

## Files Modified

1. **Type Definitions**:
   - `/Site/lib/posts.ts` - Added new display fields to Post type

2. **Data Mapping**:
   - `/Site/lib/hooks/use-feed.ts` - Map new fields from Firestore

3. **Components**:
   - `/Site/components/post-card.tsx` - Removed profile hooks, use direct data
   - `/Site/components/post-detail/post-detail-main-info.tsx` - Same changes

---

## Testing Checklist

- [x] Personal posts display correct name and photo
- [x] Club posts display correct club name and avatar
- [x] Campus posts display correct campus name and logo
- [x] Old posts without new fields still display (fallback works)
- [x] New posts with new fields display correctly
- [x] No console errors about missing data
- [x] Performance improved (fewer Firestore reads)

---

## Future Improvements

### 1. Data Denormalization Strategy
When user/club/campus data changes, update all related posts:
- User changes display name → Update all their posts
- Club changes avatar → Update all club posts
- Campus changes logo → Update all campus posts

### 2. Cloud Function for Updates
```typescript
// Example: Update posts when user profile changes
export const onUserProfileUpdate = functions.firestore
    .document('users/{userId}')
    .onUpdate(async (change, context) => {
        const newData = change.after.data();
        const userId = context.params.userId;
        
        // Update all posts by this user
        const postsSnapshot = await db.collection('posts')
            .where('authorId', '==', userId)
            .get();
        
        const batch = db.batch();
        postsSnapshot.docs.forEach(doc => {
            batch.update(doc.ref, {
                authorDisplayName: newData.displayName,
                authorPhotoURL: newData.photoURL,
                authorUsername: newData.username,
            });
        });
        
        await batch.commit();
    });
```

---

## Summary

✅ **Removed**: Profile fetching by ID (useUserProfile, useClubProfile, useCampusProfile)
✅ **Added**: Direct display fields in post documents
✅ **Result**: Faster rendering, fewer Firestore reads, simpler code
✅ **Compatibility**: Full backward compatibility with old posts
