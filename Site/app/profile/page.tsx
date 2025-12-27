"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence, useScroll } from "framer-motion";
import { onAuthStateChanged, signOut, signInWithPopup, type User } from "firebase/auth";
import { doc, getDoc, collection, getDocs, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { auth, provider, db } from "../../lib/firebase";
import { ProfileTabs, type Tab } from "@/components/profile-tabs";

import { PostCard } from "@/components/post-card";
import { CompactPostCard } from "@/components/compact-post-card";
import { useRightSidebar } from "@/components/right-sidebar-context";
import { UserRow } from "@/components/user-row";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";
import { UserProfileHeader } from "@/components/profile/user-profile-header";
import { Post } from "@/lib/posts";
import { TextPostListItem } from "@/components/text-post-list-item";
import { useFeed } from "@/lib/hooks/use-feed";
import { useUserComments } from "@/lib/hooks/use-user-comments";
import { MyClubsView } from "@/components/my-clubs-view";

// Utility function for relative time display
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

type UserProfile = {
  username?: string;
  displayName?: string;
  photoURL?: string;
  campusId?: string;       // Preferred
  universityId?: string;   // Legacy
  campus?: string;
  campusLocation?: string;
  yearOfStudy?: string;
  major?: string;
  dorm?: string;
  role?: string;
};



export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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

  return <ProfileContent user={user} />;
}

