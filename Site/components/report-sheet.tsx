"use client";

import { useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

const REPORT_REASONS = [
  "Spam or misleading",
  "Harassment or hate speech",
  "Inappropriate content",
  "False information",
  "Violence or dangerous content",
  "Other",
];

type ReportSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string, details?: string) => Promise<void>;
  commentAuthor: string;
};

export function ReportSheet({ isOpen, onClose, onSubmit, commentAuthor }: ReportSheetProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [pending, setPending] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason || pending) return;
    setPending(true);
    try {
      await onSubmit(selectedReason, details.trim() || undefined);
      setSelectedReason(null);
      setDetails("");
      onClose();
    } finally {
      setPending(false);
    }
  };

  const handleClose = () => {
    if (!pending) {
      setSelectedReason(null);
      setDetails("");
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl bg-[#111216] p-6 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Report Comment</h2>
          <button
            type="button"
            className="rounded-full p-2 text-neutral-400 hover:bg-white/5 hover:text-white"
            onClick={handleClose}
            disabled={pending}
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <p className="mb-4 text-sm text-neutral-400">
          Why are you reporting this comment by {commentAuthor}?
        </p>

        <div className="mb-4 space-y-2">
          {REPORT_REASONS.map((reason) => (
            <button
              key={reason}
              type="button"
              className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                selectedReason === reason
                  ? "border-white bg-white/10 text-white"
                  : "border-white/10 text-neutral-300 hover:border-white/20 hover:bg-white/5"
              }`}
              onClick={() => setSelectedReason(reason)}
              disabled={pending}
            >
              {reason}
            </button>
          ))}
        </div>

        {selectedReason === "Other" && (
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-neutral-300">
              Additional details (optional)
            </label>
            <textarea
              className="w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-sm text-white placeholder-neutral-500 focus:border-white/30 focus:outline-none"
              placeholder="Provide more information..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              disabled={pending}
            />
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            className="flex-1 rounded-full border border-white/10 py-3 font-semibold text-white hover:bg-white/5 disabled:opacity-50"
            onClick={handleClose}
            disabled={pending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="flex-1 rounded-full bg-red-500 py-3 font-semibold text-white hover:bg-red-600 disabled:opacity-50"
            onClick={handleSubmit}
            disabled={!selectedReason || pending}
          >
            {pending ? "Reporting..." : "Submit Report"}
          </button>
        </div>
      </div>
    </div>
  );
}

