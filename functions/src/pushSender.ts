import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { sendPushUpdateStatus } from './push/sendPush';
import { logger } from 'firebase-functions/v2';

const v2Options = {
    region: 'us-central1',
    minInstances: 0, // Fallback doesn't need to be kept warm
    maxInstances: 5,
    memory: '256MiB' as const,
};

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
export const sendPushNotification = onDocumentWritten({ ...v2Options, document: 'notifications/{notificationId}' }, async (event) => {
    const afterSnap = event.data?.after;
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
        logger.info(`[sendPushFallback] Skipping young notification ${event.params.notificationId} (age: ${ageMs}ms)`);
        return;
    }

    // 5. Send the push
    logger.info(`[sendPushFallback] Processing stuck notification ${event.params.notificationId}. Status: ${status}`);
    await sendPushUpdateStatus(event.params.notificationId, notificationData);
});
