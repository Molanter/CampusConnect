"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, signInWithPopup, type User } from "firebase/auth";
import { doc, getDoc, collection, getDocs, query, where, getFirestore, onSnapshot, orderBy } from "firebase/firestore";
import { auth, provider } from "../../lib/firebase";
import { ProfileTabs, type Tab } from "@/components/profile-tabs";
import { PostCard } from "@/components/post-card";
import { CompactPostCard } from "@/components/compact-post-card";
import { useRightSidebar } from "@/components/right-sidebar-context";
import { UserRow } from "@/components/user-row";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightOnRectangleIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";
import { Post } from "@/lib/posts";

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

type Comment = {
  id: string;
  text: string;
  uid: string;
  createdAt: any;
  eventId: string; // keeping eventId for now as it matches firestore path segments
  eventTitle: string;
};

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("my-events");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [myPostsLoading, setMyPostsLoading] = useState(false);

  const [attendedPosts, setAttendedPosts] = useState<Post[]>([]);
  const [attendedLoading, setAttendedLoading] = useState(false);

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  const { openView } = useRightSidebar();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Load user profile
  useEffect(() => {
    if (!user) return;
    const loadProfile = async () => {
      try {
        const dbFull = getFirestore();
        const ref = doc(dbFull, "users", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setProfile({
            username: data.username || "",
            displayName: data.name || data.preferredName || data.displayName || user.displayName || "",
            photoURL: data.photoURL || user.photoURL || "",
            campus: data.campus || "",
            campusLocation: data.campusLocation || "",
            yearOfStudy: data.yearOfStudy || "",
            major: data.major || "",
            dorm: data.dorm || "",
            role: data.role || "",
          });
        } else {
          setProfile({
            username: "",
            displayName: user.displayName || "",
            photoURL: user.photoURL || "",
          });
        }
      } catch (err) {
        console.error("Error loading profile", err);
      }
    };
    void loadProfile();
  }, [user]);

  // Load My Posts (formerly My Events)
  useEffect(() => {
    if (!user || activeTab !== "my-events") return;

    setMyPostsLoading(true);
    const dbFull = getFirestore();
    const q = query(
      collection(dbFull, "events"), // Still using "events" collection
      where("hostUserId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Post[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          content: data.content ?? data.description ?? "",
          isEvent: data.isEvent ?? true,
          date: data.date,
          startTime: data.startTime,
          endTime: data.endTime,
          locationLabel: data.locationLabel,
          authorId: data.authorId ?? data.hostUserId ?? "",
          authorName: data.authorName ?? data.hostDisplayName ?? "Unknown",
          authorUsername: data.authorUsername ?? data.hostUsername,
          authorAvatarUrl: data.authorAvatarUrl ?? data.hostPhotoURL,
          imageUrls: data.imageUrls || (data.imageUrl ? [data.imageUrl] : []),
          coordinates: data.coordinates,
          likes: data.likes || [],
          goingUids: data.goingUids || [],
          maybeUids: data.maybeUids || [],
          notGoingUids: data.notGoingUids || [],
        };
      });

      // Sort client-side by createdAt or date descending
      items.sort((a, b) => {
        // If both have date, sort by date
        if (a.date && b.date) return b.date.localeCompare(a.date);
        // Fallback to ID or created (not strictly reliable without real timestamp field in type but okay for now)
        return 0;
      });

      setMyPosts(items);
      setMyPostsLoading(false);
    });

    return () => unsubscribe();
  }, [user, activeTab]);

  // Load Attended Events (Posts user is going to)
  useEffect(() => {
    if (!user || activeTab !== "attended") return;

    setAttendedLoading(true);
    const dbFull = getFirestore();
    const q = query(
      collection(dbFull, "events"),
      where("goingUids", "array-contains", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Post[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          content: data.content ?? data.description ?? "",
          isEvent: data.isEvent ?? true,
          date: data.date,
          startTime: data.startTime,
          endTime: data.endTime,
          locationLabel: data.locationLabel,
          authorId: data.authorId ?? data.hostUserId ?? "",
          authorName: data.authorName ?? data.hostDisplayName ?? "Unknown",
          authorUsername: data.authorUsername ?? data.hostUsername,
          authorAvatarUrl: data.authorAvatarUrl ?? data.hostPhotoURL,
          imageUrls: data.imageUrls || (data.imageUrl ? [data.imageUrl] : []),
          coordinates: data.coordinates,
          likes: data.likes || [],
          goingUids: data.goingUids || [],
          maybeUids: data.maybeUids || [],
          notGoingUids: data.notGoingUids || [],
        };
      });

      // Sort client-side by date ascending for attended (upcoming)
      items.sort((a, b) => {
        if (!a.date || !b.date) return 0;
        return a.date.localeCompare(b.date);
      });

      setAttendedPosts(items);
      setAttendedLoading(false);
    });

    return () => unsubscribe();
  }, [user, activeTab]);

  // Load Comments
  useEffect(() => {
    if (!user || activeTab !== "comments") return;

    setCommentsLoading(true);
    const dbFull = getFirestore();

    const loadComments = async () => {
      try {
        const eventsSnap = await getDocs(collection(dbFull, "events"));
        const allComments: Comment[] = [];

        for (const eventDoc of eventsSnap.docs) {
          const commentsQuery = query(
            collection(dbFull, "events", eventDoc.id, "comments"),
            where("uid", "==", user.uid)
          );
          const commentsSnap = await getDocs(commentsQuery);

          commentsSnap.docs.forEach((commentDoc) => {
            const data = commentDoc.data();
            allComments.push({
              id: commentDoc.id,
              text: data.text || "",
              uid: data.uid || "",
              createdAt: data.createdAt,
              eventId: eventDoc.id,
              eventTitle: eventDoc.data().title || "Untitled Post",
            });
          });
        }

        allComments.sort((a, b) => {
          if (!a.createdAt || !b.createdAt) return 0;
          return b.createdAt.seconds - a.createdAt.seconds;
        });

        setComments(allComments);
        setCommentsLoading(false);
      } catch (err) {
        console.error("Error loading comments", err);
        setCommentsLoading(false);
      }
    };

    void loadComments();
  }, [user, activeTab]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Sign-out error", err);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-neutral-300">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-sm text-neutral-300">Sign in to view your profile.</p>
        <button
          onClick={() => signInWithPopup(auth, provider)}
          className="rounded-xl border border-white/10 bg-white/10 px-6 py-3 text-sm text-neutral-100 backdrop-blur-lg hover:bg-white/20 transition"
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  const displayName = profile?.displayName || user.displayName || "User";
  const username = profile?.username || "";
  const photoURL = profile?.photoURL || user.photoURL || "";
  const initials = displayName.charAt(0).toUpperCase();

  const isProfileComplete = !!(profile?.username && profile?.campus);

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-8 text-neutral-50">
      <div className="mx-auto w-full max-w-xl space-y-6">
        {/* Header */}
        <header className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Profile
          </p>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {displayName}
          </h1>
        </header>

        {/* Profile Incomplete Warning */}
        {!isProfileComplete && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
            <div className="flex items-start gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-amber-400 shrink-0 mt-0.5">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-amber-400">Complete your profile</p>
                <p className="text-xs text-amber-300/80 mt-1">
                  Please <Link href="/profile/setup" className="underline hover:text-amber-200">complete your profile setup</Link> to get started.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* User Card with buttons on right for wide screens */}
        <div className="flex items-start gap-4">
          <div className="flex-1 rounded-[28px] border border-white/10 bg-[#1C1C1E] p-5 ring-1 ring-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1">
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

                {/* Buttons - always shown inside card */}
                <div className="relative ml-auto lg:flex lg:gap-2">
                  {/* Mobile: 3-dot menu */}
                  <div className="lg:hidden">
                    <button
                      onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                      className="rounded-full border border-white/10 bg-white/5 p-2 text-neutral-400 hover:bg-white/10 hover:text-white transition"
                      title="More options"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                        <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
                      </svg>
                    </button>

                    {/* Dropdown Menu */}
                    {mobileMenuOpen && (
                      <>
                        {/* Backdrop */}
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setMobileMenuOpen(false)}
                        />

                        {/* Menu */}
                        <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-white/10 bg-[#1C1C1E] shadow-lg z-50 overflow-hidden">
                          <Link
                            href="/profile/edit"
                            onClick={() => setMobileMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/10 transition"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-neutral-400">
                              <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                            </svg>
                            Edit Profile
                          </Link>
                          <Link
                            href="/settings"
                            onClick={() => setMobileMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/10 transition border-t border-white/10"
                          >
                            <Cog6ToothIcon className="h-5 w-5 text-neutral-400" />
                            Settings
                          </Link>
                          <button
                            onClick={() => {
                              setMobileMenuOpen(false);
                              handleSignOut();
                            }}
                            className="flex w-full items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-white/10 transition border-t border-white/10"
                          >
                            <ArrowRightOnRectangleIcon className="h-5 w-5" />
                            Sign Out
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Desktop: Visible buttons */}
                  <div className="hidden lg:flex lg:gap-2">
                    <Link
                      href="/profile/edit"
                      className="rounded-full border border-white/10 bg-white/5 p-2 text-neutral-400 hover:bg-white/10 hover:text-white transition"
                      title="Edit Profile"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                        <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                      </svg>
                    </Link>
                    <Link
                      href="/settings"
                      className="rounded-full border border-white/10 bg-white/5 p-2 text-neutral-400 hover:bg-white/10 hover:text-white transition"
                      title="Settings"
                    >
                      <Cog6ToothIcon className="h-5 w-5" />
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="rounded-full border border-white/10 bg-white/5 p-2 text-neutral-400 hover:bg-white/10 hover:text-white transition"
                      title="Sign out"
                    >
                      <ArrowRightOnRectangleIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Details */}
            {(profile?.campus || profile?.major || profile?.yearOfStudy || profile?.dorm) && (
              <div className="space-y-2 text-sm pt-4 border-t border-white/10">
                {profile?.campus && (
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Campus</span>
                    <span className="text-white font-medium">{profile.campus}</span>
                  </div>
                )}
                {profile?.role === "student" && profile?.major && (
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Major</span>
                    <span className="text-white font-medium">{profile.major}</span>
                  </div>
                )}
                {profile?.role === "student" && profile?.yearOfStudy && (
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Year</span>
                    <span className="text-white font-medium">{profile.yearOfStudy}</span>
                  </div>
                )}
                {profile?.dorm && (
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Dorm</span>
                    <span className="text-white font-medium">{profile.dorm}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <ProfileTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab Content */}
        <div className="space-y-6">
          {/* My Posts Tab */}
          {activeTab === "my-events" && (
            <>
              {myPostsLoading && (
                <div className="rounded-2xl border border-white/10 bg-neutral-900/60 px-4 py-3 text-sm text-neutral-300">
                  Loading your posts...
                </div>
              )}
              {!myPostsLoading && myPosts.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-neutral-900/60 px-4 py-12 text-center">
                  <p className="text-sm text-neutral-400 mb-4">
                    You haven't posted anything yet.
                  </p>
                  <Link
                    href="/"
                    className="rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm text-white hover:bg-white/20 transition"
                  >
                    Create a post
                  </Link>
                </div>
              )}
              {!myPostsLoading && myPosts.length > 0 && (
                <div className="grid grid-cols-2 gap-4">
                  {myPosts.map((post) => (
                    <div key={post.id} className="relative">
                      <CompactPostCard
                        post={post}
                        onCommentsClick={() => openView("comments", post)}
                        onAttendanceClick={() => openView("attendance", post)}
                        onClick={() => router.push(post.isEvent ? `/events/${post.id}` : `/posts/${post.id}`)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Attended Events Tab */}
          {activeTab === "attended" && (
            <>
              {attendedLoading && (
                <div className="rounded-2xl border border-white/10 bg-neutral-900/60 px-4 py-3 text-sm text-neutral-300">
                  Loading attended events...
                </div>
              )}
              {!attendedLoading && attendedPosts.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-neutral-900/60 px-4 py-12 text-center">
                  <p className="text-sm text-neutral-400">
                    You haven't marked any events as "Going" yet.
                  </p>
                </div>
              )}
              {!attendedLoading && attendedPosts.length > 0 && (
                <div className="grid grid-cols-2 gap-4">
                  {attendedPosts.map((post) => (
                    <div key={post.id} className="relative">
                      <CompactPostCard
                        post={post}
                        onCommentsClick={() => openView("comments", post)}
                        onAttendanceClick={() => openView("attendance", post)}
                        onClick={() => router.push(`/events/${post.id}`)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Comments Tab */}
          {activeTab === "comments" && (
            <>
              {commentsLoading && (
                <div className="rounded-2xl border border-white/10 bg-neutral-900/60 px-4 py-3 text-sm text-neutral-300">
                  Loading your comments...
                </div>
              )}
              {!commentsLoading && comments.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-neutral-900/60 px-4 py-12 text-center">
                  <p className="text-sm text-neutral-400">
                    You haven't commented on anything yet.
                  </p>
                </div>
              )}
              {!commentsLoading && comments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-[28px] border border-white/10 bg-[#1C1C1E] p-5 ring-1 ring-white/5"
                >
                  <div className="mb-3 flex items-start gap-3">
                    <UserRow
                      uid={user.uid}
                      userData={{
                        displayName: displayName,
                        username: username,
                        photoURL: photoURL,
                      }}
                    />
                  </div>
                  <p className="text-sm text-neutral-200 mb-3">{comment.text}</p>
                  <Link
                    href={`/events/${comment.eventId}`}
                    className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-400 hover:border-amber-400/50 hover:bg-amber-500/20 hover:text-amber-300 transition font-medium"
                  >
                    <span>View Post: {comment.eventTitle}</span>
                  </Link>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}