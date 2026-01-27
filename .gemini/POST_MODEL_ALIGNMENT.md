# Post Model Alignment - Web ↔ iOS

## Overview
Updated the web Post model to match the iOS `PostDoc` struct, ensuring consistent data structure across platforms.

---

## iOS Model (Reference)

```swift
struct PostEventLogistics: Codable, Equatable {
    var startsAt: Date = Date()
    var locationLabel: String = ""
    var locationUrl: String = ""
    var lat: Double?
    var lng: Double?
    var goingUids: [String]?
    var maybeUids: [String]?
    var notGoingUids: [String]?
}

struct PostDoc: Identifiable, Codable, Equatable {
    let id: String

    // scope / ownership
    var ownerType: PostOwnerType
    var campusId: String
    var clubId: String?

    // main
    var description: String
    var authorId: String
    var type: PostType
    var imageUrls: [String]

    // ✅ denormalized display fields (snapshots)
    var ownerName: String?
    var ownerPhotoURL: String?
    var authorUsername: String?
    var authorDisplayName: String?
    var authorPhotoURL: String?

    // timestamps / edits
    var createdAt: Date?
    var editedAt: Date?
    var editCount: Int?

    // counters
    var commentsCount: Int?
    var repliesCommentsCount: Int?
    var seenCount: Int?

    // arrays
    var likedBy: [String]?

    // event-only
    var event: PostEventLogistics?
}
```

---

## Web Model (Updated)

```typescript
export type PostEventLogistics = {
    startsAt?: Date | any; // Timestamp
    locationLabel?: string;
    locationUrl?: string;
    lat?: number;
    lng?: number;
    // Attendance (event-only)
    goingUids?: string[];
    maybeUids?: string[];
    notGoingUids?: string[];
};

export type Post = {
    // Identity
    id: string;

    // Scope / Ownership
    ownerType: PostOwnerType;
    campusId: string;
    clubId?: string;

    // Main Content
    description: string;
    authorId: string;
    type: PostType;
    imageUrls: string[];

    // ✅ Denormalized display fields (snapshots)
    ownerName?: string;
    ownerPhotoURL?: string;
    authorUsername?: string;
    authorDisplayName?: string;
    authorPhotoURL?: string;

    // Timestamps / Edits
    createdAt?: Date | any; // Timestamp
    editedAt?: Date | any; // Timestamp
    editCount?: number;

    // Counters
    commentsCount?: number;
    repliesCommentsCount?: number;
    seenCount?: number;

    // Arrays
    likedBy?: string[];

    // Event-only (nested object)
    event?: PostEventLogistics;

    // ... legacy fields for backward compatibility
};
```

---

## Key Changes

### 1. **Nested Event Object**
**Before** (Flat structure):
```typescript
{
    type: "event",
    startsAt: "2026-01-25T18:00:00Z",
    locationLabel: "Student Union",
    lat: 44.9778,
    lng: -93.2650,
    goingUids: ["user1", "user2"],
    maybeUids: ["user3"],
    notGoingUids: []
}
```

**After** (Nested structure):
```typescript
{
    type: "event",
    event: {
        startsAt: "2026-01-25T18:00:00Z",
        locationLabel: "Student Union",
        lat: 44.9778,
        lng: -93.2650,
        goingUids: ["user1", "user2"],
        maybeUids: ["user3"],
        notGoingUids: []
    }
}
```

### 2. **Required vs Optional Fields**

**Required** (always present):
- `id`
- `ownerType`
- `campusId`
- `description`
- `authorId`
- `type`
- `imageUrls`

**Optional** (may be undefined):
- All display fields
- All timestamps
- All counters
- `event` object
- `clubId`

### 3. **Field Organization**

Organized into logical groups:
1. **Identity** - `id`
2. **Scope/Ownership** - `ownerType`, `campusId`, `clubId`
3. **Main Content** - `description`, `authorId`, `type`, `imageUrls`
4. **Display Fields** - Denormalized snapshots
5. **Timestamps** - `createdAt`, `editedAt`
6. **Counters** - likes, comments, views
7. **Arrays** - `likedBy`
8. **Event Data** - Nested `event` object
9. **Legacy Fields** - For backward compatibility

