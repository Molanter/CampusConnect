"use client";

import { Club } from "@/lib/clubs";
import { useRouter } from "next/navigation";
import { HomeIcon, UserGroupIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { CheckBadgeIcon } from "@heroicons/react/24/solid";

interface ClubRowProps {
    club: Club;
    showChevron?: boolean;
}

export function ClubRow({ club, showChevron = false }: ClubRowProps) {
    const router = useRouter();
    const isDorm = club.category === "dorm" || (club as any).type === "dorm" || (club as any).isDorm || club.name?.toLowerCase().includes("dorm");

    return (
        <div
            onClick={() => router.push(`/clubs/${club.id}`)}
            className="group relative flex cursor-pointer items-center w-full transition-colors hover:bg-secondary/10"
        >
            <div className="flex items-center gap-3 w-full min-w-0 pl-3.5 pr-3 py-2.5">
                {/* Avatar Slot */}
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-[12px] cc-avatar ring-1 ring-secondary/20 bg-secondary/10 flex items-center justify-center aspect-square shadow-sm">
                    {club.logoUrl || club.profileImageUrl || club.coverImageUrl ? (
                        <img
                            src={club.logoUrl || club.profileImageUrl || club.coverImageUrl}
                            alt={club.name}
                            className="!h-full !w-full object-cover object-center transition-transform group-hover:scale-105"
                        />
                    ) : isDorm ? (
                        <div className="flex h-full w-full items-center justify-center bg-secondary/10 text-secondary">
                            <HomeIcon className="h-5 w-5" />
                        </div>
                    ) : (
                        <div className="flex h-full w-full items-center justify-center bg-secondary/10 text-secondary">
                            <span className="text-lg font-bold uppercase">{club.name.charAt(0)}</span>
                        </div>
                    )}
                </div>

                {/* Content Slot */}
                <div className="flex flex-col min-w-0 flex-1 leading-tight">
                    <div className="flex items-center gap-1.5">
                        <h3 className="text-[15px] font-semibold text-foreground truncate flex items-center gap-1">
                            {club.name}
                            {club.isVerified && (
                                <CheckBadgeIcon className="h-3.5 w-3.5 text-brand shrink-0" />
                            )}
                        </h3>
                        <span className="rounded-full bg-secondary/10 border border-secondary/20 px-1.5 py-0.5 text-[8px] font-bold text-secondary uppercase tracking-wider">
                            {isDorm ? "Dorm" : "Club"}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <UserGroupIcon className="h-3 w-3 text-secondary/40" />
                        <span className="text-[11px] cc-muted font-medium truncate">
                            {club.memberCount || 0} members
                        </span>
                        {club.category && !isDorm && (
                            <>
                                <span className="text-[10px] text-secondary/40">•</span>
                                <span className="text-[10px] text-secondary/60 capitalize">
                                    {club.category}
                                </span>
                            </>
                        )}
                    </div>
                </div>

                {/* Chevron */}
                {showChevron && (
                    <div className="group/icon p-1 rounded-full hover:bg-secondary/16 transition-colors">
                        <ChevronRightIcon className="h-5 w-5 text-secondary transition-colors group-hover/icon:text-foreground" />
                    </div>
                )}
            </div>

            {/* Inset Divider (matching PostRow container feel) */}
            <div className="absolute bottom-0 left-16 right-0 h-px bg-secondary/10 group-last:hidden" />
        </div>
    );
}
