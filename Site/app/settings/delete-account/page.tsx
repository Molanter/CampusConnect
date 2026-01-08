"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, deleteDoc, collection, query, where, getDocs } from "firebase/firestore";
import Toast, { ToastData } from "@/components/Toast";
import { SettingsFooter } from "@/components/settings-footer";

export default function DeleteAccountPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [emailConfirm, setEmailConfirm] = useState("");
    const [confirmText, setConfirmText] = useState("");
    const [toast, setToast] = useState<ToastData | null>(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    // Check if email matches
    const emailMatches = emailConfirm.toLowerCase() === user?.email?.toLowerCase();
    // Check if DELETE is typed correctly
    const deleteTyped = confirmText.toLowerCase() === "delete";
    // All confirmations met
    const canDelete = emailMatches && deleteTyped;

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
            if (!u) {
                router.push("/");
            }
        });
        return () => unsub();
    }, [router]);

    const handleDeleteAccount = async () => {
        if (confirmText.toLowerCase() !== "delete") {
            setToast({ type: "error", message: "Please type DELETE to confirm" });
            return;
        }

        setLoading(true);
        setShowConfirmModal(false);

        try {
            if (!user) throw new Error("No user found");

            // Delete user's data from Firestore
            // This is a simplified version - you may need to delete more collections
            const userDocRef = doc(db, "users", user.uid);
            await deleteDoc(userDocRef);

            // Delete the Firebase Auth user
            await user.delete();

            setToast({ type: "success", message: "Account deleted successfully" });
            setTimeout(() => {
                router.push("/");
            }, 2000);
        } catch (error: any) {
            console.error("Delete account error:", error);

            // If re-authentication is needed
            if (error.code === "auth/requires-recent-login") {
                setToast({
                    type: "error",
                    message: "Please sign out and sign in again before deleting your account"
                });
            } else {
                setToast({ type: "error", message: error.message || "Failed to delete account" });
            }
            setLoading(false);
        }
    };

    if (!user) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background pb-20">
            <Toast toast={toast} onClear={() => setToast(null)} />

            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-40 pt-4 pointer-events-none">
                <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 pointer-events-auto">
                    <Link
                        href="/settings"
                        className="flex h-10 w-10 items-center justify-center rounded-full cc-header-btn active:scale-95"
                    >
                        <ChevronLeftIcon className="h-5 w-5 text-foreground" />
                    </Link>
                    <div className="flex items-center rounded-full cc-glass px-6 py-2.5 shadow-sm">
                        <h1 className="text-sm font-bold text-foreground">Delete Account</h1>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-2xl px-4 pt-24 pb-8">
                <div className="space-y-8">
                    {/* Warning Section */}
                    <div className="cc-section rounded-3xl p-6 md:p-8 space-y-4 border-2 border-red-500/20">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-full bg-red-500/10">
                                <ExclamationTriangleIcon className="h-6 w-6 text-red-500" />
                            </div>
                            <h2 className="text-2xl font-bold text-red-500">Warning: This Action is Permanent</h2>
                        </div>
                        <p className="text-[15px] leading-relaxed text-foreground/90">
                            Deleting your account is a permanent action that cannot be undone. All of your data will be permanently removed from our servers.
                        </p>
                    </div>

                    {/* What Will Be Deleted */}
                    <div className="cc-section rounded-3xl p-6 md:p-8">
                        <h3 className="mb-4 text-lg font-bold text-foreground">
                            What will be deleted:
                        </h3>
                        <div className="space-y-3 text-[15px] leading-relaxed text-foreground/80 pl-4 border-l-2 border-red-500/30">
                            <div className="flex items-start gap-3">
                                <div className="h-2 w-2 rounded-full bg-red-500 mt-2" />
                                <p>Your profile information and settings</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="h-2 w-2 rounded-full bg-red-500 mt-2" />
                                <p>All posts, comments, and interactions</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="h-2 w-2 rounded-full bg-red-500 mt-2" />
                                <p>Club memberships and ownership</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="h-2 w-2 rounded-full bg-red-500 mt-2" />
                                <p>Message history and support tickets</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="h-2 w-2 rounded-full bg-red-500 mt-2" />
                                <p>All other account data</p>
                            </div>
                        </div>
                    </div>

                    {/* Before You Go */}
                    <div className="cc-section rounded-3xl p-6 md:p-8">
                        <h3 className="mb-4 text-lg font-bold text-foreground">
                            Before you go...
                        </h3>
                        <div className="space-y-3 text-[15px] leading-relaxed text-foreground/80">
                            <p>
                                If you're experiencing issues with CampusConnect, please consider{" "}
                                <Link href="/settings/help-support" className="font-semibold text-brand hover:underline">
                                    contacting our support team
                                </Link>
                                {" "}before deleting your account. We're here to help!
                            </p>
                            <p>
                                You can also temporarily sign out instead of permanently deleting your account.
                            </p>
                        </div>
                    </div>

                    {/* Confirmation Section */}
                    <div className="cc-section rounded-3xl p-6 md:p-8 space-y-6">
                        <h3 className="text-lg font-bold text-foreground">
                            Confirm Account Deletion
                        </h3>

                        {/* Step 1: Email Confirmation */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${emailMatches ? 'bg-green-500 text-white' : 'bg-secondary/20 text-secondary'}`}>
                                    1
                                </div>
                                <label className="text-[13px] font-semibold text-foreground/80">
                                    Confirm your email address:
                                </label>
                            </div>
                            <input
                                type="email"
                                value={emailConfirm}
                                onChange={(e) => setEmailConfirm(e.target.value)}
                                placeholder={user?.email || "Enter your email"}
                                className="w-full bg-secondary/5 rounded-2xl px-5 py-3.5 text-foreground placeholder:text-secondary/50 focus:outline-none focus:ring-2 focus:ring-brand/30 transition-all font-medium"
                            />
                            {emailConfirm && !emailMatches && (
                                <p className="text-xs text-red-500 px-2">Email does not match your account</p>
                            )}
                            {emailMatches && (
                                <p className="text-xs text-green-500 px-2 flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    Email verified
                                </p>
                            )}
                        </div>

                        {/* Step 2: Type DELETE (only shown after email matches) */}
                        {emailMatches && (
                            <div className="space-y-3 animate-slide-up-fade">
                                <div className="flex items-center gap-2">
                                    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${deleteTyped ? 'bg-green-500 text-white' : 'bg-secondary/20 text-secondary'}`}>
                                        2
                                    </div>
                                    <label className="text-[13px] font-semibold text-foreground/80">
                                        Type <span className="font-mono font-bold text-red-500">DELETE</span> to confirm:
                                    </label>
                                </div>
                                <input
                                    type="text"
                                    value={confirmText}
                                    onChange={(e) => setConfirmText(e.target.value)}
                                    placeholder="Type DELETE here"
                                    className="w-full bg-secondary/5 rounded-2xl px-5 py-3.5 text-foreground placeholder:text-secondary/50 focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-all font-medium"
                                />
                                {confirmText && !deleteTyped && (
                                    <p className="text-xs text-red-500 px-2">Must type exactly "DELETE"</p>
                                )}
                                {deleteTyped && (
                                    <p className="text-xs text-green-500 px-2 flex items-center gap-1">
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                        Confirmation received
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Step 3: Delete Button (only shown after both confirmations) */}
                        {canDelete && (
                            <div className="space-y-4 animate-slide-up-fade">
                                <div className="flex items-center gap-2">
                                    <div className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold bg-secondary/20 text-secondary">
                                        3
                                    </div>
                                    <label className="text-[13px] font-semibold text-foreground/80">
                                        Final step - click to delete:
                                    </label>
                                </div>
                                <button
                                    onClick={() => setShowConfirmModal(true)}
                                    disabled={loading}
                                    className="w-full bg-red-500 text-white py-3.5 rounded-full font-bold text-[17px] shadow-lg shadow-red-500/20 hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed transition-all"
                                >
                                    {loading ? "Deleting Account..." : "Delete My Account"}
                                </button>
                            </div>
                        )}

                        <div className="text-center pt-2">
                            <Link
                                href="/settings"
                                className="text-[14px] font-semibold text-brand hover:underline"
                            >
                                Cancel and go back to Settings
                            </Link>
                        </div>
                    </div>

                    {/* Footer */}
                    <SettingsFooter />
                </div>
            </main>

            {/* Final Confirmation Modal */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-md animate-in fade-in duration-300"
                        onClick={() => setShowConfirmModal(false)}
                    />
                    <div className="relative w-full max-w-sm bg-background border border-red-500/30 rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-8">
                            <div className="flex items-center justify-center mb-4">
                                <div className="p-4 rounded-full bg-red-500/10">
                                    <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />
                                </div>
                            </div>
                            <h3 className="text-xl font-black text-foreground mb-2 text-center">Final Confirmation</h3>
                            <p className="text-secondary text-sm mb-6 leading-relaxed text-center">
                                Are you absolutely sure you want to permanently delete your account? This action cannot be undone.
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowConfirmModal(false)}
                                    className="flex-1 bg-secondary/10 hover:bg-secondary/20 text-foreground font-bold py-4 rounded-full transition-all text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteAccount}
                                    className="flex-1 bg-red-500 hover:scale-105 active:scale-95 text-white font-bold py-4 rounded-full shadow-lg shadow-red-500/20 transition-all text-sm"
                                >
                                    Yes, I Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
