
"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup } from "firebase/auth";
import type { User } from "firebase/auth";
import {
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore/lite";

import { auth, provider, db } from "../lib/firebase";
import { AttendanceCard } from "@/components/attendance-card";
import { useRightSidebar } from "@/components/right-sidebar-context";

type UpcomingEvent = {
  id: string;
  title: string;
  description?: string | null;
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  locationLabel?: string | null;
  campusName?: string | null;
  hostDisplayName?: string | null;
  hostUsername?: string | null;
  hostPhotoURL?: string | null;
  imageUrls?: string[] | null;
  coordinates?: { lat: number; lng: number } | null;
};

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const { openView } = useRightSidebar();

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Sign-in error", err);
      if (err?.code === "auth/operation-not-allowed") {
        setAuthError(
          "Google sign-in is disabled for this Firebase project. Enable it in Firebase Console → Authentication → Sign-in method → Google."
        );
      } else {
        setAuthError("Sign-in failed. Please try again.");
      }
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchUpcoming = async () => {
      try {
        setEventsLoading(true);
        setEventsError(null);

        const eventsRef = collection(db, "events");
        const q = query(eventsRef, orderBy("date", "asc"));

        const snap = await getDocs(q);
        const items: UpcomingEvent[] = snap.docs.map((doc) => {
          const data = doc.data() as any;
          return {
            id: doc.id,
            title: data.title ?? "Untitled event",
            description: data.description ?? null,
            date: data.date ?? null,
            startTime: data.startTime ?? null,
            endTime: data.endTime ?? null,
            locationLabel: data.locationLabel ?? null,
            campusName: data.campusName ?? null,
            hostDisplayName: data.hostDisplayName ?? null,
            hostUsername: data.hostUsername ?? null,
            hostPhotoURL: data.hostPhotoURL ?? null,
            imageUrls:
              (Array.isArray(data.imageUrls) ? data.imageUrls : null) ??
              (data.imageUrl ? [data.imageUrl] : []),
            coordinates: data.coordinates ?? null,
          };
        });

        setEvents(items);
      } catch (err: any) {
        console.error("Error loading upcoming events for home feed", err);
        setEventsError(
          err?.message ||
          "Could not load upcoming events. Please try again later."
        );
      } finally {
        setEventsLoading(false);
      }
    };

    void fetchUpcoming();
  }, [user]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-300">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <button
          onClick={handleSignIn}
          className="rounded-xl border border-white/10 bg-white/10 px-6 py-3 text-slate-100 backdrop-blur-lg hover:bg-white/20 transition"
        >
          Sign in with Google
        </button>
        {authError && (
          <p className="mt-3 max-w-xs text-center text-sm text-red-300">
            {authError}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-8 text-neutral-50 md:px-8 md:py-10">
      <div className="mx-auto w-full max-w-[450px]">
        {/* Left: feed */}
        <div className="space-y-6">
          {/* Header */}
          <header className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
                Feed
              </p>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                Upcoming events
              </h1>
              <p className="text-sm text-neutral-400">
                Events created by students and groups on your campus.
              </p>
            </div>
          </header>

          {/* Status */}
          {eventsLoading && (
            <div className="rounded-2xl border border-white/10 bg-neutral-900/60 px-4 py-3 text-sm text-neutral-300">
              Loading upcoming events...
            </div>
          )}

          {eventsError && !eventsLoading && (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {eventsError}
            </div>
          )}

          {!eventsLoading && !eventsError && events.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-neutral-900/60 px-4 py-6 text-sm text-neutral-300">
              No events yet. Once you create events, they&apos;ll show up here.
            </div>
          )}

          {/* Events list */}
          {!eventsLoading && events.length > 0 && (
            <section className="space-y-6">
              {events.map((event) => (
                <AttendanceCard
                  key={event.id}
                  id={event.id}
                  title={event.title}
                  description={event.description || ""}
                  images={event.imageUrls || []}
                  date={event.date || "Date"}
                  time={event.startTime ? `${event.startTime}${event.endTime ? ` - ${event.endTime}` : ""}` : "Time"}
                  location={event.locationLabel || "Location"}
                  hostName={event.hostDisplayName || "Host"}
                  hostUsername={event.hostUsername || undefined}
                  hostAvatarUrl={event.hostPhotoURL}
                  coordinates={event.coordinates}
                  onCommentsClick={() => openView("comments", event)}
                  onAttendanceClick={() => openView("attendance", event)}
                  onDetailsClick={() => openView("details", event)}
                />
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}