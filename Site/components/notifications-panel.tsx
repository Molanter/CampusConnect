"use client";

type NotificationsPanelProps = {
  isWide: boolean;
  onClose: () => void;
  inline?: boolean;
};

export function NotificationsPanel({
  isWide,
  onClose,
  inline = false,
}: NotificationsPanelProps) {
  if (inline) {
    return (
      <div className="h-full w-full rounded-3xl border border-white/10 bg-neutral-950/95 px-4 py-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
              Notifications
            </p>
            <h2 className="text-sm font-semibold text-neutral-50">
              Activity
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

        <div className="space-y-3 text-xs text-neutral-300">
          <p className="text-neutral-500">
            You&apos;ll see mentions and attendance updates here once that
            activity is wired up.
          </p>
        </div>
      </div>
    );
  }

  const containerBase =
    "fixed inset-0 z-40 flex bg-black/40 backdrop-blur-sm";

  const innerClasses = isWide
    ? "ml-auto mr-4 my-4 h-[80vh] w-full max-w-sm rounded-3xl border border-white/10 bg-neutral-950/95 px-4 py-4"
    : "mx-4 my-6 h-[80vh] w-full max-w-sm rounded-3xl border border-white/10 bg-neutral-950/95 px-4 py-4";

  return (
    <div className={containerBase} aria-modal="true" role="dialog">
      <div className={innerClasses}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
              Notifications
            </p>
            <h2 className="text-sm font-semibold text-neutral-50">
              Activity
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

        <div className="space-y-3 text-xs text-neutral-300">
          <p className="text-neutral-500">
            You&apos;ll see mentions and attendance updates here once that
            activity is wired up.
          </p>
        </div>
      </div>
    </div>
  );
}


