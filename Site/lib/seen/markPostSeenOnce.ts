import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export interface MarkSeenParams {
    uid: string;
    postId: string;
    campusId: string;
}

export interface MarkSeenResult {
    didWrite: boolean;
    error?: string;
}

/**
 * Mark a post as seen by creating a user's seenPost record.
 * The Cloud Function will automatically increment posts.seenCount.
 * 
 * This does NOT use a transaction to avoid unnecessary post document reads.
 * Instead, it checks if the seenPost doc exists first (1 read),
 * then creates it if needed (1 write).
 * 
 * @param params - User ID, Post ID, and Campus ID
 * @returns Result indicating if write occurred
 */
export async function markPostSeenOnce(params: MarkSeenParams): Promise<MarkSeenResult> {
    const { uid, postId, campusId } = params;

    if (!uid || !postId || !campusId) {
        return { didWrite: false, error: "Missing required parameters" };
    }

    try {
        const seenRef = doc(db, `users/${uid}/seenPosts/${postId}`);

        // Check if already marked
        const seenDoc = await getDoc(seenRef);

        if (seenDoc.exists()) {
            // Already marked - no action needed
            return { didWrite: false };
        }

        // Create seen record (Cloud Function will increment seenCount)
        // Note: If another client creates this between getDoc and setDoc,
        // this will fail with PERMISSION_DENIED due to Firestore rules blocking updates
        await setDoc(seenRef, {
            seenAt: serverTimestamp(),
            campusId,
        });

        console.log(`[Firestore] Succesfully created seenPost subcollection document for post: ${postId}`);

        return { didWrite: true };
    } catch (error: any) {
        // CRITICAL: Permission denied means another client already created this doc
        // This is the expected behavior for race conditions and should NOT be treated as an error
        if (error.code === "permission-denied" || error.message?.includes("permission")) {
            // Document already exists (created by another tab/device)
            // This is a success case - the post is marked as seen
            return { didWrite: false }; // No error
        }

        // Log other errors
        console.error("Error marking post as seen:", error);
        return {
            didWrite: false,
            error: error?.message || "Failed to mark as seen"
        };
    }
}
