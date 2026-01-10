import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { createNotificationDoc } from './notifications/createNotification';
import { sendPushUpdateStatus } from './push/sendPush';

import { logger } from 'firebase-functions/v2';



// Distribute rate limiting across instances using a simple expiry field in the user's private data
// or just keep it simple with memory for now as instances are reasonably persistent if warm.
const rateLimitCache = new Map<string, number>();

export const sendTestNotification = onCall({
    region: 'us-central1',
    maxInstances: 5
}, async (request) => {
    // Check authentication
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const uid = request.auth.uid;
    const now = Date.now();
    const lastCallTime = rateLimitCache.get(uid);
    const RATE_LIMIT_MS = 60 * 1000;

    if (lastCallTime && (now - lastCallTime) < RATE_LIMIT_MS) {
        throw new HttpsError('resource-exhausted', 'Please wait 60s');
    }
    rateLimitCache.set(uid, now);

    try {
        const { id, data } = await createNotificationDoc({
            toUid: uid,
            type: 'system',
            title: 'Test notification',
            body: 'Push notifications are working! 🎉',
            deeplink: {
                screen: 'settings_notifications',
                params: {},
            },
            dedupeKey: `test:${uid}:${now}`,
        });

        if (id && data) {
            const pushResult = await sendPushUpdateStatus(id, data);
            return {
                success: true,
                message: 'Test notification processed',
                notificationId: id,
                pushStatus: pushResult.status
            };
        }

        return { success: false, message: 'Could not create notification' };

    } catch (error: any) {
        logger.error(`[sendTestNotification] Error:`, error);
        throw new HttpsError('internal', error.message || 'Internal error');
    }
});
