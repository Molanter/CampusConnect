import * as functions from 'firebase-functions';
import { createNotificationDoc } from './createNotification';
import { sendPushUpdateStatus } from '../push/sendPush';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Trigger: Post Liked
 */
export const onPostLiked = functions
    .firestore
    .document('posts/{postId}')
    .onUpdate(async (change, context) => {
        const afterData = change.after.data();
        const beforeData = change.before.data();
        if (!afterData || !beforeData) return;

        const afterLikes = afterData.likes || [];
        const beforeLikes = beforeData.likes || [];

        if (afterLikes.length <= beforeLikes.length) return;

        const newLikers = afterLikes.filter((uid: string) => !beforeLikes.includes(uid));
        if (newLikers.length === 0) return;

        const likerUid = newLikers[newLikers.length - 1];
        const postId = context.params.postId;
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
export const onCommentCreated = functions
    .firestore
    .document('posts/{postId}/comments/{commentId}')
    .onCreate(async (snapshot, context) => {
        const commentData = snapshot.data();
        if (!commentData) return;

        const { postId, commentId } = context.params;
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
    });

/**
 * Trigger: New Reply
 */
export const onReplyCreated = functions
    .firestore
    .document('posts/{postId}/comments/{commentId}/replies/{replyId}')
    .onCreate(async (snapshot, context) => {
        const replyData = snapshot.data();
        if (!replyData) return;

        const { postId, commentId } = context.params;
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
export const onCommentLiked = functions
    .firestore
    .document('posts/{postId}/comments/{commentId}')
    .onUpdate(async (change, context) => {
        const afterData = change.after.data();
        const beforeData = change.before.data();
        if (!afterData || !beforeData) return;

        const afterLikes = afterData.likes || [];
        const beforeLikes = beforeData.likes || [];

        // Find new likers
        const newLikers = afterLikes.filter((uid: string) => !beforeLikes.includes(uid));
        if (newLikers.length === 0) return;

        const likerUid = newLikers[newLikers.length - 1];
        const { postId, commentId } = context.params;
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
export const onReplyLiked = functions
    .firestore
    .document('posts/{postId}/comments/{commentId}/replies/{replyId}')
    .onUpdate(async (change, context) => {
        const afterData = change.after.data();
        const beforeData = change.before.data();
        if (!afterData || !beforeData) return;

        const afterLikes = afterData.likes || [];
        const beforeLikes = beforeData.likes || [];

        // Find new likers
        const newLikers = afterLikes.filter((uid: string) => !beforeLikes.includes(uid));
        if (newLikers.length === 0) return;

        const likerUid = newLikers[newLikers.length - 1];
        const { postId, commentId, replyId } = context.params;
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
export const onFollowCreated = functions
    .firestore
    .document('follows/{followId}')
    .onCreate(async (snapshot, context) => {
        const followData = snapshot.data();
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
export const onClubInviteCreated = functions
    .firestore
    .document('clubs/{clubId}/invites/{inviteId}')
    .onCreate(async (snapshot, context) => {
        const inviteData = snapshot.data();
        if (!inviteData) return;

        const toUid = inviteData.toUid;
        const inviterUid = inviteData.invitedBy;
        const clubId = context.params.clubId;

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
export const onClubJoinRequestCreated = functions
    .firestore
    .document('clubs/{clubId}/joinRequests/{requestId}')
    .onCreate(async (snapshot, context) => {
        const requestData = snapshot.data();
        if (!requestData) return;

        const requesterUid = requestData.uid;
        const clubId = context.params.clubId;

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
