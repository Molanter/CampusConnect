"use client";

import Link from "next/link";
import { Club } from "../../lib/clubs";
import { UserGroupIcon, LockClosedIcon, HomeIcon } from "@heroicons/react/24/solid";
import { CheckBadgeIcon } from "@heroicons/react/24/solid";

interface ClubCardProps {
    club: Club;
}

export function ClubCard({ club }: ClubCardProps) {
    return (
        <Link href={`/clubs/${club.id}`} className="block group">
            <div className="relative cc-section cc-radius-24 overflow-hidden shadow-lg transition-all duration-150 hover:cc-shadow-soft active:scale-[0.98]">

                {/* Cover Image */}
                <div className="relative h-32 w-full overflow-hidden cc-glass-strong">
                    {club.coverImageUrl ? (
                        <img
                            src={club.coverImageUrl}
                            alt={club.name}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center cc-glass-strong">
                            <UserGroupIcon className="h-12 w-12 text-secondary/30" />
                        </div>
                    )}

                    {/* Private Badge */}
                    {club.isPrivate && (
                        <div className="absolute top-2 right-2 rounded-full bg-secondary/20 backdrop-blur-md px-2 py-1 text-[10px] font-medium text-foreground/90 border border-secondary/25">
                            <LockClosedIcon className="inline h-3 w-3 mr-1 mb-0.5" />
                            Private
                        </div>
                    )}
                </div>

                {/* Avatar Overlap - Moved out to prevent clipping */}
                <div className="absolute top-[5.5rem] left-4 h-16 w-16 overflow-hidden rounded-2xl border-4 border-white/10 cc-avatar shadow-xl aspect-square z-10 cc-glass-strong">
                    {club.logoUrl || club.profileImageUrl ? (
                        <img
                            src={club.logoUrl || club.profileImageUrl}
                            alt={club.name}
                            className="!h-full !w-full object-cover object-center"
                        />
                    ) : (club.category === "dorm" || (club as any).type === "dorm" || (club as any).isDorm || club.name?.toLowerCase().includes("dorm")) ? (
                        <div className="flex h-full w-full items-center justify-center text-secondary">
                            <span className="text-2xl font-bold uppercase">{club.name.charAt(0)}</span>
                        </div>
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-secondary">
                            <span className="text-2xl font-bold uppercase">{club.name.charAt(0)}</span>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="p-4 pt-8">
                    <h3 className="text-lg font-semibold text-foreground/90 group-hover:text-foreground truncate flex items-center gap-1">
                        {club.name}
                        {club.isVerified && <CheckBadgeIcon className="h-4 w-4 text-brand shrink-0" />}
                    </h3>

                    <p className="mt-1 text-sm cc-muted line-clamp-2 h-10 leading-relaxed">
                        {club.description}
                    </p>

                    <div className="mt-4 flex items-center justify-between text-xs cc-muted">
                        <div className="flex items-center gap-1.5">
                            <UserGroupIcon className="h-3.5 w-3.5" />
                            <span>{club.memberCount} members</span>
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    );
}
