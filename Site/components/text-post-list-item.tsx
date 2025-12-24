"use client";

import { useState, useEffect } from "react";
import { Post } from "@/lib/posts";
import { useRouter } from "next/navigation";
import {
    HeartIcon,
    ChatBubbleLeftIcon,
} from "@heroicons/react/24/outline";
import { HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

interface TextPostListItemProps {
    post: Post;
    onCommentsClick?: () => void;
    onClick?: () => void;
}

export function TextPostListItem({
    post,
    onCommentsClick,
    onClick,
}: TextPostListItemProps) {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<any>(null);

    const {
        id,
        title,
        content,
        isEvent,
        date,
        startTime,
        likes = [],
    } = post;

    const isLiked = currentUser ? likes.includes(currentUser.uid) : false;
    const likeCount = likes.length;

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setCurrentUser(u));
        return () => unsub();
    }, []);

    const handleCardClick = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button')) return;

        if (onClick) {
            onClick();
        } else {
            router.push(isEvent ? `/events/${id}` : `/posts/${id}`);
        }
    };

    // Date Formatting
    const getFormattedDateTime = () => {
        if (!date) return null;
        try {
            const dateObj = new Date(date + "T12:00:00");
            const month = dateObj.toLocaleDateString("en-US", { month: "short" });
            const day = dateObj.getDate();
            const dateStr = `${month} ${day}`;

            let timeStr = "";
            if (startTime) {
                const [hours, minutes] = startTime.split(':').map(Number);
                const suffix = hours >= 12 ? "PM" : "AM";
                const h = hours % 12 || 12;
                timeStr = `${h}:${minutes.toString().padStart(2, '0')} ${suffix}`;
            }

            return { dateStr, timeStr };
        } catch (e) {
            return null;
        }
    };

    const dateTime = isEvent ? getFormattedDateTime() : null;
    const textLength = content?.trim().length || 0;
    const isShortText = textLength > 0 && textLength < 20;

    return (
        <article
            onClick={handleCardClick}
            className="group relative aspect-square w-full cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.04] shadow-sm transition-all hover:border-white/20 hover:from-white/[0.12] hover:to-white/[0.06] active:scale-[0.98]"
        >
            {/* Background subtle text glyph */}
            <div className="absolute right-3 top-3 opacity-[0.04]">
                <ChatBubbleLeftIcon className="h-16 w-16 text-white" />
            </div>

            {/* Main content - centered */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                {/* Event date pill - top right */}
                {isEvent && dateTime && (
                    <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[9px] font-medium text-white/80 backdrop-blur-sm">
                        <span>{dateTime.dateStr}</span>
                        {dateTime.timeStr && (
                            <>
                                <span className="opacity-50">•</span>
                                <span>{dateTime.timeStr}</span>
                            </>
                        )}
                    </div>
                )}

                {/* Text content */}
                <div className="relative z-10 text-center">
                    {isEvent && title && (
                        <h3 className="mb-2 line-clamp-1 text-xs font-bold uppercase tracking-wider text-white/50">
                            {title}
                        </h3>
                    )}
                    <p className={`leading-snug text-white/90 ${isShortText
                            ? "text-lg font-medium line-clamp-2"
                            : "line-clamp-3 text-sm"
                        }`}>
                        {content?.trim() || <span className="italic text-white/30">No text</span>}
                    </p>
                </div>
            </div>

            {/* Compact actions - bottom left */}
            <div className="absolute bottom-2 left-2 z-20 flex items-center gap-3">
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); }}
                    className={`flex items-center gap-0.5 transition-colors ${isLiked ? "text-amber-400" : "text-white/50 hover:text-white/80"
                        }`}
                >
                    {isLiked ? (
                        <HeartIconSolid className="h-4 w-4" />
                    ) : (
                        <HeartIcon className="h-4 w-4" />
                    )}
                    <span className="text-[10px] font-semibold tabular-nums">
                        {likeCount || 0}
                    </span>
                </button>

                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onCommentsClick) onCommentsClick();
                    }}
                    className="flex items-center gap-0.5 text-white/50 transition hover:text-white/80"
                >
                    <ChatBubbleLeftIcon className="h-4 w-4" />
                    <span className="text-[10px] font-semibold tabular-nums">
                        {post.commentsCount || 0}
                    </span>
                </button>
            </div>
        </article>
    );
}
