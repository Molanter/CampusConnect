# Profile Page - Firestore Indexes

## Overview
This document describes all Firestore queries and indexes used on the user profile page (`/user/[id]`).

---

## Queries on Profile Page

### 1. **User Profile Data**
**Query**: Single document fetch
```typescript
const ref = doc(db, "users", targetUid);
const snap = await getDoc(ref);
```

**Index Required**: ❌ None (single document fetch)

**Fields Retrieved**:
- `username`
- `displayName` / `name` / `fullName` / `preferredName`
- `photoURL`
- `campusId` / `universityId`
- `campus`
- `campusLocation`
- `yearOfStudy`
- `major`
- `dorm`
- `role`

---

### 2. **User Posts**
**Query**: Posts by author
```typescript
const postsRef = collection(db, "posts");
const qPosts = query(postsRef, where("authorId", "==", targetUid));
const snap = await getDocs(qPosts);
```

**Index Required**: ✅ **Single-field index**
- Collection: `posts`
- Field: `authorId`
- Type: Ascending

**Current Status**: ⚠️ **NOT in firestore.indexes.json**
- This is a simple equality query
- Firestore automatically creates single-field indexes
- No composite index needed

**Fallback Query** (if posts collection is empty):
```typescript
const eventsRef = collection(db, "events");
const qEvents = query(eventsRef, where("hostUserId", "==", targetUid));
const snapEvents = await getDocs(qEvents);
```

**Index Required**: ✅ **Single-field index**
- Collection: `events`
- Field: `hostUserId`
- Type: Ascending

---

### 3. **User's Clubs (Count)**
**Query**: Clubs where user is a member
```typescript
// For each club:
const membersRef = collection(db, "clubs", clubDoc.id, "members");
const memberQuery = query(membersRef, where("uid", "==", targetUid));
const memberSnapshot = await getDocs(memberQuery);
```

**Index Required**: ✅ **Single-field index**
- Collection: `clubs/{clubId}/members`
- Field: `uid`
- Type: Ascending

**Current Status**: ⚠️ **NOT in firestore.indexes.json**
- This is a simple equality query on a subcollection
- Firestore automatically creates single-field indexes
- No composite index needed

**Performance Issue**: ⚠️
- This query fetches ALL clubs first, then checks membership for each
- **Very inefficient** for large numbers of clubs
- Should use a collection group query or denormalized data

---

### 4. **Username Lookup** (Alternative route: `/user/u/[username]`)
**Query**: Find user by username
```typescript
const q = query(collection(db, "users"), where("username", "==", username));
```

**Index Required**: ✅ **Single-field index**
- Collection: `users`
- Field: `username`
- Type: Ascending

**Current Status**: ⚠️ **NOT in firestore.indexes.json**
- Simple equality query
- Firestore automatically creates single-field indexes

---

## Summary of Indexes

### Automatic Single-Field Indexes (Created by Firestore)
These don't need to be in `firestore.indexes.json`:

1. **`posts` collection**:
   - `authorId` (Ascending)

2. **`events` collection**:
   - `hostUserId` (Ascending)

3. **`clubs/{clubId}/members` subcollection**:
   - `uid` (Ascending)

4. **`users` collection**:
   - `username` (Ascending)

### Composite Indexes (Need to be defined)
**None required for profile page** ✅

---

## Current firestore.indexes.json

The current `firestore.indexes.json` contains:

1. **`seenPosts` collection group**:
   - `campusId` + `seenAt` (DESC)

2. **`notifications` collection** (4 different composite indexes):
   - `toUid` + `createdAt` (DESC)
   - `toUid` + `isRead` + `createdAt` (DESC)
   - `toUid` + `dedupeKey` + `isRead` + `isArchived`
   - `toUid` + `groupKey` + `isRead` + `isArchived`

**None of these are used by the profile page.**

---

## Performance Optimizations

### Current Issues

1. **Clubs Count Query** ⚠️ **VERY INEFFICIENT**
   ```typescript
   // Current: Fetches ALL clubs, then checks each one
   const clubsSnapshot = await getDocs(clubsRef);
   for (const clubDoc of clubsSnapshot.docs) {
       const memberQuery = query(membersRef, where("uid", "==", targetUid));
       // ...
   }
   ```

   **Problem**: 
   - If there are 100 clubs, this makes 101 Firestore reads (1 for clubs + 100 for member checks)
   - Scales poorly as club count grows

### Recommended Solutions

#### Option 1: Collection Group Query (Requires Index)
```typescript
// Query all member subcollections at once
const membersGroupRef = collectionGroup(db, "members");
const q = query(membersGroupRef, where("uid", "==", targetUid));
const snapshot = await getDocs(q);
const clubsCount = snapshot.size;
```

**Index Required**:
```json
{
    "collectionGroup": "members",
    "queryScope": "COLLECTION_GROUP",
    "fields": [
        {
            "fieldPath": "uid",
            "order": "ASCENDING"
        }
    ]
}
```

**Benefits**:
- Single query instead of N+1 queries
- Much faster for large club counts
- Scales well

#### Option 2: Denormalized Data (No Index Required)
Store club count directly on user document:
```typescript
// In user document:
{
    uid: "user123",
    clubsCount: 5,  // Updated when user joins/leaves clubs
    // ...
}
```

**Benefits**:
- No query needed at all
- Instant load
- No index required

**Tradeoffs**:
- Need to update count when user joins/leaves clubs
- Requires Cloud Functions or client-side logic

#### Option 3: Dedicated Collection (Requires Index)
Create a `userClubs` collection:
```typescript
// Collection: userClubs
{
    userId: "user123",
    clubId: "club456",
    joinedAt: timestamp
}
```

Query:
```typescript
const q = query(
    collection(db, "userClubs"),
    where("userId", "==", targetUid)
);
const snapshot = await getDocs(q);
const clubsCount = snapshot.size;
```

**Index Required**: Single-field on `userId`

---

## Recommended Index Additions

### For Profile Page Optimization

Add to `firestore.indexes.json`:

```json
{
    "indexes": [
        {
            "collectionGroup": "members",
            "queryScope": "COLLECTION_GROUP",
            "fields": [
                {
                    "fieldPath": "uid",
                    "order": "ASCENDING"
                }
            ]
        }
    ]
}
```

This enables the efficient collection group query for clubs count.

---

## Query Performance Summary

| Query | Current Reads | With Optimization | Improvement |
|-------|--------------|-------------------|-------------|
| User profile | 1 | 1 | - |
| User posts | 1 | 1 | - |
| Clubs count | 101 (for 100 clubs) | 1 | **99% reduction** |
| **Total** | **103** | **3** | **97% reduction** |

---

## Deployment

To deploy the recommended index:

```bash
firebase deploy --only firestore:indexes
```

This will create the collection group index for `members.uid`.

---

## Conclusion

### Current State
- ✅ Profile page works without custom indexes
- ✅ Firestore auto-creates single-field indexes
- ⚠️ Clubs count query is very inefficient (N+1 problem)

### Recommended Actions
1. **Add collection group index** for `members.uid`
2. **Update clubs count query** to use collection group
3. **Consider denormalizing** clubs count for even better performance

### Impact
- **97% reduction** in Firestore reads for profile page
- **Much faster** page load times
- **Lower costs** for Firestore usage
