"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, orderBy, getDocs, doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore/lite";
import { auth, db } from "../../../lib/firebase";
import {
    Club,
    ClubMember,
    getClub,
    joinClub
} from "../../../lib/clubs";
import { Post } from "../../../lib/posts";
import { ClubHeader } from "../../../components/clubs/club-header";
import { ClubTabs, ClubTab } from "../../../components/clubs/club-tabs";
import { UserRow } from "../../../components/user-row";
import { MemberMenu } from "../../../components/clubs/member-menu";
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

    // Helpers
    const canViewContent = !club?.isPrivate || (membership?.status === "approved");

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setCurrentUser(u));
        return () => unsub();
    }, []);

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
                    const d = snap.docs[0].data();
                    setMembership({ ...d, uid: currentUser.uid } as ClubMember);
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
    useEffect(() => {
        if (!clubId || !canViewContent) return;

        const fetchContent = async () => {
            if (activeTab === "posts" || activeTab === "events") {
                const postsRef = collection(db, "events");
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
                }

                const snap = await getDocs(q);
                const fetchedPosts = snap.docs.map(d => ({ id: d.id, ...d.data() } as Post));

                if (activeTab === "events") setEvents(fetchedPosts);
                else setPosts(fetchedPosts);
            }

            if (activeTab === "members") {
                const memRef = collection(db, "clubs", clubId, "members");
                const q = query(memRef, orderBy("joinedAt", "desc"));
                const snap = await getDocs(q);

                const memsWithData = await Promise.all(snap.docs.map(async (d) => {
                    const memData = d.data();
                    const uSnap = await getDoc(doc(db, "users", memData.uid));
                    const uData = uSnap.exists() ? uSnap.data() : {};
                    // Include doc ID for updates, using generic casting to avoid type errors locally
                    return { ...memData, ...uData, _docId: d.id } as ClubMember;
                }));

                setMembers(memsWithData);
            }
        };

        fetchContent();
    }, [clubId, activeTab, canViewContent]);


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
                                        <PostCard key={post.id} post={post} />
                                    ))
                                )}
                            </div>
                        )}

                        {/* Members Tab */}
                        {activeTab === "members" && (
                            <div className="rounded-[28px] border border-white/10 bg-[#1C1C1E] p-6 shadow-lg">
                                <h3 className="mb-4 text-lg font-semibold text-white">
                                    Members ({members.length})
                                </h3>
                                <div className="space-y-4">
                                    {members.map(mem => (
                                        <div key={mem.uid} className="flex items-center justify-between">
                                            <UserRow
                                                uid={mem.uid}
                                                userData={mem}
                                                subtitle={mem.role === "owner" ? "Owner" : mem.role === "admin" ? "Admin" : undefined}
                                                rightElement={
                                                    <MemberMenu
                                                        member={mem}
                                                        currentUserRole={membership?.role || null}
                                                        onPromote={() => handleUpdateMember((mem as any)._docId, { role: "admin" })}
                                                        onDemote={() => handleUpdateMember((mem as any)._docId, { role: "member" })}
                                                        onKick={() => handleRemoveMember((mem as any)._docId)}
                                                        onApprove={() => handleUpdateMember((mem as any)._docId, { status: "approved" })}
                                                        onReject={() => handleRemoveMember((mem as any)._docId)}
                                                    />
                                                }
                                            />
                                        </div>
                                    ))}
                                </div>
                                {members.length === 0 && (
                                    <div className="p-4 text-zinc-500">Loading members...</div>
                                )}
                            </div>
                        )}

                        {/* About Tab */}
                        {activeTab === "about" && (
                            <div className="rounded-[28px] border border-white/10 bg-[#1C1C1E] p-6 text-white shadow-lg">
                                <h3 className="mb-4 text-lg font-semibold">About {club.name}</h3>
                                <p className="whitespace-pre-wrap text-zinc-300">
                                    {club.description}
                                </p>

                                <div className="mt-8 grid grid-cols-2 gap-4">
                                    <div className="rounded-xl bg-white/5 p-4">
                                        <span className="block text-xs text-zinc-500">Created</span>
                                        <span className="font-medium">
                                            {club.createdAt?.toDate ? club.createdAt.toDate().toLocaleDateString() : "Recently"}
                                        </span>
                                    </div>
                                    <div className="rounded-xl bg-white/5 p-4">
                                        <span className="block text-xs text-zinc-500">Members</span>
                                        <span className="font-medium">{club.memberCount}</span>
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
