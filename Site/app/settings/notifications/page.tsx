/**
 * Notification Preferences Page Component
 * 
 * Settings → Notifications page with:
 * - Push notification master toggle
 * - Browser permission status
 * - Per-type notification toggles
 * - Device management
 * - Test notification button
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/use-auth";
import { db, functions } from "@/lib/firebase";
import {
    doc,
    getDoc,
    setDoc,
    collection,
    getDocs,
    deleteDoc,
    serverTimestamp,
    onSnapshot,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
    requestNotificationPermissionAndRegister,
    hasNotificationPermission,
} from "@/lib/fcm";
import { ChevronLeftIcon, BellIcon, DevicePhoneMobileIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { SettingsFooter } from "@/components/settings-footer";

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

export default function NotificationsSettingsPage() {
    const { user } = useAuth();
    const [preferences, setPreferences] = useState<NotificationPreferences>(
        DEFAULT_PREFERENCES
    );
    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testStatus, setTestStatus] = useState<
        "idle" | "sending" | "success" | "error"
    >("idle");
    const [testError, setTestError] = useState<string>("");
    const [permissionStatus, setPermissionStatus] = useState<
        "granted" | "denied" | "default"
    >("default");
    const [lastNotificationId, setLastNotificationId] = useState<string | null>(null);
    const [lastNotificationStatus, setLastNotificationStatus] = useState<{
        status: string;
        sentAt?: any;
        error?: string;
    } | null>(null);

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

            const devicesList: Device[] = devicesSnapshot.docs
                .map((doc) => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        deviceName: data.deviceName || "Unknown Device",
                        platform: data.platform || "unknown",
                        fcmToken: data.fcmToken || "",
                        lastSeenAt: data.lastSeenAt?.toDate() || new Date(),
                        disabled: data.disabled || false,
                    };
                })
                .filter((device) => !device.disabled);

            console.log(`[NotificationsSettings] Found ${devicesList.length} active devices:`, devicesList.map(d => d.deviceName));
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
        if (type === "system" && preferences.pushTypes.system) {
            return;
        }

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
            console.log("[NotificationsSettings] Registration successful, refreshing state...");
            updatePermissionStatus();
            await loadDevices();
            alert("✅ Notifications enabled successfully!");
        } else {
            if (result.error === "permission_denied") {
                alert(
                    "❌ Permission denied. Please allow notifications in your browser settings:\n\n" +
                    "Chrome/Edge: Settings → Privacy → Site Settings → Notifications\n" +
                    "Firefox: Preferences → Privacy → Permissions → Notifications\n" +
                    "Safari: Preferences → Websites → Notifications"
                );
            } else {
                alert(`❌ Failed to enable notifications: ${result.error}`);
            }
        }
    };

    const handleRemoveDevice = async (deviceId: string) => {
        if (!user) return;
        if (
            !confirm(
                "Remove this device? You'll stop receiving push notifications on it."
            )
        )
            return;

        try {
            await deleteDoc(doc(db, "users", user.uid, "devices", deviceId));
            setDevices(devices.filter((d) => d.id !== deviceId));
        } catch (error) {
            console.error("Error removing device:", error);
            alert("❌ Failed to remove device");
        }
    };

    const handleSendTestNotification = async () => {
        if (!user) return;

        console.log("[TestNotification] Starting test flow...");

        if (!preferences.pushEnabled) {
            console.warn("[TestNotification] Blocked: pushEnabled is false");
            alert("Please enable push notifications first");
            return;
        }

        if (permissionStatus !== "granted") {
            console.warn("[TestNotification] Blocked: permissionStatus is", permissionStatus);
            alert("Please grant browser notification permission first");
            return;
        }

        if (devices.length === 0) {
            console.warn("[TestNotification] Blocked: No active devices found in state");
            alert(
                "No active devices found. Please enable notifications in your browser first."
            );
            return;
        }

        console.log("[TestNotification] Calling cloud function with", devices.length, "devices in state");
        setTestStatus("sending");
        setTestError("");

        try {
            const sendTest = httpsCallable(functions, "sendTestNotification");
            const response = await sendTest();
            console.log("[TestNotification] Cloud Function Response:", response.data);

            const resultData = response.data as any;
            if (resultData.notificationId) {
                setLastNotificationId(resultData.notificationId);
                // Start listening to this specific notification's delivery status
                const unsub = onSnapshot(doc(db, "notifications", resultData.notificationId), (docSnapshot) => {
                    if (docSnapshot.exists()) {
                        const data = docSnapshot.data();
                        if (data.push) {
                            console.log("[TestNotification] Delivery Status Update:", data.push);
                            setLastNotificationStatus(data.push);
                        }
                    }
                });
                // Unsubscribe after 30 seconds to clean up
                setTimeout(unsub, 30000);
            }

            setTestStatus("success");
            setTimeout(() => setTestStatus("idle"), 3000);
        } catch (error: any) {
            console.error("Error sending test notification:", error);
            setTestStatus("error");

            const errorMessage = error.message || "Unknown error";
            if (errorMessage.includes("wait")) {
                setTestError("Please wait before sending another test notification");
            } else if (errorMessage.includes("No active devices")) {
                setTestError("No active devices found");
            } else {
                setTestError("Failed to send test notification");
            }

            setTimeout(() => setTestStatus("idle"), 5000);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <p className="text-sm text-secondary">Loading...</p>
            </div>
        );
    }

    const notificationTypes: Array<{
        key: keyof NotificationPreferences["pushTypes"];
        label: string;
        description: string;
        canDisable: boolean;
    }> = [
            {
                key: "follow",
                label: "New Followers",
                description: "When someone follows you",
                canDisable: true,
            },
            {
                key: "post_like",
                label: "Post Likes",
                description: "When someone likes your post",
                canDisable: true,
            },
            {
                key: "post_comment",
                label: "Post Comments",
                description: "When someone comments on your post",
                canDisable: true,
            },
            {
                key: "comment_reply",
                label: "Comment Replies",
                description: "When someone replies to your comment",
                canDisable: true,
            },
            {
                key: "comment_like",
                label: "Comment Likes",
                description: "When someone likes your comment",
                canDisable: true,
            },
            {
                key: "club_invite",
                label: "Club Invites",
                description: "When you're invited to join a club",
                canDisable: true,
            },
            {
                key: "club_join_request",
                label: "Join Requests",
                description: "When someone requests to join your club",
                canDisable: true,
            },
            {
                key: "announcement",
                label: "Announcements",
                description: "Important announcements from clubs and campus",
                canDisable: true,
            },
            {
                key: "system",
                label: "System",
                description: "Critical system notifications (cannot be disabled)",
                canDisable: false,
            },
        ];

    const formatLastSeen = (date: Date) => {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;

        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;

        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 30) return `${diffDays}d ago`;

        return date.toLocaleDateString();
    };

    const testButtonEnabled =
        preferences.pushEnabled &&
        permissionStatus === "granted" &&
        devices.length > 0 &&
        testStatus !== "sending";

    return (
        <div className="min-h-screen bg-background pb-20">
            {/* Main Content */}
            <main className="mx-auto max-w-2xl px-4 pb-8">
                <div className="sticky top-0 z-40 -mx-4 px-4 md:-mx-8 md:px-8 pt-4 pb-12 pointer-events-none transition-all duration-300">
                    {/* Background Blur Layer */}
                    <div className="absolute inset-0 backdrop-blur-3xl bg-background/90 [mask-image:linear-gradient(to_bottom,black_0%,black_20%,transparent_100%)]" />

                    <div className="relative flex items-center gap-2 pointer-events-auto">
                        <Link
                            href="/settings"
                            className="flex h-12 w-12 items-center justify-center rounded-full cc-header-btn active:scale-95 transition-all shrink-0 border cc-header-item-stroke"
                        >
                            <ChevronLeftIcon className="h-5 w-5 text-foreground" />
                        </Link>
                        <div className="flex items-center rounded-full cc-glass-strong px-6 py-3 border cc-header-item-stroke">
                            <h1 className="text-sm font-bold text-foreground">Notifications</h1>
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    {/* Push Notifications Section */}
                    <section className="space-y-4">
                        <h2 className="px-4 text-[13px] font-bold uppercase tracking-wider text-secondary">
                            Push Notifications
                        </h2>
                        <div className="cc-section overflow-hidden rounded-3xl">
                            {/* Browser Permission Status */}
                            <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-secondary/15">
                                <div className="flex-1">
                                    <p className="text-foreground font-semibold text-[15px]">
                                        Browser Permission
                                    </p>
                                    <p className="text-secondary text-[13px] mt-1">
                                        {permissionStatus === "granted" && (
                                            <span className="text-green-500">✅ Granted</span>
                                        )}
                                        {permissionStatus === "denied" && (
                                            <span className="text-red-500">
                                                ❌ Denied - Enable in browser settings
                                            </span>
                                        )}
                                        {permissionStatus === "default" && (
                                            <span className="text-yellow-500">⚠️ Not requested</span>
                                        )}
                                    </p>
                                </div>

                                {permissionStatus !== "granted" ? (
                                    <button
                                        onClick={handleEnablePush}
                                        className="shrink-0 bg-brand text-brand-foreground px-4 py-2 rounded-full text-sm font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-brand/20"
                                    >
                                        Enable in Browser
                                    </button>
                                ) : (
                                    devices.length === 0 && (
                                        <button
                                            onClick={handleEnablePush}
                                            className="shrink-0 bg-brand/10 text-brand px-4 py-2 rounded-full text-sm font-bold hover:bg-brand/20 active:scale-95 transition-all"
                                        >
                                            Register this Browser
                                        </button>
                                    )
                                )}
                            </div>

                            {/* Test Notification Row */}
                            {permissionStatus === "granted" && (
                                <div className="flex items-center justify-between px-6 py-5 border-t border-secondary/15">
                                    <div>
                                        <p className="text-foreground font-semibold text-[15px]">
                                            Test Notification
                                        </p>
                                        <p className="text-secondary text-[13px] mt-1">
                                            Send a test push to this browser
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            console.log("[TestNotification] Button clicked. State check:", {
                                                pushEnabled: preferences.pushEnabled,
                                                permissionStatus,
                                                devicesCount: devices.length,
                                                testStatus
                                            });
                                            handleSendTestNotification();
                                        }}
                                        disabled={testStatus === "sending"}
                                        className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${testStatus === "success"
                                            ? "bg-green-600 text-white"
                                            : testStatus === "error"
                                                ? "bg-red-600 text-white"
                                                : devices.length === 0 || !preferences.pushEnabled
                                                    ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                                                    : "bg-brand/10 text-brand hover:bg-brand/20 active:scale-95"
                                            }`}
                                    >
                                        {testStatus === "idle" && "Send Test"}
                                        {testStatus === "sending" && "Sending..."}
                                        {testStatus === "success" && "Sent!"}
                                        {testStatus === "error" && "Retry"}
                                    </button>
                                </div>
                            )}

                            {/* Delivery Status Indicator */}
                            {lastNotificationStatus && (
                                <div className="mx-6 mb-5 p-4 rounded-2xl bg-secondary/5 border border-secondary/10 animate-in fade-in slide-in-from-top-2">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-[12px] font-bold uppercase tracking-wider text-secondary">
                                            Delivery Status
                                        </p>
                                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${lastNotificationStatus.status === 'sent' ? 'bg-green-500/20 text-green-500' : 'bg-yellow-500/20 text-yellow-500'}`}>
                                            {lastNotificationStatus.status.toUpperCase()}
                                        </span>
                                    </div>
                                    <p className="text-foreground text-[13px]">
                                        {lastNotificationStatus.status === 'sent' && "Successfully delivered to your browser!"}
                                        {lastNotificationStatus.status === 'pending' && "Waking up the push engine..."}
                                        {lastNotificationStatus.status === 'skipped' && `Skipped: ${lastNotificationStatus.error || 'Check settings'}`}
                                        {lastNotificationStatus.status === 'failed' && `Error: ${lastNotificationStatus.error}`}
                                    </p>
                                </div>
                            )}

                            {/* Master Toggle */}
                            <div className="flex items-center justify-between px-6 py-5">
                                <div>
                                    <p className="text-foreground font-semibold text-[15px]">
                                        Enable push notifications
                                    </p>
                                    <p className="text-secondary text-[13px] mt-1">
                                        Receive push notifications for activity
                                    </p>
                                </div>
                                <button
                                    onClick={handleMasterToggle}
                                    disabled={saving}
                                    className={`relative h-6 w-11 rounded-full transition-colors duration-200 outline-none focus:ring-2 focus:ring-brand/30 ${preferences.pushEnabled ? "bg-brand" : "bg-secondary/20"
                                        }`}
                                >
                                    <div
                                        className={`absolute top-1 left-1 h-4 w-4 bg-white rounded-full transition-transform duration-200 ${preferences.pushEnabled ? "translate-x-5" : "translate-x-0"
                                            }`}
                                    />
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* Notification Types Section */}
                    <section className="space-y-4">
                        <h2 className="px-4 text-[13px] font-bold uppercase tracking-wider text-secondary">
                            Notify me about
                        </h2>
                        <div className="cc-section overflow-hidden rounded-3xl">
                            {notificationTypes.map((type, index) => (
                                <div
                                    key={type.key}
                                    className={`flex items-center justify-between px-6 py-5 ${index < notificationTypes.length - 1
                                        ? "border-b border-secondary/15"
                                        : ""
                                        }`}
                                >
                                    <div className="flex-1">
                                        <p className="text-foreground font-semibold text-[15px]">
                                            {type.label}
                                        </p>
                                        <p className="text-secondary text-[13px] mt-1">
                                            {type.description}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleTypeToggle(type.key)}
                                        disabled={
                                            saving || !preferences.pushEnabled || !type.canDisable
                                        }
                                        className={`relative h-6 w-11 rounded-full transition-colors duration-200 outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-50 ${preferences.pushTypes[type.key]
                                            ? "bg-brand"
                                            : "bg-secondary/20"
                                            }`}
                                    >
                                        <div
                                            className={`absolute top-1 left-1 h-4 w-4 bg-white rounded-full transition-transform duration-200 ${preferences.pushTypes[type.key]
                                                ? "translate-x-5"
                                                : "translate-x-0"
                                                }`}
                                        />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Devices Section */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between px-4">
                            <h2 className="text-[13px] font-bold uppercase tracking-wider text-secondary">
                                Devices
                            </h2>
                            <button
                                onClick={loadDevices}
                                className="text-[11px] font-bold uppercase tracking-widest text-brand hover:opacity-70 transition-opacity"
                            >
                                Refresh
                            </button>
                        </div>
                        <div className="cc-section overflow-hidden rounded-3xl">
                            {devices.length === 0 ? (
                                <div className="px-6 py-8 text-center">
                                    <DevicePhoneMobileIcon className="h-12 w-12 text-secondary/50 mx-auto mb-3" />
                                    <p className="text-secondary text-[14px] mb-4">
                                        No devices registered for push notifications
                                    </p>
                                    {permissionStatus !== "granted" && (
                                        <button
                                            onClick={handleEnablePush}
                                            className="bg-brand text-brand-foreground px-6 py-2.5 rounded-full text-sm font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-brand/20"
                                        >
                                            Enable Notifications
                                        </button>
                                    )}
                                </div>
                            ) : (
                                devices.map((device, index) => (
                                    <div
                                        key={device.id}
                                        className={`flex items-center justify-between px-6 py-5 ${index < devices.length - 1
                                            ? "border-b border-secondary/15"
                                            : ""
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 rounded-2xl bg-secondary/10">
                                                <DevicePhoneMobileIcon className="h-5 w-5 text-secondary" />
                                            </div>
                                            <div>
                                                <p className="text-foreground font-semibold text-[15px]">
                                                    {device.deviceName}
                                                </p>
                                                <p className="text-secondary text-[13px]">
                                                    {device.platform} • Last seen{" "}
                                                    {formatLastSeen(device.lastSeenAt)}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveDevice(device.id)}
                                            className="p-2 rounded-full hover:bg-red-500/10 text-red-500 transition-colors active:scale-95"
                                        >
                                            <XMarkIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>



                    {/* Footer */}
                    <SettingsFooter />
                </div>
            </main>

            {/* Saving Indicator */}
            {saving && (
                <div className="fixed bottom-4 right-4 bg-brand text-brand-foreground px-4 py-2 rounded-full text-sm font-bold shadow-lg shadow-brand/20 animate-in slide-in-from-bottom">
                    Saving...
                </div>
            )}
        </div>
    );
}
