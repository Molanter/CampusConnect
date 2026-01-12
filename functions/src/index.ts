import * as admin from 'firebase-admin';

// Initialize admin once at the top
if (!admin.apps.length) {
    admin.initializeApp();
}

// Export moderation functions
export { onReportCreated, moderatePost } from './moderation';

// Export comment counting functions
export {
    onCommentCreated as countCommentCreated,
    onCommentDeleted as countCommentDeleted,
    onReplyCreated as countReplyCreated,
    onReplyDeleted as countReplyDeleted
} from './commentCounts';

// Export seen post tracking
export { onSeenPostCreated } from './onSeenPostCreated';

// --- REFACSORED NOTIFICATION TRIGGERS (v2) ---
export {
    onPostLiked,
    onCommentCreated,
    onReplyCreated,
    onCommentLiked,
    onFollowCreated,
    onClubInviteCreated,
    onClubJoinRequestCreated
} from './notifications/triggers';

// Fallback Push Sender (v2)
export { sendPushNotification } from './pushSender';

// Test Notification (v2)
export { sendTestNotification } from './testNotification';
