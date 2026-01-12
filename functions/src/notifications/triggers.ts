import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { createNotificationDoc } from './createNotification';
import { sendPushUpdateStatus } from '../push/sendPush';
import * as admin from 'firebase-admin';

const db = admin.firestore();

const v2Options = {
    region: 'us-central1',
    minInstances: 1,
    maxInstances: 10,
    memory: '256MiB' as const,
};

/**
 * Trigger: Post Liked
 */
export const onPostLiked = onDocumentUpdated({ ...v2Options, document: 'posts/{postId}' }, async (event) => {
    const afterData = event.data?.after.data();
    const beforeData = event.data?.before.data();
    if (!afterData || !beforeData) return;

    const afterLikes = afterData.likes || [];
    const beforeLikes = beforeData.likes || [];

    if (afterLikes.length <= beforeLikes.length) return;

    const newLikers = afterLikes.filter((uid: string) => !beforeLikes.includes(uid));
    if (newLikers.length === 0) return;

    const likerUid = newLikers[newLikers.length - 1];
    const postId = event.params.postId;
    const authorUid = afterData.authorUid || afterData.authorId || afterData.createdBy;

    if (!authorUid || authorUid === likerUid) return;

    const likerDoc = await db.collection('users').doc(likerUid).get();
    const likerName = likerDoc.data()?.displayName || likerDoc.data()?.name || 'Someone';
    const likerPhoto = likerDoc.data()?.photoURL || likerDoc.data()?.profilePhotoURL || null;

    const { id, data } = await createNotificationDoc({
        toUid: authorUid,
        type: 'post_like',
        title: `${likerName} liked your post`,
        actorUid: likerUid,
        actorName: likerName,
        actorPhotoURL: likerPhoto,
        postId,
        deeplink: { screen: 'post', params: { postId } },
        groupKey: `post_like:${authorUid}:${postId}`,
    });

    if (id && data && (data.push?.status === 'pending')) {
        await sendPushUpdateStatus(id, data);
    }
});

/**
 * Trigger: New Comment
 */
export const onCommentCreated = onDocumentCreated({ ...v2Options, document: 'posts/{postId}/comments/{commentId}' }, async (event) => {
    const commentData = event.data?.data();
    if (!commentData) return;

    const { postId, commentId } = event.params;
    const commentAuthorUid = commentData.authorUid || commentData.authorId;

    // 1. Notify Post Owner
    const postDoc = await db.collection('posts').doc(postId).get();
    const postData = postDoc.data();
    const postOwnerUid = postData?.authorUid || postData?.authorId || postData?.createdBy;

    if (postOwnerUid && postOwnerUid !== commentAuthorUid) {
        // Fetch commenter name to avoid "Someone"
        const commenterDoc = await db.collection('users').doc(commentAuthorUid).get();
        const commenterName = commenterDoc.data()?.displayName || commenterDoc.data()?.name || 'Someone';
        const commenterPhoto = commenterDoc.data()?.photoURL || commenterDoc.data()?.profilePhotoURL || null;

        const { id, data } = await createNotificationDoc({
            toUid: postOwnerUid,
            type: 'post_comment',
            title: `${commenterName} commented on your post`,
            body: commentData.content || commentData.text || commentData.body || '',
            actorUid: commentAuthorUid,
            actorName: commenterName,
            actorPhotoURL: commenterPhoto,
            postId,
            commentId,
            deeplink: { screen: 'post', params: { postId, commentId } },
        });

        if (id && data) await sendPushUpdateStatus(id, data);
    }

    // 2. Notify Parent Comment Owner (if reply) - handled by onReplyCreated if using that structure
    // Since this trigger is for posts/{postId}/comments/{commentId}, let's look for sub-trigger if needed.
    // The current schema has posts/{postId}/comments/{commentId}/replies/{replyId}
});

/**
 * Trigger: New Reply
 */
