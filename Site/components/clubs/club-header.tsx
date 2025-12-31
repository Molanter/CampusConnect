"use client";

import React, { useState } from "react";
import { Club, JoinStatus } from "../../lib/clubs";
import {
    UserGroupIcon,
    Cog6ToothIcon,
    EllipsisHorizontalIcon,
    ArrowUpOnSquareIcon,
    ExclamationTriangleIcon,
    ArrowRightOnRectangleIcon,
    LockClosedIcon
} from "@heroicons/react/24/outline";
import { CheckBadgeIcon } from "@heroicons/react/24/solid";
import { Menu, Transition } from "@headlessui/react";
import { useRouter } from "next/navigation";

interface ClubHeaderProps {
    club: Club;
    currentUserRole: "owner" | "admin" | "member" | null;
    joinStatus: JoinStatus | null;
    stats?: {
        posts: number;
        members: number;
    };
    onJoin: () => void;
    onLeave: () => void;
    onSettings?: () => void;
    onInvite?: () => void;
    onReport?: () => void;

    onPostsClick?: () => void;
    onMembersClick?: () => void;

    isNarrow?: boolean;
    isGlobalAdmin?: boolean;
}

export function ClubHeader({
    club,
    currentUserRole,
    joinStatus,
    stats = { posts: 0, members: 0 },
    onJoin,
    onLeave,
    onSettings,
    onInvite,
    onReport,
    onPostsClick,
    onMembersClick,
    isNarrow = false,
    isGlobalAdmin = false,
}: ClubHeaderProps) {
    const router = useRouter();
    const isMember = currentUserRole === "owner" || currentUserRole === "admin" || currentUserRole === "member";
    const isPending = joinStatus === "pending";
    const isAdmin = currentUserRole === "owner" || currentUserRole === "admin" || isGlobalAdmin;
    const isOwner = currentUserRole === "owner"; // Used for destructive actions if needed

    // Use logoUrl for avatar, coverImageUrl for background
    const avatarUrl = club.logoUrl || club.coverImageUrl; // Fallback to cover if no logo
    const backgroundUrl = club.coverImageUrl;
    const initials = club.name.charAt(0).toUpperCase();

    // Stats display
    const statItems = [
        { label: "Posts", value: stats.posts, onClick: onPostsClick },
        { label: "Members", value: stats.members, onClick: onMembersClick },
    ];

    return (
        <div className="relative rounded-[36px] md:rounded-[44px] border border-white/10 shadow-2xl ring-1 ring-white/5">
            {/* Shared Background Image Layer */}
            {backgroundUrl && (
                <div className="absolute inset-0 z-0 overflow-hidden rounded-[36px] md:rounded-[44px]">
                    <img
                        src={backgroundUrl}
                        alt=""
                        className="h-full w-full object-cover transition-opacity duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-[#0A0A0A]" />
                </div>
            )}

            {/* Content Container */}
            <div className="relative z-10 p-2 pb-4 space-y-3 md:p-4 md:space-y-4">
                {/* Main Club Card */}
                <div className="w-full overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] backdrop-blur-sm shadow-lg ring-1 ring-white/5">
                    {/* Foreground Content */}
                    <div className="space-y-4 p-4 md:space-y-6 md:p-6">
                        {/* Top Section: Avatar & Identity */}
                        <div className="flex items-center gap-4 md:gap-6">
                            <div className="relative shrink-0">
                                <div className="h-16 w-16 overflow-hidden rounded-full border border-white/10 bg-neutral-800 md:h-20 md:w-20">
                                    {avatarUrl ? (
                                        <img
                                            src={avatarUrl}
                                            alt={club.name}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-500/20 to-orange-600/20 text-xl font-bold text-white/50 md:text-2xl">
                                            {initials}
                                        </div>
                                    )}
                                </div>
                                {club.isPrivate && (
                                    <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-black/60 shadow-md backdrop-blur-xl">
                                        <LockClosedIcon className="h-3.5 w-3.5 text-white/70" />
                                    </div>
                                )}
                            </div>

                            <div className="min-w-0 flex-1">
                                <div className="flex flex-col">
                                    <h1 className="flex items-center gap-1.5 truncate text-2xl font-semibold tracking-tight text-white md:text-3xl">
                                        {club.name}
                                        {club.isVerified && (
                                            <CheckBadgeIcon className="h-6 w-6 shrink-0 text-blue-500 md:h-7 md:w-7" />
                                        )}
                                    </h1>
                                    <p className="text-sm text-neutral-400 md:text-base line-clamp-1">
                                        {club.category || "General"} • {club.isPrivate ? "Private" : "Public"} Group
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Description - Below Avatar */}
                        {club.description && (
                            <div className="mt-3">
                                <p className="text-sm text-neutral-400 md:text-base line-clamp-2">
                                    {club.description}
                                </p>
                            </div>
                        )}

                        {/* Stats Row - Capsules */}
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 px-0.5">
                            {statItems.map((stat) => (
                                <button
                                    key={stat.label}
                                    onClick={stat.onClick}
                                    className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-0.5 ring-1 ring-white/20 transition-all hover:bg-white/10 cursor-pointer active:scale-95"
                                >
                                    <span className="text-xs font-bold text-white">{stat.value}</span>
                                    <span className="text-[9px] font-bold uppercase tracking-tight text-neutral-400">{stat.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Action Buttons Row */}
                <div className="flex items-center gap-2">
                    {/* Primary Action Button (Join/Joined) */}
                    {isPending ? (
                        <button
                            onClick={onLeave}
                            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-neutral-800 text-base font-semibold text-white/60 transition-transform active:scale-[0.98]"
                        >
                            Pending
                        </button>
                    ) : isMember ? (
                        <button
                            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-white/10 text-base font-semibold text-neutral-400 cursor-default"
                        >
                            Joined
                        </button>
                    ) : (
                        <button
                            onClick={onJoin}
                            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#ffb200] text-base font-semibold text-black transition-transform active:scale-[0.98]"
                        >
                            {club.isPrivate ? "Request to Join" : "Join Club"}
                        </button>
                    )}

                    {/* Secondary Actions */}
                    <ActionControls
                        isAdmin={isAdmin}
                        isMember={isMember}
                        onInvite={onInvite}
                        onSettings={onSettings}
                        onLeave={onLeave}
                        onReport={onReport}
                    />
                </div>
            </div>
        </div >
    );
}

// Sub-component for Action Controls
function ActionControls({
    isAdmin,
    isMember,
    onInvite,
    onSettings,
    onLeave,
    onReport
}: {
    isAdmin: boolean;
    isMember: boolean;
    onInvite?: () => void;
    onSettings?: () => void;
    onLeave?: () => void;
    onReport?: () => void;
}) {
    // Menu Items Definition
    // Admin: Settings, Share, Leave
    // Member: Share, Leave, Report
    // Public: Share, Report

    return (
        <>
            {/* Desktop: Horizontal Row (Settings only) */}
            <div className="hidden md:flex items-center gap-2">
                {onInvite && (
                    <IconButton onClick={onInvite} icon={ArrowUpOnSquareIcon} />
                )}
                {isAdmin && onSettings && (
                    <IconButton onClick={onSettings} icon={Cog6ToothIcon} />
                )}

                {/* Overflow Menu for desktop too? Profile has 'More' button. */}
                <Menu as="div" className="relative">
                    <Menu.Button as="div">
                        <IconButton icon={EllipsisHorizontalIcon} />
                    </Menu.Button>
                    <Transition
                        enter="transition ease-out duration-200"
                        enterFrom="transform opacity-0 scale-95"
                        enterTo="transform opacity-100 scale-100"
                        leave="transition ease-in duration-150"
                        leaveFrom="transform opacity-100 scale-100"
                        leaveTo="transform opacity-0 scale-95"
                    >
                        <Menu.Items className="absolute right-0 top-full mt-2 z-50 w-56 origin-top-right divide-y divide-secondary/10 overflow-hidden cc-radius-menu cc-glass-strong cc-glass-highlight focus:outline-none">
                            <div className="p-1.5">
                                {isMember && (
                                    <Menu.Item>
                                        {({ active }) => (
                                            <button onClick={onLeave} className={`${active ? 'bg-secondary/20' : ''} group flex w-full items-center gap-3 rounded-full px-3 py-3 text-[17px] text-red-500 transition-colors`}>
                                                <ArrowRightOnRectangleIcon className="h-[22px] w-[22px]" />
                                                <span>Leave Club</span>
                                            </button>
                                        )}
                                    </Menu.Item>
                                )}
                                {!isMember && onReport && (
                                    <Menu.Item>
                                        {({ active }) => (
                                            <button onClick={onReport} className={`${active ? 'bg-secondary/20' : ''} group flex w-full items-center gap-3 rounded-full px-3 py-3 text-[17px] text-red-500 transition-colors`}>
                                                <ExclamationTriangleIcon className="h-[22px] w-[22px]" />
                                                <span>Report Club</span>
                                            </button>
                                        )}
                                    </Menu.Item>
                                )}
                            </div>
                        </Menu.Items>
                    </Transition>
                </Menu>
            </div>

            {/* Mobile: Single Menu Button */}
            <Menu as="div" className="relative md:hidden">
                <Menu.Button className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2C2C2E]/80 text-white backdrop-blur-md transition-all active:scale-95 hover:bg-[#3A3A3C]">
                    <EllipsisHorizontalIcon className="h-6 w-6" />
                </Menu.Button>

                <Transition
                    enter="transition ease-out duration-200"
                    enterFrom="transform opacity-0 scale-95"
                    enterTo="transform opacity-100 scale-100"
                    leave="transition ease-in duration-150"
                    leaveFrom="transform opacity-100 scale-100"
                    leaveTo="transform opacity-0 scale-95"
                >
                    <Menu.Items className="absolute right-0 top-full mt-2 z-50 w-56 origin-top-right divide-y divide-secondary/10 overflow-hidden cc-radius-menu cc-glass-strong cc-glass-highlight focus:outline-none">

                        {/* Standard Actions */}
                        <div className="p-1.5">
                            <Menu.Item>
                                {({ active }) => (
                                    <button onClick={onInvite} className={`${active ? 'bg-secondary/20' : ''} group flex w-full items-center gap-3 rounded-full px-3 py-3 text-[17px] text-foreground transition-colors`}>
                                        <ArrowUpOnSquareIcon className="h-[22px] w-[22px] text-foreground" />
                                        <span>Share Club</span>
                                    </button>
                                )}
                            </Menu.Item>

                            {isAdmin && onSettings && (
                                <Menu.Item>
                                    {({ active }) => (
                                        <button onClick={onSettings} className={`${active ? 'bg-secondary/20' : ''} group flex w-full items-center gap-3 rounded-full px-3 py-3 text-[17px] text-foreground transition-colors`}>
                                            <Cog6ToothIcon className="h-[22px] w-[22px] text-foreground" />
                                            <span>Settings</span>
                                        </button>
                                    )}
                                </Menu.Item>
                            )}
                        </div>

                        {/* Destructive Actions */}
                        <div className="p-1.5">
                            {isMember && (
                                <Menu.Item>
                                    {({ active }) => (
                                        <button onClick={onLeave} className={`${active ? 'bg-secondary/20' : ''} group flex w-full items-center gap-3 rounded-full px-3 py-3 text-[17px] text-red-500 transition-colors`}>
                                            <ArrowRightOnRectangleIcon className="h-[22px] w-[22px]" />
                                            <span>Leave Club</span>
                                        </button>
                                    )}
                                </Menu.Item>
                            )}
                            {!isMember && onReport && (
                                <Menu.Item>
                                    {({ active }) => (
                                        <button onClick={onReport} className={`${active ? 'bg-secondary/20' : ''} group flex w-full items-center gap-3 rounded-full px-3 py-3 text-[17px] text-red-500 transition-colors`}>
                                            <ExclamationTriangleIcon className="h-[22px] w-[22px]" />
                                            <span>Report Club</span>
                                        </button>
                                    )}
                                </Menu.Item>
                            )}
                        </div>
                    </Menu.Items>
                </Transition>
            </Menu>
        </>
    );
}

function IconButton({ onClick, icon: Icon, variant = 'default' }: { onClick?: () => void, icon: React.ElementType, variant?: 'default' | 'danger' }) {
    const isDanger = variant === 'danger';
    return (
        <button
            onClick={onClick}
            className={`flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md transition-all active:scale-95 border ${isDanger
                ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/30'
                : 'bg-[#2C2C2E]/80 text-white hover:bg-[#3A3A3C] border-white/10'
                }`}
        >
            <Icon className="h-6 w-6" />
        </button>
    )
}