---

## Data Mapping

### mapDocToPost Function

```typescript
export const mapDocToPost = (doc: QueryDocumentSnapshot<DocumentData>): Post => {
    const data = doc.data();
    
    return {
        // === CORE FIELDS (match iOS PostDoc) ===
        id: doc.id,
        
        // Scope / Ownership
        ownerType: data.ownerType ?? (data.clubId ? "club" : "campus"),
        campusId: data.campusId ?? "",
        clubId: data.clubId,
        
        // Main Content
        description: data.description ?? data.content ?? "",
        authorId: data.authorId ?? "",
        type: data.type ?? "post",
        imageUrls: data.imageUrls ?? [],
        
        // ✅ Denormalized display fields
        ownerName: data.ownerName,
        ownerPhotoURL: data.ownerPhotoURL,
        authorUsername: data.authorUsername,
        authorDisplayName: data.authorDisplayName,
        authorPhotoURL: data.authorPhotoURL,
        
        // Timestamps / Edits
        createdAt: data.createdAt,
        editedAt: data.editedAt,
        editCount: data.editCount ?? 0,
        
        // Counters
        commentsCount: data.commentsCount,
        repliesCommentsCount: data.repliesCommentsCount,
        seenCount: data.seenCount ?? 0,
        
        // Arrays
        likedBy: data.likedBy ?? [],
        
        // Event-only (nested object)
        event: (data.type === "event") ? {
            startsAt: data.event?.startsAt ?? data.startsAt,
            locationLabel: data.event?.locationLabel ?? data.locationLabel,
            locationUrl: data.event?.locationUrl ?? data.locationUrl,
            lat: data.event?.lat ?? data.lat,
            lng: data.event?.lng ?? data.lng,
            goingUids: data.event?.goingUids ?? data.goingUids,
            maybeUids: data.event?.maybeUids ?? data.maybeUids,
            notGoingUids: data.event?.notGoingUids ?? data.notGoingUids,
        } : undefined,
        
        // Legacy fields (for backward compatibility)
        // ...
    } as Post;
};
```

---

## Backward Compatibility

### Reading Data
Components check nested `event` object first, then fall back to legacy flat fields:

```typescript
// ✅ NEW: Nested structure
const goingUids = post.event?.goingUids || [];

// ✅ FALLBACK: Legacy flat structure
const goingUids = post.event?.goingUids || post.goingUids || [];
```

### Writing Data
New posts should write to the nested structure:

```typescript
// ✅ NEW: Write to nested event object
const postData = {
    type: "event",
    event: {
        startsAt: new Date(),
        locationLabel: "Student Union",
        goingUids: [],
        maybeUids: [],
        notGoingUids: []
    }
};
```

**Note**: Legacy flat fields are still supported for old posts but should not be used for new posts.

---

## Migration Strategy

### Phase 1: Read Both (Current) ✅
- Components read from `event.*` first
- Fall back to legacy flat fields
- No breaking changes

### Phase 2: Write Nested (Next)
- Update post creation to write to `event` object
- Stop writing to legacy flat fields
- Old posts still readable

### Phase 3: Data Migration (Future)
- Run script to migrate old posts
- Copy flat fields to nested `event` object
- Remove legacy fields from old posts

### Phase 4: Cleanup (Future)
- Remove legacy field support from components
- Remove legacy fields from type definition
- Update Firestore security rules

---

## Component Updates

### Files Modified

1. **`/Site/lib/posts.ts`**
   - Added `PostEventLogistics` type
   - Restructured `Post` type
   - Separated core fields from legacy fields

2. **`/Site/lib/hooks/use-feed.ts`**
   - Updated `mapDocToPost` function
   - Added nested event object mapping
   - Maintained backward compatibility

3. **`/Site/components/post-card.tsx`**
   - Updated attendance state initialization
   - Updated snapshot listener
   - Reads from `event.*` with fallback

