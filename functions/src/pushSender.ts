import * as functions from 'firebase-functions';
import { sendPushUpdateStatus } from './push/sendPush';

/**
 * Fallback Push Sender
 * Triggered on any write to notifications/{id}
 * 
 * Logic:
 * 1. If doc deleted => return
 * 2. If push.send != true => return
 * 3. If push.status is already 'sent' or 'failed' => return
 * 4. If push.status is 'pending', send push.
 */
export const sendPushNotification = functions
    .firestore
    .document('notifications/{notificationId}')
    .onWrite(async (change, context) => {
        const afterSnap = change.after;
        if (!afterSnap || !afterSnap.exists) return;

        const notificationData = afterSnap.data()!;

        // 1. Guard: Check if push is enabled
        if (!notificationData.push?.send) return;

        // 2. Guard: Avoid double-sending
        const status = notificationData.push.status;
        if (status === 'sent' || status === 'failed') return;

        // 3. Guard: If already being processed by another instance (optimistic)
        // We only process 'pending'
        if (status !== 'pending') return;

        // 4. Guard: Only fallback if the notification is at least 30 seconds old
        // This gives the primary trigger and potential retries plenty of time.
        const createdAt = notificationData.createdAt?.toDate() || new Date();
        const ageMs = Date.now() - createdAt.getTime();
        if (ageMs < 30000) {
            console.log(`[sendPushFallback] Skipping young notification ${context.params.notificationId} (age: ${ageMs}ms)`);
            return;
        }

        // 5. Send the push
        console.log(`[sendPushFallback] Processing stuck notification ${context.params.notificationId}. Status: ${status}`);
        await sendPushUpdateStatus(context.params.notificationId, notificationData);
    });
