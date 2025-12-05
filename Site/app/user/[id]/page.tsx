"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, getFirestore, collection, query, where, getDocs } from "firebase/firestore";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";
import { MiniEventCard } from "@/components/mini-event-card";
import { useRightSidebar } from "@/components/right-sidebar-context";

type UserProfile = {
  username?: string;
  displayName?: string;
  photoURL?: string;
  campus?: string;
  campusLocation?: string;
  yearOfStudy?: string;
  major?: string;
  dorm?: string;
  role?: string;
};

type Event = {
  id: string;
  title: string;
  description?: string | null;
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  locationLabel?: string | null;
  hostDisplayName?: string | null;
  hostUsername?: string | null;
  hostPhotoURL?: string | null;
  imageUrls?: string[] | null;
  coordinates?: { lat: number; lng: number } | null;
};

export default function UserProfilePage() {
  const params = useParams();
  const targetUid = params.id as string;
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [userEvents, setUserEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const { openView } = useRightSidebar();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!targetUid) return;

    const loadProfile = async () => {
      try {
        const db = getFirestore();
        const ref = doc(db, "users", targetUid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setProfile({
            username: data.username || "",
            displayName: data.preferredName || data.displayName || "User",
            photoURL: data.photoURL || "",
            campus: data.campus || "",
            campusLocation: data.campusLocation || "",
            yearOfStudy: data.yearOfStudy || "",
            major: data.major || "",
            dorm: data.dorm || "",
            role: data.role || "",
          });
        } else {
          // User not found
          setProfile(null);
        }
      } catch (err) {
        console.error("Error loading profile", err);
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, [targetUid]);

  useEffect(() => {
    if (!targetUid) return;

    const loadEvents = async () => {
      try {
        setEventsLoading(true);
        const db = getFirestore();
        const q = query(
          collection(db, "events"),
          where("hostUserId", "==", targetUid)
        );
        const snap = await getDocs(q);
        const items: Event[] = snap.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || "Untitled",
            description: data.description || null,
            date: data.date || null,
            startTime: data.startTime || null,
            endTime: data.endTime || null,
            locationLabel: data.locationLabel || null,
            hostDisplayName: data.hostDisplayName || null,
            hostUsername: data.hostUsername || null,
            hostPhotoURL: data.hostPhotoURL || null,
            imageUrls: data.imageUrls || null,
            coordinates: data.coordinates || null,
          };
        });

        // Sort client-side
        items.sort((a, b) => {
          if (!a.date || !b.date) return 0;
          return b.date.localeCompare(a.date);
        });

        setUserEvents(items);
      } catch (err) {
        console.error("Error loading user events", err);
      } finally {
        setEventsLoading(false);
      }
    };

    void loadEvents();
  }, [targetUid]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-neutral-300">
        Loading...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 text-neutral-300">
        <p>User not found.</p>
        <Link href="/" className="text-amber-400 hover:underline">
          Go Home
        </Link>
      </div>
    );
  }

  const displayName = profile.displayName || "User";
  const username = profile.username || "";
  const photoURL = profile.photoURL || "";
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-8 text-neutral-50">
      <div className="mx-auto w-full max-w-xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-bold tracking-tight">Profile</h1>
        </div>

        {/* User Card */}
        <div className="rounded-[28px] border border-white/10 bg-[#1C1C1E] p-5 ring-1 ring-white/5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-neutral-700 ring-2 ring-white/10">
              {photoURL ? (
                <img src={photoURL} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-lg font-bold text-white">
                  {initials}
                </div>
              )}
            </div>
            <div>
              <p className="text-lg font-semibold text-white">{displayName}</p>
              {username && (
                <p className="text-sm text-neutral-400">@{username}</p>
              )}
            </div>
          </div>

          {/* Profile Details */}
          {(profile.campus || profile.major || profile.yearOfStudy || profile.dorm) && (
            <div className="space-y-2 text-sm pt-4 border-t border-white/10">
              {profile.campus && (
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Campus</span>
                  <span className="text-white font-medium">{profile.campus}</span>
                </div>
              )}
              {profile.role === "student" && profile.major && (
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Major</span>
                  <span className="text-white font-medium">{profile.major}</span>
                </div>
              )}
              {profile.role === "student" && profile.yearOfStudy && (
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Year</span>
                  <span className="text-white font-medium">{profile.yearOfStudy}</span>
                </div>
              )}
              {profile.dorm && (
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Dorm</span>
                  <span className="text-white font-medium">{profile.dorm}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User's Events */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
            Events hosted by {displayName}
          </h2>
          
          {eventsLoading && (
            <div className="rounded-2xl border border-white/10 bg-neutral-900/60 px-4 py-3 text-sm text-neutral-300">
              Loading events...
            </div>
          )}
          
          {!eventsLoading && userEvents.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-neutral-900/60 px-4 py-8 text-center text-sm text-neutral-400">
              No events hosted yet.
            </div>
          )}

          {!eventsLoading && userEvents.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              {userEvents.map((event) => (
                <MiniEventCard
                  key={event.id}
                  id={event.id}
                  title={event.title}
                  description={event.description || ""}
                  image={(event.imageUrls && event.imageUrls[0]) || undefined}
                  date={event.date || "Date"}
                  time={event.startTime || "Time"}
                  coordinates={event.coordinates}
                  onCommentsClick={() => openView("comments", event)}
                  onAttendanceClick={() => openView("attendance", event)}
                  onClick={() => router.push(`/events/${event.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

