"use client";

import { Post } from "@/lib/posts";
import { useRouter } from "next/navigation";
import { ChatBubbleLeftIcon, HeartIcon } from "@heroicons/react/24/outline";

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
            className="group flex flex-col gap-2 rounded-2xl border border-white/5 bg-[#1C1C1E] p-4 shadow-sm transition-all hover:border-white/10 hover:bg-white/5 active:scale-[0.98] cursor-pointer"
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide bg-white/5 px-1.5 py-0.5 rounded">
                            Post
                        </span>
                        <span className="text-xs text-zinc-500">•</span>
                        <span className="text-xs font-medium text-zinc-400">
                            {authorName || "Anonymous"}
                        </span>
                    </div>

                    <h3 className="line-clamp-2 text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
                        {title || content || "Untitled Post"}
                    </h3>
                </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-zinc-500 mt-1">
                <div className="flex items-center gap-1">
                    <HeartIcon className="h-3.5 w-3.5" />
                    <span>{likes.length}</span>
                </div>
                {/* Comments count would go here if available */}
            </div>
        </div>
    );
}
