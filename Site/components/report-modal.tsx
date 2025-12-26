"use client";

import { useState } from "react";
import { auth, db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { XMarkIcon, FlagIcon } from "@heroicons/react/24/outline";
import { REPORT_REASON_LABELS, ReportReason } from "../lib/types/moderation";

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    postId: string;
    onReportSubmitted?: () => void;
}

export function ReportModal({ isOpen, onClose, postId, onReportSubmitted }: ReportModalProps) {
    const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
    const [details, setDetails] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedReason) {
            setError("Please select a reason");
            return;
        }

        const currentUser = auth.currentUser;
        if (!currentUser) {
            setError("You must be signed in to report posts");
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            // TESTING MODE: Using addDoc to allow multiple reports from same user
            // For production, use setDoc with UID as doc ID to prevent duplicates
            const reportsRef = collection(db, "posts", postId, "reports");

            await addDoc(reportsRef, {
                reporterUid: currentUser.uid,
                reason: selectedReason,
                details: details.trim().slice(0, 500), // Max 500 chars
                createdAt: serverTimestamp(),
            });

            setSuccess(true);
            onReportSubmitted?.();

            // Close modal after brief delay to show success message
            setTimeout(() => {
                onClose();
                // Reset state
                setSelectedReason(null);
                setDetails("");
                setSuccess(false);
            }, 1500);

        } catch (err: any) {
            console.error("Error submitting report:", err);

            // Check if it's a duplicate report error
            if (err.code === "permission-denied" || err.message?.includes("already exists")) {
                setError("You have already reported this post");
            } else {
                setError("Failed to submit report. Please try again.");
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        if (!submitting) {
            onClose();
            // Reset state after animation
            setTimeout(() => {
                setSelectedReason(null);
                setDetails("");
                setError(null);
                setSuccess(false);
            }, 300);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={handleClose}
        >
            <div
                className="relative w-full max-w-md overflow-hidden rounded-3xl bg-[#1C1C1E] ring-1 ring-white/10 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 p-4">
                    <div className="flex items-center gap-2">
                        <FlagIcon className="h-5 w-5 text-red-400" />
                        <h3 className="text-lg font-bold text-white">Report Post</h3>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={submitting}
                        className="rounded-full p-2 text-neutral-400 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
                    >
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>

                {success ? (
                    <div className="p-6 text-center">
                        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20 mb-4">
                            <svg className="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <p className="text-white font-medium">Report submitted</p>
                        <p className="text-sm text-neutral-400 mt-1">Thank you for helping keep our community safe</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        {/* Reason Selection */}
                        <div>
                            <label className="block text-sm font-medium text-neutral-300 mb-3">
                                Why are you reporting this post?
                            </label>
                            <div className="space-y-2">
                                {(Object.keys(REPORT_REASON_LABELS) as ReportReason[]).map((reason) => (
                                    <label
                                        key={reason}
                                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${selectedReason === reason
                                            ? "bg-red-500/20 ring-1 ring-red-500/50"
                                            : "bg-white/5 hover:bg-white/10"
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name="reason"
                                            value={reason}
                                            checked={selectedReason === reason}
                                            onChange={(e) => setSelectedReason(e.target.value as ReportReason)}
                                            className="h-4 w-4 text-red-500 focus:ring-red-500 focus:ring-offset-neutral-900"
                                        />
                                        <span className="text-sm text-white">{REPORT_REASON_LABELS[reason]}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Optional Details */}
                        <div>
                            <label className="block text-sm font-medium text-neutral-300 mb-2">
                                Additional details (optional)
                            </label>
                            <textarea
                                value={details}
                                onChange={(e) => setDetails(e.target.value)}
                                maxLength={500}
                                rows={3}
                                placeholder="Provide more context about this report..."
                                className="w-full resize-none rounded-xl bg-white/5 px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 border border-white/10"
                            />
                            <p className="text-xs text-neutral-500 mt-1">
                                {details.length}/500 characters
                            </p>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3">
                                <p className="text-sm text-red-400">{error}</p>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={!selectedReason || submitting}
                            className="w-full rounded-full bg-red-500 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-red-600 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-500"
                        >
                            {submitting ? "Submitting..." : "Submit Report"}
                        </button>

                        <p className="text-xs text-center text-neutral-500">
                            Reports are reviewed by our moderation team. False reports may result in action against your account.
                        </p>
                    </form>
                )}
            </div>
        </div>
    );
}
