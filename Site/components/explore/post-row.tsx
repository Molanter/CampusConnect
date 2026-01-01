"use client";

import { Post } from "@/lib/posts";
import { useRouter } from "next/navigation";
import { HeartIcon } from "@heroicons/react/24/outline";

interface PostRowProps {
    post: Post;
}

export function PostRow({ post }: PostRowProps) {
    const router = useRouter();
    const { id, title, content, authorName, likes = [], isEvent } = post;
    const isLiked = false; // Simplified for preview

    return (
        <div
            onClick={() => router.push(isEvent ? `/events/${id}` : `/posts/${id}`)}
            className="group flex flex-col gap-2 w-full min-w-0 p-4 transition-colors hover:bg-secondary/10 cursor-pointer"
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-secondary uppercase tracking-wide bg-secondary/10 px-2 py-0.5 rounded-full">
                            Post
                        </span>
                        <span className="text-secondary/40">•</span>
                        <span className="text-xs font-medium text-secondary">
                            {authorName || "Anonymous"}
                        </span>
                    </div>

                    <h3 className="line-clamp-2 text-sm font-medium text-foreground transition-colors">
                        {title || content}
                    </h3>
                </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-secondary mt-1">
                <div className="group/icon flex items-center gap-1 cursor-pointer text-secondary">
                    <HeartIcon className="h-3.5 w-3.5 text-secondary transition-colors group-hover/icon:text-foreground" />
                    <span className="text-secondary transition-colors group-hover/icon:text-foreground">{likes.length}</span>
                </div>
                {/* Comments count would go here if available */}
            </div>
        </div>
    );
}
