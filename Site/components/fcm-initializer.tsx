"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/use-auth";
import {
    requestNotificationPermissionAndRegister,
    hasNotificationPermission
} from "@/lib/fcm";
import { getMessagingInstance } from "@/lib/firebase";
import { onMessage, MessagePayload } from "firebase/messaging";

/**
 * FCMInitializer Component
 * Automatically registers the device/browser for push notifications on login
 * if browser permissions are already granted.
 */
export function FCMInitializer() {
    const { user, loading } = useAuth();
    const initializedRef = useRef<string | null>(null);

    useEffect(() => {
        // Only run when user is logged in and not already initialized for this session/user
        if (!loading && user && initializedRef.current !== user.uid) {

            const initFCM = async () => {
                const permission = typeof window !== 'undefined' ? Notification.permission : 'default';

                if (permission === 'denied') {
                    console.log("[FCMInitializer] Browser notification permission denied. Skipping auto-registration.");
                    initializedRef.current = user.uid;
                    return;
                }

                console.log("[FCMInitializer] Initializing FCM for user...", user.uid);
                const result = await requestNotificationPermissionAndRegister(user.uid);

                if (result.success) {
                    console.log("[FCMInitializer] FCM registered successfully.");
                    // Set up foreground message listener
                    const messaging = await getMessagingInstance();
                    if (messaging) {
                        onMessage(messaging, (payload: MessagePayload) => {
                            console.log("[FCMInitializer] Foreground message received:", payload);
                        });
                    }
                } else {
                    console.warn("[FCMInitializer] FCM registration skipped/failed:", result.error);
                }

                initializedRef.current = user.uid;
            };

            initFCM();
        } else if (!loading && !user) {
            // Reset when logged out
            initializedRef.current = null;
        }
    }, [user, loading]);

    return null; // This component doesn't render anything
}
