"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useScroll } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { useAdminMode } from "@/components/admin-mode-context";

// Sub-component to safely handle useScroll with conditional rendering

function ClubPager({
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
    fetchContent
}: any) {
    const pagerRef = useRef<HTMLDivElement>(null);
    const [isScrolling, setIsScrolling] = useState(false);
    const targetScrollPos = useRef<number | null>(null);
    const isProgrammaticScroll = useRef(false);
    const { adminModeOn } = useAdminMode();

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
                        {posts.length === 0 ? (
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
                                {members.map((mem: ClubMember, index: number) => (
                                    <div
                                        key={mem.uid}
                                        className={`${isNarrow ? 'px-4' : 'px-6'} py-4 transition-colors hover:bg-white/5 ${index === 0 ? "rounded-t-[28px]" : ""} ${index === members.length - 1 ? "rounded-b-[28px]" : ""}`}
                                    >
                                        <MemberRow
                                            member={mem}
                                            currentUserRole={membership?.role || null}
                                            isGlobalAdmin={isGlobalAdminUser && adminModeOn}
                                            onRoleChange={(_, newRole) => handleUpdateMember((mem as any)._docId, { role: newRole })}
                                            onKick={() => handleRemoveMember((mem as any)._docId)}
                                        />
                                    </div>
                                ))}
                            </div>
                            {members.length === 0 && (
                                <div className="p-12 text-center text-zinc-500">Loading members...</div>
                            )}
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
                                                className={`${isNarrow ? 'px-4' : 'px-6'} py-4 transition-colors hover:bg-white/5 ${index === 0 ? "rounded-t-[28px]" : ""} ${index === requests.length - 1 ? "rounded-b-[28px]" : ""}`}
                                            >
                                                <MemberRow
                                                    member={mem}
                                                    currentUserRole={membership?.role || null}
                                                    isGlobalAdmin={isGlobalAdminUser && adminModeOn}
                                                    onApprove={() => handleUpdateMember((mem as any)._docId, { status: "approved" })}
                                                    onReject={() => handleUpdateMember((mem as any)._docId, { status: "rejected" })}
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


import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, orderBy, getDocs, doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";
import {
    Club,
    ClubMember,
    ClubRole,
    JoinStatus,
    getClub,
    joinClub
} from "../../../lib/clubs";
import { Post } from "../../../lib/posts";
import { mapDocToPost } from "../../../lib/hooks/use-feed";
import { ClubHeader } from "../../../components/clubs/club-header";
import { ClubTabs, ClubTab } from "../../../components/clubs/club-tabs";
import { MemberRow } from "../../../components/clubs/member-row";
import { PostCard } from "../../../components/post-card";
import { useRightSidebar } from "../../../components/right-sidebar-context";
import { LockClosedIcon, CalendarDaysIcon, GlobeAltIcon } from "@heroicons/react/24/outline";

import { fetchGlobalAdminEmails, isGlobalAdmin } from "../../../lib/admin-utils";

export default function ClubPage() {
    const params = useParams();
    const router = useRouter();
    const clubId = params.clubId as string;

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [club, setClub] = useState<Club | null>(null);
    const [membership, setMembership] = useState<ClubMember | null>(null); // My membership
    const [activeTab, setActiveTab] = useState<ClubTab>("posts");
    const [isGlobalAdminUser, setIsGlobalAdminUser] = useState(false); // Global admin override

    const { openView, isNarrow } = useRightSidebar();
    const [loading, setLoading] = useState(true);

    // Content state
    const [posts, setPosts] = useState<Post[]>([]);
    const [members, setMembers] = useState<ClubMember[]>([]);
    const [requests, setRequests] = useState<ClubMember[]>([]); // New state


    const [stats, setStats] = useState({ totalPosts: 0, activityRate: 0 });

    // Helpers
    const { adminModeOn } = useAdminMode();
    // Only show content if: club is public, user is approved member, OR admin mode is explicitly ON
    const canViewContent = !club?.isPrivate || (membership?.status === "approved") || (isGlobalAdminUser && adminModeOn);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setCurrentUser(u));
        return () => unsub();
    }, []);

    // Check Global Admin Status
    useEffect(() => {
        if (!currentUser) return;
        const checkAdmin = async () => {
            const globalAdmins = await fetchGlobalAdminEmails();
            if (isGlobalAdmin(currentUser.email, globalAdmins)) {
                setIsGlobalAdminUser(true);
            }
        };
        checkAdmin();
    }, [currentUser]);

    // Fetch Statistics (Always, for Header)
    useEffect(() => {
        if (!clubId || !canViewContent) return;

        const fetchStats = async () => {
            try {
                const postsRef = collection(db, "posts");
                const q = query(postsRef, where("clubId", "==", clubId));
                const snap = await getDocs(q);

                const allItems = snap.docs.map(d => d.data());
                const totalPosts = allItems.filter(i => !i.isEvent).length;
                const totalEvents = allItems.filter(i => !!i.isEvent).length;

                // Activity Rate (posts per month)
                let rate = 0;
                if (club?.createdAt) {
                    const created = club.createdAt.toDate ? club.createdAt.toDate() : new Date(club.createdAt);
                    const now = new Date();
                    const diffMonths = Math.max(1, (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth()));
                    rate = (totalPosts + totalEvents) / diffMonths;
                }

                setStats({ totalPosts, activityRate: rate });
            } catch (err) {
                console.error("Error fetching stats:", err);
            }
        };

        fetchStats();
    }, [clubId, club, canViewContent]);


    // Fetch Club and Membership
    useEffect(() => {
        if (!clubId || !currentUser) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Fetch Club
                const clubData = await getClub(clubId);
                setClub(clubData);

                // 2. Check my membership
                const memRef = collection(db, "clubs", clubId, "members");
                const q = query(memRef, where("uid", "==", currentUser.uid));
                const snap = await getDocs(q);

                if (!snap.empty) {
                    const docSnap = snap.docs[0];
                    const d = docSnap.data();
                    setMembership({
                        uid: currentUser.uid,
                        clubId: clubId,
                        role: d.role as ClubRole,
                        status: d.status as JoinStatus,
                        joinedAt: d.joinedAt,
                        _docId: docSnap.id
                    });
                } else {
                    setMembership(null);
                }

            } catch (err) {
                console.error("Error fetching club data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [clubId, currentUser]);

    // Dynamic Tabs Logic
    const canSeeRequests = !!(club && club.isPrivate && (membership?.role === "owner" || membership?.role === "admin" || (isGlobalAdminUser && adminModeOn)));
    const tabs: { key: ClubTab; label: string }[] = [
        { key: "posts", label: "Posts" },
        { key: "members", label: "Members" },
        { key: "about", label: "About" },
        ...(canSeeRequests ? [{ key: "requests", label: "Requests" } as const] : [])
    ];


    // Fetch Tab Content
    const fetchContent = useCallback(async () => {
        if (!clubId || !canViewContent) return;

        if (activeTab === "posts") {
            const postsRef = collection(db, "posts");
            // Filter for non-event posts
            const q = query(
                postsRef,
                where("clubId", "==", clubId),
                where("isEvent", "==", false),
                orderBy("createdAt", "desc")
            );

            const snap = await getDocs(q);
            const items = snap.docs.map(d => mapDocToPost(d));
            setPosts(items);
        }

        if (activeTab === "members") {
            const memRef = collection(db, "clubs", clubId, "members");
            const q = query(
                memRef,
                where("status", "==", "approved"),
                orderBy("joinedAt", "desc")
            );

            const snap = await getDocs(q);

            const memsWithData = await Promise.all(snap.docs.map(async (d) => {
                const memData = d.data();
                const uSnap = await getDoc(doc(db, "users", memData.uid));
                const uData = uSnap.exists() ? uSnap.data() : {};
                return {
                    ...uData,
                    uid: memData.uid,
                    clubId: clubId,
                    role: memData.role,
                    joinedAt: memData.joinedAt,
                    status: memData.status,
                    _docId: d.id,
                } as ClubMember;
            }));

            setMembers(memsWithData);
        }

        if (activeTab === "requests") {
            const memRef = collection(db, "clubs", clubId, "members");
            const q = query(
                memRef,
                where("status", "in", ["pending", "rejected"]),
                orderBy("joinedAt", "desc")
            );

            const snap = await getDocs(q);

            const memsWithData = await Promise.all(snap.docs.map(async (d) => {
                const memData = d.data();
                const uSnap = await getDoc(doc(db, "users", memData.uid));
                const uData = uSnap.exists() ? uSnap.data() : {};
                return {
                    ...uData,
                    uid: memData.uid,
                    clubId: clubId,
                    role: memData.role,
                    joinedAt: memData.joinedAt,
                    status: memData.status,
                    _docId: d.id,
                } as ClubMember;
            }));

            memsWithData.sort((a, b) => {
                if (a.status === b.status) return 0;
                return a.status === "pending" ? -1 : 1;
            });

            setRequests(memsWithData);
        }
    }, [clubId, activeTab, canViewContent]);

    useEffect(() => {
        fetchContent();
    }, [fetchContent, activeTab]);


    // Actions
    const handleJoin = async () => {
        if (!currentUser || !club) return;
        try {
            await joinClub(club.id, currentUser.uid, club.isPrivate);
            // Refresh status efficiently
            setMembership({
                uid: currentUser.uid,
                clubId: club.id,
                role: "member",
                status: club.isPrivate ? "pending" : "approved",
                joinedAt: new Date(),
            });
        } catch (err) {
            console.error("Failed to join:", err);
        }
    };

    const handleLeave = async () => {
        if (!currentUser || !club || !membership) return;

        // Handle pending users differently - just cancel the request
        if (membership.status === "pending") {
            if (!confirm("Cancel your join request?")) return;
            try {
                if (membership._docId) {
                    await deleteDoc(doc(db, "clubs", clubId, "members", membership._docId));
                } else {
                    // Fallback: search by uid
                    const memRef = collection(db, "clubs", clubId, "members");
                    const q = query(memRef, where("uid", "==", currentUser.uid));
                    const snap = await getDocs(q);
                    if (!snap.empty) {
                        await deleteDoc(snap.docs[0].ref);
                    }
                }
                setMembership(null);
                fetchContent(); // Refresh requests tab
                alert("Join request cancelled.");
            } catch (err) {
                console.error("Error cancelling request:", err);
                alert("Failed to cancel request.");
            }
            return;
        }

        // Regular approved member leave logic
        if (!confirm("Are you sure you want to leave this club?")) return;

        try {
            // Fetch all members to determine state
            const memRef = collection(db, "clubs", clubId, "members");
            const q = query(memRef, where("status", "==", "approved"), orderBy("joinedAt", "asc"));
            const snap = await getDocs(q);
            const allMembers = snap.docs.map(d => ({ ...d.data(), _docId: d.id } as ClubMember));

            if (allMembers.length <= 1) {
                alert("You are the only member. You cannot leave the club empty. Please delete the club instead.");
                return;
            }

            // Logic: If Owner, transfer ownership
            if (membership.role === "owner") {
                // Candidates: everyone except me
                const candidates = allMembers.filter(m => m.uid !== currentUser.uid);

                // Priority 1: Admins (oldest first)
                // Priority 2: Members (oldest first) -- already sorted by joinedAt asc
                let successor = candidates.find(m => m.role === "admin");
                if (!successor) {
                    successor = candidates[0]; // Oldest member
                }

                if (successor && successor._docId) {
                    await updateDoc(doc(db, "clubs", clubId, "members", successor._docId), { role: "owner" });
                    alert(`Ownership has been transferred to ${successor.displayName || successor.name || "the next member"}.`);
                }
            }

            // Delete my membership
            if (membership._docId) {
                await deleteDoc(doc(db, "clubs", clubId, "members", membership._docId));
                setMembership(null);
                setClub(prev => prev ? { ...prev, isMember: false, memberCount: Math.max(0, prev.memberCount - 1) } : null);
                router.refresh(); // Optional
            }

        } catch (err) {
            console.error("Error leaving club:", err);
            alert("Failed to leave club.");
        }
    };

    // Member Management Actions
    const handleUpdateMember = async (memberDocId: string, updates: Partial<ClubMember>) => {
        if (!memberDocId) return;
        try {
            // Safety check for role changes (demotion of last owner)
            if (updates.role && (updates.role === "admin" || updates.role === "member")) {
                const memRef = collection(db, "clubs", clubId, "members");
                const q = query(memRef, where("status", "==", "approved"));
                const snap = await getDocs(q);
                const allMembers = snap.docs.map(d => ({ ...d.data(), _docId: d.id } as ClubMember));

                const targetMember = allMembers.find(m => (m as any)._docId === memberDocId);
                // Check if this is the ONLY owner and we are demoting them
                if (targetMember && targetMember.role === "owner") {
                    const otherOwners = allMembers.filter(m => m.role === "owner" && (m as any)._docId !== memberDocId);
                    if (otherOwners.length === 0) {
                        alert("Cannot demote the only owner of the club. Assign another owner first.");
                        return;
                    }
                }
            }

            await updateDoc(doc(db, "clubs", clubId, "members", memberDocId), updates);

            // Local update for both lists
            setMembers(prev => prev.map(m => (m as any)._docId === memberDocId ? { ...m, ...updates } : m));
            setRequests(prev => prev.map(m => (m as any)._docId === memberDocId ? { ...m, ...updates } : m));

            // Move between lists if status changed
            if (updates.status === "approved") {
                // Determine if we need to move from Requests to Members
                // Since this is a swipe view, both lists might exist. 
                // We should remove from Requests and add to Members if it was in Requests.
                setRequests(prev => {
                    const found = prev.find(m => (m as any)._docId === memberDocId);
                    if (found) {
                        const updatedMember = { ...found, ...updates };
                        setMembers(curr => [updatedMember, ...curr]); // Add to top of members
                        return prev.filter(m => (m as any)._docId !== memberDocId);
                    }
                    return prev;
                });
            }
        } catch (err) {
            console.error("Error updating member:", err);
            alert("Failed to update member.");
        }
    };

    const handleRemoveMember = async (memberDocId: string) => {
        if (!memberDocId) return;

        if (!confirm("Are you sure you want to remove this member?")) return;

        try {
            // Fetch all members to determine state safely
            const memRef = collection(db, "clubs", clubId, "members");
            const q = query(memRef, where("status", "==", "approved"), orderBy("joinedAt", "asc"));
            const snap = await getDocs(q);
            const allMembers = snap.docs.map(d => ({ ...d.data(), _docId: d.id } as ClubMember));

            const targetMember = allMembers.find(m => (m as any)._docId === memberDocId);

            // Only enforce "last member" check if valid target found and it's from Approved list
            if (targetMember) {
                if (allMembers.length <= 1) {
                    alert("Cannot remove the last member of the club.");
                    return;
                }

                // If removing Owner (by Global Admin), transfer ownership
                if (targetMember.role === "owner") {
                    const candidates = allMembers.filter(m => (m as any)._docId !== memberDocId);

                    // Priority 1: Admins (oldest first)
                    let successor = candidates.find(m => m.role === "admin");
                    // Priority 2: Oldest member
                    if (!successor) {
                        successor = candidates[0];
                    }

                    if (successor && successor._docId) {
                        await updateDoc(doc(db, "clubs", clubId, "members", successor._docId), { role: "owner" });
                    }
                }
            }

            await deleteDoc(doc(db, "clubs", clubId, "members", memberDocId));

            // Local update
            setMembers(prev => prev.filter(m => (m as any)._docId !== memberDocId));
            setRequests(prev => prev.filter(m => (m as any)._docId !== memberDocId));

        } catch (err) {
            console.error("Error removing member:", err);
            alert("Failed to remove member.");
        }
    };

    const handleShare = async () => {
        if (typeof navigator !== 'undefined' && navigator.share) {
            try {
                await navigator.share({
                    title: club?.name,
                    text: `Check out ${club?.name} on CampusConnect!`,
                    url: window.location.href
                });
            } catch (err) {
                // ignore
            }
        } else {
            navigator.clipboard.writeText(window.location.href);
            alert("Link copied to clipboard!");
        }
    };

    const handleSettings = () => {
        router.push(`/clubs/${clubId}/settings`);
    };

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-[#ffb200]" />
            </div>
        );
    }

    if (!club) return <div className="pt-20 text-center text-white">Club not found</div>;

    return (
        <div className={`mx-auto min-h-screen w-full ${isNarrow ? 'px-0 py-4' : 'max-w-4xl px-4 py-8'} pb-32 space-y-6`}>

            <ClubHeader
                club={club}
                currentUserRole={membership?.role || null}
                joinStatus={membership?.status || null}
                stats={{
                    posts: stats.totalPosts || 0,
                    members: club.memberCount
                }}
                onJoin={handleJoin}
                onLeave={handleLeave}
                onInvite={handleShare}
                onSettings={handleSettings}
                onPostsClick={() => setActiveTab("posts")}
                onMembersClick={() => setActiveTab("members")}
                isNarrow={isNarrow}
                isGlobalAdmin={isGlobalAdminUser && adminModeOn}
            />

            {/* Access Control Check */}
            {!canViewContent ? (
                <div className="mt-8 flex flex-col items-center justify-center rounded-[28px] border border-white/10 bg-[#1C1C1E] p-12 text-center shadow-lg">
                    <div className="mb-4 rounded-full bg-zinc-800 p-6">
                        <LockClosedIcon className="h-10 w-10 text-zinc-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white">This Club is Private</h2>
                    <p className="mt-2 text-zinc-400">Join this club to view its posts and members.</p>
                </div>
            ) : (
                <ClubPager
                    tabs={tabs}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    isNarrow={isNarrow}
                    posts={posts}
                    members={members}
                    requests={requests}
                    club={club}
                    membership={membership}
                    isGlobalAdminUser={isGlobalAdminUser && adminModeOn}
                    handleUpdateMember={handleUpdateMember}
                    handleRemoveMember={handleRemoveMember}
                    openView={openView}
                    fetchContent={fetchContent}
                />
            )}
        </div>
    );
}
