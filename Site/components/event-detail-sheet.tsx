// components/event-detail-sheet.tsx

import { Event } from "../lib/events";

type EventDetailSheetProps = {
  event: Event;
  onClose: () => void;
};

export function EventDetailSheet({ event, onClose }: EventDetailSheetProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xl">
      <div className="w-full max-w-lg rounded-t-3xl border border-white/20 bg-white/10 p-5 backdrop-blur-2xl">
        <button
          className="mb-3 text-[11px] text-gray-400 hover:text-gray-100 underline-offset-4 hover:underline transition"
          type="button"
          onClick={onClose}
        >
          Close
        </button>

        <h2 className="mb-1 text-lg font-semibold text-slate-50">
          {event.title}
        </h2>

        <p className="mb-2 text-sm text-slate-200">{event.venue}</p>

        <p className="mb-3 text-xs text-slate-300">
          {event.distanceMinutesWalk} min walk • {event.priceLevel}
        </p>

        <div className="mb-4 flex flex-wrap gap-2">
          {event.mood.map((m) => (
            <span
              key={m}
              className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-slate-50"
            >
              {m}
            </span>
          ))}
        </div>

        <div className="mb-2 flex items-center gap-2 text-sm text-slate-200">
          <strong>Status:</strong>
          {event.isLiveNow ? (
            event.endsInMinutes <= 30 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-orange-400/40 bg-orange-400/10 px-2 py-0.5 text-[11px] text-orange-200">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                Closing soon
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-green-400/40 bg-green-400/10 px-2 py-0.5 text-[11px] text-green-300">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                Open now
              </span>
            )
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-400/40 bg-red-400/10 px-2 py-0.5 text-[11px] text-red-200">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              Closed
            </span>
          )}
        </div>

        <div className="text-sm text-slate-200">
          <strong>Time window: </strong>
          {event.timeWindow}
        </div>
      </div>
    </div>
  );
}