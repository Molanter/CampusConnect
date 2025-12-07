"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc, getFirestore } from "firebase/firestore";
import { PostCard } from "@/components/post-card";
import { useRightSidebar } from "@/components/right-sidebar-context";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { Post } from "@/lib/posts";

export default function EventDetailPage() {
    const params = useParams();
    const eventId = params.id as string;
    const [post, setPost] = useState<Post | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const { openView } = useRightSidebar();

    useEffect(() => {
        if (!eventId) return;

        const loadPost = async () => {
            try {
                setLoading(true);
                const dbFull = getFirestore();
                const docRef = doc(dbFull, "events", eventId);
                const snap = await getDoc(docRef);

                if (snap.exists()) {
                    const data = snap.data();
                    setPost({
                        id: snap.id,
                        title: data.title, // Title can be undefined/null for posts
                        content: data.content ?? data.description ?? "",
                        isEvent: data.isEvent ?? true, // infer event if missing, or use field
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
                        // createdAt can be added if needed
                    });
                } else {
                    setError("Post not found");
                }
            } catch (err) {
                console.error("Error loading post", err);
                setError("Failed to load post");
            } finally {
                setLoading(false);
            }
        };

        void loadPost();
    }, [eventId]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center text-neutral-300">
                Loading...
            </div>
        );
    }

    if (error || !post) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-4 text-neutral-300">
                <p>{error || "Post not found"}</p>
                <Link
                    href="/"
                    className="rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm text-white hover:bg-white/20 transition"
                >
                    Back to feed
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-950 px-4 py-8 text-neutral-50">
            <div className="mx-auto w-full max-w-xl space-y-6">
                {/* Back Button */}
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition"
                >
                    <ArrowLeftIcon className="h-4 w-4" />
                    <span>Back to feed</span>
                </Link>

                {/* Post Card */}
                <PostCard
                    post={post}
                    onCommentsClick={() => openView("comments", post)}
                    onAttendanceClick={() => openView("attendance", post)}
                    onDetailsClick={() => { }} // Already on details page
                />
            </div>
        </div>
    );
}

