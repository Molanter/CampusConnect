"use client";

import { Club } from "@/lib/clubs";
import { useRouter } from "next/navigation";
import { UserGroupIcon, HomeIcon } from "@heroicons/react/24/outline";
import { CheckBadgeIcon } from "@heroicons/react/24/solid";

interface ClubCardProps {
    club: Club;
}

export function ClubCard({ club }: ClubCardProps) {
    const router = useRouter();

    return (
        <div
            onClick={() => router.push(`/clubs/${club.id}`)}
            className="group flex flex-col cc-section cc-radius-24 p-4 transition-all duration-150 cc-hover-shadow active:scale-[0.98] cursor-pointer"
        >
            <div className="mb-3 flex items-start justify-between">
                <div className="h-12 w-12 overflow-hidden rounded-[14px] cc-avatar flex items-center justify-center aspect-square shadow-sm">
                    {club.logoUrl || club.profileImageUrl || club.coverImageUrl ? (
                        <img
                            src={club.logoUrl || club.profileImageUrl || club.coverImageUrl}
                            alt={club.name}
                            className="!h-full !w-full object-cover object-center"
                        />
                    ) : (club.category === "dorm" || (club as any).type === "dorm" || (club as any).isDorm || club.name?.toLowerCase().includes("dorm")) ? (
                        <div className="flex h-full w-full items-center justify-center bg-secondary text-white">
                            <HomeIcon className="h-6 w-6" />
                        </div>
                    ) : (
                        <div className="flex h-full w-full items-center justify-center bg-secondary text-white">
                            <span className="text-xl font-bold uppercase">{club.name.charAt(0)}</span>
                        </div>
                    )}
                </div>
                <button className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary/16">
                    View
                </button>
            </div>

            <h3 className="line-clamp-1 text-sm font-bold text-foreground transition-colors flex items-center gap-1">
                {club.name}
                {club.isVerified && (
                    <CheckBadgeIcon className="h-3.5 w-3.5 text-brand shrink-0" />
                )}
            </h3>

            <p className="mt-1 line-clamp-2 text-xs cc-muted leading-relaxed h-8">
                {club.description || "No description provided."}
            </p>

            <div className="mt-4 flex items-center gap-1 text-xs text-secondary">
                <UserGroupIcon className="h-3.5 w-3.5 text-secondary" />
                <span>{club.memberCount} members</span>
            </div>
        </div>
    );
}
