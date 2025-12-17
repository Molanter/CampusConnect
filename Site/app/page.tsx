"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup } from "firebase/auth";
import type { User } from "firebase/auth";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from "firebase/firestore/lite"; // Importing from lite for read-only if possible, but PostComposer uses full SDK. Mixing is fine if careful. But typically better to use one.
// Actually, for simplicity and consistency with PostComposer (which acts on 'db' from lib/firebase which is full SDK usually), let's ensure we use consistent SDK if possible. 
// However, the existing imports use 'firebase/firestore/lite'. I'll stick to what was there or upgrade if needed. 
// PostComposer imports 'firebase/firestore'. "lib/firebase" likely exports 'db' initialized with full SDK. 
// 'firebase/firestore/lite' is compatible with the same 'db' instance for getDocs usually.

import { auth, provider, db } from "../lib/firebase";
import { PostCard } from "@/components/post-card";
import { PostComposer } from "@/components/post-composer";
import { useRightSidebar } from "@/components/right-sidebar-context";
import { Post } from "@/lib/posts";

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);

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

  const fetchPosts = async () => {
    if (!user) return;
    try {
      setPostsLoading(true);
      setPostsError(null);

      const eventsRef = collection(db, "events");
      // Ordering by createdAt desc to show newest posts first. 
      // Note: older events might not have createdAt. We might need to handle that or fallback.
      // The original query was orderBy("date", "asc").
      // For a "feed", usually it's reverse chronological.
      // But for "Upcoming events", it's by date.
      // Since we are merging, "Feed" usually implies createdAt.
      // Let's try orderBy createdAt desc. If indexes are missing, it might fail in dev console.
      // For now, I'll assume usage of 'createdAt' for new posts. Legacy events might lack it?
      // I'll stick to 'date' for now if that's what was working, or maybe 'createdAt' is better for a general feed.
      // Let's try 'createdAt' descending. If it fails, I'll need to create an index.
      const q = query(eventsRef, orderBy("createdAt", "desc"), limit(50));

      const snap = await getDocs(q);
      const items: Post[] = snap.docs.map((doc) => {
        const data = doc.data() as any;
        return {
          id: doc.id,
          title: data.title ?? (data.isEvent ? "Untitled Event" : undefined), // Title optional for posts
          content: data.content ?? data.description ?? "", // Map description to content
          imageUrls:
            (Array.isArray(data.imageUrls) ? data.imageUrls : null) ??
            (data.imageUrl ? [data.imageUrl] : []),
          // Event specific fields
          isEvent: data.isEvent ?? true, // Default to true for legacy events? Or check fields? 
          // If 'isEvent' is missing, but it has 'date', it's likely an event.
          // Let's infer isEvent if not present:
          // isEvent: data.isEvent ?? (!!data.date),

          date: data.date ?? undefined,
          startTime: data.startTime ?? undefined,
          endTime: data.endTime ?? undefined,
          locationLabel: data.locationLabel ?? undefined,
          coordinates: data.coordinates ?? undefined,

          authorId: data.authorId ?? data.hostUserId ?? "",
          authorName: data.authorName ?? data.hostDisplayName ?? "Unknown",
          authorUsername: data.authorUsername ?? data.hostUsername,
          authorAvatarUrl: data.authorAvatarUrl ?? data.hostPhotoURL,

          likes: data.likes ?? [],
          createdAt: data.createdAt,
          editCount: data.editCount ?? 0,
        };
      });

      setPosts(items);
    } catch (err: any) {
      console.error("Error loading posts", err);
      // Fallback to client-side sorting if index is missing or just generic error
      setPostsError(
        err?.message ||
        "Could not load posts. Please try again later."
      );
    } finally {
      setPostsLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
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
    <div className="min-h-screen bg-neutral-950 py-8 text-neutral-50 md:py-10">
      <div className="@container">
        {/* 1. Top Content (Centered & Constrained) */}
        <div className="space-y-6">
          {/* Header */}
          <div className="mx-auto w-full max-w-[450px] px-4 md:px-8">
            <header className="flex items-center justify-between gap-4">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
                  Feed
                </p>
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                  Your Feed
                </h1>
              </div>
            </header>
          </div>

          {/* Composer - Reduced padding on desktop to match post width */}
          <div className="mx-auto w-full max-w-[600px]">
            <PostComposer user={user} onPostCreated={fetchPosts} />
          </div>

          {/* Status Messages */}
          <div className="mx-auto w-full max-w-[450px] px-4 md:px-8">
            {postsLoading && (
              <div className="rounded-2xl border border-white/10 bg-neutral-900/60 px-4 py-3 text-sm text-neutral-300">
                Loading posts...
              </div>
            )}

            {postsError && !postsLoading && (
              <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {postsError}
              </div>
            )}

            {!postsLoading && !postsError && posts.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-neutral-900/60 px-4 py-6 text-sm text-neutral-300">
                No posts yet. Be the first to post!
              </div>
            )}
          </div>
        </div>

        {/* 2. Posts List (Full Width Container for Breakout) */}
        {!postsLoading && posts.length > 0 && (
          <section className="mt-6 flex flex-col gap-6">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                variant="threads"
                onCommentsClick={() => openView("comments", post)}
                onAttendanceClick={() => openView("attendance", post)}
                onDetailsClick={() => openView("details", post)}
              />
            ))}
          </section>
        )}
      </div>
    </div>
  );
}