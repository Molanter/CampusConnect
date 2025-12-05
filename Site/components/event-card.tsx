// components/event-card.tsx

import { Event } from "../lib/events";

type EventCardProps = {
  event: Event;
  onClick: () => void;
};

export function EventCard({ event, onClick }: EventCardProps) {
  const isWalkable = event.distanceMinutesWalk <= 30;
  const distanceLabel = isWalkable
    ? `${event.distanceMinutesWalk} min walk`
    : `${event.distanceMinutesWalk} min ride`;
  const primaryMood = event.mood[0];
  const moodLabel =
    primaryMood.length > 6 ? primaryMood.slice(0, 3).toUpperCase() : primaryMood;

  return (
    <article
      className="flex gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-3.5 text-xs cursor-pointer backdrop-blur hover:border-white/40 hover:bg-slate-950/60 transition"
      onClick={onClick}
    >
      <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-[11px] font-semibold uppercase text-white whitespace-nowrap">
        {moodLabel}
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-medium text-slate-50">{event.title}</h2>

          {event.isLiveNow ? (
            event.endsInMinutes !== undefined && event.endsInMinutes <= 30 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-orange-400/40 bg-orange-400/10 px-2 py-0.5 text-[10px] text-orange-200">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                Closing soon
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-green-400/40 bg-green-400/10 px-2 py-0.5 text-[10px] text-green-300">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                Open now
              </span>
            )
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-400/40 bg-red-400/10 px-2 py-0.5 text-[10px] text-red-200">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              Closed
            </span>
          )}
        </div>
        <div className="text-[11px] text-slate-300">
          {event.venue} · {distanceLabel}
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-200">
          <span>{event.timeWindow}</span>
          <span className="font-semibold">{event.priceLevel}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-200">
          {event.mood.map((m) => (
            <span
              key={m}
              className="rounded-full border border-white/20 bg-white/5 px-2.5 py-0.5"
            >
              {m}
            </span>
          ))}
          {event.endsInMinutes && event.isLiveNow && (
            <span className="ml-1 rounded-full border border-orange-400/50 bg-orange-400/10 px-2.5 py-0.5 text-[10px] text-orange-200">
              Ends in ~{event.endsInMinutes} min
            </span>
          )}
        </div>
      </div>
    </article>
  );
}