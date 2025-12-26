/**
 * Cloud Functions for Post Reporting and Moderation System
 * 
 * This file contains:
 * 1. onReportCreated - Triggered when a new report is added
 * 2. moderatePost - Callable function for admin moderation actions
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

const REPORT_THRESHOLD = 3;

/**
 * Cloud Function: onReportCreated
 * 
 * Trigger: onCreate(posts/{postId}/reports/{reporterUid})
 * 
 * This function:
 * 1. Increments the post's reportCount
 * 2. If reportCount >= 3 and visibility is "visible", sets visibility to "under_review"
 * 3. Creates/updates moderation queue entry
 * 4. Logs actions to audit trail
 */
export const onReportCreated = functions.firestore
    .document('posts/{postId}/reports/{reporterUid}')
    .onCreate(async (snapshot, context) => {
        const { postId, reporterUid } = context.params;
        const reportData = snapshot.data();

        console.log(`[onReportCreated v4 - single-read tx] New report for post ${postId} by ${reporterUid}`);

        try {
            // IMPORTANT: Firestore tx requires all reads before any writes. Do not add tx.get after writes.
            await db.runTransaction(async (transaction) => {
                const postRef = db.collection('posts').doc(postId);
                const queueRef = db.collection('moderationQueue').doc(`post_${postId}`);

                // SINGLE READ ONLY (no queue read needed)
                const postDoc = await transaction.get(postRef);

                if (!postDoc.exists) {
                    console.error(`[onReportCreated] Post ${postId} not found`);
                    return;
                }

                // COMPUTE IN MEMORY
                const postData = postDoc.data();
                const currentReportCount = postData?.reportCount || 0;
                const currentVisibility = postData?.visibility || "visible";
                const newReportCount = currentReportCount + 1;
                const shouldAutoReview = currentVisibility === "visible" && newReportCount >= REPORT_THRESHOLD;

                console.log(`[onReportCreated] ReportCount: ${currentReportCount} -> ${newReportCount}, AutoReview: ${shouldAutoReview}`);

                // ALL WRITES (no reads after this point)
                // Write 1: Update post
                const postUpdates: any = {
                    reportCount: newReportCount
                };

                if (shouldAutoReview) {
                    postUpdates.visibility = "under_review";
                    postUpdates.reportedAt = admin.firestore.FieldValue.serverTimestamp();
                }

                transaction.update(postRef, postUpdates);

                // Write 2: Create/Update moderation queue if threshold reached (merge avoids read)
                if (shouldAutoReview) {
                    transaction.set(queueRef, {
                        targetType: "post",
                        targetId: postId,
                        state: "needs_review",
                        reportCount: newReportCount,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        ownerUid: postData?.authorId || postData?.ownerUid || ""
                    }, { merge: true });

                    // Write 3: Create audit log
                    const auditRef = db.collection('auditLogs').doc();
                    transaction.set(auditRef, {
                        targetType: "post",
                        targetId: postId,
                        action: "auto_under_review",
                        actorType: "system",
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            });

            // Create audit log entry for report (non-blocking, outside transaction)
            await db.collection('auditLogs').add({
                targetType: "post",
                targetId: postId,
                action: "report_added",
                actorType: "user",
                actorUid: reporterUid,
                reason: reportData.reason,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`[onReportCreated] Successfully processed report for post ${postId}`);

        } catch (error) {
            console.error(`[onReportCreated] Error processing report for post ${postId}:`, error);
            throw error;
        }
    });

/**
 * Cloud Function: moderatePost
 * 
 * Callable HTTPS function for admin moderation actions
 * 
 * Parameters:
 * - postId: string
 * - action: "restore" | "hide" | "dismiss"
 * - note?: string (optional)
 */
export const moderatePost = functions.https.onCall(async (data, context) => {
    // Check authentication
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'User must be authenticated to moderate posts'
        );
    }

    const { postId, action, note } = data;

    // Validate parameters
    if (!postId || typeof postId !== 'string') {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'postId is required and must be a string'
        );
    }

    if (!action || !['restore', 'hide', 'dismiss'].includes(action)) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'action must be one of: restore, hide, dismiss'
        );
    }

    // Check if user is admin
    const userEmail = context.auth.token.email?.toLowerCase();
    const adminConfigRef = db.collection('config').doc('admin');
    const adminConfig = await adminConfigRef.get();
    const globalAdminEmails = (adminConfig.data()?.globalAdminEmails || []).map((e: string) => e.toLowerCase());

    if (!userEmail || !globalAdminEmails.includes(userEmail)) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'Only admins can moderate posts'
        );
    }

    console.log(`[moderatePost] Admin ${userEmail} performing ${action} on post ${postId}`);

    try {
        const postRef = db.collection('posts').doc(postId);
        const queueRef = db.collection('moderationQueue').doc(`post_${postId}`);

        await db.runTransaction(async (transaction) => {
            // READS FIRST - must come before any writes
            const postDoc = await transaction.get(postRef);
            const queueDoc = await transaction.get(queueRef);

            // Fetch reports if restoring (must be done in read phase)
            let reportsSnapshot: admin.firestore.QuerySnapshot | null = null;
            if (action === 'restore') {
                reportsSnapshot = await transaction.get(db.collection('posts').doc(postId).collection('reports'));
            }

            if (!postDoc.exists) {
                throw new functions.https.HttpsError(
                    'not-found',
                    `Post ${postId} not found`
                );
            }

            const updates: any = {};
            let queueState: string;
            let auditAction: string;

            switch (action) {
                case 'restore':
                    updates.visibility = 'visible';
                    updates.reportCount = 0; // Reset report count
                    queueState = 'dismissed';
                    auditAction = 'admin_restored';
                    break;

                case 'hide':
                    updates.visibility = 'hidden';
                    updates.hiddenAt = admin.firestore.FieldValue.serverTimestamp();
                    updates.hiddenBy = context.auth!.uid;
                    if (note) {
                        updates.moderationNote = note;
                    }
                    updates.moderationReason = note || 'No reason provided'; // Save reason
                    queueState = 'action_taken';
                    auditAction = 'admin_hidden';
                    break;

                case 'dismiss':
                    // Keep visibility visible and keep reports
                    updates.visibility = 'visible';
                    queueState = 'dismissed';
                    auditAction = 'admin_dismissed';
                    break;

                default:
                    throw new functions.https.HttpsError(
                        'invalid-argument',
                        'Invalid action'
                    );
            }

            // WRITE 1: Update post if changes needed
            if (Object.keys(updates).length > 0) {
                transaction.update(postRef, updates);
            }

            // WRITE 2: Delete all reports if restore action
            if (action === 'restore' && reportsSnapshot) {
                reportsSnapshot.docs.forEach(doc => {
                    transaction.delete(doc.ref);
                });
            }

            // WRITE 3: Update moderation queue
            if (queueDoc.exists) {
                transaction.update(queueRef, {
                    state: queueState,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }

            // WRITE 4: Create audit log entry
            const auditRef = db.collection('auditLogs').doc();
            transaction.set(auditRef, {
                targetType: "post",
                targetId: postId,
                action: auditAction,
                actorType: "admin",
                actorUid: context.auth!.uid,
                note: note || null,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });

        console.log(`[moderatePost] Successfully moderated post ${postId} with action ${action}`);

        return {
            success: true,
            message: `Post ${action}d successfully`
        };

    } catch (error) {
        console.error(`[moderatePost] Error moderating post ${postId}:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError(
            'internal',
            'An error occurred while moderating the post'
        );
    }
});
