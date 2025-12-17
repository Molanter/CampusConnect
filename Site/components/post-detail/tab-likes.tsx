"use client";

import { Post } from "@/lib/posts";
import { UserRow } from "@/components/user-row";
import Link from "next/link";

interface TabLikesProps {
    post: Post;
}

export function TabLikes({ post }: TabLikesProps) {
    const likes = post.likes || [];

    if (likes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-zinc-500">No likes yet.</p>
                <p className="text-xs text-zinc-600 mt-1">Be the first to like this post!</p>
            </div>
        );
    }

    return (
        <div className="space-y-1">
            {likes.map((uid) => (
                <Link key={uid} href={`/user/${uid}`} className="block px-3 py-2 -mx-3 rounded-3xl hover:bg-white/5 transition-colors">
                    <UserRow uid={uid} />
                </Link>
            ))}
        </div>
    );
}
