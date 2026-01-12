/**
 * Cloud Functions for Notifications System
 * 
 * This file contains notification creation triggers and helpers.
 * Notifications are created SERVER-SIDE ONLY.
 * 
 * Deploy: firebase deploy --only functions
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

// Initialize admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * Notification type definitions
 */
type NotificationType =
    | "follow"
    | "club_invite"
    | "club_join_request"
    | "post_like"
    | "comment_like"
    | "comment_reply"
    | "post_comment"
    | "announcement"
    | "system";

interface CreateNotificationParams {
    toUid: string;
    type: NotificationType;
    title: string;
    body?: string | null;
    actorUid?: string | null;
    actorName?: string | null;
    actorPhotoURL?: string | null;
    campusId?: string | null;
    clubId?: string | null;
    postId?: string | null;
    commentId?: string | null;
    deeplink: {
        screen: string;
        params: Record<string, any>;
    };
    dedupeKey?: string | null;
    groupKey?: string | null;
    pushSend?: boolean;
    imageUrl?: string | null;
}

/**
 * Helper: Create a notification
 * Implements dedupe logic and self-notification prevention
 */
async function createNotification(params: CreateNotificationParams): Promise<void> {
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
        deeplink,
        dedupeKey = null,
        pushSend = true,
        imageUrl = null,
    } = params;

    // Prevent self-notifications
    if (actorUid && actorUid === toUid) {
        console.log(`[createNotification] Skipping self-notification for user ${toUid}`);
        return;
    }

    // Dedupe logic
    if (dedupeKey) {
        const existingQuery = await db
            .collection('notifications')
            .where('toUid', '==', toUid)
            .where('dedupeKey', '==', dedupeKey)
            .where('isRead', '==', false)
            .where('isArchived', '==', false)
            .limit(1)
            .get();

        if (!existingQuery.empty) {
            // Update existing notification (increment group count)
            const existingDoc = existingQuery.docs[0];
            const existingData = existingDoc.data();
            const newGroupCount = (existingData.groupCount || 1) + 1;

            await existingDoc.ref.update({
                groupCount: newGroupCount,
                title, // Update title to reflect latest action
                body,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            console.log(`[createNotification] Updated existing notification ${existingDoc.id} with dedupeKey ${dedupeKey}`);
            return;
        }
    }

    // Create new notification
    const notificationData = {
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
        imageUrl,
        deeplink,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        isRead: false,
        readAt: null,
        seenAt: null,
        isArchived: false,
        dedupeKey,
        groupKey: params.groupKey || dedupeKey,
        groupCount: params.groupKey ? 1 : null,
        push: {
            send: pushSend,
            status: 'pending',
            sentAt: null,
            error: null,
        },
        version: 1,
    };

    await db.collection('notifications').add(notificationData);
    console.log(`[createNotification] Created notification for ${toUid}, type: ${type}`);
}

/**
 * Cloud Function: onClubJoinRequestCreated
 * 
 * Trigger: onCreate(clubs/{clubId}/joinRequests/{requestId})
 * 
 * Notify club admins and owner when someone requests to join
 */
export const onClubJoinRequestCreated = functions
    .region('us-central1')
    .firestore
    .document('clubs/{clubId}/joinRequests/{requestId}')
    .onCreate(async (snapshot, context) => {
        const { clubId } = context.params;
        const requestData = snapshot.data();

        console.log(`[onClubJoinRequestCreated] New join request for club ${clubId}`);

        try {
            // Get club data
            const clubDoc = await db.collection('clubs').doc(clubId).get();
            if (!clubDoc.exists) {
                console.error(`[onClubJoinRequestCreated] Club ${clubId} not found`);
                return;
            }

            const clubData = clubDoc.data()!;
            const clubName = clubData.name || 'a club';

            // Get requester data
            const requesterUid = requestData.requesterUid || requestData.uid;
            if (!requesterUid) {
                console.error(`[onClubJoinRequestCreated] No requester UID found`);
                return;
            }

            const requesterDoc = await db.collection('users').doc(requesterUid).get();
            const requesterData = requesterDoc.exists ? requesterDoc.data()! : {};
            const requesterName = requesterData.displayName || requesterData.name || 'Someone';
            const requesterPhoto = requesterData.photoURL || requesterData.profilePhotoURL || null;

            // Get all club admins and owner
            const adminUids: Set<string> = new Set();

            // Add owner
            if (clubData.createdBy) {
                adminUids.add(clubData.createdBy);
            }
            if (clubData.ownerId) {
                adminUids.add(clubData.ownerId);
            }

            // Get admin members
            const membersSnapshot = await db
                .collection('clubs')
                .doc(clubId)
                .collection('members')
                .where('role', 'in', ['owner', 'admin'])
                .get();

            membersSnapshot.docs.forEach(doc => {
                const memberData = doc.data();
                if (memberData.uid) {
                    adminUids.add(memberData.uid);
                }
            });

            console.log(`[onClubJoinRequestCreated] Notifying ${adminUids.size} admins`);

            // Create notification for each admin
            const promises = Array.from(adminUids).map(adminUid =>
                createNotification({
                    toUid: adminUid,
                    type: 'club_join_request',
                    title: `${requesterName} requested to join ${clubName}`,
                    body: `Review the request in club settings`,
                    actorUid: requesterUid,
                    actorName: requesterName,
                    actorPhotoURL: requesterPhoto,
                    clubId,
                    campusId: clubData.campusId || null,
                    deeplink: {
                        screen: 'club_requests',
                        params: { clubId },
                    },
                    dedupeKey: `club_join_request:${adminUid}:${clubId}:${requesterUid}`,
                    pushSend: true,
                })
            );

            await Promise.all(promises);
            console.log(`[onClubJoinRequestCreated] Notifications created successfully`);

        } catch (error) {
            console.error(`[onClubJoinRequestCreated] Error creating notifications:`, error);
            throw error;
        }
    });

/**
 * Cloud Function: onFollowCreated
 * 
 * Trigger: onCreate(follows/{followId})
 * 
 * Notify user when someone follows them
 */
export const onFollowCreated = functions
    .region('us-central1')
    .firestore
    .document('follows/{followId}')
    .onCreate(async (snapshot, context) => {
        const followData = snapshot.data();
        const followerUid = followData.followerUid;
        const followedUid = followData.followedUid;

        console.log(`[onFollowCreated] ${followerUid} followed ${followedUid}`);

        try {
            // Get follower data
            const followerDoc = await db.collection('users').doc(followerUid).get();
            const followerData = followerDoc.exists ? followerDoc.data()! : {};
            const followerName = followerData.displayName || followerData.name || 'Someone';
            const followerPhoto = followerData.photoURL || followerData.profilePhotoURL || null;

            await createNotification({
                toUid: followedUid,
                type: 'follow',
                title: `${followerName} followed you`,
                actorUid: followerUid,
                actorName: followerName,
                actorPhotoURL: followerPhoto,
                deeplink: {
                    screen: 'profile',
                    params: { userId: followerUid },
                },
                dedupeKey: `follow:${followedUid}:${followerUid}`,
                pushSend: true,
            });

            console.log(`[onFollowCreated] Notification created successfully`);

        } catch (error) {
            console.error(`[onFollowCreated] Error creating notification:`, error);
            throw error;
        }
    });

/**
 * Cloud Function: onClubInviteCreated
 * 
 * Trigger: onCreate(clubs/{clubId}/invites/{inviteId})
 * 
 * Notify user when invited to join a club
 */
export const onClubInviteCreated = functions
    .region('us-central1')
    .firestore
    .document('clubs/{clubId}/invites/{inviteId}')
    .onCreate(async (snapshot, context) => {
        const { clubId } = context.params;
        const inviteData = snapshot.data();
        const toUid = inviteData.toUid || inviteData.inviteeUid;
        const fromUid = inviteData.fromUid || inviteData.inviterUid;

        console.log(`[onClubInviteCreated] ${fromUid} invited ${toUid} to club ${clubId}`);

        try {
            // Get club data
            const clubDoc = await db.collection('clubs').doc(clubId).get();
            if (!clubDoc.exists) {
                console.error(`[onClubInviteCreated] Club ${clubId} not found`);
                return;
            }
            const clubData = clubDoc.data()!;
            const clubName = clubData.name || 'a club';

            // Get inviter data
            const inviterDoc = await db.collection('users').doc(fromUid).get();
            const inviterData = inviterDoc.exists ? inviterDoc.data()! : {};
            const inviterName = inviterData.displayName || inviterData.name || 'Someone';
            const inviterPhoto = inviterData.photoURL || inviterData.profilePhotoURL || null;

            await createNotification({
                toUid,
                type: 'club_invite',
                title: `${inviterName} invited you to join ${clubName}`,
                body: 'Tap to view club',
                actorUid: fromUid,
                actorName: inviterName,
                actorPhotoURL: inviterPhoto,
                clubId,
                campusId: clubData.campusId || null,
                deeplink: {
                    screen: 'club',
                    params: { clubId },
                },
                dedupeKey: `club_invite:${toUid}:${clubId}`,
                pushSend: true,
            });

            console.log(`[onClubInviteCreated] Notification created successfully`);

        } catch (error) {
            console.error(`[onClubInviteCreated] Error creating notification:`, error);
            throw error;
        }
    });

/**
 * Cloud Function: onPostLiked
 * 
 * Trigger: onUpdate(posts/{postId})
 * 
 * Notify post owner when someone likes their post via the 'likes' array
 */
export const onPostLiked = functions
    .region('us-central1')
    .firestore
    .document('posts/{postId}')
    .onUpdate(async (change, context) => {
        const { postId } = context.params;
        const beforeData = change.before.data();
        const afterData = change.after.data();

        const beforeLikes = beforeData.likes || [];
        const afterLikes = afterData.likes || [];

        // Check if a new like was added
        if (afterLikes.length <= beforeLikes.length) {
            return;
        }

        // Find the newly added UIDs
        const newLikers = afterLikes.filter((uid: string) => !beforeLikes.includes(uid));

        if (newLikers.length === 0) return;

        // Process only the latest liker (to prevent notification storm if multiple added at once)
        const likerUid = newLikers[newLikers.length - 1];

        console.log(`[onPostLiked] New like detected from ${likerUid} on post ${postId}`);

        try {
            const postOwnerUid = afterData.authorUid || afterData.authorId || afterData.createdBy;

            if (!postOwnerUid) {
                console.error(`[onPostLiked] No owner found for post ${postId}`);
                return;
            }

            // Skip if liker is the post owner (self-like)
            if (likerUid === postOwnerUid) {
                console.log(`[onPostLiked] Skipping self-like notification`);
                return;
            }

            // Get liker data
            const likerDoc = await db.collection('users').doc(likerUid).get();
            const likerData = likerDoc.exists ? likerDoc.data()! : {};
            const likerName = likerData.displayName || likerData.name || 'Someone';
            const likerPhoto = likerData.photoURL || likerData.profilePhotoURL || null;

            // Check for existing unread like notification for this post (grouping)
            const groupKey = `post_like:${postOwnerUid}:${postId}`;
            const existingQuery = await db
                .collection('notifications')
                .where('toUid', '==', postOwnerUid)
                .where('groupKey', '==', groupKey)
                .where('isRead', '==', false)
                .where('isArchived', '==', false)
                .limit(1)
                .get();

            if (!existingQuery.empty) {
                // Update existing notification with new liker and increment count
                const existingDoc = existingQuery.docs[0];
                const existingData = existingDoc.data();
                const newGroupCount = (existingData.groupCount || 1) + 1;

                const newTitle = newGroupCount === 2
                    ? `${likerName} and 1 other liked your post`
                    : `${likerName} and ${newGroupCount - 1} others liked your post`;

                await existingDoc.ref.update({
                    groupCount: newGroupCount,
                    title: newTitle,
                    actorUid: likerUid,
                    actorName: likerName,
                    actorPhotoURL: likerPhoto,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    'push.status': 'pending',
                    'push.sentAt': null,
                    'push.error': null,
                });

                console.log(`[onPostLiked] Updated grouped notification (count: ${newGroupCount})`);
            } else {
                // Create new notification (first like)
                await createNotification({
                    toUid: postOwnerUid,
                    type: 'post_like',
                    title: `${likerName} liked your post`,
                    actorUid: likerUid,
                    actorName: likerName,
                    actorPhotoURL: likerPhoto,
                    postId,
                    campusId: afterData.campusId || null,
                    clubId: afterData.clubId || null,
                    deeplink: {
                        screen: 'post',
                        params: { postId },
                    },
                    dedupeKey: `post_like:${postOwnerUid}:${postId}:${likerUid}`,
                    groupKey: groupKey,
                    pushSend: true,
                });

                console.log(`[onPostLiked] Created new like notification`);
            }

        } catch (error) {
            console.error(`[onPostLiked] Error creating notification:`, error);
        }
    });

/**
 * Cloud Function: onCommentCreated
 * 
 * Trigger: onCreate(posts/{postId}/comments/{commentId})
 * 
 * Handles two cases:
 * 1. Comment on post -> notify post owner
 * 2. Reply to comment -> notify parent comment author
 */
export const onCommentCreated = functions
    .region('us-central1')
    .firestore
    .document('posts/{postId}/comments/{commentId}')
    .onCreate(async (snapshot, context) => {
        const { postId, commentId } = context.params;
        const commentData = snapshot.data();
        const authorUid = commentData.authorUid || commentData.authorId;
        const replyToCommentId = commentData.replyToCommentId || commentData.parentCommentId;
        const bodyPreview = (commentData.text || commentData.body || '').substring(0, 100);

        console.log(`[onCommentCreated] Comment ${commentId} on post ${postId} by ${authorUid}`);

        try {
            // Get post data
            const postDoc = await db.collection('posts').doc(postId).get();
            if (!postDoc.exists) {
                console.error(`[onCommentCreated] Post ${postId} not found`);
                return;
            }

            const postData = postDoc.data()!;
            const postOwnerUid = postData.authorUid || postData.authorId || postData.createdBy;

            // Get commenter data
            const commenterDoc = await db.collection('users').doc(authorUid).get();
            const commenterData = commenterDoc.exists ? commenterDoc.data()! : {};
            const commenterName = commenterData.displayName || commenterData.name || 'Someone';
            const commenterPhoto = commenterData.photoURL || commenterData.profilePhotoURL || null;

            if (replyToCommentId) {
                // Case 2: Reply to comment
                const parentCommentDoc = await db
                    .collection('posts')
                    .doc(postId)
                    .collection('comments')
                    .doc(replyToCommentId)
                    .get();

                if (!parentCommentDoc.exists) {
                    console.error(`[onCommentCreated] Parent comment ${replyToCommentId} not found`);
                    return;
                }

                const parentCommentData = parentCommentDoc.data()!;
                const parentAuthorUid = parentCommentData.authorUid || parentCommentData.authorId;

                // Skip if replying to own comment
                if (authorUid === parentAuthorUid) {
                    console.log(`[onCommentCreated] Skipping self-reply notification`);
                    return;
                }

                await createNotification({
                    toUid: parentAuthorUid,
                    type: 'comment_reply',
                    title: `${commenterName} replied to your comment`,
                    body: bodyPreview,
                    actorUid: authorUid,
                    actorName: commenterName,
                    actorPhotoURL: commenterPhoto,
                    postId,
                    commentId,
                    campusId: postData.campusId || null,
                    clubId: postData.clubId || null,
                    deeplink: {
                        screen: 'post',
                        params: { postId, commentId },
                    },
                    dedupeKey: `comment_reply:${parentAuthorUid}:${postId}:${replyToCommentId}:${authorUid}`,
                    pushSend: true,
                });

                console.log(`[onCommentCreated] Reply notification created`);

            } else {
                // Case 1: Top-level comment on post
                if (!postOwnerUid) {
                    console.error(`[onCommentCreated] No owner found for post ${postId}`);
                    return;
                }

                // Skip if commenting on own post
                if (authorUid === postOwnerUid) {
                    console.log(`[onCommentCreated] Skipping self-comment notification`);
                    return;
                }

                await createNotification({
                    toUid: postOwnerUid,
                    type: 'post_comment',
                    title: `${commenterName} commented on your post`,
                    body: bodyPreview,
                    actorUid: authorUid,
                    actorName: commenterName,
                    actorPhotoURL: commenterPhoto,
                    postId,
                    commentId,
                    campusId: postData.campusId || null,
                    clubId: postData.clubId || null,
                    deeplink: {
                        screen: 'post',
                        params: { postId, commentId },
                    },
                    dedupeKey: `post_comment:${postOwnerUid}:${postId}:${authorUid}`,
                    pushSend: true,
                });

                console.log(`[onCommentCreated] Comment notification created`);
            }

        } catch (error) {
            console.error(`[onCommentCreated] Error creating notification:`, error);
            throw error;
        }
    });

/**
 * Cloud Function: onCommentLiked
 * 
 * Trigger: onUpdate(posts/{postId}/comments/{commentId})
 * 
 * Notify comment author when someone likes their comment via the 'likes' array
 */
export const onCommentLiked = functions
    .region('us-central1')
    .firestore
    .document('posts/{postId}/comments/{commentId}')
    .onUpdate(async (change, context) => {
        const { postId, commentId } = context.params;
        const afterData = change.after.data();
        const beforeData = change.before.data();

        const beforeLikes = beforeData.likes || [];
        const afterLikes = afterData.likes || [];

        // Only proceed if a new like was added
        if (afterLikes.length <= beforeLikes.length) return;

        const newLikers = afterLikes.filter((uid: string) => !beforeLikes.includes(uid));
        if (newLikers.length === 0) return;

        const likerUid = newLikers[newLikers.length - 1];
        console.log(`[onCommentLiked] New like from ${likerUid} on comment ${commentId}`);

        try {
            const commentAuthorUid = afterData.authorUid || afterData.authorId || afterData.createdBy;
            if (!commentAuthorUid || likerUid === commentAuthorUid) return;

            // Get liker data
            const likerDoc = await db.collection('users').doc(likerUid).get();
            const likerData = likerDoc.exists ? likerDoc.data()! : {};
            const likerName = likerData.displayName || likerData.name || 'Someone';
            const likerPhoto = likerData.photoURL || likerData.profilePhotoURL || null;

            // Get post data for context
            const postDoc = await db.collection('posts').doc(postId).get();
            const postData = postDoc.exists ? postDoc.data()! : {};

            const groupKey = `comment_like:${commentAuthorUid}:${commentId}`;
            const existingQuery = await db
                .collection('notifications')
                .where('toUid', '==', commentAuthorUid)
                .where('groupKey', '==', groupKey)
                .where('isRead', '==', false)
                .where('isArchived', '==', false)
                .limit(1)
                .get();

            if (!existingQuery.empty) {
                const existingDoc = existingQuery.docs[0];
                const existingData = existingDoc.data();
                const newGroupCount = (existingData.groupCount || 1) + 1;

                const newTitle = newGroupCount === 2
                    ? `${likerName} and 1 other liked your comment`
                    : `${likerName} and ${newGroupCount - 1} others liked your comment`;

                await existingDoc.ref.update({
                    groupCount: newGroupCount,
                    title: newTitle,
                    actorUid: likerUid,
                    actorName: likerName,
                    actorPhotoURL: likerPhoto,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    'push.status': 'pending',
                    'push.sentAt': null,
                    'push.error': null,
                });
            } else {
                await createNotification({
                    toUid: commentAuthorUid,
                    type: 'comment_like',
                    title: `${likerName} liked your comment`,
                    actorUid: likerUid,
                    actorName: likerName,
                    actorPhotoURL: likerPhoto,
                    postId,
                    commentId,
                    campusId: postData.campusId || null,
                    clubId: postData.clubId || null,
                    deeplink: {
                        screen: 'post',
                        params: { postId, commentId },
                    },
                    dedupeKey: `comment_like:${commentAuthorUid}:${commentId}:${likerUid}`,
                    groupKey: groupKey,
                    pushSend: true,
                });
            }
        } catch (error) {
            console.error(`[onCommentLiked] Error:`, error);
        }
    });

/**
 * Cloud Function: onReplyLiked
 * 
 * Trigger: onUpdate(posts/{postId}/comments/{commentId}/replies/{replyId})
 * 
 * Notify reply author when someone likes their reply via the 'likes' array
 */
export const onReplyLiked = functions
    .region('us-central1')
    .firestore
    .document('posts/{postId}/comments/{commentId}/replies/{replyId}')
    .onUpdate(async (change, context) => {
        const { postId, commentId, replyId } = context.params;
        const afterData = change.after.data();
        const beforeData = change.before.data();

        const beforeLikes = beforeData.likes || [];
        const afterLikes = afterData.likes || [];

        if (afterLikes.length <= beforeLikes.length) return;

        const newLikers = afterLikes.filter((uid: string) => !beforeLikes.includes(uid));
        if (newLikers.length === 0) return;

        const likerUid = newLikers[newLikers.length - 1];
        console.log(`[onReplyLiked] New like from ${likerUid} on reply ${replyId}`);

        try {
            const replyAuthorUid = afterData.authorUid || afterData.authorId || afterData.createdBy;
            if (!replyAuthorUid || likerUid === replyAuthorUid) return;

            const likerDoc = await db.collection('users').doc(likerUid).get();
            const likerData = likerDoc.exists ? likerDoc.data()! : {};
            const likerName = likerData.displayName || likerData.name || 'Someone';
            const likerPhoto = likerData.photoURL || likerData.profilePhotoURL || null;

            const postDoc = await db.collection('posts').doc(postId).get();
            const postData = postDoc.exists ? postDoc.data()! : {};

            const groupKey = `reply_like:${replyAuthorUid}:${replyId}`;
            const existingQuery = await db
                .collection('notifications')
                .where('toUid', '==', replyAuthorUid)
                .where('groupKey', '==', groupKey)
                .where('isRead', '==', false)
                .where('isArchived', '==', false)
                .limit(1)
                .get();

            if (!existingQuery.empty) {
                const existingDoc = existingQuery.docs[0];
                const existingData = existingDoc.data();
                const newGroupCount = (existingData.groupCount || 1) + 1;

                const newTitle = newGroupCount === 2
                    ? `${likerName} and 1 other liked your reply`
                    : `${likerName} and ${newGroupCount - 1} others liked your reply`;

                await existingDoc.ref.update({
                    groupCount: newGroupCount,
                    title: newTitle,
                    actorUid: likerUid,
                    actorName: likerName,
                    actorPhotoURL: likerPhoto,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    'push.status': 'pending',
                    'push.sentAt': null,
                    'push.error': null,
                });
            } else {
                await createNotification({
                    toUid: replyAuthorUid,
                    type: 'comment_like', // Use same type for simplicity in UI if needed
                    title: `${likerName} liked your reply`,
                    actorUid: likerUid,
                    actorName: likerName,
                    actorPhotoURL: likerPhoto,
                    postId,
                    commentId,
                    campusId: postData.campusId || null,
                    clubId: postData.clubId || null,
                    deeplink: {
                        screen: 'post',
                        params: { postId, commentId },
                    },
                    dedupeKey: `reply_like:${replyAuthorUid}:${replyId}:${likerUid}`,
                    groupKey: groupKey,
                    pushSend: true,
                });
            }
        } catch (error) {
            console.error(`[onReplyLiked] Error:`, error);
        }
    });
