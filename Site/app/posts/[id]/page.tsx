"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { Menu, Transition } from "@headlessui/react";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { ArrowUpTrayIcon, BellIcon, EllipsisHorizontalIcon } from "@heroicons/react/24/outline";
import { Post } from "@/lib/posts";
import { PostMediaStrip } from "@/components/post-detail/post-media-strip";
import { PostCard } from "@/components/post-card";
import { MediaHorizontalScroll } from "@/components/post-detail/media-horizontal-scroll";
import { PostDetailMainInfo } from "@/components/post-detail/post-detail-main-info";
import { useRightSidebar } from "@/components/right-sidebar-context";
import { useAdminMode } from "@/components/admin-mode-context";
import { CommentsView } from "@/components/comments-view";



export default function PostDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { toggle, openView, close } = useRightSidebar();
    const { isGlobalAdminUser, isCampusAdminUser, adminModeOn } = useAdminMode();
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
                        description: data.description,
                        content: data.content ?? data.description ?? "",
                        type: data.type ?? (data.isEvent ? "event" : "post"),
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
                        campusId: data.campusId,
                        clubId: data.clubId,
                        clubName: data.clubName,
                        clubAvatarUrl: data.clubAvatarUrl,
                        campusName: data.campusName,
                        campusAvatarUrl: data.campusAvatarUrl,
                        ownerType: data.ownerType,
                        isVerified: data.isVerified,
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

    // Open appropriate sidebar view based on admin mode
    useEffect(() => {
        if (post) {
            // Check if we are on desktop (>768px)
            const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
            const isAdmin = isGlobalAdminUser || isCampusAdminUser;

            if (isAdmin && adminModeOn && isDesktop) {
                openView("post-history", { postId });
            } else {
                close();
            }
        }
    }, [post, postId, isGlobalAdminUser, isCampusAdminUser, adminModeOn, openView, close]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center cc-page text-secondary">
                <div>Loading...</div>
            </div>
        );
    }

    if (error || !post) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-4 cc-page text-secondary">
                <p>{error}</p>
                <Link href="/" className="rounded-full bg-surface-2 border border-secondary/20 px-4 py-2 text-foreground hover:bg-surface-3 transition-colors">Back</Link>
            </div>
        );
    }

    const isAdmin = isGlobalAdminUser || isCampusAdminUser;

    return (
        <div className="min-h-screen cc-page pb-32">
            {/* Header */}


            <main className="mx-auto max-w-2xl">
                {/* 1) Top: Media section (hero) if available */}
                {(post.imageUrls && post.imageUrls.length > 0 || post.coordinates) && (
                    <div className="px-4 mb-4 mt-2">
                        <MediaHorizontalScroll
                            post={post}
                            noPadding
                            fullWidth
                        />
                    </div>
                )}

                <div className="px-4">
                    {/* 2) Post content block (Chat-style) */}
                    <PostDetailMainInfo post={post} />

                    {/* 3) Embedded Comments */}
                    <div className="mt-4 pt-4 border-t border-secondary/10">
                        <CommentsView data={post} />
                    </div>
                </div>
            </main>


        </div>
    );
}

