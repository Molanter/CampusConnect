# Profile Page - Clubs Tab Data Fetching

## Overview
This document describes how clubs are fetched and displayed on the Clubs tab of the user profile page.

---

## Component Structure

### Profile Page
**File**: `/Site/app/user/[id]/page.tsx`

The profile page renders the `MyClubsView` component for the Clubs tab:

```tsx
{/* Page: Clubs */}
<div className="w-full shrink-0 snap-start px-3">
    <MyClubsView userId={targetUid} />
</div>
```

### MyClubsView Component
**File**: `/Site/components/my-clubs-view.tsx`

This component handles all the club fetching and rendering logic.

---

## Data Fetching Logic

### Current Implementation (N+1 Query Problem)

```typescript
const fetchMyClubs = async () => {
    try {
        setLoading(true);
        
        // 1. Fetch ALL clubs
        const clubsRef = collection(db, "clubs");
        const clubsSnapshot = await getDocs(clubsRef);
        
        const myClubs: Club[] = [];
        
        // 2. For EACH club, check if user is a member
        for (const clubDoc of clubsSnapshot.docs) {
            const membersRef = collection(db, "clubs", clubDoc.id, "members");
            const memberQuery = query(membersRef, where("uid", "==", userId));
            const memberSnapshot = await getDocs(memberQuery);
            
            // 3. If user is a member, add club to list
            if (!memberSnapshot.empty) {
                const clubData = clubDoc.data();
                myClubs.push({
                    id: clubDoc.id,
                    name: clubData.name || "Unnamed Club",
                    description: clubData.description,
                    coverImageUrl: clubData.coverImageUrl,
                    memberCount: clubData.memberCount || 0,
                    isVerified: clubData.isVerified,
                    category: clubData.category,
                    type: clubData.type,
                    isDorm: clubData.isDorm
                });
            }
        }
        
        setClubs(myClubs);
    } catch (error) {
        console.error("Error fetching clubs:", error);
    } finally {
        setLoading(false);
    }
};
```

---

## Query Breakdown

### Step 1: Fetch All Clubs
```typescript
const clubsRef = collection(db, "clubs");
const clubsSnapshot = await getDocs(clubsRef);
```

**Firestore Query**:
- Collection: `clubs`
- Filter: None
- Result: ALL clubs in the system

**Firestore Reads**: 1 (for all clubs)

---

### Step 2: Check Membership for Each Club
```typescript
for (const clubDoc of clubsSnapshot.docs) {
    const membersRef = collection(db, "clubs", clubDoc.id, "members");
    const memberQuery = query(membersRef, where("uid", "==", userId));
    const memberSnapshot = await getDocs(memberQuery);
    
    if (!memberSnapshot.empty) {
        // User is a member of this club
    }
}
```

**Firestore Query** (per club):
- Collection: `clubs/{clubId}/members`
- Filter: `where("uid", "==", userId)`
- Result: Member document if user is in this club

**Firestore Reads**: N (where N = total number of clubs)

---

## Performance Analysis

### Current Performance

| Scenario | Total Clubs | User's Clubs | Firestore Reads | Cost |
|----------|-------------|--------------|-----------------|------|
| Small campus | 10 clubs | 3 clubs | **11 reads** | Low |
| Medium campus | 50 clubs | 5 clubs | **51 reads** | Medium |
| Large campus | 200 clubs | 8 clubs | **201 reads** | **HIGH** ⚠️ |

**Formula**: `Total Reads = 1 + N` (where N = total clubs)

### Problem: N+1 Query Pattern

This is a classic **N+1 query problem**:
1. **1 query** to fetch all clubs
2. **N queries** to check membership in each club

**Issues**:
- ⚠️ Scales poorly with club count
- ⚠️ Expensive in terms of Firestore reads
- ⚠️ Slow page load time
- ⚠️ Unnecessary queries for clubs user doesn't belong to

---

## Optimized Solutions

### Solution 1: Collection Group Query (Recommended)

Use a collection group query to find all memberships at once:

```typescript
const fetchMyClubs = async () => {
    try {
        setLoading(true);
        
        // 1. Query all member subcollections for this user
        const membersGroupRef = collectionGroup(db, "members");
        const memberQuery = query(membersGroupRef, where("uid", "==", userId));
        const memberSnapshot = await getDocs(memberQuery);
        
        // 2. Extract club IDs
        const clubIds = memberSnapshot.docs.map(doc => {
            // doc.ref.path is like: "clubs/clubId/members/memberId"
            const pathParts = doc.ref.path.split('/');
            return pathParts[1]; // Get clubId
        });
        
        // 3. Fetch club details for each club ID
        const myClubs: Club[] = [];
        for (const clubId of clubIds) {
            const clubDoc = await getDoc(doc(db, "clubs", clubId));
            if (clubDoc.exists()) {
                const clubData = clubDoc.data();
                myClubs.push({
                    id: clubDoc.id,
                    name: clubData.name || "Unnamed Club",
                    description: clubData.description,
                    coverImageUrl: clubData.coverImageUrl,
                    memberCount: clubData.memberCount || 0,
                    isVerified: clubData.isVerified,
                    category: clubData.category,
                    type: clubData.type,
                    isDorm: clubData.isDorm
                });
            }
        }
        
        setClubs(myClubs);
    } catch (error) {
        console.error("Error fetching clubs:", error);
    } finally {
        setLoading(false);
    }
};
```

