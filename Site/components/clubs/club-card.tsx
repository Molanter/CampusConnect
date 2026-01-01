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
            <div className="relative overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#0c0c0c] shadow-lg transition-all duration-300 hover:scale-[1.02] hover:brightness-[1.1] hover:border-white/10">

                {/* Cover Image & Avatar */}
                <div className="relative h-32 w-full overflow-hidden bg-white/5">
                    {club.coverImageUrl ? (
                        <img
                            src={club.coverImageUrl}
                            alt={club.name}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900">
                            <UserGroupIcon className="h-12 w-12 text-white/10" />
                        </div>
                    )}

                    {/* Avatar Overlap */}
                    <div className="absolute -bottom-6 left-4 h-16 w-16 overflow-hidden rounded-2xl border-4 border-[#0c0c0c] bg-[#111] shadow-xl">
                        {club.logoUrl || club.profileImageUrl ? (
                            <img
                                src={club.logoUrl || club.profileImageUrl}
                                alt={club.name}
                                className="h-full w-full object-cover object-center"
                            />
                        ) : club.category === "dorm" ? (
                            <div className="flex h-full w-full items-center justify-center bg-secondary/10 text-secondary">
                                <HomeIcon className="h-8 w-8" />
                            </div>
                        ) : (
                            <div className="flex h-full w-full items-center justify-center bg-secondary/10 text-secondary">
                                <span className="text-2xl font-bold uppercase">{club.name.charAt(0)}</span>
                            </div>
                        )}
                    </div>

                    {/* Private Badge */}
                    {club.isPrivate && (
                        <div className="absolute top-2 right-2 rounded-full bg-black/60 backdrop-blur-md px-2 py-1 text-[10px] font-medium text-white/90 border border-white/10">
                            <LockClosedIcon className="inline h-3 w-3 mr-1 mb-0.5" />
                            Private
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="p-4 pt-8">
                    <h3 className="text-lg font-semibold text-white/90 group-hover:text-white truncate flex items-center gap-1">
                        {club.name}
                        {club.isVerified && <CheckBadgeIcon className="h-4 w-4 text-blue-500 shrink-0" />}
                    </h3>

                    <p className="mt-1 text-sm text-zinc-400 line-clamp-2 h-10 leading-relaxed">
                        {club.description}
                    </p>

                    <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
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
