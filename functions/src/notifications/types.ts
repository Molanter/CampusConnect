export type NotificationType =
    | "follow"
    | "club_invite"
    | "club_join_request"
    | "post_like"
    | "comment_like"
    | "comment_reply"
    | "post_comment"
    | "announcement"
    | "system";

export interface CreateNotificationParams {
    toUid: string;
    type: NotificationType;
    title: string;
    body?: string | null;
    actorUid?: string | null;
    actorName?: string | null;
    actorPhotoURL?: string | null;
    campusId?: string | null;
    clubId?: string | null;
    postId?: string | null;
    commentId?: string | null;
    replyId?: string | null;
    deeplink: {
        screen: string;
        params: Record<string, any>;
    };
    dedupeKey?: string | null;
    groupKey?: string | null;
    pushSend?: boolean;
    imageUrl?: string | null;
}

export interface PushSettings {
    pushEnabled: boolean;
    pushTypes: Record<string, boolean>;
    quietHours?: {
        enabled: boolean;
        start: string; // HH:mm
        end: string;   // HH:mm
    };
}
