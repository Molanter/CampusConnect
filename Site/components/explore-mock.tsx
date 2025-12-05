const mockEvents = [
  {
    id: 1,
    title: "Rooftop happy hour",
    venue: "Skyline Bar",
    distance: "6 min walk",
    time: "Now – 7:30 PM",
    mood: ["Social", "Drinks"],
    price: "$$",
    live: true,
  },
  {
    id: 2,
    title: "Indie vinyl night",
    venue: "Basement Records",
    distance: "4 min walk",
    time: "7:00 – 9:00 PM",
    mood: ["Chill", "Music"],
    price: "$",
    live: false,
  },
  {
    id: 3,
    title: "Late-night ramen",
    venue: "Neko Ramen",
    distance: "9 min walk",
    time: "Now – Midnight",
    mood: ["Food", "Low-key"],
    price: "$$",
    live: true,
  },
];

export function ExploreMock() {
  return (
    <div className="mx-auto max-w-sm rounded-[2.25rem] border border-white/10 bg-surface/80 p-3 shadow-soft backdrop-blur md:max-w-md">
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="text-xs text-gray-300">Downtown · Within 10 min</div>
        <div className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-accent">
          Live feed
        </div>
      </div>

      <div className="mb-3 h-40 rounded-2xl bg-gradient-to-br from-brand/25 via-surface to-accent/20">
        <div className="flex h-full items-center justify-center text-xs text-gray-300">
          Map preview
        </div>
      </div>

      <div className="mb-2 flex flex-wrap gap-2 text-[11px]">
        <FilterPill label="Chill" active />
        <FilterPill label="Social" />
        <FilterPill label="Date night" />
        <FilterPill label="Free" />
        <FilterPill label="Tonight" />
      </div>

      <div className="space-y-2 overflow-hidden">
        {mockEvents.map((e) => (
          <div
            key={e.id}
            className="flex gap-3 rounded-2xl border border-white/8 bg-white/5 p-3 text-xs"
          >
            <div className="mt-0.5 h-10 w-10 rounded-xl bg-gradient-to-br from-brand/60 to-accent/70" />
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-gray-50">{e.title}</div>
                {e.live && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] text-accent">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_10px_rgba(34,211,238,0.9)]" />
                    Live now
                  </span>
                )}
              </div>
              <div className="text-[11px] text-gray-400">
                {e.venue} · {e.distance}
              </div>
              <div className="flex items-center justify-between text-[11px] text-gray-300">
                <span>{e.time}</span>
                <span className="font-semibold">{e.price}</span>
              </div>
              <div className="flex flex-wrap gap-1 text-[10px] text-gray-300">
                {e.mood.map((m) => (
                  <span
                    key={m}
                    className="rounded-full bg-white/5 px-2 py-0.5"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilterPill({ label, active }: { label: string; active?: boolean }) {
  if (active) {
    return (
      <button className="rounded-full bg-brand px-3 py-1 text-[11px] font-medium text-white">
        {label}
      </button>
    );
  }
  return (
    <button className="rounded-full bg-white/5 px-3 py-1 text-[11px] text-gray-200">
      {label}
    </button>
  );
}