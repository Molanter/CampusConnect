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
import { TextPostListItem } from "@/components/text-post-list-item";
import { UserProfileHeader } from "@/components/profile/user-profile-header";

type UserProfile = {
  username?: string;
  displayName?: string;
  photoURL?: string;
  universityId?: string;
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
            displayName: data.name || data.fullName || data.preferredName || data.displayName || "User",
            photoURL: data.photoURL || "",
            universityId: data.universityId || "",
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

        // 1. Try 'posts' collection first
        const postsRef = collection(db, "posts");
        const qPosts = query(postsRef, where("authorId", "==", targetUid));
        const snap = await getDocs(qPosts);

        let docs = snap.docs;

        // 2. Fallback to 'events' if 'posts' is empty
        if (snap.empty) {
          const eventsRef = collection(db, "events");
          const qEvents = query(eventsRef, where("hostUserId", "==", targetUid));
          const snapEvents = await getDocs(qEvents);
          docs = snapEvents.docs;
        }

        const items: Post[] = docs.map((doc) => {
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
            clubId: data.clubId,
            clubName: data.clubName,
            clubAvatarUrl: data.clubAvatarUrl,
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
    <div className="min-h-screen text-neutral-50">
      <div className="mx-auto w-full max-w-2xl px-2 py-6 pb-32 space-y-6">
        {/* Header Bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white transition-all active:scale-95"
          >
            <ChevronLeftIcon className="h-6 w-6" />
          </button>
        </div>

        {/* New Glass Profile Header */}
        <UserProfileHeader
          displayName={displayName}
          username={username}
          photoURL={photoURL}
          universityId={profile?.universityId}
          universityName={profile?.campus}
          yearOfStudy={profile?.yearOfStudy}
          major={profile?.major}
          isOwnProfile={user?.uid === targetUid}
          stats={{
            posts: userPosts.length,
            clubs: 0,
            followers: 0,
            following: 0,
          }}
          onEdit={() => router.push("/profile/edit")}
          onSettings={() => router.push("/settings")}
          onShare={() => {
            if (navigator.share) {
              navigator.share({
                title: `${displayName}'s Profile`,
                url: window.location.href,
              });
            }
          }}
          onReport={() => {
            openView("report", { id: targetUid, type: "user" });
          }}
        />

        {/* User's Posts */}
        <div className="space-y-4">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/30">
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
            <div className="space-y-4">
              {userPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  variant="threads"
                  onCommentsClick={() => openView("comments", post)}
                  onAttendanceClick={() => openView("attendance", post)}
                  onDetailsClick={() => openView("details", post)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