**Firestore Reads**: `1 + M` (where M = user's club count)

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

**Performance Comparison**:

| Scenario | Total Clubs | User's Clubs | OLD Reads | NEW Reads | Improvement |
|----------|-------------|--------------|-----------|-----------|-------------|
| Small | 10 | 3 | 11 | **4** | 64% ↓ |
| Medium | 50 | 5 | 51 | **6** | 88% ↓ |
| Large | 200 | 8 | 201 | **9** | **96% ↓** |

---

### Solution 2: Denormalized User Clubs Collection

Create a dedicated collection to store user-club relationships:

**Collection Structure**: `userClubs`
```typescript
{
    userId: "user123",
    clubId: "club456",
    clubName: "Chess Club",
    clubCoverImageUrl: "https://...",
    clubCategory: "Academic",
    joinedAt: timestamp,
    role: "member" | "admin" | "owner"
}
```

**Query**:
```typescript
const fetchMyClubs = async () => {
    const userClubsRef = collection(db, "userClubs");
    const q = query(userClubsRef, where("userId", "==", userId));
    const snapshot = await getDocs(q);
    
    const myClubs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: data.clubId,
            name: data.clubName,
            coverImageUrl: data.clubCoverImageUrl,
            category: data.clubCategory,
            // ... other denormalized fields
        };
    });
    
    setClubs(myClubs);
};
```

**Firestore Reads**: **1** (single query)

**Benefits**:
- ✅ Fastest solution (single query)
- ✅ No index required (single-field query)
- ✅ Can include denormalized club data
- ✅ Scales perfectly with user's club count

**Tradeoffs**:
- ⚠️ Requires maintaining sync when clubs are updated
- ⚠️ Additional storage for denormalized data
- ⚠️ Need Cloud Functions to keep data in sync

---

### Solution 3: Cache Club Memberships on User Document

Store club IDs directly on the user document:

**User Document**:
```typescript
{
    uid: "user123",
    name: "John Doe",
    clubIds: ["club1", "club2", "club3"], // Array of club IDs
    // ... other fields
}
```

**Query**:
```typescript
const fetchMyClubs = async () => {
    // 1. Get user's club IDs
    const userDoc = await getDoc(doc(db, "users", userId));
    const clubIds = userDoc.data()?.clubIds || [];
    
    // 2. Fetch each club
    const myClubs: Club[] = [];
    for (const clubId of clubIds) {
        const clubDoc = await getDoc(doc(db, "clubs", clubId));
        if (clubDoc.exists()) {
            myClubs.push({
                id: clubDoc.id,
                ...clubDoc.data()
            });
        }
    }
    
    setClubs(myClubs);
};
```

**Firestore Reads**: `1 + M` (where M = user's club count)

**Benefits**:
- ✅ Simple to implement
- ✅ No index required
- ✅ Relatively fast

**Tradeoffs**:
- ⚠️ Need to update user doc when joining/leaving clubs
- ⚠️ Array size limit (Firestore arrays max ~1MB)

---

## Recommended Implementation

### Best Solution: Collection Group Query

**Why**:
1. ✅ **96% reduction** in Firestore reads for large campuses
2. ✅ Minimal code changes required
3. ✅ No data duplication
4. ✅ Automatically stays in sync
5. ✅ Only requires adding one index

**Implementation Steps**:

1. **Add index to `firestore.indexes.json`**:
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

2. **Deploy index**:
```bash
firebase deploy --only firestore:indexes
```

3. **Update `my-clubs-view.tsx`** with the optimized query (code shown above)

---

## Current Index Requirements

### Automatic Single-Field Indexes
- `clubs/{clubId}/members` subcollection:
  - Field: `uid`
  - Order: Ascending
  - **Auto-created by Firestore** ✅

### Required Composite Index
- **None currently** (using N+1 queries)

### Recommended Composite Index
- Collection Group: `members`
- Field: `uid`
- Order: Ascending
- **Status**: ⚠️ Not yet added

---

## Summary

### Current State
- ✅ Works correctly
- ⚠️ Uses N+1 query pattern
- ⚠️ Scales poorly (201 reads for 200 clubs)
- ⚠️ Slow for large campuses

### With Optimization
- ✅ 96% fewer Firestore reads
- ✅ Much faster page load
- ✅ Scales with user's clubs, not total clubs
- ✅ Lower costs

### Action Items
1. Add collection group index for `members.uid`
2. Update `my-clubs-view.tsx` to use collection group query
3. Deploy index and code changes
4. Test with various club counts

**Impact**: For a campus with 200 clubs and a user in 8 clubs:
- **Before**: 201 Firestore reads
- **After**: 9 Firestore reads
- **Savings**: 192 reads (96% reduction) 🎉
