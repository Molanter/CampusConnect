"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { ClubHeader } from "../../../components/clubs/club-header";
import { ClubTabs, ClubTab } from "../../../components/clubs/club-tabs";
import { MemberRow } from "../../../components/clubs/member-row";
import { PostCard } from "../../../components/post-card";
import { LockClosedIcon } from "@heroicons/react/24/outline";

export default function ClubPage() {
    const params = useParams();
    const clubId = params.clubId as string;

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [club, setClub] = useState<Club | null>(null);
    const [membership, setMembership] = useState<ClubMember | null>(null); // My membership
    const [activeTab, setActiveTab] = useState<ClubTab>("posts");
    const [loading, setLoading] = useState(true);

    // Content state
    const [posts, setPosts] = useState<Post[]>([]);
    const [events, setEvents] = useState<Post[]>([]);
    const [members, setMembers] = useState<ClubMember[]>([]);
    const [stats, setStats] = useState({ totalPosts: 0, totalEvents: 0, activityRate: 0 });

    // Helpers
    const canViewContent = !club?.isPrivate || (membership?.status === "approved");

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setCurrentUser(u));
        return () => unsub();
    }, []);

    // Fetch Statistics
    useEffect(() => {
        if (!clubId || activeTab !== "about" || !canViewContent) return;

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

                setStats({ totalPosts, totalEvents, activityRate: rate });
            } catch (err) {
                console.error("Error fetching stats:", err);
            }
        };

        fetchStats();
    }, [clubId, activeTab, club, canViewContent]);


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

    // Fetch Tab Content
    const fetchContent = useCallback(async () => {
        if (!clubId || !canViewContent) return;

        if (activeTab === "posts" || activeTab === "events") {
            const postsRef = collection(db, "posts");
            let q = query(
                postsRef,
                where("clubId", "==", clubId),
                orderBy("createdAt", "desc")
            );

            if (activeTab === "events") {
                q = query(
                    postsRef,
                    where("clubId", "==", clubId),
                    where("isEvent", "==", true),
                    orderBy("createdAt", "desc")
                );
            } else if (activeTab === "posts") {
                q = query(
                    postsRef,
                    where("clubId", "==", clubId),
                    where("isEvent", "==", false),
                    orderBy("createdAt", "desc")
                );
            }

            const snap = await getDocs(q);
            const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Post));
            if (activeTab === "posts") setPosts(items);
            else setEvents(items);
        }

        if (activeTab === "members") {
            const memRef = collection(db, "clubs", clubId, "members");
            const q = query(memRef, orderBy("joinedAt", "desc"));
            const snap = await getDocs(q);

            const memsWithData = await Promise.all(snap.docs.map(async (d) => {
                const memData = d.data();
                const uSnap = await getDoc(doc(db, "users", memData.uid));
                const uData = uSnap.exists() ? uSnap.data() : {};
                // Include doc ID for updates, using explicit mapping to satisfy TypeScript
                return {
                    uid: memData.uid,
                    clubId: clubId,
                    role: memData.role,
                    joinedAt: memData.joinedAt,
                    status: memData.status,
                    _docId: d.id,
                    ...uData
                } as ClubMember;
            }));

            setMembers(memsWithData);
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

    const handleLeave = () => {
        // Implement leave logic if needed
        alert("Leave logic not implemented yet for MVP");
    };

    // Member Management Actions
    const handleUpdateMember = async (memberDocId: string, updates: Partial<ClubMember>) => {
        if (!memberDocId) return;
        try {
            await updateDoc(doc(db, "clubs", clubId, "members", memberDocId), updates);
            // Local update
            setMembers(prev => prev.map(m => (m as any)._docId === memberDocId ? { ...m, ...updates } : m));
        } catch (err) {
            console.error("Error updating member:", err);
        }
    };

    const handleRemoveMember = async (memberDocId: string) => {
        if (!memberDocId) return;
        try {
            await deleteDoc(doc(db, "clubs", clubId, "members", memberDocId));
            // Local update
            setMembers(prev => prev.filter(m => (m as any)._docId !== memberDocId));
        } catch (err) {
            console.error("Error removing member:", err);
        }
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
        <div className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8 pb-32 space-y-6">

            <ClubHeader
                club={club}
                currentUserRole={membership?.role || null}
                joinStatus={membership?.status || null}
                onJoin={handleJoin}
                onLeave={handleLeave}
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
                <>
                    {/* Tabs */}
                    <ClubTabs activeTab={activeTab} onTabChange={setActiveTab} />

                    <div className="space-y-6">

                        {/* Posts / Events Tab */}
                        {(activeTab === "posts" || activeTab === "events") && (
                            <div className="space-y-6">
                                {(activeTab === "posts" ? posts : events).length === 0 ? (
                                    <div className="rounded-[28px] border border-dashed border-white/10 bg-[#1C1C1E]/50 p-12 text-center text-zinc-500">
                                        No {activeTab} yet.
                                    </div>
                                ) : (
                                    (activeTab === "posts" ? posts : events).map(post => (
                                        <PostCard key={post.id} post={post} onDeleted={fetchContent} />
                                    ))
                                )}
                            </div>
                        )}

                        {/* Members Tab */}
                        {activeTab === "members" && (
                            <div className="space-y-3">
                                <h2 className="px-6 text-[13px] font-semibold uppercase tracking-wider text-neutral-500">
                                    Members ({members.length})
                                </h2>
                                <div className="rounded-[28px] border border-white/10 bg-[#1C1C1E] shadow-lg">
                                    <div className="divide-y divide-white/5">
                                        {members.map((mem, index) => (
                                            <div
                                                key={mem.uid}
                                                className={`px-6 py-4 transition-colors hover:bg-white/5 ${index === 0 ? "rounded-t-[28px]" : ""
                                                    } ${index === members.length - 1 ? "rounded-b-[28px]" : ""
                                                    }`}
                                            >
                                                <MemberRow
                                                    member={mem}
                                                    currentUserRole={membership?.role || null}
                                                    onPromote={() => handleUpdateMember((mem as any)._docId, { role: "admin" })}
                                                    onDemote={() => handleUpdateMember((mem as any)._docId, { role: "member" })}
                                                    onKick={() => handleRemoveMember((mem as any)._docId)}
                                                    onApprove={() => handleUpdateMember((mem as any)._docId, { status: "approved" })}
                                                    onReject={() => handleRemoveMember((mem as any)._docId)}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    {members.length === 0 && (
                                        <div className="p-12 text-center text-zinc-500">Loading members...</div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* About Tab */}
                        {activeTab === "about" && (
                            <div className="space-y-8">
                                <div className="space-y-3">
                                    <h2 className="px-6 text-[13px] font-semibold uppercase tracking-wider text-neutral-500">
                                        About {club.name}
                                    </h2>
                                    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#1C1C1E] shadow-lg">
                                        <div className="p-6">
                                            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-300">
                                                {club.description}
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-2 divide-x divide-white/5 border-t border-white/5 bg-white/2">
                                            <div className="p-6 text-center">
                                                <span className="block text-[11px] font-bold uppercase tracking-widest text-zinc-500">Created</span>
                                                <span className="mt-1 block text-lg font-semibold text-white">
                                                    {club.createdAt?.toDate ? club.createdAt.toDate().toLocaleDateString() : "Recently"}
                                                </span>
                                            </div>
                                            <div className="p-6 text-center">
                                                <span className="block text-[11px] font-bold uppercase tracking-widest text-zinc-500">Members</span>
                                                <span className="mt-1 block text-lg font-semibold text-white">{club.memberCount}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h2 className="px-6 text-[13px] font-semibold uppercase tracking-wider text-neutral-500">
                                        Statistics
                                    </h2>
                                    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#1C1C1E] shadow-lg">
                                        <div className="grid grid-cols-3 divide-x divide-white/5">
                                            <div className="p-6 text-center">
                                                <span className="block text-[11px] font-bold uppercase tracking-widest text-zinc-500">Total Posts</span>
                                                <span className="mt-1 block text-2xl font-bold text-white">{stats.totalPosts}</span>
                                            </div>
                                            <div className="p-6 text-center">
                                                <span className="block text-[11px] font-bold uppercase tracking-widest text-zinc-500">Total Events</span>
                                                <span className="mt-1 block text-2xl font-bold text-white">{stats.totalEvents}</span>
                                            </div>
                                            <div className="p-6 text-center">
                                                <span className="block text-[11px] font-bold uppercase tracking-widest text-zinc-500">Posts / Month</span>
                                                <span className="mt-1 block text-2xl font-bold text-[#ffb200]">
                                                    {stats.activityRate.toFixed(1)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </>
            )}
        </div>
    );
}
