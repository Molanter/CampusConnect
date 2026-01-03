"use client";

type EventDetailOverlayProps = {
  event: {
    title: string;
    description?: string | null;
    date?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    locationLabel?: string | null;
    campusName?: string | null;
    hostDisplayName?: string | null;
  };
  isWide: boolean;
  onClose: () => void;
  inline?: boolean;
};

export function EventDetailOverlay({
  event,
  isWide,
  onClose,
  inline = false,
}: EventDetailOverlayProps) {
  const dateLabel = event.date ?? "Date TBA";
  const timeLabel =
    event.startTime && event.endTime
      ? `${event.startTime}–${event.endTime}`
      : event.startTime || event.endTime || "";

  const location =
    event.locationLabel || event.campusName || "Location TBA";

  if (inline) {
    return (
      <div className="h-full w-full rounded-3xl border border-secondary/15 bg-background px-5 py-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
              Event details
            </p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">
              {event.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-secondary/10 px-3 py-1 text-[11px] text-foreground hover:bg-secondary/20 transition-colors"
          >
            Close
          </button>
        </div>

        <div className="space-y-3 text-sm text-neutral-200">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
              When
            </p>
            <p className="mt-0.5">
              {dateLabel}
              {timeLabel ? ` • ${timeLabel}` : ""}
            </p>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
              Where
            </p>
            <p className="mt-0.5">{location}</p>
          </div>

          {event.hostDisplayName && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                Host
              </p>
              <p className="mt-0.5">{event.hostDisplayName}</p>
            </div>
          )}

          {event.description && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-secondary">
                Description
              </p>
              <p className="mt-0.5 text-sm text-foreground/80 whitespace-pre-wrap">
                {event.description}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const containerBase =
    "fixed inset-0 z-40 flex bg-black/40 backdrop-blur-sm";

  const innerClasses = isWide
    ? "ml-auto mr-4 my-4 w-full max-w-md rounded-3xl border border-secondary/15 bg-background px-5 py-5"
    : "mx-4 my-6 w-full max-w-xl rounded-3xl border border-secondary/15 bg-background px-5 py-5";

  return (
    <div className={containerBase} aria-modal="true" role="dialog">
      <div className={innerClasses}>
        {/* same inner content */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
              Event details
            </p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">
              {event.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-secondary/10 px-3 py-1 text-[11px] text-foreground hover:bg-secondary/20 transition-colors"
          >
            Close
          </button>
        </div>

        <div className="space-y-3 text-sm text-neutral-200">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
              When
            </p>
            <p className="mt-0.5">
              {dateLabel}
              {timeLabel ? ` • ${timeLabel}` : ""}
            </p>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
              Where
            </p>
            <p className="mt-0.5">{location}</p>
          </div>

          {event.hostDisplayName && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                Host
              </p>
              <p className="mt-0.5">{event.hostDisplayName}</p>
            </div>
          )}

          {event.description && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-secondary">
                Description
              </p>
              <p className="mt-0.5 text-sm text-foreground/80 whitespace-pre-wrap">
                {event.description}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


