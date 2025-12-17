"use client";

import { Post } from "@/lib/posts";
import { CommentsView } from "../comments-view";

interface TabDiscussionProps {
    post: Post;
}

export function TabDiscussion({ post }: TabDiscussionProps) {
    // Reuse the full CommentsView extraction
    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 min-h-[400px] px-2 h-[600px]">
            <CommentsView data={post} />
        </div>
    );
}
