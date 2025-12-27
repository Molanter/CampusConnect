"use client";

import { Club } from "@/lib/clubs";
import { useRouter } from "next/navigation";
import { ChevronRightIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { CheckBadgeIcon } from "@heroicons/react/24/solid";

interface ClubRowProps {
    club: Club;
}

export function ClubRow({ club }: ClubRowProps) {
    const router = useRouter();

    return (
        <div
            onClick={() => router.push(`/clubs/${club.id}`)}
            className="group flex items-center justify-between rounded-2xl border border-white/5 bg-[#1C1C1E] p-4 shadow-sm transition-all hover:border-white/10 hover:bg-white/5 active:scale-[0.98] cursor-pointer"
        >
            <div className="flex items-center gap-4 overflow-hidden">
                {/* Avatar */}
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-zinc-800 ring-1 ring-white/10">
                    {club.coverImageUrl ? (
                        <img src={club.coverImageUrl} alt={club.name} className="h-full w-full object-cover" />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-600 to-cyan-600 text-white">
                            <span className="text-lg font-bold">{club.name.charAt(0)}</span>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex flex-col overflow-hidden">
                    <div className="flex items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-white group-hover:text-[#ffb200] transition-colors flex items-center gap-1">
                            {club.name}
                            {club.isVerified && (
                                <CheckBadgeIcon className="h-4 w-4 text-blue-500 shrink-0" />
                            )}
                        </h3>
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-500 uppercase tracking-wide">
                            Club
                        </span>
                    </div>
                    <p className="truncate text-sm text-zinc-400">
                        {club.description || "No description provided."}
                    </p>
                </div>
            </div>

            {/* Action */}
            <div className="pl-4">
                <ChevronRightIcon className="h-5 w-5 text-zinc-500 group-hover:text-white transition-colors" />
            </div>
        </div>
    );
}