export const onReplyCreated = onDocumentCreated({ ...v2Options, document: 'posts/{postId}/comments/{commentId}/replies/{replyId}' }, async (event) => {
    const replyData = event.data?.data();
    if (!replyData) return;

    const { postId, commentId } = event.params;
    const replyAuthorUid = replyData.authorUid || replyData.authorId;

    const parentCommentDoc = await db.collection('posts').doc(postId).collection('comments').doc(commentId).get();
    const parentAuthorUid = parentCommentDoc.data()?.authorUid || parentCommentDoc.data()?.authorId;

    if (parentAuthorUid && parentAuthorUid !== replyAuthorUid) {
        // Fetch replier name
        const replierDoc = await db.collection('users').doc(replyAuthorUid).get();
        const replierName = replierDoc.data()?.displayName || replierDoc.data()?.name || 'Someone';
        const replierPhoto = replierDoc.data()?.photoURL || replierDoc.data()?.profilePhotoURL || null;

        const { id, data } = await createNotificationDoc({
            toUid: parentAuthorUid,
            type: 'comment_reply',
            title: `${replierName} replied to your comment`,
            body: replyData.content || replyData.text || replyData.body || '',
            actorUid: replyAuthorUid,
            actorName: replierName,
            actorPhotoURL: replierPhoto,
            postId,
            commentId,
            deeplink: { screen: 'post', params: { postId, commentId } },
        });

        if (id && data && (data.push?.status === 'pending')) await sendPushUpdateStatus(id, data);
    }
});

/**
 * Trigger: Comment Liked
 */
export const onCommentLiked = onDocumentUpdated({ ...v2Options, document: 'posts/{postId}/comments/{commentId}' }, async (event) => {
    const afterData = event.data?.after.data();
    const beforeData = event.data?.before.data();
    if (!afterData || !beforeData) return;

    const afterLikes = afterData.likes || [];
    const beforeLikes = beforeData.likes || [];

    // Find new likers
    const newLikers = afterLikes.filter((uid: string) => !beforeLikes.includes(uid));
    if (newLikers.length === 0) return;

    const likerUid = newLikers[newLikers.length - 1];
    const { postId, commentId } = event.params;
    const authorUid = afterData.authorUid || afterData.authorId;

    console.log(`[onCommentLiked] New like on ${commentId} by ${likerUid}. Author: ${authorUid}`);

    if (!authorUid) {
        console.log(`[onCommentLiked] Skipping: No authorUid found for comment ${commentId}`);
        return;
    }

    if (authorUid === likerUid) {
        console.log(`[onCommentLiked] Skipping: Self-like by ${likerUid}`);
        return;
    }

    const likerDoc = await db.collection('users').doc(likerUid).get();
    const likerName = likerDoc.data()?.displayName || likerDoc.data()?.name || 'Someone';
    const likerPhoto = likerDoc.data()?.photoURL || likerDoc.data()?.profilePhotoURL || null;

    const { id, data, wasUpdated } = await createNotificationDoc({
        toUid: authorUid,
        type: 'comment_like',
        title: `${likerName} liked your comment`,
        actorUid: likerUid,
        actorName: likerName,
        actorPhotoURL: likerPhoto,
        postId,
        commentId,
        deeplink: { screen: 'post', params: { postId, commentId } },
        groupKey: `comment_like:${authorUid}:${commentId}`,
    });

    console.log(`[onCommentLiked] Notification ${id} created/updated. wasUpdated: ${wasUpdated}. Push status: ${data?.push?.status}`);

    if (id && data && data.push?.status === 'pending') {
        await sendPushUpdateStatus(id, data);
    }
});

/**
 * Trigger: Reply Liked
 */
export const onReplyLiked = onDocumentUpdated({ ...v2Options, document: 'posts/{postId}/comments/{commentId}/replies/{replyId}' }, async (event) => {
    const afterData = event.data?.after.data();
    const beforeData = event.data?.before.data();
    if (!afterData || !beforeData) return;

    const afterLikes = afterData.likes || [];
    const beforeLikes = beforeData.likes || [];

    // Find new likers
    const newLikers = afterLikes.filter((uid: string) => !beforeLikes.includes(uid));
    if (newLikers.length === 0) return;

    const likerUid = newLikers[newLikers.length - 1];
    const { postId, commentId, replyId } = event.params;
    const authorUid = afterData.authorUid || afterData.authorId;

    console.log(`[onReplyLiked] New like on ${replyId} by ${likerUid}. Author: ${authorUid}`);

    if (!authorUid) {
        console.log(`[onReplyLiked] Skipping: No authorUid found for reply ${replyId}`);
        return;
    }

    if (authorUid === likerUid) {
        console.log(`[onReplyLiked] Skipping: Self-like by ${likerUid}`);
        return;
    }

    const likerDoc = await db.collection('users').doc(likerUid).get();
    const likerName = likerDoc.data()?.displayName || likerDoc.data()?.name || 'Someone';
    const likerPhoto = likerDoc.data()?.photoURL || likerDoc.data()?.profilePhotoURL || null;

    const { id, data, wasUpdated } = await createNotificationDoc({
        toUid: authorUid,
        type: 'comment_like',
        title: `${likerName} liked your reply`,
        actorUid: likerUid,
        actorName: likerName,
        actorPhotoURL: likerPhoto,
        postId,
        commentId,
        replyId,
        deeplink: { screen: 'post', params: { postId, commentId } },
        groupKey: `reply_like:${authorUid}:${replyId}`,
    });

    console.log(`[onReplyLiked] Notification ${id} created/updated. wasUpdated: ${wasUpdated}. Push status: ${data?.push?.status}`);

    if (id && data && data.push?.status === 'pending') {
        await sendPushUpdateStatus(id, data);
    }
});