function ProfileContent({ user }: { user: User }) {
  const router = useRouter();
  const { openView } = useRightSidebar();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("my-events");
  // const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // Removed unused state
  const [attendedPosts, setAttendedPosts] = useState<Post[]>([]);
  const [attendedLoading, setAttendedLoading] = useState(false);
  const [clubsCount, setClubsCount] = useState(0);

  // Use the same feed as the main page, but filtered to only this user
  const { posts: myPosts, loading: myPostsLoading } = useFeed(user, user.uid);

  // Use collectionGroup for comments
  const {
    comments,
    loading: commentsLoading,
    loadMore: loadMoreComments,
    hasMore: hasMoreComments,
    isLoadingMore: isLoadingMoreComments
  } = useUserComments(user.uid);

  // 1. Refs and Motion Values for real-time tracking
  const pagerRef = useRef<HTMLDivElement>(null);
  const { scrollXProgress } = useScroll({
    container: pagerRef
  });

  const TABS = [
    { key: "my-events", label: "Posts" },
    { key: "attended", label: "Events" },
    { key: "comments", label: "Comments" },
    { key: "clubs", label: "Clubs" },
  ];

  const TABS_ORDER: Tab[] = ["my-events", "attended", "comments", "clubs"];

  const [isScrolling, setIsScrolling] = useState(false);
  const targetScrollPos = useRef<number | null>(null);
  const isProgrammaticScroll = useRef(false);

  // Handle programmatic tab changes (clicking a tab button)
  const handleTabChange = (tabKey: string) => {
    const tab = tabKey as Tab;
    setActiveTab(tab);
    if (!pagerRef.current) return;

    const index = TABS_ORDER.indexOf(tab);
    const pageWidth = pagerRef.current.clientWidth;
    const targetLeft = index * pageWidth;

    // Track programmatic scroll
    isProgrammaticScroll.current = true;
    targetScrollPos.current = targetLeft;
    setIsScrolling(true);

    pagerRef.current.scrollTo({
      left: targetLeft,
      behavior: "smooth"
    });

    // Safety timeout: unlock if scroll gets stuck or interrupted
    setTimeout(() => {
      if (isProgrammaticScroll.current) {
        isProgrammaticScroll.current = false;
        targetScrollPos.current = null;
        setIsScrolling(false);
      }
    }, 1000);
  };

  // Sync state back from scroll position (on settle)
  const handleScroll = () => {
    if (!pagerRef.current) return;

    // Check if we are in a programmatic scroll
    if (isProgrammaticScroll.current && targetScrollPos.current !== null) {
      const currentLeft = pagerRef.current.scrollLeft;
      const dist = Math.abs(currentLeft - targetScrollPos.current);

      // If we arrived at target (within small threshold), unlock
      if (dist < 10) {
        isProgrammaticScroll.current = false;
        targetScrollPos.current = null;
        setIsScrolling(false);
      } else {
        // Still scrolling to target, ignore updates
        return;
      }
    }

    const scrollLeft = pagerRef.current.scrollLeft;
    const pageWidth = pagerRef.current.clientWidth;
    if (pageWidth === 0) return;

    const index = Math.round(scrollLeft / pageWidth);
    const newTab = TABS_ORDER[index];
    if (newTab && newTab !== activeTab) {
      setActiveTab(newTab);
    }
  };

  // Sync on mount (for browser scroll restoration)
  useEffect(() => {
    const syncInitialScroll = () => {
      if (!pagerRef.current) return;
      const scrollLeft = pagerRef.current.scrollLeft;
      const pageWidth = pagerRef.current.clientWidth;
      if (pageWidth > 0 && scrollLeft > 0) {
        const index = Math.round(scrollLeft / pageWidth);
        const restoredTab = TABS_ORDER[index];
        if (restoredTab) setActiveTab(restoredTab);
      }
    };
    // Restoration often happens slightly after mount
    const timer = setTimeout(syncInitialScroll, 100);
    return () => clearTimeout(timer);
  }, []);

  // Load user profile
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setProfile({
            username: data.username || "",
            displayName: data.name || data.fullName || data.preferredName || data.displayName || user.displayName || "",
            photoURL: data.photoURL || user.photoURL || "",
            campusId: data.campusId || data.universityId || "", // Map both
            universityId: data.universityId || "",
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

  // Load Attended Events
  useEffect(() => {
    if (activeTab !== "attended") return;
    setAttendedLoading(true);
    const q = query(
      collection(db, "events"),
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
      items.sort((a, b) => {
        if (!a.date || !b.date) return 0;
        return a.date.localeCompare(b.date);
      });
      setAttendedPosts(items);
      setAttendedLoading(false);
    });
    return () => unsubscribe();
  }, [user.uid, activeTab]);

  // Load Clubs Count
  useEffect(() => {
    const fetchClubsCount = async () => {
      try {
        // Query all clubs where user is a member
        const clubsRef = collection(db, "clubs");
        const clubsSnapshot = await getDocs(clubsRef);

        let count = 0;
        for (const clubDoc of clubsSnapshot.docs) {
          const membersRef = collection(db, "clubs", clubDoc.id, "members");
          const memberQuery = query(membersRef, where("uid", "==", user.uid));
          const memberSnapshot = await getDocs(memberQuery);

          if (!memberSnapshot.empty) {
            count++;
          }
        }

        setClubsCount(count);
      } catch (error) {
        console.error("Error fetching clubs count:", error);
        setClubsCount(0);
      }
    };

    fetchClubsCount();
  }, [user.uid]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Sign-out error", err);
    }
  };

  const displayName = profile?.displayName || user.displayName || "User";
  const username = profile?.username || "";
  const photoURL = profile?.photoURL || user.photoURL || "";
  const isProfileComplete = !!(profile?.username && profile?.campus);

  return (
    <div className="min-h-screen text-neutral-50 mb-12">
      <div className="mx-auto w-full max-w-2xl px-1 py-6 pb-32 space-y-6">
        {/* Header Bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white transition-all active:scale-95"
          >
            <ChevronLeftIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Profile Incomplete Warning */}
        {!isProfileComplete && (
          <div className="rounded-[24px] border border-amber-500/10 bg-amber-500/5 p-4">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-amber-500/10 p-2.5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-amber-500">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-amber-500">Profile Incomplete</p>
                <p className="mt-1 text-xs leading-relaxed text-amber-400/70">
                  Please <Link href="/profile/setup" className="font-bold underline decoration-amber-500/30 underline-offset-2 hover:text-amber-300">complete your setup</Link> to unlock all community features.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* New Glass Profile Header */}
        <UserProfileHeader
          displayName={displayName}
          username={username}
          photoURL={photoURL}
          campusId={profile?.campusId || profile?.universityId}
          campusName={profile?.campus}
          yearOfStudy={profile?.yearOfStudy}
          major={profile?.major}
          isOwnProfile
          stats={{
            posts: myPosts.length,
            clubs: clubsCount,
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
          onSignOut={handleSignOut}
          onPostsClick={() => handleTabChange("my-events")}
          onClubsClick={() => handleTabChange("clubs")}
          onFollowersClick={() => {/* TODO: implement followers view */ }}
          onFollowingClick={() => {/* TODO: implement following view */ }}
        />

        {/* Tabs - Real-time progress passing */}
        {/* Tabs - Real-time progress passing */}
        <ProfileTabs
          tabs={TABS}
          value={activeTab}
          onChange={handleTabChange}
        />

        {/* Tab Content - Swipeable Pager */}
        <div
          ref={pagerRef}
          onScroll={handleScroll}
          className={`flex overflow-x-auto scrollbar-hide touch-pan-x ${isScrolling ? "overflow-hidden" : "snap-x snap-mandatory"
            }`}
          style={{ width: "100%" }}
        >
          {/* Page: Posts */}
          <div className="w-full shrink-0 snap-start px-1">
            <div className="space-y-6">
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
                <div className="space-y-4">
                  {myPosts.map((post) => (
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

          {/* Page: Events */}
          <div className="w-full shrink-0 snap-start px-1">
            <div className="space-y-6">
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
                <div className="space-y-4">
                  {attendedPosts.map((post) => (
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

          {/* Page: Comments */}
          <div className="w-full shrink-0 snap-start px-1">
            <div className="space-y-3">
              {commentsLoading && (
                <div className="rounded-2xl border border-white/10 bg-neutral-900/60 px-4 py-3 text-sm text-neutral-300">
                  Loading your comments...
                </div>
              )}
              {!commentsLoading && comments.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-neutral-900/60 px-4 py-12 text-center">
                  <p className="text-sm text-neutral-400 mb-2">
                    You haven't commented on anything yet.
                  </p>
                  <p className="text-xs text-neutral-500">
                    Your comments will appear here
                  </p>
                </div>
              )}
              {!commentsLoading && comments.length > 0 && (
                <div className="space-y-4">
                  {comments.map((comment) => {
                    const commentDate = comment.createdAt?.toDate?.();
                    const timeAgo = commentDate
                      ? getRelativeTime(commentDate)
                      : "Recently";

                    return (
                      <button
                        key={comment.id}
                        onClick={() => router.push(`/posts/${comment.postId}`)}
                        className="w-full rounded-[24px] border border-white/10 bg-[#1C1C1E] p-4 ring-1 ring-white/5 hover:bg-white/[0.02] hover:border-white/15 transition-all text-left"
                      >
                        <p className="text-sm text-neutral-200 mb-2 line-clamp-3">
                          {comment.text}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-neutral-500">
                          <span>{timeAgo}</span>
                          <span>•</span>
                          <span className="text-amber-400/70">View Post →</span>
                        </div>
                      </button>
                    );
                  })}

                  {/* Load More Button */}
                  {hasMoreComments && (
                    <button
                      onClick={loadMoreComments}
                      disabled={isLoadingMoreComments}
                      className="w-full rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-neutral-300 hover:bg-white/10 disabled:opacity-50 transition"
                    >
                      {isLoadingMoreComments ? "Loading..." : "Load More"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Page: Clubs */}
          <div className="w-full shrink-0 snap-start px-1">
            <MyClubsView userId={user.uid} />
          </div>
        </div>
      </div>
    </div>
  );
}
