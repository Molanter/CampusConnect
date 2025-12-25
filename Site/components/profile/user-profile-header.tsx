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
    universityId?: string;
    universityName?: string;
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
    universityId,
    universityName,
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
    const [universityLogoUrl, setUniversityLogoUrl] = useState<string | null>(null);
    const [logoLoading, setLogoLoading] = useState(false);

    // Fetch university logo
    useEffect(() => {
        if (!universityId) return;

        const fetchUniversityLogo = async () => {
            setLogoLoading(true);
            try {
                // Fetch university document to get shortName
                const uniDoc = await getDoc(doc(db, "universities", universityId));
                if (uniDoc.exists()) {
                    const shortName = uniDoc.data().shortName;
                    if (shortName) {
                        // Get download URL from Storage
                        const logoPath = `universities/${universityId}/${shortName}.png`;
                        const logoRef = ref(storage, logoPath);
                        const url = await getDownloadURL(logoRef);
                        setUniversityLogoUrl(url);
                    }
                }
            } catch (error) {
                console.error("Error fetching university logo:", error);
                setUniversityLogoUrl(null);
            } finally {
                setLogoLoading(false);
            }
        };

        fetchUniversityLogo();
    }, [universityId]);

    // Build info line: University • Year • Major
    const infoLine = [universityName, yearOfStudy, major]
        .filter(Boolean)
        .join(" • ");

    const effectiveBgUrl = backgroundImageUrl || photoURL;

    return (
        <div className="relative rounded-[36px] md:rounded-[44px] border border-white/10 shadow-2xl ring-1 ring-white/5">
            {/* Shared Background Image Layer */}
            {effectiveBgUrl && (
                <div className="absolute inset-0 z-0 overflow-hidden rounded-[36px] md:rounded-[44px]">
                    <img
                        src={effectiveBgUrl}
                        alt=""
                        className="h-full w-full object-cover transition-opacity duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-[#0A0A0A]" />
                </div>
            )}

            {/* Content Container */}
            <div className="relative z-10 p-2 pb-4 space-y-3 md:p-4 md:space-y-4">
                {/* Main Profile Card */}
                <div className="w-full overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] backdrop-blur-md shadow-lg ring-1 ring-white/5">
                    {/* Foreground Content */}
                    <div className="space-y-4 p-4 md:space-y-6 md:p-6">
                        {/* Top Section: Avatar & Identity */}
                        <div className="flex items-center gap-4 md:gap-6">
                            <div className="relative shrink-0">
                                <div className="h-16 w-16 overflow-hidden rounded-full border border-white/10 bg-neutral-800 md:h-20 md:w-20">
                                    {photoURL ? (
                                        <img
                                            src={photoURL}
                                            alt={displayName}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-500/20 to-purple-600/20 text-xl font-bold text-white/50 md:text-2xl">
                                            {initials}
                                        </div>
                                    )}
                                </div>

                                {/* University Logo Badge */}
                                {universityLogoUrl && (
                                    <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/15 p-0.5 shadow-md backdrop-blur-xl">
                                        <img
                                            src={universityLogoUrl}
                                            alt="University logo"
                                            className="h-full w-full rounded-full object-contain"
                                        />
                                    </div>
                                )}
                                {!universityLogoUrl && universityId && !logoLoading && (
                                    <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/15 shadow-md backdrop-blur-xl">
                                        <AcademicCapIcon className="h-3.5 w-3.5 text-white/40" />
                                    </div>
                                )}
                            </div>

                            <div className="min-w-0 flex-1">
                                <div className="flex flex-col">
                                    <h1 className="truncate text-2xl font-semibold tracking-tight text-white md:text-3xl">
                                        {displayName}
                                    </h1>
                                    {username && (
                                        <p className="text-sm text-neutral-400 md:text-base">
                                            {username}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Info Line: University • Year • Major - Below Avatar */}
                        {infoLine && (
                            <div className="mt-3">
                                <p className="text-sm text-neutral-400 md:text-base">
                                    {infoLine}
                                </p>
                            </div>
                        )}

                        {/* Stats Row - Capsules with Strokes */}
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 px-0.5">
                            <button
                                onClick={onPostsClick}
                                className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-0.5 ring-1 ring-white/20 transition-all hover:bg-white/10 cursor-pointer active:scale-95"
                            >
                                <span className="text-xs font-bold text-white">{stats.posts}</span>
                                <span className="text-[9px] font-bold uppercase tracking-tight text-neutral-400">Posts</span>
                            </button>
                            <button
                                onClick={onClubsClick}
                                className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-0.5 ring-1 ring-white/20 transition-all hover:bg-white/10 cursor-pointer active:scale-95"
                            >
                                <span className="text-xs font-bold text-white">{stats.clubs || 0}</span>
                                <span className="text-[9px] font-bold uppercase tracking-tight text-neutral-400">Clubs</span>
                            </button>
                            <button
                                onClick={onFollowersClick}
                                className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-0.5 ring-1 ring-white/20 transition-all hover:bg-white/10 cursor-pointer active:scale-95"
                            >
                                <span className="text-xs font-bold text-white">{stats.followers}</span>
                                <span className="text-[9px] font-bold uppercase tracking-tight text-neutral-400">Followers</span>
                            </button>
                            <button
                                onClick={onFollowingClick}
                                className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-0.5 ring-1 ring-white/20 transition-all hover:bg-white/10 cursor-pointer active:scale-95"
                            >
                                <span className="text-xs font-bold text-white">{stats.following}</span>
                                <span className="text-[9px] font-bold uppercase tracking-tight text-neutral-400">Following</span>
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
                            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-white text-base font-semibold text-black transition-transform active:scale-[0.98]"
                        >
                            <PencilIcon className="h-4 w-4 stroke-[2.5]" />
                            Edit Profile
                        </button>
                    ) : (
                        <button
                            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#ffb200] text-base font-semibold text-black transition-transform active:scale-[0.98]"
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
    // Menu Items Definition for Apple-style list
    const menuItems = [
        { label: "Share Profile", icon: ArrowUpOnSquareIcon, action: onShare },
        { label: "Settings", icon: Cog6ToothIcon, action: onSettings, condition: isOwnProfile },
        { label: "Report User", icon: ExclamationTriangleIcon, action: onReport, condition: !isOwnProfile, divider: true },
        { label: "Sign Out", icon: ArrowRightOnRectangleIcon, action: onSignOut, condition: isOwnProfile, destructive: true, divider: true },
    ].filter(item => item.condition !== false);

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
                <IconButton onClick={onMore} icon={EllipsisHorizontalIcon} />
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
                    <Menu.Items className="absolute right-0 top-full mt-2 z-50 w-56 origin-top-right divide-y divide-white/5 rounded-3xl border border-white/10 bg-[#1C1C1E]/90 backdrop-blur-xl shadow-2xl ring-1 ring-black/5 focus:outline-none">

                        {/* Standard Actions */}
                        <div className="p-1.5">
                            <Menu.Item>
                                {({ active }) => (
                                    <button onClick={onShare} className={`${active ? 'bg-white/10' : ''} group flex w-full items-center gap-3 rounded-lg px-3 py-3 text-[17px] text-white transition-colors`}>
                                        <ArrowUpOnSquareIcon className="h-[22px] w-[22px] text-white" />
                                        <span>Share Profile</span>
                                    </button>
                                )}
                            </Menu.Item>

                            {isOwnProfile && onSettings && (
                                <Menu.Item>
                                    {({ active }) => (
                                        <button onClick={onSettings} className={`${active ? 'bg-white/10' : ''} group flex w-full items-center gap-3 rounded-lg px-3 py-3 text-[17px] text-white transition-colors`}>
                                            <Cog6ToothIcon className="h-[22px] w-[22px] text-white" />
                                            <span>Settings</span>
                                        </button>
                                    )}
                                </Menu.Item>
                            )}
                        </div>

                        {/* Destructive / Report Actions */}
                        {(onSignOut || (!isOwnProfile && onReport)) && (
                            <div className="p-1.5">
                                {isOwnProfile && onSignOut && (
                                    <Menu.Item>
                                        {({ active }) => (
                                            <button onClick={onSignOut} className={`${active ? 'bg-white/10' : ''} group flex w-full items-center gap-3 rounded-lg px-3 py-3 text-[17px] text-red-500 transition-colors`}>
                                                <ArrowRightOnRectangleIcon className="h-[22px] w-[22px]" />
                                                <span>Sign Out</span>
                                            </button>
                                        )}
                                    </Menu.Item>
                                )}
                                {!isOwnProfile && onReport && (
                                    <Menu.Item>
                                        {({ active }) => (
                                            <button onClick={onReport} className={`${active ? 'bg-white/10' : ''} group flex w-full items-center gap-3 rounded-lg px-3 py-3 text-[17px] text-red-500 transition-colors`}>
                                                <ExclamationTriangleIcon className="h-[22px] w-[22px]" />
                                                <span>Report User</span>
                                            </button>
                                        )}
                                    </Menu.Item>
                                )}
                            </div>
                        )}
                    </Menu.Items>
                </Transition>
            </Menu>
        </>
    );
}

function IconButton({ onClick, icon: Icon }: { onClick?: () => void, icon: React.ElementType }) {
    return (
        <button
            onClick={onClick}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2C2C2E]/80 text-white backdrop-blur-md transition-all active:scale-95 hover:bg-[#3A3A3C]"
        >
            <Icon className="h-6 w-6" />
        </button>
    )
}
