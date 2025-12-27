"use client";

import { useRef, useState, useEffect } from "react";
import { Post } from "@/lib/posts";
import { Club, ClubMember } from "@/lib/clubs";
import { ClubTab, ClubTabs } from "./club-tabs";
import { PostCard } from "@/components/post-card";
import { MemberRow } from "./member-row";
import { CalendarDaysIcon, GlobeAltIcon } from "@heroicons/react/24/outline";

interface ClubPagerProps {
    tabs: { key: ClubTab; label: string }[];
    activeTab: ClubTab;
    onTabChange: (tab: ClubTab) => void;
    isNarrow: boolean;
    posts: Post[];
    members: ClubMember[];
    requests: ClubMember[];
    club: Club;
    membership: ClubMember | null;
    isGlobalAdminUser: boolean;
    handleUpdateMember?: (id: string, updates: Partial<ClubMember>) => void;
    handleRemoveMember?: (id: string) => void;
    openView: (view: any, data?: any) => void;
    fetchContent?: () => void;
    isLoading?: boolean;
}

export function ClubPager({
    tabs,
    activeTab,
    onTabChange,
    isNarrow,
    posts,
    members,
    requests,
    club,
    membership,
    isGlobalAdminUser,
    handleUpdateMember,
    handleRemoveMember,
    openView,
    fetchContent,
    isLoading = false
}: ClubPagerProps) {
    const pagerRef = useRef<HTMLDivElement>(null);
    const [isScrolling, setIsScrolling] = useState(false);
    const targetScrollPos = useRef<number | null>(null);
    const isProgrammaticScroll = useRef(false);

    // Sync scroll position when activeTab changes externally
    useEffect(() => {
        if (!pagerRef.current || isProgrammaticScroll.current) return;

        const index = tabs.findIndex(t => t.key === activeTab);
        if (index === -1) return;

        const width = pagerRef.current.clientWidth;
        if (width === 0) return; // Not visible yet

        const targetLeft = index * width;

        if (Math.abs(pagerRef.current.scrollLeft - targetLeft) > 10) {
            pagerRef.current.scrollTo({
                left: targetLeft,
                behavior: "smooth"
            });
        }
    }, [activeTab, tabs]);

    const handleTabClick = (key: ClubTab) => {
        onTabChange(key);
        if (!pagerRef.current) return;

        const index = tabs.findIndex((t: any) => t.key === key);
        if (index === -1) return;

        const width = pagerRef.current.clientWidth;
        const targetLeft = index * width;

        isProgrammaticScroll.current = true;
        targetScrollPos.current = targetLeft;
        setIsScrolling(true);

        pagerRef.current.scrollTo({
            left: targetLeft,
            behavior: "smooth"
        });

        setTimeout(() => {
            if (isProgrammaticScroll.current) {
                isProgrammaticScroll.current = false;
                targetScrollPos.current = null;
                setIsScrolling(false);
            }
        }, 1000);
    };

    const handleScroll = () => {
        if (!pagerRef.current) return;

        if (isProgrammaticScroll.current && targetScrollPos.current !== null) {
            const currentLeft = pagerRef.current.scrollLeft;
            const dist = Math.abs(currentLeft - targetScrollPos.current);
            if (dist < 10) {
                isProgrammaticScroll.current = false;
                targetScrollPos.current = null;
                setIsScrolling(false);
            } else {
                return;
            }
        }

        const scrollLeft = pagerRef.current.scrollLeft;
        const width = pagerRef.current.offsetWidth;
        if (width === 0) return;

        const index = Math.round(scrollLeft / width);
        const newTab = tabs[index]?.key;
        if (newTab && newTab !== activeTab) {
            onTabChange(newTab);
        }
    };

    return (
        <>
            <ClubTabs
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={handleTabClick}
                isNarrow={isNarrow}
            />

            <div
                ref={pagerRef}
                onScroll={handleScroll}
                className={`flex overflow-x-auto scrollbar-hide touch-pan-x ${isScrolling ? "overflow-hidden" : "snap-x snap-mandatory"} pb-8`}
                style={{ width: "100%" }}
            >
                {/* Posts Tab */}
                <div className="w-full shrink-0 snap-start px-1">
                    <div className="mx-auto w-full max-w-[680px]">
                        {isLoading ? (
                            <div className="flex justify-center py-20">
                                <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-[#ffb200]" />
                            </div>
                        ) : posts.length === 0 ? (
                            <div className="rounded-[28px] border border-dashed border-white/10 bg-[#1C1C1E]/50 p-12 text-center text-zinc-500">
                                No posts yet.
                            </div>
                        ) : (
                            posts.map((post: Post) => (
                                <PostCard
                                    key={post.id}
                                    post={post}
                                    variant="threads"
                                    onCommentsClick={() => openView("comments", post)}
                                    onLikesClick={() => openView("likes", post)}
                                    onAttendanceClick={() => openView("attendance", post)}
                                    onDetailsClick={() => openView("details", post)}
                                    onDeleted={fetchContent}
                                />
                            ))
                        )}
                    </div>
                </div>

                {/* Members Tab */}
                <div className="w-full shrink-0 snap-start px-1">
                    <div className="space-y-3">
                        <h2 className={`${isNarrow ? 'px-4' : 'px-6'} text-[13px] font-semibold uppercase tracking-wider text-neutral-500`}>
                            Members ({members.length})
                        </h2>
                        <div className="rounded-[28px] border border-white/10 bg-[#1C1C1E] shadow-lg">
                            <div className="divide-y divide-white/5">
                                {isLoading ? (
                                    <div className="p-12 text-center">
                                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-[#ffb200] mx-auto" />
                                    </div>
                                ) : members.length === 0 ? (
                                    <div className="p-12 text-center text-zinc-500">No members found.</div>
                                ) : (
                                    members.map((mem: ClubMember, index: number) => (
                                        <div
                                            key={mem.uid}
                                            className={`${isNarrow ? 'px-4' : 'px-6'} py-4 transition-colors hover:bg-white/5 ${index === 0 ? "rounded-t-[28px]" : ""} ${index === members.length - 1 ? "rounded-b-[28px]" : ""}`}
                                        >
                                            <MemberRow
                                                member={mem}
                                                currentUserRole={membership?.role || null}
                                                isGlobalAdmin={isGlobalAdminUser}
                                                onRoleChange={handleUpdateMember ? (_, newRole) => handleUpdateMember((mem as any)._docId, { role: newRole }) : undefined}
                                                onKick={handleRemoveMember ? () => handleRemoveMember((mem as any)._docId) : undefined}
                                            />
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* About Tab */}
                <div className="w-full shrink-0 snap-start px-1">
                    <div className="mx-auto w-full max-w-[680px] space-y-6">
                        <div className={`${isNarrow ? 'px-4' : 'px-6'} py-4 space-y-6`}>
                            <div className="rounded-[28px] border border-white/10 bg-[#1C1C1E] p-8 shadow-lg">
                                <h2 className="text-xl font-bold text-white mb-4">About {club.name}</h2>
                                <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">
                                    {club.description || "No description provided."}
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="rounded-[28px] border border-white/10 bg-[#1C1C1E] p-6 shadow-lg">
                                    <div className="flex items-center gap-3 mb-4 text-zinc-400">
                                        <CalendarDaysIcon className="h-6 w-6" />
                                        <h3 className="text-sm font-semibold uppercase tracking-wider">Created</h3>
                                    </div>
                                    <p className="text-lg font-bold text-white">
                                        {club.createdAt?.toDate ? club.createdAt.toDate().toLocaleDateString(undefined, {
                                            month: 'long',
                                            day: 'numeric',
                                            year: 'numeric'
                                        }) : "Unknown"}
                                    </p>
                                </div>

                                <div className="rounded-[28px] border border-white/10 bg-[#1C1C1E] p-6 shadow-lg">
                                    <div className="flex items-center gap-3 mb-4 text-zinc-400">
                                        <GlobeAltIcon className="h-6 w-6" />
                                        <h3 className="text-sm font-semibold uppercase tracking-wider">Privacy</h3>
                                    </div>
                                    <p className="text-lg font-bold text-white capitalize">
                                        {club.isPrivate ? "Private Group" : "Public Group"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Requests Tab (Conditional) */}
                {tabs.some((t: any) => t.key === 'requests') && (
                    <div className="w-full shrink-0 snap-start px-1">
                        <div className="space-y-3">
                            <h2 className={`${isNarrow ? 'px-4' : 'px-6'} text-[13px] font-semibold uppercase tracking-wider text-neutral-500`}>
                                Join Requests ({requests.length})
                            </h2>
                            <div className="rounded-[28px] border border-white/10 bg-[#1C1C1E] shadow-lg">
                                <div className="divide-y divide-white/5">
                                    {requests.length === 0 ? (
                                        <div className="p-12 text-center text-zinc-500">No pending requests.</div>
                                    ) : (
                                        requests.map((mem: ClubMember, index: number) => (
                                            <div
                                                key={mem.uid}
                                                className={`${isNarrow ? 'px-4' : 'px-6'} py-4 transition-colors hover:bg-white/5 ${index === 0 ? "rounded-t-[28px]" : ""} ${index === members.length - 1 ? "rounded-b-[28px]" : ""}`}
                                            >
                                                <MemberRow
                                                    member={mem}
                                                    currentUserRole={membership?.role || null}
                                                    isGlobalAdmin={isGlobalAdminUser}
                                                    onApprove={handleUpdateMember ? () => handleUpdateMember((mem as any)._docId, { status: "approved" }) : undefined}
                                                    onReject={handleUpdateMember ? () => handleUpdateMember((mem as any)._docId, { status: "rejected" }) : undefined}
                                                />
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

