"use client";

import React, { useEffect, useState } from "react";
import { UserGroupIcon, Cog6ToothIcon, EllipsisHorizontalIcon, PencilIcon, AcademicCapIcon, ArrowRightOnRectangleIcon, ArrowUpOnSquareIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Menu, Transition } from "@headlessui/react";
import { doc, getDoc } from "firebase/firestore";
import { ref, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";

interface UserProfileHeaderProps {
    displayName: string;
    username?: string;
    photoURL?: string;
    campusId?: string;       // Renamed from universityId
    campusName?: string;     // Renamed from universityName
    yearOfStudy?: string;
    major?: string;
    backgroundImageUrl?: string;
    isOwnProfile?: boolean;
    stats?: {
        posts: number;
        clubs?: number;
        followers: number;
        following: number;
    };
    onEdit?: () => void;
    onSettings?: () => void;
    onShare?: () => void;
    onMore?: () => void;
    onSignOut?: () => void;
    onReport?: () => void;
    onPostsClick?: () => void;
    onClubsClick?: () => void;
    onFollowersClick?: () => void;
    onFollowingClick?: () => void;
}

export function UserProfileHeader({
    displayName,
    username,
    photoURL,
    campusId,          // Renamed
    campusName,        // Renamed
    yearOfStudy,
    major,
    backgroundImageUrl,
    isOwnProfile,
    stats = { posts: 0, followers: 0, following: 0 },
    onEdit,
    onSettings,
    onShare,
    onMore,
    onSignOut,
    onReport,
    onPostsClick,
    onClubsClick,
    onFollowersClick,
    onFollowingClick,
}: UserProfileHeaderProps) {
    const initials = displayName.charAt(0).toUpperCase();
    const [campusLogoUrl, setCampusLogoUrl] = useState<string | null>(null);
    const [logoLoading, setLogoLoading] = useState(false);

    // Fetch campus logo from campuses collection
    useEffect(() => {
        if (!campusId) return;

        const fetchCampusLogo = async () => {
            setLogoLoading(true);
            try {
                // Fetch campus document directly from campuses collection
                const campusDocRef = doc(db, "campuses", campusId);
                const campusDoc = await getDoc(campusDocRef);

                if (campusDoc.exists()) {
                    const campusData = campusDoc.data();
                    if (campusData.logoUrl) {
                        setCampusLogoUrl(campusData.logoUrl);
                    } else {
                        setCampusLogoUrl(null);
                    }
                } else {
                    setCampusLogoUrl(null);
                }
            } catch (error) {
                console.error("Error fetching campus logo:", error);
                setCampusLogoUrl(null);
            } finally {
                setLogoLoading(false);
            }
        };

        fetchCampusLogo();
    }, [campusId]);

    // Build info line: Campus • Year • Major
    const infoLine = [campusName, yearOfStudy, major]
        .filter(Boolean)
        .join(" • ");

    const effectiveBgUrl = backgroundImageUrl || photoURL;

    return (
        <div className="relative cc-section cc-radius-24 overflow-visible">
            {/* Shared Background Image Layer */}
            {effectiveBgUrl && (
                <div className="absolute inset-0 z-0 overflow-hidden cc-radius-24">
                    <img
                        src={effectiveBgUrl}
                        alt=""
                        className="!h-full !w-full object-cover object-center transition-opacity duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-secondary/10 to-background/90" />
                </div>
            )}

            {/* Content Container */}
            <div className="relative z-10 p-2 pb-4 space-y-3 md:p-4 md:space-y-4">
                {/* Main Profile Card */}
                <div className="w-full overflow-hidden cc-radius-24 border border-secondary/20 cc-glass-strong shadow-lg">
                    {/* Foreground Content */}
                    <div className="space-y-4 p-4 md:space-y-6 md:p-6">
                        {/* Top Section: Avatar & Identity */}
                        <div className="flex items-center gap-4 md:gap-6">
                            <div className="relative shrink-0">
                                <div className="h-16 w-16 overflow-hidden rounded-full cc-avatar bg-surface-2 md:h-20 md:w-20 shadow-md">
                                    {photoURL ? (
                                        <img
                                            src={photoURL}
                                            alt={displayName}
                                            className="!h-full !w-full object-cover object-center"
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-secondary/10 text-xl font-bold text-foreground md:text-2xl">
                                            {initials}
                                        </div>
                                    )}
                                </div>

                                {/* Campus Logo Badge */}
                                {campusLogoUrl && (
                                    <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-secondary/20 shadow-md backdrop-blur-xl border border-secondary/25 p-0.5">
                                        <img
                                            src={campusLogoUrl}
                                            alt="Campus logo"
                                            className="h-full w-full rounded-full object-contain"
                                        />
                                    </div>
                                )}
                                {!campusLogoUrl && campusId && !logoLoading && (
                                    <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-secondary/20 shadow-md backdrop-blur-xl border border-secondary/25">
                                        <AcademicCapIcon className="h-3.5 w-3.5 text-foreground/70" />
                                    </div>
                                )}
                            </div>

                            <div className="min-w-0 flex-1">
                                <div className="flex flex-col">
                                    <h1 className="line-clamp-2 text-xl font-semibold tracking-tight text-foreground md:text-3xl">
                                        {displayName}
                                    </h1>
                                    {username && (
                                        <p className="text-sm cc-muted md:text-base">
                                            {username}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Info Line: University • Year • Major - Below Avatar */}
                        {infoLine && (
                            <div className="mt-3">
                                <p className="text-sm cc-muted md:text-base">
                                    {infoLine}
                                </p>
                            </div>
                        )}

                        {/* Stats Row - Capsules with Strokes */}
                        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-0.5 px-0.5">
                            <button
                                onClick={onPostsClick}
                                className="flex shrink-0 items-center gap-1.5 rounded-full bg-secondary/10 px-2.5 py-0.5 border border-secondary/25 transition-all hover:bg-secondary/16 cursor-pointer active:scale-95"
                            >
                                <span className="text-xs font-bold text-foreground">{stats.posts}</span>
                                <span className="text-[9px] font-bold uppercase tracking-tight cc-muted">Posts</span>
                            </button>
                            <button
                                onClick={onClubsClick}
                                className="flex shrink-0 items-center gap-1.5 rounded-full bg-secondary/10 px-2.5 py-0.5 border border-secondary/25 transition-all hover:bg-secondary/16 cursor-pointer active:scale-95"
                            >
                                <span className="text-xs font-bold text-foreground">{stats.clubs || 0}</span>
                                <span className="text-[9px] font-bold uppercase tracking-tight cc-muted">Clubs</span>
                            </button>
                            <button
                                onClick={onFollowersClick}
                                className="flex shrink-0 items-center gap-1.5 rounded-full bg-secondary/10 px-2.5 py-0.5 border border-secondary/25 transition-all hover:bg-secondary/16 cursor-pointer active:scale-95"
                            >
                                <span className="text-xs font-bold text-foreground">{stats.followers}</span>
                                <span className="text-[9px] font-bold uppercase tracking-tight cc-muted">Followers</span>
                            </button>
                            <button
                                onClick={onFollowingClick}
                                className="flex shrink-0 items-center gap-1.5 rounded-full bg-secondary/10 px-2.5 py-0.5 border border-secondary/25 transition-all hover:bg-secondary/16 cursor-pointer active:scale-95"
                            >
                                <span className="text-xs font-bold text-foreground">{stats.following}</span>
                                <span className="text-[9px] font-bold uppercase tracking-tight cc-muted">Following</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Action Buttons Row - Below Card */}
                <div className="flex items-center gap-2">
                    {/* Primary Action Button (Edit or Follow) */}
                    {isOwnProfile ? (
                        <button
                            onClick={onEdit}
                            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full cc-header-btn text-base font-semibold text-foreground transition-transform active:scale-[0.98]"
                        >
                            <PencilIcon className="h-4 w-4 stroke-[2.5]" />
                            Edit Profile
                        </button>
                    ) : (
                        <button
                            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-brand text-base font-semibold text-brand-foreground transition-transform active:scale-[0.98]"
                        >
                            Follow
                        </button>
                    )}

                    {/* Secondary Actions - Desktop (Row) / Mobile (Menu) */}
                    <ActionControls
                        isOwnProfile={isOwnProfile}
                        onShare={onShare}
                        onSettings={onSettings}
                        onMore={onMore}
                        onReport={onReport}
                        onSignOut={onSignOut}
                    />
                </div>
            </div>
        </div>
    );
}

// Sub-component for clean Action Controls logic
function ActionControls({
    isOwnProfile,
    onShare,
    onSettings,
    onMore,
    onReport,
    onSignOut
}: {
    isOwnProfile?: boolean;
    onShare?: () => void;
    onSettings?: () => void;
    onMore?: () => void;
    onReport?: () => void;
    onSignOut?: () => void;
}) {
    const [desktopMenuOpen, setDesktopMenuOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
        <>
            {/* Desktop: Horizontal Row */}
            <div className="hidden md:flex items-center gap-2">
                {onShare && (
                    <IconButton onClick={onShare} icon={ArrowUpOnSquareIcon} />
                )}
                {isOwnProfile && onSettings && (
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
                                    {isOwnProfile && onSignOut && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSignOut?.();
                                                setDesktopMenuOpen(false);
                                            }}
                                            className="flex w-full items-center justify-between rounded-full px-3 py-2 text-sm text-red-600 hover:bg-red-500/10 dark:text-red-400 transition-colors"
                                        >
                                            <span className="font-medium">Sign Out</span>
                                            <ArrowRightOnRectangleIcon className="h-4 w-4" />
                                        </button>
                                    )}
                                    {!isOwnProfile && onReport && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onReport?.();
                                                setDesktopMenuOpen(false);
                                            }}
                                            className="flex w-full items-center justify-between rounded-full px-3 py-2 text-sm text-red-600 hover:bg-red-500/10 dark:text-red-400 transition-colors"
                                        >
                                            <span className="font-medium">Report User</span>
                                            <ExclamationTriangleIcon className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Mobile: Single Menu Button */}
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
                                {onShare && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onShare();
                                            setMobileMenuOpen(false);
                                        }}
                                        className="flex w-full items-center justify-between rounded-full px-3 py-2 text-sm text-foreground hover:bg-secondary/20 transition-colors"
                                    >
                                        <span className="font-medium">Share Profile</span>
                                        <ArrowUpOnSquareIcon className="h-4 w-4" />
                                    </button>
                                )}

                                {isOwnProfile && onSettings && (
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
                            {(onSignOut || (!isOwnProfile && onReport)) && (
                                <div className="p-1.5 border-t border-secondary/10">
                                    {isOwnProfile && onSignOut && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSignOut?.();
                                                setMobileMenuOpen(false);
                                            }}
                                            className="flex w-full items-center justify-between rounded-full px-3 py-2 text-sm text-red-600 hover:bg-red-500/10 dark:text-red-400 transition-colors"
                                        >
                                            <span className="font-medium">Sign Out</span>
                                            <ArrowRightOnRectangleIcon className="h-4 w-4" />
                                        </button>
                                    )}
                                    {!isOwnProfile && onReport && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onReport?.();
                                                setMobileMenuOpen(false);
                                            }}
                                            className="flex w-full items-center justify-between rounded-full px-3 py-2 text-sm text-red-600 hover:bg-red-500/10 dark:text-red-400 transition-colors"
                                        >
                                            <span className="font-medium">Report User</span>
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

function IconButton({ onClick, icon: Icon }: { onClick?: () => void, icon: React.ElementType }) {
    return (
        <button
            onClick={onClick}
            className="flex h-11 w-11 items-center justify-center rounded-full cc-header-btn text-foreground transition-all active:scale-95"
        >
            <Icon className="h-6 w-6" />
        </button>
    )
}
