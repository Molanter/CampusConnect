/**
 * Firebase Cloud Messaging (FCM) Token Management
 * Handles device registration and push notification permissions
 */

"use client";

import { getToken, deleteToken, Messaging } from "firebase/messaging";
import {
    doc,
    setDoc,
    deleteDoc,
    serverTimestamp,
} from "firebase/firestore";
import { db, getMessagingInstance } from "./firebase";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

/**
 * Get or generate a unique device ID for this browser
 */
export function getDeviceId(): string {
    const key = "cc_device_id";
    let deviceId = localStorage.getItem(key);

    if (!deviceId) {
        deviceId = `web:${crypto.randomUUID()}`;
        localStorage.setItem(key, deviceId);
    }

    return deviceId;
}

/**
 * Get device name from user agent
 */
function getDeviceName(): string {
    const ua = navigator.userAgent;
    let browser = "Unknown";
    let os = "Unknown";

    // Detect browser
    if (ua.includes("Chrome")) browser = "Chrome";
    else if (ua.includes("Firefox")) browser = "Firefox";
    else if (ua.includes("Safari")) browser = "Safari";
    else if (ua.includes("Edge")) browser = "Edge";

    // Detect OS
    if (ua.includes("Windows")) os = "Windows";
    else if (ua.includes("Mac")) os = "macOS";
    else if (ua.includes("Linux")) os = "Linux";
    else if (ua.includes("Android")) os = "Android";
    else if (ua.includes("iOS")) os = "iOS";

    return `${browser} on ${os}`;
}

/**
 * Request notification permission and register FCM token
 * This should be called on login
 */
export async function requestNotificationPermissionAndRegister(
    uid: string
): Promise<{ success: boolean; error?: string }> {
    try {
        // Check if notifications are supported
        if (!("Notification" in window)) {
            console.log("This browser does not support notifications");
            return { success: false, error: "not_supported" };
        }

        // Check if messaging is initialized
        const messaging = await getMessagingInstance();
        if (!messaging) {
            console.log("Firebase messaging not initialized or not supported");
            return { success: false, error: "messaging_not_initialized" };
        }

        // Request permission (only if not already granted)
        let permission = Notification.permission;
        if (permission !== "granted") {
            permission = await Notification.requestPermission();
        }

        if (permission !== "granted") {
            console.log("Notification permission denied");
            return { success: false, error: "permission_denied" };
        }

        // Register service worker
        await navigator.serviceWorker.register(
            "/firebase-messaging-sw.js"
        );

        // Wait for the service worker to be fully ready and active
        // This prevents the "no active Service Worker" error during token subscription
        const registration = await navigator.serviceWorker.ready;

        console.log("Service worker registered and ready");

        // Get FCM token
        if (!VAPID_KEY) {
            console.error("VAPID key not configured");
            return { success: false, error: "vapid_key_missing" };
        }

        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: registration,
        });

        if (!token) {
            console.log("No registration token available");
            return { success: false, error: "no_token" };
        }

        // Save token to Firestore
        const deviceId = getDeviceId();
        const deviceName = getDeviceName();

        await setDoc(doc(db, "users", uid, "devices", deviceId), {
            fcmToken: token,
            platform: "web",
            deviceName,
            createdAt: serverTimestamp(),
            lastSeenAt: serverTimestamp(),
            userAgent: navigator.userAgent,
            disabled: false,
        });

        console.log("FCM token saved successfully");
        return { success: true };
    } catch (error) {
        console.error("Error requesting notification permission:", error);
        return { success: false, error: String(error) };
    }
}

/**
 * Delete FCM token on logout
 */
export async function deleteNotificationToken(uid: string): Promise<void> {
    try {
        const messaging = await getMessagingInstance();
        if (!messaging) {
            console.log("Firebase messaging not initialized");
            return;
        }

        // Delete token from FCM
        await deleteToken(messaging);

        // Delete device document from Firestore
        const deviceId = getDeviceId();
        await deleteDoc(doc(db, "users", uid, "devices", deviceId));

        console.log("FCM token deleted successfully");
    } catch (error) {
        console.error("Error deleting notification token:", error);
    }
}

/**
 * Check if notification permission has been granted
 */
export function hasNotificationPermission(): boolean {
    if (!("Notification" in window)) {
        return false;
    }
    return Notification.permission === "granted";
}
