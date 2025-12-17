"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, getFirestore } from "firebase/firestore";
import Link from "next/link";
import { ChevronLeftIcon, EllipsisHorizontalIcon, ArrowUpTrayIcon, BellIcon } from "@heroicons/react/24/outline";
import { Post } from "@/lib/posts";
import { PostMediaStrip } from "@/components/post-detail/post-media-strip";
import { PostCard } from "@/components/post-card";
import { MediaHorizontalScroll } from "@/components/post-detail/media-horizontal-scroll";
// import { PostMainInfo } from "@/components/post-detail/post-main-info";
import { PostTabs } from "@/components/post-detail/post-tabs";
import { PostTabContent } from "@/components/post-detail/post-tab-content-wrapper";
import { useRightSidebar } from "@/components/right-sidebar-context";

export default function PostDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { toggle } = useRightSidebar();
    const eventId = params.id as string;
    const [post, setPost] = useState<Post | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"details" | "comments" | "attendance" | "likes">("details");

    useEffect(() => {
        if (!eventId) return;
        const loadPost = async () => {
            try {
                setLoading(true);
                const db = getFirestore();
                const snap = await getDoc(doc(db, "events", eventId));
                if (snap.exists()) {
                    const data = snap.data();
                    setPost({
                        id: snap.id,
                        title: data.title,
                        content: data.content ?? data.description ?? "",
                        isEvent: data.isEvent ?? true,
                        date: data.date,
                        startTime: data.startTime,
                        endTime: data.endTime,
                        locationLabel: data.locationLabel,
                        locationUrl: data.locationUrl,
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
                        mood: data.mood || [],
                        priceLevel: data.priceLevel
                    });
                } else {
                    setError("Post not found");
                }
            } catch (err) {
                console.error(err);
                setError("Failed to load");
            } finally {
                setLoading(false);
            }
        };
        void loadPost();
    }, [eventId]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-neutral-950 text-neutral-400">
                <div className="animate-pulse">Loading...</div>
            </div>
        );
    }

    if (error || !post) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-4 bg-neutral-950 text-neutral-400">
                <p>{error}</p>
                <Link href="/" className="rounded-full bg-white/10 px-4 py-2 text-white">Back</Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-950 pb-32">
            {/* Sticky Header */}
            {/* Header - Not Sticky, App-like Back Button */}
            <header className="flex h-16 items-center justify-between px-4 pt-2">
                <button
                    onClick={() => router.back()}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-800/50 backdrop-blur-md text-white border border-white/5 active:opacity-70 active:scale-95 transition-all"
                >
                    <ChevronLeftIcon className="h-6 w-6" />
                </button>

                <div className="flex items-center gap-2">
                    <button className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-800/50 backdrop-blur-md text-white border border-white/5 active:opacity-70 active:scale-95 transition-all">
                        {/* Share */}
                        <ArrowUpTrayIcon className="h-5 w-5" />
                    </button>
                    <button className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-800/50 backdrop-blur-md text-white border border-white/5 active:opacity-70 active:scale-95 transition-all">
                        <EllipsisHorizontalIcon className="h-5 w-5" />
                    </button>
                </div>
            </header>

            <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
                {/* Row 1: Media Strip */}
                {/* Row 1: Media Strip - Removed in favor of Details Tab Scroll */}
                {/* <PostMediaStrip post={post} /> */}

                {/* Row 2,3,4: Main Info Card - Moved to Details Tab */}
                {/* <PostCard ... /> */}

                {/* Media Scroll - Above Tabs */}
                <div className="mb-6">
                    <MediaHorizontalScroll post={post} />
                </div>

                {/* Segmented Picker */}
                <PostTabs activeTab={activeTab} onChange={setActiveTab} />

                {/* Content */}
                <PostTabContent activeTab={activeTab} post={post} onTabChange={setActiveTab} />
            </main>

            {/* Floating Bell Button */}
            <button
                onClick={toggle}
                className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-black/40 backdrop-blur-xl border border-white/10 text-white shadow-lg active:scale-95 transition-all z-50 hover:bg-black/60"
            >
                <BellIcon className="h-6 w-6" />
            </button>
        </div>
    );
}
