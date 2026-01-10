/**
 * Firestore helper functions for notifications
 */

import {
    collection,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    getDocs,
    doc,
    updateDoc,
    serverTimestamp,
    onSnapshot,
    QueryConstraint,
    Query,
    DocumentData,
    Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Notification } from "./types/notifications";

/**
 * Convert Firestore timestamp to Date
 */
function convertTimestamp(timestamp: any): Date {
    if (!timestamp) return new Date();
    if (timestamp instanceof Date) return timestamp;
    if (timestamp?.toDate) return timestamp.toDate();
    if (timestamp?.seconds) return new Date(timestamp.seconds * 1000);
    return new Date(timestamp);
}

/**
 * Convert Firestore document to Notification object
 */
export function firestoreToNotification(
    id: string,
    data: DocumentData
): Notification {
    return {
        id,
        toUid: data.toUid || "",
        campusId: data.campusId || null,
        clubId: data.clubId || null,
        postId: data.postId || null,
        commentId: data.commentId || null,
        type: data.type,
        title: data.title || "",
        body: data.body || null,
        imageUrl: data.imageUrl || null,
        actorUid: data.actorUid || null,
        actorName: data.actorName || null,
        actorPhotoURL: data.actorPhotoURL || null,
        deeplink: data.deeplink || { screen: "notifications", params: {} },
        createdAt: convertTimestamp(data.createdAt),
        isRead: data.isRead || false,
        readAt: data.readAt ? convertTimestamp(data.readAt) : null,
        seenAt: data.seenAt ? convertTimestamp(data.seenAt) : null,
        isArchived: data.isArchived || false,
        dedupeKey: data.dedupeKey || null,
        groupKey: data.groupKey || null,
        groupCount: data.groupCount || null,
        push: data.push || { send: false },
        version: data.version || 1,
    };
}

/**
 * Fetch notifications for a specific user
 */
export async function fetchNotifications(
    uid: string,
    pageSize: number = 50,
    lastDoc?: any
): Promise<{ notifications: Notification[]; lastDoc: any }> {
    const constraints: QueryConstraint[] = [
        where("toUid", "==", uid),
        orderBy("createdAt", "desc"),
        limit(pageSize),
    ];

    if (lastDoc) {
        constraints.push(startAfter(lastDoc));
    }

    const q = query(collection(db, "notifications"), ...constraints);
    const snapshot = await getDocs(q);

    const notifications = snapshot.docs.map((doc) =>
        firestoreToNotification(doc.id, doc.data())
    );

    return {
        notifications,
        lastDoc: snapshot.docs[snapshot.docs.length - 1],
    };
}

/**
 * Subscribe to real-time notifications
 */
export function subscribeToNotifications(
    uid: string,
    onUpdate: (notifications: Notification[]) => void,
    pageSize: number = 50
): () => void {
    const q = query(
        collection(db, "notifications"),
        where("toUid", "==", uid),
        orderBy("createdAt", "desc"),
        limit(pageSize)
    );

    return onSnapshot(q, (snapshot) => {
        const notifications = snapshot.docs.map((doc) =>
            firestoreToNotification(doc.id, doc.data())
        );
        onUpdate(notifications);
    });
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(uid: string): Promise<number> {
    const q = query(
        collection(db, "notifications"),
        where("toUid", "==", uid),
        where("isRead", "==", false)
    );

    const snapshot = await getDocs(q);
    return snapshot.size;
}

/**
 * Subscribe to unread count
 */
export function subscribeToUnreadCount(
    uid: string,
    onUpdate: (count: number) => void
): () => void {
    const q = query(
        collection(db, "notifications"),
        where("toUid", "==", uid),
        where("isRead", "==", false)
    );

    return onSnapshot(q, (snapshot) => {
        onUpdate(snapshot.size);
    });
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(
    notificationId: string
): Promise<void> {
    const notificationRef = doc(db, "notifications", notificationId);
    await updateDoc(notificationRef, {
        isRead: true,
        readAt: serverTimestamp(),
    });
}

/**
 * Mark notification as seen
 */
export async function markNotificationAsSeen(
    notificationId: string
): Promise<void> {
    const notificationRef = doc(db, "notifications", notificationId);
    await updateDoc(notificationRef, {
        seenAt: serverTimestamp(),
    });
}

/**
 * Mark multiple notifications as seen
 */
export async function markNotificationsAsSeen(
    notificationIds: string[]
): Promise<void> {
    const promises = notificationIds.map((id) => markNotificationAsSeen(id));
    await Promise.all(promises);
}

/**
 * Archive notification
 */
export async function archiveNotification(
    notificationId: string
): Promise<void> {
    const notificationRef = doc(db, "notifications", notificationId);
    await updateDoc(notificationRef, {
        isArchived: true,
    });
}