/**
 * Trigger: New Follower
 */
export const onFollowCreated = onDocumentCreated({ ...v2Options, document: 'follows/{followId}' }, async (event) => {
    const followData = event.data?.data();
    if (!followData) return;

    const followerUid = followData.followerUid;
    const followedUid = followData.followedUid;

    if (!followerUid || !followedUid || followerUid === followedUid) return;

    const followerDoc = await db.collection('users').doc(followerUid).get();
    const followerName = followerDoc.data()?.displayName || followerDoc.data()?.name || 'Someone';
    const followerPhoto = followerDoc.data()?.photoURL || followerDoc.data()?.profilePhotoURL || null;

    const { id, data } = await createNotificationDoc({
        toUid: followedUid,
        type: 'follow',
        title: `${followerName} followed you`,
        actorUid: followerUid,
        actorName: followerName,
        actorPhotoURL: followerPhoto,
        deeplink: { screen: 'profile', params: { uid: followerUid } },
        dedupeKey: `follow:${followedUid}:${followerUid}`,
    });

    if (id && data) await sendPushUpdateStatus(id, data);
});

/**
 * Trigger: Club Invite
 */
export const onClubInviteCreated = onDocumentCreated({ ...v2Options, document: 'clubs/{clubId}/invites/{inviteId}' }, async (event) => {
    const inviteData = event.data?.data();
    if (!inviteData) return;

    const toUid = inviteData.toUid;
    const inviterUid = inviteData.invitedBy;
    const clubId = event.params.clubId;

    const inviterDoc = await db.collection('users').doc(inviterUid).get();
    const inviterName = inviterDoc.data()?.displayName || inviterDoc.data()?.name || 'Someone';
    const inviterPhoto = inviterDoc.data()?.photoURL || inviterDoc.data()?.profilePhotoURL || null;

    const { id, data } = await createNotificationDoc({
        toUid,
        type: 'club_invite',
        title: `${inviterName} invited you to join a club`,
        actorUid: inviterUid,
        actorName: inviterName,
        actorPhotoURL: inviterPhoto,
        clubId,
        deeplink: { screen: 'club', params: { clubId } },
    });

    if (id && data) await sendPushUpdateStatus(id, data);
});

/**
 * Trigger: Club Join Request
 */
export const onClubJoinRequestCreated = onDocumentCreated({ ...v2Options, document: 'clubs/{clubId}/joinRequests/{requestId}' }, async (event) => {
    const requestData = event.data?.data();
    if (!requestData) return;

    const requesterUid = requestData.uid;
    const clubId = event.params.clubId;

    const clubDoc = await db.collection('clubs').doc(clubId).get();
    const clubData = clubDoc.data();
    const ownerUid = clubData?.ownerUid;

    const requesterDoc = await db.collection('users').doc(requesterUid).get();
    const requesterName = requesterDoc.data()?.displayName || requesterDoc.data()?.name || 'Someone';
    const requesterPhoto = requesterDoc.data()?.photoURL || requesterDoc.data()?.profilePhotoURL || null;

    if (ownerUid) {
        const { id, data } = await createNotificationDoc({
            toUid: ownerUid,
            type: 'club_join_request',
            title: `${requesterName} requested to join your club`,
            actorUid: requesterUid,
            actorName: requesterName,
            actorPhotoURL: requesterPhoto,
            clubId,
            deeplink: { screen: 'club_settings', params: { clubId, tab: 'members' } },
        });

        if (id && data) await sendPushUpdateStatus(id, data);
    }
});
