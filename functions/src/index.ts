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

// --- NOTIFICATION TRIGGERS (v1) ---
export {
    onPostLiked,
    onCommentCreated,
    onReplyCreated,
    onCommentLiked,
    onReplyLiked,
    onFollowCreated,
    onClubInviteCreated,
    onClubJoinRequestCreated
} from './notifications/triggers';

// Fallback Push Sender (v1)
export { sendPushNotification } from './pushSender';

// Test Notification (v1)
export { sendTestNotification } from './testNotification';
