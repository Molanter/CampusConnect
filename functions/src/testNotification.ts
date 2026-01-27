import * as functions from 'firebase-functions';
import { createNotificationDoc } from './notifications/createNotification';
import { sendPushUpdateStatus } from './push/sendPush';

// Distribute rate limiting across instances using a simple expiry field in the user's private data
// or just keep it simple with memory for now as instances are reasonably persistent if warm.
const rateLimitCache = new Map<string, number>();

export const sendTestNotification = functions
    .https
    .onCall(async (data, context) => {
        // Check authentication
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const uid = context.auth.uid;
        const now = Date.now();
        const lastCallTime = rateLimitCache.get(uid);
        const RATE_LIMIT_MS = 60 * 1000;

        if (lastCallTime && (now - lastCallTime) < RATE_LIMIT_MS) {
            throw new functions.https.HttpsError('resource-exhausted', 'Please wait 60s');
        }
        rateLimitCache.set(uid, now);

        try {
            const { id, data: notifData } = await createNotificationDoc({
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

            if (id && notifData) {
                const pushResult = await sendPushUpdateStatus(id, notifData);
                return {
                    success: true,
                    message: 'Test notification processed',
                    notificationId: id,
                    pushStatus: pushResult.status
                };
            }

            return { success: false, message: 'Could not create notification' };

        } catch (error: any) {
            console.error(`[sendTestNotification] Error:`, error);
            throw new functions.https.HttpsError('internal', error.message || 'Internal error');
        }
    });
