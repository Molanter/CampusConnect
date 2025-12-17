"use client";

import { Club } from "@/lib/clubs";
import { useRouter } from "next/navigation";
import { UserGroupIcon } from "@heroicons/react/24/outline";

interface ClubCardProps {
    club: Club;
}

export function ClubCard({ club }: ClubCardProps) {
    const router = useRouter();

    return (
        <div
            onClick={() => router.push(`/clubs/${club.id}`)}
            className="group flex flex-col rounded-2xl border border-white/10 bg-[#1C1C1E] p-4 shadow-sm transition-all hover:border-white/20 hover:bg-white/5 active:scale-[0.98] cursor-pointer"
        >
            <div className="mb-3 flex items-start justify-between">
                <div className="h-12 w-12 overflow-hidden rounded-full bg-zinc-800 ring-1 ring-white/10">
                    {club.coverImageUrl ? (
                        <img src={club.coverImageUrl} alt={club.name} className="h-full w-full object-cover" />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-600 to-cyan-600 text-white">
                            <span className="text-lg font-bold">{club.name.charAt(0)}</span>
                        </div>
                    )}
                </div>
                <button className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white transition hover:bg-white/20">
                    View
                </button>
            </div>

            <h3 className="line-clamp-1 text-sm font-bold text-white group-hover:text-[#ffb200] transition-colors">
                {club.name}
            </h3>

            <p className="mt-1 line-clamp-2 text-xs text-zinc-400 h-8">
                {club.description || "No description provided."}
            </p>

            <div className="mt-4 flex items-center gap-1 text-xs text-zinc-500">
                <UserGroupIcon className="h-3.5 w-3.5" />
                <span>{club.memberCount} members</span>
            </div>
        </div>
    );
}
