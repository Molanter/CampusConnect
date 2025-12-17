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
        content,
        date,
        startTime,
        endTime,
        locationLabel,
        locationUrl,
        authorName,
        priceLevel,
        mood = []
    } = post;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Main Info Card */}
            <PostCard
                post={post}
                compact={false}
                hideMediaGrid={true}
                hideCommentPreview={true}
                hideDate={true}
                fullWidth={true}
                onCommentsClick={() => onTabChange?.("comments")}
                onAttendanceClick={() => onTabChange?.("attendance")}
                onLikesClick={() => onTabChange?.("likes")}
            />

            {/* Key Info List - No card background, just rows */}
            <div className="space-y-4">

                {/* Date/Time Row (Moved from PostCard) */}
                <div className="flex items-center gap-4 px-2">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-blue-400">
                        <CalendarIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-white">
                                {date ? format(new Date(date), "EEEE, MMMM d, yyyy") : "Date TBA"}
                            </p>
                            {/* Status Pill & Countdown Logic */}
                            {(() => {
                                if (!date || !startTime) return null;
                                const now = new Date();
                                const start = new Date(`${date}T${startTime}`);
                                // Simple end time handling, assuming same day if not specified otherwise
                                const end = endTime ? new Date(`${date}T${endTime}`) : new Date(start.getTime() + 2 * 60 * 60 * 1000); // default 2h

                                let status: 'live' | 'upcoming' | 'past' = 'upcoming';
                                if (now > end) status = 'past';
                                else if (now >= start) status = 'live';

                                let label = "";
                                if (status === 'live') label = "LIVE";
                                else if (status === 'past') label = "PAST";
                                else {
                                    const diff = start.getTime() - now.getTime();
                                    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                                    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                    if (days > 0) label = `${days}d`;
                                    else if (hours > 0) label = `${hours}h`;
                                    else label = `${minutes}m`;
                                }

                                return (
                                    <div className="flex items-center gap-2">
                                        {status !== 'upcoming' && (
                                            <div className={`px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider uppercase ${status === 'live'
                                                ? "bg-red-500/20 text-red-500 border border-red-500/30"
                                                : "bg-neutral-800 text-neutral-500 border border-white/5"
                                                }`}>
                                                {status === 'live' ? 'LIVE' : 'ENDED'}
                                            </div>
                                        )}
                                        {status === 'upcoming' && (
                                            <span className="text-xs font-medium text-neutral-400">
                                                Starts in {label}
                                            </span>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                        <p className="text-sm text-neutral-400">
                            {startTime ? `${startTime}${endTime ? ` - ${endTime}` : ""}` : "Time TBA"}
                        </p>
                    </div>
                </div>

                <div className="h-px bg-white/5 mx-2" />

                {/* Location with Button */}
                <div className="flex items-center gap-4 px-2">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-purple-400">
                        <MapPinIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 flex items-center justify-between">
                        <div>
                            <p className="font-semibold text-white">
                                {locationLabel || "Location TBA"}
                            </p>
                            <p className="text-xs text-neutral-500">View on map</p>
                        </div>
                        {locationUrl && (
                            <a
                                href={locationUrl}
                                target="_blank"
                                className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-white hover:bg-white/20 transition-colors"
                            >
                                Open Maps
                            </a>
                        )}
                    </div>
                </div>


            </div>

            {/* About - Removed redundant section, covered by PostCard description */}
            {/* <div className="px-2 pt-4">...</div> */}

            {/* Tags & Meta */}
            {(mood.length > 0 || priceLevel) && (
                <div className="px-2 pt-4">
                    <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-neutral-500">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                        {priceLevel && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-neutral-300">
                                <TagIcon className="h-3.5 w-3.5" /> {priceLevel}
                            </span>
                        )}
                        {mood.map(m => (
                            <span key={m} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-neutral-300">
                                # {m}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
