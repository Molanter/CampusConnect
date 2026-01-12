/**
 * React hook for notifications
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
    subscribeToNotifications,
    subscribeToUnreadCount,
    markNotificationAsRead,
    markNotificationAsSeen,
    archiveNotification,
} from "./notifications";
import { Notification } from "./types/notifications";

export function useNotifications(uid: string | null) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!uid) {
            setNotifications([]);
            setUnreadCount(0);
            setLoading(false);
            return;
        }

        setLoading(true);

        // Subscribe to notifications
        const unsubscribeNotifications = subscribeToNotifications(
            uid,
            (newNotifications) => {
                setNotifications(newNotifications);
                setLoading(false);
            }
        );

        // Subscribe to unread count
        const unsubscribeUnreadCount = subscribeToUnreadCount(uid, (count) => {
            setUnreadCount(count);
        });

        return () => {
            unsubscribeNotifications();
            unsubscribeUnreadCount();
        };
    }, [uid]);

    const markAsRead = useCallback(async (notificationId: string) => {
        try {
            await markNotificationAsRead(notificationId);
            // Optimistically update local state
            setNotifications((prev) =>
                prev.map((n) =>
                    n.id === notificationId ? { ...n, isRead: true, readAt: new Date() } : n
                )
            );
        } catch (error) {
            console.error("Error marking notification as read:", error);
        }
    }, []);

    const markAsSeen = useCallback(async (notificationId: string) => {
        try {
            await markNotificationAsSeen(notificationId);
            // Optimistically update local state
            setNotifications((prev) =>
                prev.map((n) =>
                    n.id === notificationId ? { ...n, seenAt: new Date() } : n
                )
            );
        } catch (error) {
            console.error("Error marking notification as seen:", error);
        }
    }, []);

    const archive = useCallback(async (notificationId: string) => {
        try {
            await archiveNotification(notificationId);
            // Optimistically update local state
            setNotifications((prev) =>
                prev.map((n) =>
                    n.id === notificationId ? { ...n, isArchived: true } : n
                )
            );
        } catch (error) {
            console.error("Error archiving notification:", error);
        }
    }, []);

    return {
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAsSeen,
        archive,
    };
}
