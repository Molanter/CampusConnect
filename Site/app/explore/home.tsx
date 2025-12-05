export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="mt-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          What To Do Right Now
        </h1>
        <p className="mt-2 text-slate-400">
          Quickly find the best things happening around you.
        </p>
      </section>

      <div className="rounded-xl border border-white/10 bg-slate-900/40 p-6 backdrop-blur">
        <h2 className="text-xl font-medium">Explore events</h2>
        <p className="mt-1 text-slate-400">
          Browse live happenings, curated ideas, and time-sensitive activities.
        </p>

        <a
          href="/explore"
          className="mt-4 inline-block rounded-md bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20"
        >
          Go to Explore →
        </a>
      </div>

      <div className="rounded-xl border border-white/10 bg-slate-900/40 p-6 backdrop-blur">
        <h2 className="text-xl font-medium">Your profile</h2>
        <p className="mt-1 text-slate-400">
          Save preferences, moods, and neighborhoods you like.
        </p>

        <a
          href="/profile"
          className="mt-4 inline-block rounded-md bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20"
        >
          Go to Profile →
        </a>
      </div>
    </div>
  );
}