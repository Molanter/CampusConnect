"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { Menu, Transition } from "@headlessui/react";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { ChevronLeftIcon, EllipsisHorizontalIcon, ArrowUpTrayIcon, BellIcon } from "@heroicons/react/24/outline";
import { Post } from "@/lib/posts";
import { PostMediaStrip } from "@/components/post-detail/post-media-strip";
import { PostCard } from "@/components/post-card";
import { MediaHorizontalScroll } from "@/components/post-detail/media-horizontal-scroll";
import { PostDetailMainInfo } from "@/components/post-detail/post-detail-main-info";
import { useRightSidebar } from "@/components/right-sidebar-context";
import { TabDiscussion } from "@/components/event-sheet/tab-discussion";



export default function PostDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { toggle, openView } = useRightSidebar();
    const postId = params.id as string;
    const [post, setPost] = useState<Post | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!postId) return;
        const loadPost = async () => {
            try {
                setLoading(true);

                const snap = await getDoc(doc(db, "posts", postId));
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
                        priceLevel: data.priceLevel,
                        createdAt: data.createdAt,
                        clubId: data.clubId,
                        clubName: data.clubName,
                        clubAvatarUrl: data.clubAvatarUrl,
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
    }, [postId]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-neutral-950 text-neutral-400">
                <div>Loading...</div>
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
            {/* Header - Minimal app bar */}
            <header className="flex h-12 items-center justify-between px-4 sticky top-0 bg-neutral-950/80 backdrop-blur-md z-40 border-b border-white/5">
                <button
                    onClick={() => router.back()}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/5 transition-all"
                >
                    <ChevronLeftIcon className="h-5 w-5" />
                </button>

                <div className="flex-1 flex justify-center">
                    <span className="text-[13px] font-bold text-white/90">Details</span>
                </div>

                <div className="flex items-center gap-1">
                    <button className="flex h-9 w-9 items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/5 transition-all">
                        <ArrowUpTrayIcon className="h-4 w-4" />
                    </button>
                    <Menu as="div" className="relative">
                        <Menu.Button className="flex h-9 w-9 items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/5 transition-all outline-none">
                            <EllipsisHorizontalIcon className="h-5 w-5" />
                        </Menu.Button>
                        <Transition
                            enter="transition duration-100 ease-out"
                            enterFrom="transform scale-95 opacity-0"
                            enterTo="transform scale-100 opacity-100"
                            leave="transition duration-75 ease-out"
                            leaveFrom="transform scale-100 opacity-100"
                            leaveTo="transform scale-95 opacity-0"
                        >
                            <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right rounded-xl border border-white/10 bg-[#1C1C1E]/90 shadow-xl backdrop-blur-xl focus:outline-none z-50 overflow-hidden">
                                <div className="p-1.5">
                                    <Menu.Item>
                                        {({ active }) => (
                                            <button
                                                onClick={() => {
                                                    if (post) {
                                                        openView("report", { id: post.id, type: post.isEvent ? "event" : "post" });
                                                    }
                                                }}
                                                className={`${active ? 'bg-white/10 text-white' : 'text-neutral-400'
                                                    } flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors`}
                                            >
                                                <span className="font-medium">Report</span>
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
                                                </svg>
                                            </button>
                                        )}
                                    </Menu.Item>
                                </div>
                            </Menu.Items>
                        </Transition>
                    </Menu>
                </div>
            </header>

            <main className="mx-auto max-w-2xl">
                {/* 1) Top: Media section (hero) if available */}
                {(post.imageUrls && post.imageUrls.length > 0 || post.coordinates) && (
                    <div className="px-4 mb-4 mt-2">
                        <MediaHorizontalScroll
                            post={post}
                            noPadding
                            fullWidth
                            className="h-[300px] md:h-[400px] rounded-[18px]"
                        />
                    </div>
                )}

                <div className="px-4">
                    {/* 2) Post content block (Threads-style message) */}
                    <PostDetailMainInfo post={post} />

                    {/* 3) Embedded Comments */}
                    <div className="mt-0.5 pt-2 border-t border-white/5">
                        <TabDiscussion post={post} />
                    </div>
                </div>
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

