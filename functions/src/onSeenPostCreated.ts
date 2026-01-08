import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * Cloud Function: Increment post's seenCount when a user marks it as seen
 * 
 * Trigger: onCreate users/{uid}/seenPosts/{postId}
 * Action: Increment posts/{postId}.seenCount by 1
 * 
 * Security: Only this function can increment seenCount (client cannot)
 * Idempotency: onCreate fires exactly once per document creation
 */
export const onSeenPostCreated = functions.firestore
    .document("users/{uid}/seenPosts/{postId}")
    .onCreate(async (snap, context) => {
        const { uid, postId } = context.params;

        try {
            const postRef = admin.firestore().doc(`posts/${postId}`);

            // Increment seen count atomically
            await postRef.update({
                seenCount: admin.firestore.FieldValue.increment(1),
            });

            functions.logger.info(`Incremented seenCount for post ${postId} (viewed by ${uid})`);
        } catch (error: any) {
            // Handle case where post was deleted or doesn't exist
            if (error.code === "NOT_FOUND") {
                functions.logger.warn(`Post ${postId} not found, skipping seenCount increment (uid: ${uid})`);
                return;
            }

            // Log other errors but don't crash
            functions.logger.error(`Error incrementing seenCount for post ${postId} (uid: ${uid}):`, error);
            throw error;
        }
    });
