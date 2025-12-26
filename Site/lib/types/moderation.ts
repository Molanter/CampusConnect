/**
 * Type definitions for post reporting and moderation system
 */

export type ReportReason =
    | "spam"
    | "harassment"
    | "hate"
    | "nudity"
    | "violence"
    | "illegal"
    | "other";

export interface PostReport {
    reporterUid: string;
    reason: ReportReason;
    details?: string; // Max 500 chars
    createdAt: any; // Timestamp
}

export interface ModerationQueueItem {
    targetType: "post";
    targetId: string;
    state: "needs_review" | "dismissed" | "action_taken";
    reportCount: number;
    createdAt: any; // Timestamp
    updatedAt?: any; // Timestamp
    reasonsBreakdown?: Record<ReportReason, number>;
    ownerUid: string;
}

export interface AuditLog {
    targetType: "post";
    targetId: string;
    action: "report_added" | "auto_under_review" | "admin_hidden" | "admin_restored" | "admin_dismissed";
    actorType: "user" | "system" | "admin";
    actorUid?: string;
    reason?: ReportReason;
    note?: string;
    createdAt: any; // Timestamp
}

export type ModerationAction = "restore" | "hide" | "dismiss";

export interface ModeratePostParams {
    postId: string;
    action: ModerationAction;
    note?: string;
}

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
    spam: "Spam",
    harassment: "Harassment",
    hate: "Hate speech",
    nudity: "Nudity or sexual content",
    violence: "Violence or threats",
    illegal: "Illegal activity",
    other: "Other",
};

export const REPORT_THRESHOLD = 3;
