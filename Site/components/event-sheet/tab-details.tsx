"use client";

import { Post } from "@/lib/posts";
import { PostCard } from "@/components/post-card";
import { format } from "date-fns";
import { CalendarIcon, MapPinIcon, TagIcon } from "@heroicons/react/24/outline";

interface TabDetailsProps {
    post: Post;
    onTabChange?: (tab: "details" | "comments" | "attendance" | "likes") => void;
}

export function TabDetails({ post, onTabChange }: TabDetailsProps) {
    const {
        priceLevel,
        mood = []
    } = post;

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 py-4">
            {/* Tags & Meta */}
            {(mood.length > 0 || priceLevel) ? (
                <div className="px-2">
                    <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-white/30">Tags & Categories</h3>
                    <div className="flex flex-wrap gap-2.5">
                        {priceLevel && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-neutral-300">
                                <TagIcon className="h-4 w-4" /> {priceLevel}
                            </span>
                        )}
                        {mood.map(m => (
                            <span key={m} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-neutral-300 font-medium">
                                # {m}
                            </span>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <TagIcon className="h-12 w-12 text-white/10 mb-3" />
                    <p className="text-white/30 text-sm font-medium">No additional details available</p>
                </div>
            )}
        </div>
    );
}
