"use client";

import React, { useState, Fragment, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Club, JoinStatus } from "../../lib/clubs";
import {
    UserGroupIcon,
    Cog6ToothIcon,
    EllipsisHorizontalIcon,
    ArrowUpOnSquareIcon,
    ExclamationTriangleIcon,
    ArrowRightOnRectangleIcon,
    LockClosedIcon,
    HomeIcon
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
        <div className="relative cc-section cc-radius-24 overflow-visible">
            {/* Shared Background Image Layer */}
            {backgroundUrl && (
                <div className="absolute inset-0 z-0 overflow-hidden cc-radius-24">
                    <img
                        src={backgroundUrl}
                        alt=""
                        className="!h-full !w-full object-cover object-center transition-opacity duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-secondary/10 to-background/90" />
                </div>
            )}

            {/* Content Container */}
            <div className="relative z-10 p-2 pb-4 space-y-3 md:p-4 md:space-y-4">
                {/* Main Club Card */}
                <div className="w-full overflow-hidden cc-radius-24 border border-secondary/20 cc-glass-strong shadow-lg">
                    {/* Foreground Content */}
                    <div className="space-y-4 p-4 md:space-y-6 md:p-6">
                        {/* Top Section: Avatar & Identity */}
                        <div className="flex items-center gap-4 md:gap-6">
                            <div className="relative shrink-0">
                                <div className="h-16 w-16 overflow-hidden rounded-2xl cc-avatar md:h-20 md:w-20 shadow-md">
                                    {avatarUrl ? (
                                        <img
                                            src={avatarUrl}
                                            alt={club.name}
                                            className="!h-full !w-full object-cover object-center"
                                        />
                                    ) : (club.category === "dorm" || (club as any).type === "dorm" || (club as any).isDorm || club.name?.toLowerCase().includes("dorm")) ? (
                                        <div className="flex h-full w-full items-center justify-center bg-secondary/10 border border-secondary/25 text-secondary">
                                            <HomeIcon className="h-8 w-8 md:h-10 md:w-10" />
                                        </div>
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-secondary/10 text-xl font-bold text-foreground md:text-2xl">
                                            {initials}
                                        </div>
                                    )}
                                </div>
                                {club.isPrivate && (
                                    <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-secondary/20 shadow-md backdrop-blur-xl border border-secondary/25">
                                        <LockClosedIcon className="h-3.5 w-3.5 text-foreground/70" />
                                    </div>
                                )}
                            </div>

                            <div className="min-w-0 flex-1">
                                <div className="flex flex-col">
                                    <h1 className="flex items-center gap-1.5 truncate text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                                        {club.name}
                                        {club.isVerified && (
                                            <CheckBadgeIcon className="h-6 w-6 shrink-0 text-brand md:h-7 md:w-7" />
                                        )}
                                    </h1>
                                    <p className="text-sm cc-muted md:text-base line-clamp-1">
                                        {club.category || "General"} • {club.isPrivate ? "Private" : "Public"} Group
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Description - Below Avatar */}
                        {club.description && (
                            <div className="mt-3">
                                <p className="text-sm cc-muted md:text-base line-clamp-2">
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
                                    className="flex shrink-0 items-center gap-1.5 rounded-full bg-secondary/10 px-2.5 py-0.5 border border-secondary/25 transition-all hover:bg-secondary/16 cursor-pointer active:scale-95"
                                >
                                    <span className="text-xs font-bold text-foreground">{stat.value}</span>
                                    <span className="text-[9px] font-bold uppercase tracking-tight cc-muted">{stat.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Action Buttons Row */}
                <div className="relative flex items-center gap-2">
                    {/* Primary Action Button (Join/Joined) */}
                    {isPending ? (
                        <button
                            onClick={onLeave}
                            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full cc-header-btn text-base font-semibold text-secondary transition-transform active:scale-[0.98]"
                        >
                            Pending
                        </button>
                    ) : isMember ? (
                        <button
                            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full cc-header-btn text-base font-semibold text-secondary cursor-default"
                        >
                            Joined
                        </button>
                    ) : (
                        <button
                            onClick={onJoin}
                            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-brand text-base font-semibold text-brand-foreground transition-transform active:scale-[0.98]"
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
    const [desktopMenuOpen, setDesktopMenuOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
        <>
            {/* Desktop: Icon Buttons + Overflow Menu */}
            <div className="hidden md:flex items-center gap-2 shrink-0">
                {onInvite && (
                    <IconButton onClick={onInvite} icon={ArrowUpOnSquareIcon} />
                )}
                {isAdmin && onSettings && (
                    <IconButton onClick={onSettings} icon={Cog6ToothIcon} />
                )}

                {/* Desktop Overflow Menu */}
                <div className="relative">
                    <div onClick={(e) => {
                        e.stopPropagation();
                        setDesktopMenuOpen((v) => !v);
                    }}>
                        <IconButton icon={EllipsisHorizontalIcon} />
                    </div>

                    {desktopMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setDesktopMenuOpen(false)} />
                            <div className="absolute bottom-full right-0 z-50 mb-2 min-w-[180px] overflow-hidden cc-radius-menu cc-glass-strong">
                                <div className="p-1.5">
                                    {isMember && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onLeave?.();
                                                setDesktopMenuOpen(false);
                                            }}
                                            className="flex w-full items-center justify-between rounded-full px-3 py-2 text-sm text-red-600 hover:bg-red-500/10 dark:text-red-400 transition-colors"
                                        >
                                            <span className="font-medium">Leave Club</span>
                                            <ArrowRightOnRectangleIcon className="h-4 w-4" />
                                        </button>
                                    )}
                                    {!isMember && onReport && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onReport();
                                                setDesktopMenuOpen(false);
                                            }}
                                            className="flex w-full items-center justify-between rounded-full px-3 py-2 text-sm text-red-600 hover:bg-red-500/10 dark:text-red-400 transition-colors"
                                        >
                                            <span className="font-medium">Report Club</span>
                                            <ExclamationTriangleIcon className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Mobile: Single Menu Button with All Actions */}
            <div className="relative md:hidden shrink-0">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setMobileMenuOpen((v) => !v);
                    }}
                    className="flex h-11 w-11 items-center justify-center rounded-full cc-header-btn text-foreground transition-all active:scale-95"
                >
                    <EllipsisHorizontalIcon className="h-6 w-6" />
                </button>

                {mobileMenuOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setMobileMenuOpen(false)} />
                        <div className="absolute bottom-full right-0 z-50 mb-2 min-w-[180px] overflow-hidden cc-radius-menu cc-glass-strong">
                            <div className="p-1.5">
                                {onInvite && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onInvite();
                                            setMobileMenuOpen(false);
                                        }}
                                        className="flex w-full items-center justify-between rounded-full px-3 py-2 text-sm text-foreground hover:bg-secondary/20 transition-colors"
                                    >
                                        <span className="font-medium">Share Club</span>
                                        <ArrowUpOnSquareIcon className="h-4 w-4" />
                                    </button>
                                )}

                                {isAdmin && onSettings && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSettings();
                                            setMobileMenuOpen(false);
                                        }}
                                        className="flex w-full items-center justify-between rounded-full px-3 py-2 text-sm text-foreground hover:bg-secondary/20 transition-colors"
                                    >
                                        <span className="font-medium">Settings</span>
                                        <Cog6ToothIcon className="h-4 w-4" />
                                    </button>
                                )}
                            </div>

                            {/* Destructive Actions */}
                            {(isMember || (!isMember && onReport)) && (
                                <div className="p-1.5 border-t border-secondary/10">
                                    {isMember && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onLeave?.();
                                                setMobileMenuOpen(false);
                                            }}
                                            className="flex w-full items-center justify-between rounded-full px-3 py-2 text-sm text-red-600 hover:bg-red-500/10 dark:text-red-400 transition-colors"
                                        >
                                            <span className="font-medium">Leave Club</span>
                                            <ArrowRightOnRectangleIcon className="h-4 w-4" />
                                        </button>
                                    )}
                                    {!isMember && onReport && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onReport();
                                                setMobileMenuOpen(false);
                                            }}
                                            className="flex w-full items-center justify-between rounded-full px-3 py-2 text-sm text-red-600 hover:bg-red-500/10 dark:text-red-400 transition-colors"
                                        >
                                            <span className="font-medium">Report Club</span>
                                            <ExclamationTriangleIcon className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </>
    );
}

function IconButton({ onClick, icon: Icon, variant = 'default' }: { onClick?: () => void, icon: React.ElementType, variant?: 'default' | 'danger' }) {
    const isDanger = variant === 'danger';
    return (
        <button
            onClick={onClick}
            className={`flex h-11 w-11 items-center justify-center rounded-full transition-all active:scale-95 ${isDanger
                ? 'bg-red-500/10 text-red-500 hover:bg-red-500/16 border border-red-500/25 backdrop-blur-md'
                : 'cc-header-btn text-foreground'
                }`}
        >
            <Icon className="h-6 w-6" />
        </button>
    )
}
