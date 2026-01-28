# Post Report System - Data Model & Implementation

## Overview
The post report system allows users to report inappropriate content. Reports are stored in Firestore and trigger automated moderation workflows.

---

## Data Model

### 1. PostReport (Sub-collection)
**Collection Path**: `posts/{postId}/reports/{reportId}`

```typescript
export interface PostReport {
    reporterUid: string;      // UID of user who submitted the report
    reason: ReportReason;     // Category of the report
    details?: string;         // Optional additional context (max 500 chars)
    createdAt: any;          // Firestore Timestamp
}
```

**Report Reasons**:
```typescript
export type ReportReason =
    | "spam"
    | "harassment"
    | "hate"
    | "nudity"
    | "violence"
    | "illegal"
    | "other";
```

**Labels for UI**:
```typescript
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
    spam: "Spam",
    harassment: "Harassment",
    hate: "Hate speech",
    nudity: "Nudity or sexual content",
    violence: "Violence or threats",
    illegal: "Illegal activity",
    other: "Other",
};
```

---

## How Reports Are Saved

### Client-Side (Web App)
**File**: `/Site/components/right-sidebar.tsx` (Lines 899-949)

```typescript
const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedReason) {
        setError("Please select a reason");
        return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
        setError("You must be signed in to report posts");
        return;
    }

    setSubmitting(true);
    setError(null);

    try {
        // Create report in sub-collection
        const reportsRef = collection(db, "posts", data.id, "reports");

        await addDoc(reportsRef, {
            reporterUid: currentUser.uid,
            reason: selectedReason,
            details: details.trim().slice(0, 500),
            createdAt: serverTimestamp(),
        });

        setSuccess(true);

        // Close sidebar after brief delay
        setTimeout(() => {
            close();
            setSelectedReason(null);
            setDetails("");
            setSuccess(false);
        }, 1500);

    } catch (err: any) {
        console.error("Error submitting report:", err);
        
        if (err.code === "permission-denied" || err.message?.includes("already exists")) {
            setError("You have already reported this post");
        } else {
            setError("Failed to submit report. Please try again.");
        }
    } finally {
        setSubmitting(false);
    }
};
```

**Key Points**:
- Reports are saved to `posts/{postId}/reports` sub-collection
- Uses `addDoc()` to allow multiple reports from same user (testing mode)
- Details are trimmed to 500 characters max
- Uses `serverTimestamp()` for accurate timing

---

## Cloud Functions (Automated Processing)

### onReportCreated Trigger
**File**: `/functions/src/moderation.ts` (Lines 34-119)

**Trigger**: `onCreate(posts/{postId}/reports/{reporterUid})`

**What it does**:
1. **Increments Report Count**: Updates `post.reportCount`
2. **Auto-Review Threshold**: If `reportCount >= 3`, sets `visibility = "under_review"`
3. **Creates Moderation Queue Entry**: Adds item to `moderationQueue` collection
4. **Logs to Audit Trail**: Records action in `auditLogs` collection

```typescript
export const onReportCreated = functions.firestore
    .document('posts/{postId}/reports/{reporterUid}')
    .onCreate(async (snapshot, context) => {
        const { postId, reporterUid } = context.params;
        const reportData = snapshot.data();

        await db.runTransaction(async (transaction) => {
            const postRef = db.collection('posts').doc(postId);
            const queueRef = db.collection('moderationQueue').doc(`post_${postId}`);

            // Read post data
            const postDoc = await transaction.get(postRef);
            const postData = postDoc.data();
            
            const currentReportCount = postData?.reportCount || 0;
            const currentVisibility = postData?.visibility || "visible";
            const newReportCount = currentReportCount + 1;
            const shouldAutoReview = currentVisibility === "visible" && newReportCount >= 3;

            // Update post
            const postUpdates: any = {
                reportCount: newReportCount
            };

            if (shouldAutoReview) {
                postUpdates.visibility = "under_review";
                postUpdates.reportedAt = admin.firestore.FieldValue.serverTimestamp();
            }

            transaction.update(postRef, postUpdates);

            // Create moderation queue entry if threshold reached
            if (shouldAutoReview) {
                transaction.set(queueRef, {
                    targetType: "post",
                    targetId: postId,
                    state: "needs_review",
                    reportCount: newReportCount,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    ownerUid: postData?.authorId || ""
                }, { merge: true });

                // Create audit log
                const auditRef = db.collection('auditLogs').doc();
                transaction.set(auditRef, {
                    targetType: "post",
                    targetId: postId,
                    action: "auto_under_review",
                    actorType: "system",
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        });

        // Log report action (outside transaction)
        await db.collection('auditLogs').add({
            targetType: "post",
            targetId: postId,
            action: "report_added",
            actorType: "user",
            actorUid: reporterUid,
            reason: reportData.reason,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    });
```

