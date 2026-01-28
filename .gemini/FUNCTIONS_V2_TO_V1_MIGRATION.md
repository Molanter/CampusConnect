# Firebase Functions v2 → v1 Migration

## Overview
Converted all v2 notification trigger functions to v1 Firebase Functions for better compatibility and stability.

---

## Files Converted

### 1. **`/functions/src/notifications/triggers.ts`**
All notification trigger functions:
- `onPostLiked`
- `onCommentCreated`
- `onReplyCreated`
- `onCommentLiked`
- `onReplyLiked`
- `onFollowCreated`
- `onClubInviteCreated`
- `onClubJoinRequestCreated`

### 2. **`/functions/src/pushSender.ts`**
- `sendPushNotification` (fallback push sender)

### 3. **`/functions/src/testNotification.ts`**
- `sendTestNotification` (callable function)

---

## Key Changes

### Import Statements

**v2 (Before)**:
```typescript
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
```

**v1 (After)**:
```typescript
import * as functions from 'firebase-functions';
```

---

### Firestore Triggers

#### onCreate

**v2 (Before)**:
```typescript
export const onCommentCreated = onDocumentCreated(
    { ...v2Options, document: 'posts/{postId}/comments/{commentId}' },
    async (event) => {
        const commentData = event.data?.data();
        const { postId, commentId } = event.params;
        // ...
    }
);
```

**v1 (After)**:
```typescript
export const onCommentCreated = functions
    .region('us-central1')
    .runWith({ minInstances: 1, maxInstances: 10, memory: '256MB' })
    .firestore
    .document('posts/{postId}/comments/{commentId}')
    .onCreate(async (snapshot, context) => {
        const commentData = snapshot.data();
        const { postId, commentId } = context.params;
        // ...
    });
```

#### onUpdate

**v2 (Before)**:
```typescript
export const onPostLiked = onDocumentUpdated(
    { ...v2Options, document: 'posts/{postId}' },
    async (event) => {
        const afterData = event.data?.after.data();
        const beforeData = event.data?.before.data();
        const postId = event.params.postId;
        // ...
    }
);
```

**v1 (After)**:
```typescript
export const onPostLiked = functions
    .region('us-central1')
    .runWith({ minInstances: 1, maxInstances: 10, memory: '256MB' })
    .firestore
    .document('posts/{postId}')
    .onUpdate(async (change, context) => {
        const afterData = change.after.data();
        const beforeData = change.before.data();
        const postId = context.params.postId;
        // ...
    });
```

#### onWrite

**v2 (Before)**:
```typescript
export const sendPushNotification = onDocumentWritten(
    { ...v2Options, document: 'notifications/{notificationId}' },
    async (event) => {
        const afterSnap = event.data?.after;
        const notificationId = event.params.notificationId;
        // ...
    }
);
```

**v1 (After)**:
```typescript
export const sendPushNotification = functions
    .region('us-central1')
    .runWith({ minInstances: 0, maxInstances: 5, memory: '256MB' })
    .firestore
    .document('notifications/{notificationId}')
    .onWrite(async (change, context) => {
        const afterSnap = change.after;
        const notificationId = context.params.notificationId;
        // ...
    });
```

---

### Callable Functions (HTTPS)

**v2 (Before)**:
```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';

export const sendTestNotification = onCall({
    region: 'us-central1',
    maxInstances: 5
}, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated');
    }
    const uid = request.auth.uid;
    // ...
});
```

**v1 (After)**:
```typescript
import * as functions from 'firebase-functions';

export const sendTestNotification = functions
    .region('us-central1')
    .runWith({ maxInstances: 5 })
    .https
    .onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }
        const uid = context.auth.uid;
        // ...
    });
```

---

### Logging

**v2 (Before)**:
```typescript
import { logger } from 'firebase-functions/v2';

logger.info('Message');
logger.error('Error', error);
```

**v1 (After)**:
```typescript
console.log('Message');
console.error('Error', error);
```

---

### Configuration Options

**v2 (Before)**:
```typescript
const v2Options = {
    region: 'us-central1',
    minInstances: 1,
    maxInstances: 10,
    memory: '256MiB' as const,
};
```

**v1 (After)**:
```typescript
.region('us-central1')
.runWith({ 
    minInstances: 1, 
    maxInstances: 10, 
    memory: '256MB'  // Note: 'MB' not 'MiB'
})
```

---

## Event/Context Object Mapping

### onCreate / onUpdate

| v2 | v1 |
|----|----|
| `event.data` (snapshot) | `snapshot` (first param) |
| `event.params` | `context.params` |
| `event.data?.data()` | `snapshot.data()` |

### onUpdate Specific

| v2 | v1 |
|----|----|
| `event.data?.after` | `change.after` |
| `event.data?.before` | `change.before` |
| `event.data?.after.data()` | `change.after.data()` |
| `event.data?.before.data()` | `change.before.data()` |

### onWrite Specific

| v2 | v1 |
|----|----|
| `event.data?.after` | `change.after` |
| `event.data?.before` | `change.before` |

### Callable Functions

| v2 | v1 |
|----|----|
| `request.auth` | `context.auth` |
| `request.data` | `data` (first param) |
| `HttpsError` | `functions.https.HttpsError` |

---

## Benefits of v1

1. **Stability**: More mature and battle-tested
2. **Compatibility**: Better compatibility with existing tools
3. **Simpler**: Less abstraction, more straightforward
4. **Debugging**: Easier to debug with familiar patterns
5. **Documentation**: More extensive documentation available

---

## Deployment

To deploy the updated functions:

```bash
cd functions
npm run build
firebase deploy --only functions
```

Or deploy specific functions:

```bash
firebase deploy --only functions:onPostLiked,functions:onCommentCreated
```

---

## Testing

After deployment, test the functions:

1. **Test notification triggers**:
   - Like a post → Check if notification is created
   - Comment on a post → Check if notification is sent
   - Follow a user → Check if notification is sent

2. **Test callable function**:
   ```bash
   # From your app or Firebase console
   firebase functions:shell
   > sendTestNotification({}, {auth: {uid: 'test-user-id'}})
   ```

3. **Check logs**:
   ```bash
   firebase functions:log
   ```

---

## Migration Checklist

- [x] Convert `onPostLiked` (onUpdate)
- [x] Convert `onCommentCreated` (onCreate)
- [x] Convert `onReplyCreated` (onCreate)
- [x] Convert `onCommentLiked` (onUpdate)
- [x] Convert `onReplyLiked` (onUpdate)
- [x] Convert `onFollowCreated` (onCreate)
- [x] Convert `onClubInviteCreated` (onCreate)
- [x] Convert `onClubJoinRequestCreated` (onCreate)
- [x] Convert `sendPushNotification` (onWrite)
- [x] Convert `sendTestNotification` (onCall)
- [x] Update imports
- [x] Update logging
- [x] Update error handling
- [x] Update configuration options

---

## Summary

✅ **All v2 functions converted to v1**
✅ **10 functions updated**
✅ **Backward compatible** (no breaking changes to functionality)
✅ **Ready to deploy**

All notification trigger functions are now using Firebase Functions v1! 🎉
