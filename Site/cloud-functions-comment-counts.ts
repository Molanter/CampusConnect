/**
 * Cloud Functions for maintaining comment counts on posts
 * 
 * Deploy these functions to Firebase Cloud Functions to automatically
 * maintain commentsCount and repliesCommentsCount fields on posts.
 * 
 * Installation:
 * 1. Initialize Firebase Functions in your project: firebase init functions
 * 2. Copy this code to functions/src/index.ts
 * 3. Deploy: firebase deploy --only functions
 * 
 * Note: All comments are stored under posts/{postId}/comments
 * Events are a type of post, not a separate collection for comments.
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

/**
 * Increment commentsCount when a top-level comment is created
 */
export const onCommentCreated = functions.firestore
    .document('posts/{postId}/comments/{commentId}')
    .onCreate(async (snap, context) => {
        const postId = context.params.postId;
        const postRef = db.collection('posts').doc(postId);

        try {
            await postRef.update({
                commentsCount: admin.firestore.FieldValue.increment(1)
            });
            console.log(`Incremented commentsCount for post ${postId}`);
        } catch (error) {
            console.error(`Error incrementing commentsCount for post ${postId}:`, error);
        }
    });

/**
 * Decrement commentsCount when a top-level comment is deleted
 */
export const onCommentDeleted = functions.firestore
    .document('posts/{postId}/comments/{commentId}')
    .onDelete(async (snap, context) => {
        const postId = context.params.postId;
        const postRef = db.collection('posts').doc(postId);

        try {
            const postDoc = await postRef.get();
            const currentCount = postDoc.data()?.commentsCount || 0;

            if (currentCount > 0) {
                await postRef.update({
                    commentsCount: admin.firestore.FieldValue.increment(-1)
                });
                console.log(`Decremented commentsCount for post ${postId}`);
            }
        } catch (error) {
            console.error(`Error decrementing commentsCount for post ${postId}:`, error);
        }
    });

/**
 * Increment repliesCommentsCount when a reply is created
 */
export const onReplyCreated = functions.firestore
    .document('posts/{postId}/comments/{commentId}/replies/{replyId}')
    .onCreate(async (snap, context) => {
        const postId = context.params.postId;
        const postRef = db.collection('posts').doc(postId);

        try {
            await postRef.update({
                repliesCommentsCount: admin.firestore.FieldValue.increment(1)
            });
            console.log(`Incremented repliesCommentsCount for post ${postId}`);
        } catch (error) {
            console.error(`Error incrementing repliesCommentsCount for post ${postId}:`, error);
        }
    });

/**
 * Decrement repliesCommentsCount when a reply is deleted
 */
export const onReplyDeleted = functions.firestore
    .document('posts/{postId}/comments/{commentId}/replies/{replyId}')
    .onDelete(async (snap, context) => {
        const postId = context.params.postId;
        const postRef = db.collection('posts').doc(postId);

        try {
            const postDoc = await postRef.get();
            const currentCount = postDoc.data()?.repliesCommentsCount || 0;

            if (currentCount > 0) {
                await postRef.update({
                    repliesCommentsCount: admin.firestore.FieldValue.increment(-1)
                });
                console.log(`Decremented repliesCommentsCount for post ${postId}`);
            }
        } catch (error) {
            console.error(`Error decrementing repliesCommentsCount for post ${postId}:`, error);
        }
    });
