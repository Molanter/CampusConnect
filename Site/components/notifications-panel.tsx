"use client";

import { useAuth } from "@/lib/use-auth";
import { useNotifications } from "@/lib/use-notifications";
import { Notification } from "@/lib/types/notifications";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";

type NotificationsPanelProps = {
  isWide: boolean;
  onClose: () => void;
  inline?: boolean;
};

function NotificationItem({
  notification,
  onMarkAsRead,
  onNavigate,
}: {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onNavigate: (notification: Notification) => void;
}) {
  const handleClick = () => {
    if (!notification.isRead) {
      onMarkAsRead(notification.id);
    }
    onNavigate(notification);
  };

  const timeAgo = formatDistanceToNow(notification.createdAt, {
    addSuffix: true,
  });

  return (
    <button
      onClick={handleClick}
      className={`w-full rounded-xl border p-3 text-left transition-all hover:border-white/20 ${notification.isRead
        ? "border-white/5 bg-transparent"
        : "border-blue-500/30 bg-blue-500/5"
        }`}
    >
      <div className="flex gap-3">
        {notification.actorPhotoURL && (
          <img
            src={notification.actorPhotoURL}
            alt={notification.actorName || "User"}
            className="h-10 w-10 rounded-full object-cover"
          />
        )}
        <div className="flex-1 overflow-hidden">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-neutral-50">
              {notification.title}
            </p>
            {!notification.isRead && (
              <div className="h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
            )}
          </div>
          {notification.body && (
            <p className="mt-1 text-xs text-neutral-400">{notification.body}</p>
          )}
          <p className="mt-2 text-xs text-neutral-500">{timeAgo}</p>
        </div>
      </div>
    </button>
  );
}

export function NotificationsPanel({
  isWide,
  onClose,
  inline = false,
}: NotificationsPanelProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { notifications, unreadCount, loading, markAsRead } = useNotifications(
    user?.uid || null
  );

  const handleNavigate = (notification: Notification) => {
    const { screen, params } = notification.deeplink;

    // Build the navigation URL based on screen and params
    let url = "/";
    switch (screen) {
      case "post":
        url = `/posts/${params.postId}`;
        break;
      case "club":
        url = `/clubs/${params.clubId}`;
        break;
      case "club_requests":
        url = `/clubs/${params.clubId}/settings?tab=requests`;
        break;
      case "profile":
        url = `/user/${params.userId}`;
        break;
      case "settings_notifications":
        url = "/settings/notifications";
        break;
      case "notifications":
      default:
        url = "/";
        break;
    }

    onClose();
    router.push(url);
  };

  const content = (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Notifications
          </p>
          <h2 className="text-sm font-semibold text-neutral-50">
            Activity {unreadCount > 0 && `(${unreadCount})`}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-neutral-800/80 px-3 py-1 text-[11px] text-neutral-100 hover:bg-neutral-700"
        >
          Close
        </button>
      </div>

      <div className="space-y-2 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-neutral-500">Loading...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <p className="text-sm text-neutral-500">No notifications yet</p>
            <p className="mt-1 text-xs text-neutral-600">
              You'll be notified when something happens
            </p>
          </div>
        ) : (
          notifications
            .filter((n) => !n.isArchived)
            .map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={markAsRead}
                onNavigate={handleNavigate}
              />
            ))
        )}
      </div>
    </>
  );

  if (inline) {
    return (
      <div className="h-full w-full rounded-3xl border border-white/10 bg-neutral-950/95 px-4 py-4">
        {content}
      </div>
    );
  }

  const containerBase =
    "fixed inset-0 z-40 flex bg-black/40 backdrop-blur-sm";

  const innerClasses = isWide
    ? "ml-auto mr-4 my-4 h-[80vh] w-full max-w-sm rounded-3xl border border-white/10 bg-neutral-950/95 px-4 py-4 flex flex-col"
    : "mx-4 my-6 h-[80vh] w-full max-w-sm rounded-3xl border border-white/10 bg-neutral-950/95 px-4 py-4 flex flex-col";

  return (
    <div className={containerBase} aria-modal="true" role="dialog">
      <div className={innerClasses}>{content}</div>
    </div>
  );
}