---

## Related Data Models

### Post Fields (Updated by Reports)
```typescript
{
    reportCount?: number;           // Number of reports
    visibility?: "visible" | "under_review" | "hidden";
    reportedAt?: Timestamp;         // When post was auto-flagged
    hiddenAt?: Timestamp;           // When admin hid the post
    hiddenBy?: string;              // Admin UID who hid it
    moderationNote?: string;        // Admin's note
}
```

### ModerationQueueItem
**Collection**: `moderationQueue`
**Document ID**: `post_{postId}`

```typescript
export interface ModerationQueueItem {
    targetType: "post";
    targetId: string;                                    // Post ID
    state: "needs_review" | "dismissed" | "action_taken";
    reportCount: number;
    createdAt: any;                                      // Timestamp
    updatedAt?: any;                                     // Timestamp
    reasonsBreakdown?: Record<ReportReason, number>;     // Count per reason
    ownerUid: string;                                    // Post author UID
}
```

### AuditLog
**Collection**: `auditLogs`

```typescript
export interface AuditLog {
    targetType: "post";
    targetId: string;
    action: "report_added" | "auto_under_review" | "admin_hidden" | "admin_restored" | "admin_dismissed";
    actorType: "user" | "system" | "admin";
    actorUid?: string;
    reason?: ReportReason;
    note?: string;
    createdAt: any;                                      // Timestamp
}
```

---

## Firestore Structure

```
posts/
  {postId}/
    (post document fields)
    reportCount: 0
    visibility: "visible"
    
    reports/                          ← Sub-collection
      {reportId}/                     ← Auto-generated ID
        reporterUid: "user123"
        reason: "spam"
        details: "This is spam content"
        createdAt: Timestamp

moderationQueue/
  post_{postId}/
    targetType: "post"
    targetId: "{postId}"
    state: "needs_review"
    reportCount: 3
    createdAt: Timestamp
    ownerUid: "author123"

auditLogs/
  {auditId}/
    targetType: "post"
    targetId: "{postId}"
    action: "report_added"
    actorType: "user"
    actorUid: "reporter123"
    reason: "spam"
    createdAt: Timestamp
```

---

## Report Workflow

### 1. User Reports Post
```
User clicks "Report" → Fills form → Submits
                                      ↓
                        addDoc(posts/{postId}/reports)
                                      ↓
                            Cloud Function Triggered
```

### 2. Cloud Function Processing
```
onReportCreated triggered
         ↓
Increment reportCount
         ↓
reportCount >= 3?
    ↓ YES                    ↓ NO
Set visibility =        Do nothing more
"under_review"
    ↓
Create moderation
queue entry
    ↓
Log to audit trail
```

### 3. Admin Review
```
Admin views moderation queue
         ↓
Takes action: Hide | Restore | Dismiss
         ↓
moderatePost() Cloud Function
         ↓
Update post visibility
         ↓
Update queue state
         ↓
Log to audit trail
```

---

## Constants

```typescript
export const REPORT_THRESHOLD = 3;  // Auto-review after 3 reports
```

---

## Security Rules (Firestore)

Reports should have security rules like:
```javascript
match /posts/{postId}/reports/{reportId} {
  // Users can create reports
  allow create: if request.auth != null
                && request.resource.data.reporterUid == request.auth.uid
                && request.resource.data.reason in ['spam', 'harassment', 'hate', 'nudity', 'violence', 'illegal', 'other'];
  
  // Only admins can read reports
  allow read: if isAdmin();
  
  // No updates or deletes by users
  allow update, delete: if false;
}
```

---

## UI Components

### Report Form
**Location**: Right sidebar in web app
**Features**:
- Radio button selection for reason
- Optional text area for details (500 char limit)
- Character counter
- Success/error states
- Auto-close after submission

### Admin Moderation View
**Location**: `/app/admin/moderation/page.tsx`
**Features**:
- View all reported posts
- See report count and reasons
- Take actions: Hide, Restore, Dismiss
- Add moderation notes
- View audit history

---

## Testing Notes

- Currently using `addDoc()` instead of `setDoc()` to allow multiple reports from same user (testing mode)
- In production, should use `setDoc()` with `reporterUid` as document ID to prevent duplicate reports
- Error handling includes check for "already exists" message

---

## Summary

**Report Storage**:
- Sub-collection: `posts/{postId}/reports/{reportId}`
- Auto-generated document IDs
- Contains: reporterUid, reason, details, createdAt

**Automated Processing**:
- Cloud Function triggers on report creation
- Increments post's reportCount
- Auto-flags for review at 3+ reports
- Creates moderation queue entries
- Maintains audit trail

**Admin Actions**:
- View reports in moderation queue
- Hide, restore, or dismiss posts
- Add moderation notes
- All actions logged to audit trail
