import * as admin from 'firebase-admin';
import { CreateNotificationParams } from './types';

const db = admin.firestore();

export async function createNotificationDoc(params: CreateNotificationParams): Promise<{ id: string, data: any, wasUpdated: boolean }> {
    const {
        toUid,
        type,
        title,
        body = null,
        actorUid = null,
        actorName = null,
        actorPhotoURL = null,
        campusId = null,
        clubId = null,
        postId = null,
        commentId = null,
        replyId = null,
        deeplink,
        dedupeKey = null,
        groupKey = null,
        pushSend = true,
        imageUrl = null,
    } = params;

    // Prevent self-notifications
    if (actorUid && actorUid === toUid) {
        return { id: '', data: null, wasUpdated: false };
    }

    // 1. Check for grouping (Likes)
    if (groupKey) {
        const existingQuery = await db.collection('notifications')
            .where('toUid', '==', toUid)
            .where('groupKey', '==', groupKey)
            .where('isRead', '==', false)
            .where('isArchived', '==', false)
            .limit(1)
            .get();

        if (!existingQuery.empty) {
            const doc = existingQuery.docs[0];
            const data = doc.data();
            const newCount = (data.groupCount || 1) + 1;

            // For likes, we throttle pushes. 
            // Only send push if lastPushAt is older than 10 minutes OR if not set
            const lastPushAt = data.lastPushAt?.toDate() || new Date(0);
            const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
            const shouldPushAgain = lastPushAt < tenMinsAgo;

            const updatedData: any = {
                groupCount: newCount,
                title, // Updated title from trigger
                actorUid,
                actorName,
                actorPhotoURL,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            if (shouldPushAgain && pushSend) {
                updatedData['push.status'] = 'pending';
                updatedData['push.sentAt'] = null;
                updatedData['push.error'] = null;
                updatedData.lastPushAt = admin.firestore.FieldValue.serverTimestamp();
            }

            await doc.ref.update(updatedData);

            // Construct a clean return object that matches the Firestore structure 
            // instead of just spreading dot-notated fields
            const finalData = { ...data };
            if (shouldPushAgain && pushSend) {
                finalData.push = {
                    ...finalData.push,
                    status: 'pending',
                    sentAt: null,
                    error: null
                };
            }
            finalData.updatedAt = new Date(); // approximation for the return value
            finalData.groupCount = newCount;

            return { id: doc.id, data: finalData, wasUpdated: true };
        }
    }

    // 2. Check for deduplication
    if (dedupeKey) {
        const existingQuery = await db.collection('notifications')
            .where('toUid', '==', toUid)
            .where('dedupeKey', '==', dedupeKey)
            .where('isRead', '==', false)
            .where('isArchived', '==', false)
            .limit(1)
            .get();

        if (!existingQuery.empty) {
            return { id: existingQuery.docs[0].id, data: existingQuery.docs[0].data(), wasUpdated: true };
        }
    }

    // 3. Create New Doc
    const newNotifData = {
        toUid,
        type,
        title,
        body,
        actorUid,
        actorName,
        actorPhotoURL,
        campusId,
        clubId,
        postId,
        commentId,
        replyId,
        imageUrl,
        deeplink,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        isRead: false,
        readAt: null,
        isArchived: false,
        dedupeKey,
        groupKey,
        groupCount: groupKey ? 1 : null,
        lastPushAt: pushSend ? admin.firestore.FieldValue.serverTimestamp() : null,
        push: {
            send: pushSend,
            status: pushSend ? 'pending' : 'skipped',
            sentAt: null,
            error: pushSend ? null : 'pushSend false',
        },
        version: 2,
    };

    const docRef = await db.collection('notifications').add(newNotifData);
    return { id: docRef.id, data: newNotifData, wasUpdated: false };
}
