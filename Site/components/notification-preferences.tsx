/**
 * Notification Preferences UI Component
 * 
 * Allows users to manage their notification settings including:
 * - Push notification master toggle
 * - Per-type notification preferences
 * - Device management
 * - Quiet hours (optional v2 feature)
 */

"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/use-auth";
import { db } from "@/lib/firebase";
import {
    doc,
    getDoc,
    setDoc,
    collection,
    getDocs,
    deleteDoc,
    serverTimestamp,
} from "firebase/firestore";
import {
    requestNotificationPermissionAndRegister,
    hasNotificationPermission,
} from "@/lib/fcm";

interface NotificationPreferences {
    pushEnabled: boolean;
    inAppEnabled: boolean;
    pushTypes: {
        follow: boolean;
        club_invite: boolean;
        club_join_request: boolean;
        post_like: boolean;
        post_comment: boolean;
        comment_like: boolean;
        comment_reply: boolean;
        announcement: boolean;
        system: boolean;
    };
    quietHours?: {
        enabled: boolean;
        start: string;
        end: string;
        tz: string;
    };
}

interface Device {
    id: string;
    deviceName: string;
    platform: string;
    fcmToken: string;
    lastSeenAt: Date;
    disabled?: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
    pushEnabled: true,
    inAppEnabled: true,
    pushTypes: {
        follow: true,
        club_invite: true,
        club_join_request: true,
        post_like: true,
        post_comment: true,
        comment_like: true,
        comment_reply: true,
        announcement: true,
        system: true,
    },
};

