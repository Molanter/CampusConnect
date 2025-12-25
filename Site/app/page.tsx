"use client";

import { useEffect, useState, useRef } from "react";
import { onAuthStateChanged, signInWithPopup } from "firebase/auth";
import type { User } from "firebase/auth";

import { auth, provider } from "../lib/firebase";
import { PostCard } from "@/components/post-card";
import { PostComposer } from "@/components/post-composer";
import { useRightSidebar } from "@/components/right-sidebar-context";
import { useFeed } from "@/lib/hooks/use-feed";

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const { posts, loading: postsLoading, error: postsError, hasMore, fetchMore, refresh } = useFeed(user);

  const { openView } = useRightSidebar();
  const observerTarget = useRef(null);

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
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !postsLoading && !postsError) {
          fetchMore();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [hasMore, postsLoading, postsError, fetchMore]);


  if (authLoading) {
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
    <div className="min-h-screen text-white">
      {/* Feed Container - Centered with max-width */}
      <div className="mx-auto w-full max-w-[680px] px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="py-4">
          <header className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
                Feed
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Your Feed
              </h1>
            </div>
          </header>
        </div>

        {/* Composer */}
        <div className="pb-4">
          <PostComposer user={user} onPostCreated={refresh} />
        </div>

        {/* Status Messages for Initial Load/Error */}
        {postsLoading && posts.length === 0 && (
          <div className="py-4 text-sm text-white/60">
            Loading posts...
          </div>
        )}

        {postsError && !postsLoading && posts.length === 0 && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {postsError}
          </div>
        )}

        {!postsLoading && !postsError && posts.length === 0 && (
          <div className="py-8 text-sm text-white/60">
            No posts yet. Be the first to post!
          </div>
        )}

        {/* Posts List */}
        {posts.length > 0 && (
          <section>
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                variant="threads"
                onCommentsClick={() => openView("comments", post)}
                onLikesClick={() => openView("likes", post)}
                onAttendanceClick={() => openView("attendance", post)}
                onDetailsClick={() => openView("details", post)}
                onDeleted={refresh}
              />
            ))}

            {/* Loading more indicator & Observer target */}
            <div ref={observerTarget} className="flex h-10 w-full flex-col items-center justify-center gap-2 py-4">
              {postsLoading && posts.length > 0 && (
                <div className="text-sm text-white/50">Loading more...</div>
              )}
              {postsError && posts.length > 0 && (
                <div className="flex flex-col items-center text-center text-xs text-red-400">
                  <p>Error loading more</p>
                  <button onClick={() => fetchMore()} className="mt-1 underline hover:text-red-300">Retry</button>
                  <p className="mt-1 max-w-xs truncate text-[10px] text-red-500/50">{postsError}</p>
                </div>
              )}
              {!hasMore && posts.length > 0 && (
                <div className="text-xs uppercase tracking-widest text-white/30">End of results</div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}