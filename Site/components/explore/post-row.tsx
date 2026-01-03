"use client";

import { Post } from "@/lib/posts";
import { NewspaperIcon } from "@heroicons/react/24/outline";
import { formatDistanceToNow } from "date-fns";

interface PostRowProps {
    post: Post;
}

export function PostRow({ post }: PostRowProps) {
    const { title, content, authorName, authorUsername, imageUrls = [], createdAt, isEvent } = post;

    const photoURL = imageUrls?.[0] || (post as any).coverImageUrl;
    const effectiveContent = post.description || post.content || "";
    const displayName = title || effectiveContent.slice(0, 60) || "Untitled Post";
    const subtitle = authorUsername ? `@${authorUsername}` : (authorName || "Anonymous");
    const timeLabel = createdAt?.toDate ? formatDistanceToNow(createdAt.toDate(), { addSuffix: true }).replace("about ", "") : "";

    return (
        <div className="flex items-center gap-3 w-full min-w-0 pl-3.5 pr-3 py-2.5">
            {/* Image/Avatar Slot */}
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-[12px] cc-avatar ring-1 ring-secondary/20 bg-secondary/10 flex items-center justify-center aspect-square shadow-sm">
                {photoURL ? (
                    <img
                        src={photoURL}
                        alt={displayName}
                        className="!h-full !w-full object-cover object-center transition-transform group-hover:scale-105"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-secondary/10 text-secondary">
                        <NewspaperIcon className="h-5 w-5" />
                    </div>
                )}
            </div>

            {/* Content Slot */}
            <div className="flex flex-col min-w-0 flex-1 leading-tight">
                <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-foreground truncate">
                        {displayName}
                    </span>
                    {isEvent && (
                        <span className="rounded-full bg-brand/10 border border-brand/20 px-1.5 py-0.5 text-[8px] font-bold text-brand uppercase tracking-wider">
                            Event
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] cc-muted font-medium truncate">
                        {subtitle}
                    </span>
                    {timeLabel && (
                        <>
                            <span className="text-[10px] text-secondary/40">•</span>
                            <span className="text-[10px] text-secondary/60">
                                {timeLabel}
                            </span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