4. **`/Site/components/post-detail/post-detail-main-info.tsx`**
   - Updated stats initialization
   - Reads from `event.*` with fallback

---

## Example Usage

### Creating an Event Post

```typescript
const eventPost = {
    id: "event123",
    ownerType: "personal",
    campusId: "campus123",
    description: "Join us for the campus party!",
    authorId: "user123",
    type: "event",
    imageUrls: ["https://..."],
    
    // Display fields
    authorDisplayName: "John Doe",
    authorPhotoURL: "https://...",
    authorUsername: "johndoe",
    ownerName: "John Doe",
    ownerPhotoURL: "https://...",
    
    // Event-specific data (nested)
    event: {
        startsAt: new Date("2026-01-25T18:00:00Z"),
        locationLabel: "Student Union, Room 201",
        locationUrl: "https://maps.google.com/...",
        lat: 44.9778,
        lng: -93.2650,
        goingUids: [],
        maybeUids: [],
        notGoingUids: []
    },
    
    // Timestamps
    createdAt: new Date(),
    editCount: 0,
    
    // Counters
    commentsCount: 0,
    repliesCommentsCount: 0,
    seenCount: 0,
    
    // Arrays
    likedBy: []
};
```

### Accessing Event Data

```typescript
// ✅ Preferred: Use nested event object
const location = post.event?.locationLabel;
const attendees = post.event?.goingUids || [];

// ✅ Fallback: Support legacy flat fields
const location = post.event?.locationLabel || post.locationLabel;
const attendees = post.event?.goingUids || post.goingUids || [];
```

---

## Benefits

### 1. **Platform Consistency**
- Web and iOS use identical data structure
- Easier to maintain and debug
- Reduces confusion between platforms

### 2. **Better Organization**
- Event-specific fields grouped together
- Clear separation of concerns
- Easier to understand data model

### 3. **Type Safety**
- TypeScript enforces structure
- Catches errors at compile time
- Better IDE autocomplete

### 4. **Scalability**
- Easy to add new event fields
- No pollution of root object
- Clear extension points

### 5. **Backward Compatibility**
- Old posts still work
- Gradual migration possible
- No breaking changes

---

## Firestore Document Structure

### New Event Post
```json
{
  "id": "event123",
  "ownerType": "personal",
  "campusId": "campus123",
  "clubId": null,
  
  "description": "Join us for the campus party!",
  "authorId": "user123",
  "type": "event",
  "imageUrls": ["https://..."],
  
  "ownerName": "John Doe",
  "ownerPhotoURL": "https://...",
  "authorUsername": "johndoe",
  "authorDisplayName": "John Doe",
  "authorPhotoURL": "https://...",
  
  "createdAt": "2026-01-20T22:00:00Z",
  "editedAt": null,
  "editCount": 0,
  
  "commentsCount": 0,
  "repliesCommentsCount": 0,
  "seenCount": 0,
  
  "likedBy": [],
  
  "event": {
    "startsAt": "2026-01-25T18:00:00Z",
    "locationLabel": "Student Union, Room 201",
    "locationUrl": "https://maps.google.com/...",
    "lat": 44.9778,
    "lng": -93.2650,
    "goingUids": ["user1", "user2"],
    "maybeUids": ["user3"],
    "notGoingUids": []
  }
}
```

### Legacy Event Post (Still Supported)
```json
{
  "id": "event456",
  "type": "event",
  "authorId": "user456",
  "description": "Old event post",
  "imageUrls": [],
  
  "startsAt": "2026-01-25T18:00:00Z",
  "locationLabel": "Old Location",
  "goingUids": ["user1"],
  "maybeUids": [],
  "notGoingUids": []
}
```

Both formats are supported! The new format is preferred for new posts.

---

## Summary

✅ **Web model now matches iOS model**
✅ **Nested `event` object for event-specific fields**
✅ **Backward compatibility maintained**
✅ **Clear separation of core vs legacy fields**
✅ **Type-safe with TypeScript**
✅ **Ready for gradual migration**

The web and iOS platforms now share a consistent, well-organized data model! 🎉
