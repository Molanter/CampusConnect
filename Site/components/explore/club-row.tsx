"use client";

import { Club } from "@/lib/clubs";
import { useRouter } from "next/navigation";
import { ChevronRightIcon, UserGroupIcon, HomeIcon } from "@heroicons/react/24/outline";
import { CheckBadgeIcon } from "@heroicons/react/24/solid";

interface ClubRowProps {
    club: Club;
}

export function ClubRow({ club }: ClubRowProps) {
    const router = useRouter();

    return (
        <div
            onClick={() => router.push(`/clubs/${club.id}`)}
            className="group relative flex items-center justify-between px-4 py-3 transition-colors hover:bg-secondary/10 cursor-pointer"
        >
            <div className="flex items-center gap-4 overflow-hidden">
                {/* Avatar */}
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full cc-avatar flex items-center justify-center aspect-square">
                    {club.logoUrl || club.profileImageUrl || club.coverImageUrl ? (
                        <img
                            src={club.logoUrl || club.profileImageUrl || club.coverImageUrl}
                            alt={club.name}
                            className="!h-full !w-full object-cover object-center"
                        />
                    ) : club.category === "dorm" ? (
                        <div className="flex h-full w-full items-center justify-center bg-secondary/10 border border-secondary/25 text-secondary">
                            <HomeIcon className="h-6 w-6" />
                        </div>
                    ) : (
                        <div className="flex h-full w-full items-center justify-center bg-secondary/10 border border-secondary/25 text-secondary">
                            <span className="text-xl font-bold uppercase">{club.name.charAt(0)}</span>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex flex-col overflow-hidden">
                    <div className="flex items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-foreground transition-colors flex items-center gap-1">
                            {club.name}
                            {club.isVerified && (
                                <CheckBadgeIcon className="h-4 w-4 text-brand shrink-0" />
                            )}
                        </h3>
                        <span className="rounded-full bg-secondary/10 border border-secondary/20 px-2 py-0.5 text-[10px] font-medium text-secondary uppercase tracking-wide">
                            Club
                        </span>
                    </div>
                    <p className="truncate text-sm text-secondary">
                        {club.description || "No description provided."}
                    </p>
                </div>
            </div>

            {/* Action */}
            <div className="pl-4">
                <ChevronRightIcon className="h-5 w-5 text-secondary transition-colors group-hover:text-foreground" />
            </div>

            {/* Inset Divider */}
            <div className="absolute bottom-0 left-20 right-0 h-px bg-secondary/10 group-last:hidden" />
        </div>
    );
}
