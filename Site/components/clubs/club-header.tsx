"use client";

import { Club, JoinStatus } from "../../lib/clubs";
import { UserGroupIcon, CogIcon, ShareIcon, EllipsisHorizontalIcon } from "@heroicons/react/24/solid";

interface ClubHeaderProps {
    club: Club;
    currentUserRole: "owner" | "admin" | "member" | null;
    joinStatus: JoinStatus | null; // e.g., 'pending' if requested
    onJoin: () => void;
    onLeave: () => void; // or Cancel Request
    onSettings?: () => void;
    onInvite?: () => void;
}

export function ClubHeader({
    club,
    currentUserRole,
    joinStatus,
    onJoin,
    onLeave,
    onSettings,
    onInvite,
}: ClubHeaderProps) {

    const isMember = currentUserRole === "owner" || currentUserRole === "admin" || currentUserRole === "member";
    const isPending = joinStatus === "pending";

    return (
        <div className="relative w-full overflow-hidden rounded-[28px] border border-white/10 bg-[#1C1C1E] shadow-xl">
            {/* Background Blur */}
            <div className="absolute inset-0 w-full h-full">
                {club.coverImageUrl ? (
                    <img
                        src={club.coverImageUrl}
                        alt="Background"
                        className="h-full w-full object-cover opacity-30 blur-2xl"
                    />
                ) : (
                    <div className="h-full w-full bg-gradient-to-br from-blue-900/20 via-purple-900/20 to-zinc-900/20 blur-2xl" />
                )}
                {/* Gradient Overlay for Text Readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#1C1C1E] via-[#1C1C1E]/80 to-transparent" />
            </div>

            <div className="relative z-10 px-6 pb-6 pt-20 md:px-10">
                <div className="flex flex-col md:flex-row md:items-end md:gap-8">

                    {/* Main Icon/Avatar */}
                    <div className="group relative -mt-10 h-32 w-32 shrink-0 overflow-hidden rounded-[28px] border-[4px] border-[#1C1C1E] bg-[#2C2C2E] shadow-xl md:mb-0 md:h-36 md:w-36">
                        {club.coverImageUrl ? (
                            <img
                                src={club.coverImageUrl}
                                alt={club.name}
                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center bg-white/5">
                                <UserGroupIcon className="h-14 w-14 text-zinc-500" />
                            </div>
                        )}
                    </div>

                    {/* Info Block */}
                    <div className="mt-4 flex flex-1 flex-col gap-2 md:mt-0 md:mb-2">
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                                {club.name}
                            </h1>
                            {club.isPrivate && (
                                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-white/70 backdrop-blur-md">
                                    Private
                                </span>
                            )}
                        </div>

                        <p className="max-w-xl text-base leading-relaxed text-zinc-400">
                            {club.description}
                        </p>

                        <div className="mt-2 flex items-center gap-4 text-sm font-medium text-zinc-500">
                            <span className="flex items-center gap-1.5 text-zinc-400">
                                <UserGroupIcon className="h-4 w-4" />
                                {club.memberCount} Members
                            </span>
                        </div>
                    </div>

                    {/* Actions Block */}
                    <div className="mt-6 flex flex-wrap items-center gap-3 md:mt-0 md:mb-2 md:justify-end">

                        {(currentUserRole === "owner" || currentUserRole === "admin") && (
                            <button
                                onClick={onSettings}
                                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white transition-colors hover:bg-white/10"
                            >
                                <CogIcon className="h-5 w-5" />
                            </button>
                        )}

                        <button
                            onClick={onInvite}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white transition-colors hover:bg-white/10"
                        >
                            <ShareIcon className="h-5 w-5" />
                        </button>

                        {isMember ? (
                            <button
                                disabled
                                className="h-10 rounded-full border border-white/10 bg-white/5 px-6 text-sm font-semibold text-zinc-400 cursor-default"
                            >
                                Joined
                            </button>
                        ) : isPending ? (
                            <button
                                onClick={onLeave} // Cancel request
                                className="h-10 rounded-full bg-zinc-800 px-6 text-sm font-semibold text-white transition-all hover:bg-zinc-700"
                            >
                                Pending...
                            </button>
                        ) : (
                            <button
                                onClick={onJoin}
                                className="h-10 rounded-full bg-[#ffb200] px-8 text-sm font-bold text-black shadow-lg shadow-[#ffb200]/20 transition-all hover:scale-105 hover:bg-[#ffc233] active:scale-95"
                            >
                                {club.isPrivate ? "Request to Join" : "Join Club"}
                            </button>
                        )}

                        {isMember && (
                            <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white transition-colors hover:bg-white/10 md:hidden">
                                <EllipsisHorizontalIcon className="h-5 w-5" />
                            </button>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
}