export function NotificationPreferences() {
    const { user } = useAuth();
    const [preferences, setPreferences] = useState<NotificationPreferences>(
        DEFAULT_PREFERENCES
    );
    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [permissionStatus, setPermissionStatus] = useState<
        "granted" | "denied" | "default"
    >("default");

    useEffect(() => {
        if (!user) return;

        loadPreferences();
        loadDevices();
        updatePermissionStatus();
    }, [user]);

    const updatePermissionStatus = () => {
        if (typeof window === "undefined" || !("Notification" in window)) {
            setPermissionStatus("denied");
            return;
        }
        setPermissionStatus(Notification.permission as any);
    };

    const loadPreferences = async () => {
        if (!user) return;

        try {
            const prefDoc = await getDoc(
                doc(db, "users", user.uid, "settings", "notifications")
            );

            if (prefDoc.exists()) {
                setPreferences({ ...DEFAULT_PREFERENCES, ...prefDoc.data() } as any);
            }
        } catch (error) {
            console.error("Error loading preferences:", error);
        } finally {
            setLoading(false);
        }
    };

    const loadDevices = async () => {
        if (!user) return;

        try {
            const devicesSnapshot = await getDocs(
                collection(db, "users", user.uid, "devices")
            );

            const devicesList: Device[] = devicesSnapshot.docs.map((doc) => {
                const data = doc.data();
                return {
                    id: doc.id,
                    deviceName: data.deviceName || "Unknown Device",
                    platform: data.platform || "unknown",
                    fcmToken: data.fcmToken || "",
                    lastSeenAt: data.lastSeenAt?.toDate() || new Date(),
                    disabled: data.disabled || false,
                };
            });

            setDevices(devicesList);
        } catch (error) {
            console.error("Error loading devices:", error);
        }
    };

    const savePreferences = async (newPreferences: NotificationPreferences) => {
        if (!user) return;

        setSaving(true);
        try {
            await setDoc(
                doc(db, "users", user.uid, "settings", "notifications"),
                {
                    ...newPreferences,
                    updatedAt: serverTimestamp(),
                }
            );
            setPreferences(newPreferences);
        } catch (error) {
            console.error("Error saving preferences:", error);
            alert("Failed to save preferences. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const handleMasterToggle = async () => {
        const newPreferences = {
            ...preferences,
            pushEnabled: !preferences.pushEnabled,
        };
        await savePreferences(newPreferences);
    };

    const handleTypeToggle = async (
        type: keyof NotificationPreferences["pushTypes"]
    ) => {
        const newPreferences = {
            ...preferences,
            pushTypes: {
                ...preferences.pushTypes,
                [type]: !preferences.pushTypes[type],
            },
        };
        await savePreferences(newPreferences);
    };

    const handleEnablePush = async () => {
        if (!user) return;

        const result = await requestNotificationPermissionAndRegister(user.uid);

        if (result.success) {
            updatePermissionStatus();
            loadDevices();
            alert("✅ Notifications enabled successfully!");
        } else {
            if (result.error === "permission_denied") {
                alert(
                    "❌ Permission denied. Please allow notifications in your browser settings."
                );
            } else {
                alert(`❌ Failed to enable notifications: ${result.error}`);
            }
        }
    };

    const handleRemoveDevice = async (deviceId: string) => {
        if (!user) return;
        if (!confirm("Are you sure you want to remove this device?")) return;

        try {
            await deleteDoc(doc(db, "users", user.uid, "devices", deviceId));
            setDevices(devices.filter((d) => d.id !== deviceId));
            alert("✅ Device removed successfully");
        } catch (error) {
            console.error("Error removing device:", error);
            alert("❌ Failed to remove device");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <p className="text-sm text-neutral-500">Loading...</p>
            </div>
        );
    }

    const notificationTypes: Array<{
        key: keyof NotificationPreferences["pushTypes"];
        label: string;
        description: string;
    }> = [
            {
                key: "follow",
                label: "New Followers",
                description: "When someone follows you",
            },
            {
                key: "club_invite",
                label: "Club Invites",
                description: "When you're invited to join a club",
            },
            {
                key: "club_join_request",
                label: "Join Requests",
                description: "When someone requests to join your club",
            },
            {
                key: "post_like",
                label: "Post Likes",
                description: "When someone likes your post",
            },
            {
                key: "post_comment",
                label: "Post Comments",
                description: "When someone comments on your post",
            },
            {
                key: "comment_like",
                label: "Comment Likes",
                description: "When someone likes your comment",
            },
            {
                key: "comment_reply",
                label: "Comment Replies",
                description: "When someone replies to your comment",
            },
            {
                key: "announcement",
                label: "Announcements",
                description: "Important announcements from clubs and admins",
            },
            {
                key: "system",
                label: "System",
                description: "Critical system notifications",
            },
        ];

    return (
        <div className="space-y-8">
            {/* Section 1: Push Notifications */}
            <section className="space-y-4">
                <h2 className="text-xl font-semibold">Push Notifications</h2>

                {/* Permission Status */}
                <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">Browser Permission</p>
                            <p className="text-sm text-neutral-400">
                                {permissionStatus === "granted" && "✅ Granted"}
                                {permissionStatus === "denied" && "❌ Denied"}
                                {permissionStatus === "default" && "⚠️ Not requested"}
                            </p>
                        </div>

                        {permissionStatus !== "granted" && (
                            <button
                                onClick={handleEnablePush}
                                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                            >
                                Enable in Browser
                            </button>
                        )}
                    </div>
                </div>

                {/* Master Toggle */}
                <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">Push Notifications</p>
                            <p className="text-sm text-neutral-400">
                                Receive push notifications for activity
                            </p>
                        </div>
                        <button
                            onClick={handleMasterToggle}
                            disabled={saving}
                            className={`relative h-8 w-14 rounded-full transition-colors ${preferences.pushEnabled ? "bg-blue-600" : "bg-neutral-700"
                                }`}
                        >
                            <span
                                className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-transform ${preferences.pushEnabled ? "translate-x-7" : "translate-x-1"
                                    }`}
                            />
                        </button>
                    </div>
                </div>
            </section>

            {/* Section 2: Notify me about */}
            <section className="space-y-4">
                <h2 className="text-xl font-semibold">Notify me about</h2>

                <div className="space-y-2">
                    {notificationTypes.map((type) => (
                        <div
                            key={type.key}
                            className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <p className="font-medium">{type.label}</p>
                                    <p className="text-sm text-neutral-400">{type.description}</p>
                                </div>
                                <button
                                    onClick={() => handleTypeToggle(type.key)}
                                    disabled={
                                        saving ||
                                        !preferences.pushEnabled ||
                                        (type.key === "system" && preferences.pushTypes.system)
                                    }
                                    className={`relative h-8 w-14 rounded-full transition-colors disabled:opacity-50 ${preferences.pushTypes[type.key]
                                            ? "bg-blue-600"
                                            : "bg-neutral-700"
                                        }`}
                                >
                                    <span
                                        className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-transform ${preferences.pushTypes[type.key]
                                                ? "translate-x-7"
                                                : "translate-x-1"
                                            }`}
                                    />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Section 3: Devices */}
            <section className="space-y-4">
                <h2 className="text-xl font-semibold">Devices</h2>

                {devices.length === 0 ? (
                    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6 text-center">
                        <p className="text-sm text-neutral-400">
                            No devices registered for push notifications
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {devices.map((device) => (
                            <div
                                key={device.id}
                                className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/50 p-4"
                            >
                                <div>
                                    <p className="font-medium">{device.deviceName}</p>
                                    <p className="text-sm text-neutral-400">
                                        {device.platform} •{" "}
                                        {device.lastSeenAt.toLocaleDateString()}
                                        {device.disabled && " • Disabled"}
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleRemoveDevice(device.id)}
                                    className="rounded-lg border border-red-600 px-3 py-1 text-sm text-red-600 hover:bg-red-600 hover:text-white"
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {saving && (
                <div className="fixed bottom-4 right-4 rounded-lg bg-blue-600 px-4 py-2 text-white">
                    Saving...
                </div>
            )}
        </div>
    );
}
