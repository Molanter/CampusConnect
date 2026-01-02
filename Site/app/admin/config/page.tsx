"use client";

import React, { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import Link from "next/link";
import { ChevronLeftIcon, GlobeAltIcon, Cog6ToothIcon, MegaphoneIcon } from "@heroicons/react/24/outline";
import { db } from "../../../lib/firebase";
import Toast, { ToastData } from "@/components/Toast";

// Definition for App Config
type AppConfig = {
    version: string;
    maintenanceMode: boolean;
    maintenanceMessage?: string;
    minSupportedVersion: string;
    announcement: string;
};

// UI Definitions from guidelines
const ui = {
    page: "min-h-screen bg-transparent text-foreground flex",
    sidebar: "w-64 border border-secondary/25 cc-glass-strong p-4 flex flex-col gap-2 rounded-3xl h-fit hidden md:flex shrink-0",
    main: "flex-1 p-8 max-w-4xl mx-auto w-full",
    navItem: "flex items-center gap-3 px-4 py-2 text-sm font-medium cc-muted hover:text-foreground hover:bg-secondary/15 rounded-full transition-colors text-left",
    navItemActive: "flex items-center gap-3 px-4 py-2 text-sm font-medium text-foreground bg-secondary/30 rounded-full text-left",
    sectionTitle: "text-2xl font-light tracking-wide text-foreground mb-2",
    sectionDesc: "text-sm cc-muted mb-6",
    card: "space-y-6 rounded-3xl border border-secondary/25 cc-section p-8",
    inputGroup: "space-y-2",
    label: "text-xs font-semibold tracking-wider cc-muted uppercase",
    input: "w-full rounded-xl border border-secondary/25 bg-secondary/10 px-4 py-3 text-sm text-foreground focus:border-brand/50 focus:outline-none focus:ring-1 focus:ring-brand transition-all placeholder:text-secondary",
    textArea: "w-full resize-none rounded-xl border border-secondary/25 bg-secondary/10 px-4 py-3 text-sm text-foreground focus:border-brand/50 focus:outline-none focus:ring-1 focus:ring-brand transition-all placeholder:text-secondary",
    saveBtn: "rounded-full bg-brand px-8 py-3 text-sm font-semibold text-black transition-all hover:bg-brand/90 active:scale-95 disabled:opacity-50 shadow-lg shadow-brand/10"
};

export default function AppConfigPage() {
    const [config, setConfig] = useState<AppConfig>({
        version: "1.0.0",
        maintenanceMode: false,
        maintenanceMessage: "",
        minSupportedVersion: "1.0.0",
        announcement: ""
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'general' | 'announcements' | 'maintenance'>('general');
    const [toast, setToast] = useState<ToastData | null>(null);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const ref = doc(db, "config", "app_info");
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    setConfig({ maintenanceMessage: "", ...snap.data() } as AppConfig);
                } else {
                    await setDoc(ref, config);
                }
            } catch (err) {
                console.error("Error fetching config:", err);
                setToast({ type: "error", message: "Failed to load configuration" });
            } finally {
                setLoading(false);
            }
        };
        fetchConfig();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const ref = doc(db, "config", "app_info");
            await setDoc(ref, config);
            setToast({ type: "success", message: "App configuration updated" });
        } catch (err) {
            console.error("Error saving config:", err);
            setToast({ type: "error", message: "Failed to save configuration" });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-black text-white">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            </div>
        );
    }

    return (
        <div className={ui.page}>
            <Toast toast={toast} onClear={() => setToast(null)} />

            {/* Left Sidebar */}
            <aside className={ui.sidebar}>
                <div className="flex items-center gap-2 px-2 pb-6">
                    <span className="font-semibold tracking-wide">Configuration</span>
                </div>

                <nav className="flex flex-col gap-1">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={activeTab === 'general' ? ui.navItemActive : ui.navItem}
                    >
                        <Cog6ToothIcon className="h-5 w-5" />
                        General Settings
                    </button>
                    <button
                        onClick={() => setActiveTab('announcements')}
                        className={activeTab === 'announcements' ? ui.navItemActive : ui.navItem}
                    >
                        <MegaphoneIcon className="h-5 w-5" />
                        Announcements
                    </button>
                    <button
                        onClick={() => setActiveTab('maintenance')}
                        className={activeTab === 'maintenance' ? ui.navItemActive : ui.navItem}
                    >
                        <GlobeAltIcon className="h-5 w-5" />
                        Maintenance
                    </button>
                </nav>

                <div className="mt-auto px-4 text-xs text-neutral-600">
                    <p>CampusConnect Admin</p>
                    <p>v{config.version}</p>
                </div>
            </aside>

            {/* Main Content */}
            <main className={ui.main}>
                {activeTab === 'general' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div>
                            <h1 className={ui.sectionTitle}>App Versions</h1>
                            <p className={ui.sectionDesc}>Manage application versioning and client compatibility.</p>
                        </div>

                        <div className={ui.card}>
                            <div className="grid grid-cols-2 gap-6">
                                <div className={ui.inputGroup}>
                                    <label className={ui.label}>Current Version</label>
                                    <input
                                        type="text"
                                        value={config.version}
                                        onChange={(e) => setConfig({ ...config, version: e.target.value })}
                                        className={ui.input}
                                        placeholder="1.0.0"
                                    />
                                </div>
                                <div className={ui.inputGroup}>
                                    <label className={ui.label}>Min Supported Version</label>
                                    <input
                                        type="text"
                                        value={config.minSupportedVersion}
                                        onChange={(e) => setConfig({ ...config, minSupportedVersion: e.target.value })}
                                        className={ui.input}
                                        placeholder="1.0.0"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <button onClick={handleSave} disabled={saving} className={ui.saveBtn}>
                                {saving ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'announcements' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div>
                            <h1 className={ui.sectionTitle}>Global Announcements</h1>
                            <p className={ui.sectionDesc}>Broadcast messages to all users on the platform.</p>
                        </div>

                        <div className={ui.card}>
                            <div className="grid grid-cols-1 gap-6">
                                <div className={ui.inputGroup}>
                                    <label className={ui.label}>Announcement Title</label>
                                    <input
                                        type="text"
                                        className={ui.input}
                                        placeholder="Important Update"
                                    />
                                </div>

                                <div className={ui.inputGroup}>
                                    <label className={ui.label}>Message Content</label>
                                    <textarea
                                        value={config.announcement}
                                        onChange={(e) => setConfig({ ...config, announcement: e.target.value })}
                                        rows={6}
                                        className={ui.textArea}
                                        placeholder="Write your announcement here..."
                                    />
                                </div>
                            </div>

                            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                                <div className="flex gap-3">
                                    <GlobeAltIcon className="h-5 w-5 text-blue-400 shrink-0" />
                                    <p className="text-xs text-foreground leading-relaxed">
                                        Announcements appear on the user's home feed until dismissed.
                                        Clearing the text above removes the announcement.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <button onClick={handleSave} disabled={saving} className={ui.saveBtn}>
                                {saving ? "Saving..." : "Publish Announcement"}
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'maintenance' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div>
                            <h1 className={ui.sectionTitle}>Maintenance Mode</h1>
                            <p className={ui.sectionDesc}>Control app accessibility during scheduled downtime.</p>
                        </div>

                        <div className={ui.card}>
                            <div className="flex items-center justify-between py-2 border-b border-secondary/25 pb-6 mb-2">
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-foreground">Enable Maintenance Mode</label>
                                    <p className="text-xs cc-muted">If enabled, non-admin users will be blocked from accessing the app.</p>
                                </div>
                                <button
                                    onClick={() => setConfig({ ...config, maintenanceMode: !config.maintenanceMode })}
                                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${config.maintenanceMode ? "bg-red-500" : "bg-secondary/40"
                                        }`}
                                >
                                    <span
                                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${config.maintenanceMode ? "translate-x-6" : "translate-x-1"
                                            }`}
                                    />
                                </button>
                            </div>

                            <div className={ui.inputGroup}>
                                <label className={ui.label}>Maintenance Message</label>
                                <textarea
                                    value={config.maintenanceMessage || ""}
                                    onChange={(e) => setConfig({ ...config, maintenanceMessage: e.target.value })}
                                    rows={4}
                                    className={ui.textArea}
                                    placeholder="We are currently performing scheduled maintenance. Please check back later."
                                />
                            </div>

                            {config.maintenanceMode && (
                                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 animate-in fade-in zoom-in-95">
                                    <div className="flex gap-3">
                                        <div className="h-2 w-2 mt-1.5 rounded-full bg-red-400 animate-pulse shadow-[0_0_8px_rgba(248,113,113,0.5)] shrink-0" />
                                        <div>
                                            <p className="text-sm font-semibold text-red-500">Maintenance is Active</p>
                                            <p className="text-xs text-foreground mt-1">Users attempting to open the app will see the message above.</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end">
                            <button onClick={handleSave} disabled={saving} className={ui.saveBtn}>
                                {saving ? "Saving..." : "Update Settings"}
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
