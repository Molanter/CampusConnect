import * as admin from 'firebase-admin';
import { PushSettings } from '../notifications/types';

const db = admin.firestore();
const messaging = admin.messaging();

let cachedAppIcon: string | null = null;
async function getAppIcon(): Promise<string> {
    if (cachedAppIcon) return cachedAppIcon;
    try {
        const snap = await db.doc('config/app_info').get();
        const icon = snap.data()?.icon;
        if (icon) {
            cachedAppIcon = icon;
            return icon;
        }
    } catch (e) {
        console.error('[sendPush] Error fetching app icon:', e);
    }
    // Hardcoded fallback if Firestore fails
    return 'https://firebasestorage.googleapis.com/v0/b/campus-vibes-e34f0.firebasestorage.app/o/config%2Fapp%2Fmac1024.png?alt=media&token=fcdcb54c-3962-4ae9-a596-f567dcdc3a47';
}

export async function loadPushSettings(uid: string): Promise<PushSettings | null> {
    const settingsDoc = await db.collection('users').doc(uid).collection('settings').doc('notifications').get();
    if (!settingsDoc.exists) return null;
    return settingsDoc.data() as PushSettings;
}

export async function getActiveTokens(uid: string): Promise<string[]> {
    const devicesSnap = await db.collection('users').doc(uid).collection('devices').get();
    const tokens = devicesSnap.docs
        .map(doc => doc.data().fcmToken)
        .filter(token => !!token);

    // Deduplicate tokens to prevent multiple pushes to the same tab/device
    return Array.from(new Set(tokens));
}

export async function disableInvalidToken(uid: string, token: string) {
    const devicesSnap = await db.collection('users').doc(uid).collection('devices')
        .where('fcmToken', '==', token)
        .get();

    const batch = db.batch();
    devicesSnap.docs.forEach(doc => {
        batch.delete(doc.ref);
    });
    await batch.commit();
    console.info(`[sendPush] Disabled ${devicesSnap.docs.length} invalid tokens for user ${uid}`);
}

interface SendPushResult {
    status: 'sent' | 'skipped' | 'failed';
    sentCount: number;
    failCount: number;
    error?: string;
    durationMs: number;
}

export async function sendPushUpdateStatus(notificationId: string, notificationData: any): Promise<SendPushResult> {
    const start = Date.now();
    const toUid = notificationData.toUid;
    const type = notificationData.type;

    try {
        // 1. Check Preferences
        const settings = await loadPushSettings(toUid);
        if (settings) {
            if (settings.pushEnabled === false) {
                return finishUpdate(notificationId, { status: 'skipped', sentCount: 0, failCount: 0, error: 'User disabled all pushes', durationMs: Date.now() - start });
            }
            if (settings.pushTypes && settings.pushTypes[type] === false) {
                return finishUpdate(notificationId, { status: 'skipped', sentCount: 0, failCount: 0, error: `User disabled ${type} pushes`, durationMs: Date.now() - start });
            }
        }

        // 2. Get Tokens
        const tokens = await getActiveTokens(toUid);
        if (tokens.length === 0) {
            return finishUpdate(notificationId, { status: 'skipped', sentCount: 0, failCount: 0, error: 'no_tokens', durationMs: Date.now() - start });
        }

        // Cap tokens to prevent abuse
        const finalTokens = tokens.slice(0, 500); // For now, keep it simple with one batch of 500 max per user
        if (tokens.length > 500) {
            console.warn(`[sendPush] User ${toUid} has ${tokens.length} tokens. Capping to 500.`);
        }

        // 3. Build Payload
        const appIcon = await getAppIcon();
        const title = notificationData.title || 'Notification';
        const body = notificationData.body || '';
        const icon = notificationData.actorPhotoURL || notificationData.imageUrl || appIcon;

        // Ensure absolute URL or fallback
        const isAbsoluteUrl = (url: string) => url && (url.startsWith('http://') || url.startsWith('https://'));
        const safeIcon = isAbsoluteUrl(icon) ? icon : appIcon;

        const payload: any = {
            data: {
                notificationId,
                screen: notificationData.deeplink?.screen || 'notifications',
                paramsJson: JSON.stringify(notificationData.deeplink?.params || {}),
                title,
                body,
                imageUrl: safeIcon || null,
            },
            webpush: {
                headers: { Urgency: 'high' },
                fcmOptions: {
                    link: notificationData.deeplinkUrl || '/'
                }
            },
            tokens: finalTokens,
        };

        // We REMOVED top-level 'notification' and 'webpush.notification'.
        // This makes it a "Data-Only" message.
        // The Service Worker (firebase-messaging-sw.js) is responsible for calling showNotification.
        // This prevents the browser from showing its OWN default notification (which causes the "Double Pop").

        // 4. Send Multicast
        const response = await messaging.sendEachForMulticast(payload);

        let successCount = response.successCount;
        let failCount = response.failureCount;

        // 5. Cleanup Invalid Tokens
        if (failCount > 0) {
            for (let i = 0; i < response.responses.length; i++) {
                const resp = response.responses[i];
                if (!resp.success) {
                    const error = resp.error;
                    if (error?.code === 'messaging/invalid-registration-token' ||
                        error?.code === 'messaging/registration-token-not-registered') {
                        await disableInvalidToken(toUid, finalTokens[i]);
                    }
                }
            }
        }

        const result: SendPushResult = {
            status: successCount > 0 ? 'sent' : 'failed',
            sentCount: successCount,
            failCount: failCount,
            error: failCount > 0 ? (response.responses.find(r => !r.success)?.error?.message || 'FCM failure') : undefined,
            durationMs: Date.now() - start
        };

        return finishUpdate(notificationId, result);

    } catch (error: any) {
        console.error(`[sendPush] Fatal error for ${notificationId}:`, error);
        return finishUpdate(notificationId, {
            status: 'failed',
            sentCount: 0,
            failCount: 0,
            error: error.message || 'Fatal error',
            durationMs: Date.now() - start
        });
    }
}

async function finishUpdate(notificationId: string, result: SendPushResult): Promise<SendPushResult> {
    await db.collection('notifications').doc(notificationId).update({
        'push.status': result.status,
        'push.sentAt': admin.firestore.FieldValue.serverTimestamp(),
        'push.error': result.error || null,
        'push.durationMs': result.durationMs,
        'push.tokenCount': result.sentCount + result.failCount
    });

    console.info(`[sendPush] Finished ${notificationId} toUid=${notificationId} type=${result.status} duration=${result.durationMs}ms`);
    return result;
}
