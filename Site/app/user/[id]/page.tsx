"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import Link from "next/link";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";
import { PostCard } from "@/components/post-card";
import { CompactPostCard } from "@/components/compact-post-card";
import { useRightSidebar } from "@/components/right-sidebar-context";
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

export default function UserProfilePage() {
  const params = useParams();
  const targetUid = params.id as string;
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
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

    const loadPosts = async () => {
      try {
        setPostsLoading(true);

        const q = query(
          collection(db, "posts"),
          where("hostUserId", "==", targetUid)
        );
        const snap = await getDocs(q);
        const items: Post[] = snap.docs.map((doc) => {
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

        // Sort client-side
        items.sort((a, b) => {
          if (a.date && b.date) return b.date.localeCompare(a.date);
          return 0;
        });

        setUserPosts(items);
      } catch (err) {
        console.error("Error loading user posts", err);
      } finally {
        setPostsLoading(false);
      }
    };

    void loadPosts();
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

        {/* User's Posts */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
            Posts by {displayName}
          </h2>

          {postsLoading && (
            <div className="rounded-2xl border border-white/10 bg-neutral-900/60 px-4 py-3 text-sm text-neutral-300">
              Loading posts...
            </div>
          )}

          {!postsLoading && userPosts.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-neutral-900/60 px-4 py-8 text-center text-sm text-neutral-400">
              No posts yet.
            </div>
          )}

          {!postsLoading && userPosts.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              {userPosts.map((post) => (
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
        </div>
      </div>
    </div>
  );
}
