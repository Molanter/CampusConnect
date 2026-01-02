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
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Sync scroll position when activeTab changes externally (from capsules or code)
    useEffect(() => {
        if (!pagerRef.current) return;

        const index = tabs.findIndex(t => t.key === activeTab);
        if (index === -1) return;

        const width = pagerRef.current.clientWidth;
        if (width === 0) return;

        const targetLeft = index * width;
        const currentLeft = pagerRef.current.scrollLeft;

        // Only scroll if we're not already there
        if (Math.abs(currentLeft - targetLeft) > 10) {
            // Clear any existing timeout
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }

            isProgrammaticScroll.current = true;
            targetScrollPos.current = targetLeft;
            setIsScrolling(true);

            pagerRef.current.scrollTo({
                left: targetLeft,
                behavior: "smooth"
            });

            // Clear the flag after animation completes
            scrollTimeoutRef.current = setTimeout(() => {
                isProgrammaticScroll.current = false;
                targetScrollPos.current = null;
                setIsScrolling(false);
                scrollTimeoutRef.current = null;
            }, 500);
        }
    }, [activeTab, tabs]);

    const handleTabClick = (key: ClubTab) => {
        if (!pagerRef.current) return;

        // Clear any existing timeout
        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }

        const index = tabs.findIndex((t: any) => t.key === key);
        if (index === -1) return;

        const width = pagerRef.current.clientWidth;
        const targetLeft = index * width;

        isProgrammaticScroll.current = true;
        targetScrollPos.current = targetLeft;
        setIsScrolling(true);

        // Update state immediately for responsive UI
        onTabChange(key);

        pagerRef.current.scrollTo({
            left: targetLeft,
            behavior: "smooth"
        });

        scrollTimeoutRef.current = setTimeout(() => {
            isProgrammaticScroll.current = false;
            targetScrollPos.current = null;
            setIsScrolling(false);
            scrollTimeoutRef.current = null;
        }, 500);
    };

    const handleScroll = () => {
        if (!pagerRef.current) return;

        // If we're in the middle of a programmatic scroll, ignore user scroll events
        if (isProgrammaticScroll.current) {
            // Check if we've reached the target
            if (targetScrollPos.current !== null) {
                const currentLeft = pagerRef.current.scrollLeft;
                const dist = Math.abs(currentLeft - targetScrollPos.current);

                // If we're close enough, clear the flag early
                if (dist < 5) {
                    if (scrollTimeoutRef.current) {
                        clearTimeout(scrollTimeoutRef.current);
                    }
                    isProgrammaticScroll.current = false;
                    targetScrollPos.current = null;
                    setIsScrolling(false);
                    scrollTimeoutRef.current = null;
                }
            }
            return; // Don't process scroll event during programmatic scroll
        }

        // User is manually scrolling - detect which tab they're on
        const scrollLeft = pagerRef.current.scrollLeft;
        const width = pagerRef.current.offsetWidth;
        if (width === 0) return;

        const index = Math.round(scrollLeft / width);
        const newTab = tabs[index]?.key;

        if (newTab && newTab !== activeTab) {
            onTabChange(newTab);
        }
    };

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
        };
    }, []);

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
                {tabs.map((tab) => (
                    <div key={tab.key} className="w-full shrink-0 snap-start px-1">
                        {tab.key === "posts" && (
                            <div className="mx-auto w-full max-w-[680px]">
                                {isLoading ? (
                                    <div className="flex justify-center py-20">
                                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-secondary/25 border-t-brand" />
                                    </div>
                                ) : posts.length === 0 ? (
                                    <div className="cc-section cc-radius-24 p-12 text-center cc-muted">
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
                        )}

                        {tab.key === "members" && (
                            <div className="space-y-3">
                                <h2 className={`${isNarrow ? 'px-4' : 'px-6'} text-[13px] font-semibold uppercase tracking-wider cc-muted`}>
                                    Members ({members.length})
                                </h2>
                                <div className="cc-section cc-radius-24 shadow-lg">
                                    <div className="divide-y divide-secondary/25">
                                        {isLoading ? (
                                            <div className="p-12 text-center">
                                                <div className="h-6 w-6 animate-spin rounded-full border-2 border-secondary/25 border-t-brand mx-auto" />
                                            </div>
                                        ) : members.length === 0 ? (
                                            <div className="p-12 text-center cc-muted">No members found.</div>
                                        ) : (
                                            members.map((mem: ClubMember, index: number) => (
                                                <div
                                                    key={mem.uid}
                                                    className={`${isNarrow ? 'px-4' : 'px-6'} py-4 transition-colors hover:bg-secondary/10 active:bg-secondary/16`}
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
                        )}

                        {tab.key === "about" && (
                            <div className="mx-auto w-full max-w-[680px] space-y-6">
                                <div className={`${isNarrow ? 'px-4' : 'px-6'} py-4 space-y-6`}>
                                    <div className="cc-section cc-radius-24 p-8 shadow-lg">
                                        <h2 className="text-xl font-bold text-foreground mb-4">About {club.name}</h2>
                                        <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap">
                                            {club.description || "No description provided."}
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="cc-section cc-radius-24 p-6 shadow-lg">
                                            <div className="flex items-center gap-3 mb-4 cc-muted">
                                                <CalendarDaysIcon className="h-6 w-6" />
                                                <h3 className="text-sm font-semibold uppercase tracking-wider">Created</h3>
                                            </div>
                                            <p className="text-lg font-bold text-foreground">
                                                {club.createdAt?.toDate ? club.createdAt.toDate().toLocaleDateString(undefined, {
                                                    month: 'long',
                                                    day: 'numeric',
                                                    year: 'numeric'
                                                }) : "Unknown"}
                                            </p>
                                        </div>

                                        <div className="cc-section cc-radius-24 p-6 shadow-lg">
                                            <div className="flex items-center gap-3 mb-4 cc-muted">
                                                <GlobeAltIcon className="h-6 w-6" />
                                                <h3 className="text-sm font-semibold uppercase tracking-wider">Privacy</h3>
                                            </div>
                                            <p className="text-lg font-bold text-foreground capitalize">
                                                {club.isPrivate ? "Private Group" : "Public Group"}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {tab.key === "requests" && (
                            <div className="space-y-3">
                                <h2 className={`${isNarrow ? 'px-4' : 'px-6'} text-[13px] font-semibold uppercase tracking-wider cc-muted`}>
                                    Join Requests ({requests.length})
                                </h2>
                                <div className="cc-section cc-radius-24 shadow-lg">
                                    <div className="divide-y divide-secondary/25">
                                        {requests.length === 0 ? (
                                            <div className="p-12 text-center cc-muted">No pending requests.</div>
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
                        )}
                    </div>
                ))}
            </div>
        </>
    );
}

