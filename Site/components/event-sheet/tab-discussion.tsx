"use client";

import { Post } from "@/lib/posts";
import { CommentsView } from "../comments-view";

interface TabDiscussionProps {
    post: Post;
}

export function TabDiscussion({ post }: TabDiscussionProps) {
    // Reuse the full CommentsView extraction
    return (
        <div className="min-h-[400px] px-2">
            <CommentsView data={post} />
        </div>
    );
}
