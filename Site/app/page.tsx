"use client";

import { useEffect, useRef, useState } from "react";
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
  const observerTarget = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !postsLoading && !postsError) {
          fetchMore();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) observer.observe(observerTarget.current);

    return () => {
      if (observerTarget.current) observer.unobserve(observerTarget.current);
    };
  }, [hasMore, postsLoading, postsError, fetchMore]);

  if (authLoading) {
    return <div className="flex h-screen items-center justify-center text-muted">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="cc-section w-full max-w-sm">
          <button onClick={handleSignIn} className="cc-brand-pill w-full justify-center py-3 font-semibold">
            Sign in with Google
          </button>
          {authError && <p className="mt-3 text-center text-sm text-red-600 dark:text-red-300">{authError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto w-full max-w-[680px] px-4 sm:px-6 lg:px-8">
        <div className="py-4">
          <header className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Feed</p>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Your Feed</h1>
            </div>
          </header>
        </div>

        <div className="pb-4">
          <PostComposer user={user} onPostCreated={refresh} />
        </div>

        {postsLoading && posts.length === 0 && <div className="py-4 text-sm text-muted">Loading posts...</div>}

        {postsError && !postsLoading && posts.length === 0 && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
            {postsError}
          </div>
        )}

        {!postsLoading && !postsError && posts.length === 0 && (
          <div className="py-8 text-sm text-muted">No posts yet. Be the first to post!</div>
        )}

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

            <div ref={observerTarget} className="flex h-10 w-full flex-col items-center justify-center gap-2 py-4">
              {postsLoading && posts.length > 0 && <div className="text-sm text-muted">Loading more...</div>}
              {postsError && posts.length > 0 && (
                <div className="flex flex-col items-center text-center text-xs text-red-600 dark:text-red-300">
                  <p>Error loading more</p>
                  <button onClick={() => fetchMore()} className="mt-1 underline">
                    Retry
                  </button>
                  <p className="mt-1 max-w-xs truncate text-[10px] text-red-500/60">{postsError}</p>
                </div>
              )}
              {!hasMore && posts.length > 0 && (
                <div className="text-xs uppercase tracking-widest text-muted">End of results</div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}