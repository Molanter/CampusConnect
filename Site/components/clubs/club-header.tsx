"use client";

import { Club, JoinStatus } from "../../lib/clubs";
import { UserGroupIcon, CogIcon, ShareIcon, ChevronLeftIcon } from "@heroicons/react/24/solid";
import { useRouter } from "next/navigation";

interface ClubHeaderProps {
    club: Club;
    currentUserRole: "owner" | "admin" | "member" | null;
    joinStatus: JoinStatus | null;
    onJoin: () => void;
    onLeave: () => void;
    onSettings?: () => void;
    onInvite?: () => void;
    isNarrow?: boolean;
}

export function ClubHeader({
    club,
    currentUserRole,
    joinStatus,
    onJoin,
    onLeave,
    onSettings,
    onInvite,
    isNarrow = false,
}: ClubHeaderProps) {
    const router = useRouter();
    const isMember = currentUserRole === "owner" || currentUserRole === "admin" || currentUserRole === "member";
    const isPending = joinStatus === "pending";
    const isAdmin = currentUserRole === "owner" || currentUserRole === "admin";

    return (
        <div className="w-full space-y-6">
            {/* Mobile Layout (Hidden on Desktop unless narrow) */}
            <div className={`flex flex-col space-y-4 ${isNarrow ? "flex" : "md:hidden"}`}>
                {/* Row 1: Header Bar */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <button
                            onClick={() => router.back()}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-white active:scale-90"
                        >
                            <ChevronLeftIcon className="h-6 w-6" />
                        </button>
                        <h1 className="truncate text-xl font-bold text-white">
                            {club.name}
                        </h1>
                    </div>
                    <button
                        onClick={onInvite}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-white active:scale-90"
                    >
                        <ShareIcon className="h-5 w-5" />
                    </button>
                </div>

                {/* Row 2: Info */}
                <div className="flex gap-4">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#2C2C2E]">
                        {club.coverImageUrl ? (
                            <img src={club.coverImageUrl} alt={club.name} className="h-full w-full object-cover" />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center">
                                <UserGroupIcon className="h-10 w-10 text-zinc-500" />
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col justify-center min-w-0">
                        <p className="line-clamp-2 text-sm text-zinc-400">
                            {club.description}
                        </p>
                        <span className="mt-1 flex items-center gap-1.5 text-xs font-medium text-zinc-500">
                            <UserGroupIcon className="h-3.5 w-3.5" />
                            {club.memberCount} Members
                            {club.isPrivate && (
                                <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/50">
                                    Private
                                </span>
                            )}
                        </span>
                    </div>
                </div>

                {/* Row 3: Actions */}
                <div className="flex gap-2">
                    {isMember ? (
                        <button className="flex-1 h-11 rounded-xl border border-white/10 bg-white/5 text-sm font-semibold text-zinc-400">
                            Joined
                        </button>
                    ) : isPending ? (
                        <button
                            onClick={onLeave}
                            className="flex-1 h-11 rounded-xl bg-zinc-800 text-sm font-semibold text-white"
                        >
                            Pending...
                        </button>
                    ) : (
                        <button
                            onClick={onJoin}
                            className="flex-1 h-11 rounded-xl bg-[#ffb200] text-sm font-bold text-black"
                        >
                            {club.isPrivate ? "Request to Join" : "Join Club"}
                        </button>
                    )}

                    {isAdmin && (
                        <button
                            onClick={onSettings}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5 text-white shadow-sm"
                        >
                            <CogIcon className="h-5 w-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Desktop Layout (Hidden on Mobile or if narrow) */}
            <div className={`${isNarrow ? "hidden" : "hidden md:flex"} items-center justify-between gap-8 rounded-3xl border border-white/5 bg-white/[0.02] p-8 backdrop-blur-sm`}>
                <div className="flex items-center gap-6 overflow-hidden">
                    <div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#2C2C2E]">
                        {club.coverImageUrl ? (
                            <img src={club.coverImageUrl} alt={club.name} className="h-full w-full object-cover" />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center">
                                <UserGroupIcon className="h-14 w-14 text-zinc-500" />
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-3">
                            <h1 className="truncate text-3xl font-bold text-white">
                                {club.name}
                            </h1>
                            {club.isPrivate && (
                                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-white/50">
                                    Private
                                </span>
                            )}
                        </div>
                        <p className="mt-2 line-clamp-3 text-[15px] leading-relaxed text-zinc-400">
                            {club.description}
                        </p>
                        <div className="mt-4 flex items-center gap-4 text-sm font-medium text-zinc-500">
                            <span className="flex items-center gap-1.5">
                                <UserGroupIcon className="h-4 w-4 text-zinc-400" />
                                {club.memberCount} Members
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    {isMember ? (
                        <button className="h-11 rounded-xl border border-white/10 bg-white/5 px-8 text-sm font-semibold text-zinc-400">
                            Joined
                        </button>
                    ) : isPending ? (
                        <button
                            onClick={onLeave}
                            className="h-11 rounded-xl bg-zinc-800 px-8 text-sm font-semibold text-white"
                        >
                            Pending...
                        </button>
                    ) : (
                        <button
                            onClick={onJoin}
                            className="h-11 rounded-xl bg-[#ffb200] px-8 text-sm font-bold text-black transition-transform hover:scale-105 active:scale-95"
                        >
                            {club.isPrivate ? "Request to Join" : "Join Club"}
                        </button>
                    )}

                    <button
                        onClick={onInvite}
                        className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-white transition-colors hover:bg-white/10"
                    >
                        <ShareIcon className="h-5 w-5" />
                    </button>

                    {isAdmin && (
                        <button
                            onClick={onSettings}
                            className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-white transition-colors hover:bg-white/10"
                        >
                            <CogIcon className="h-5 w-5" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
