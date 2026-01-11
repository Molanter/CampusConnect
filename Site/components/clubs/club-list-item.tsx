"use client";

import Link from "next/link";
import { Club } from "../../lib/clubs";
import { UserGroupIcon, LockClosedIcon, CheckBadgeIcon, HomeIcon, ChevronRightIcon } from "@heroicons/react/24/solid";

interface ClubListItemProps {
    club: Club;
    isLast?: boolean;
}

export function ClubListItem({ club, isLast }: ClubListItemProps) {
    const isDorm = club.category === "dorm" || (club as any).type === "dorm" || (club as any).isDorm || club.name?.toLowerCase().includes("dorm");

    return (
        <Link href={`/clubs/${club.id}`} className="block group">
            <div className={`flex items-center gap-4 px-4 py-3 transition-all duration-150 hover:bg-white/5 active:bg-white/10 ${!isLast ? 'border-b border-white/5' : ''}`}>
                {/* Logo */}
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl cc-glass-strong border border-white/10 aspect-square flex items-center justify-center shadow-sm">
                    {club.logoUrl || club.profileImageUrl ? (
                        <img
                            src={club.logoUrl || club.profileImageUrl}
                            alt={club.name}
                            className="!h-full !w-full object-cover object-center"
                        />
                    ) : isDorm ? (
                        <div className="flex h-full w-full items-center justify-center text-white bg-secondary">
                            <HomeIcon className="h-6 w-6" />
                        </div>
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-white bg-secondary">
                            <span className="text-xl font-bold uppercase">{club.name.charAt(0)}</span>
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-base font-bold text-foreground truncate">
                            {club.name}
                        </h3>
                        {club.isVerified && <CheckBadgeIcon className="h-4 w-4 text-brand shrink-0" />}
                        <div className="px-1.5 py-0.5 rounded-full bg-secondary/10 text-secondary text-[9px] font-bold tracking-wider uppercase">
                            {isDorm ? 'DORM' : 'CLUB'}
                        </div>
                        {club.isPrivate && (
                            <LockClosedIcon className="h-3.5 w-3.5 text-secondary shrink-0" />
                        )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-secondary-dim">
                        <div className="flex items-center gap-1">
                            <UserGroupIcon className="h-3 w-3" />
                            <span>{club.memberCount} members</span>
                        </div>
                    </div>
                </div>

                {/* Arrow hint */}
                <div className="shrink-0">
                    <ChevronRightIcon className="w-5 h-5 text-secondary/40 group-hover:text-secondary group-hover:translate-x-0.5 transition-all" />
                </div>
            </div>
        </Link>
    );
}
