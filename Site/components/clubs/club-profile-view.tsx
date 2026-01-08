"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useAdminMode } from "@/components/admin-mode-context";
import { ClubPager } from "@/components/clubs/club-pager";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, orderBy, getDocs, doc, getDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
    Club,
    ClubMember,
    ClubRole,
    JoinStatus,
    getClub,
    joinClub
} from "@/lib/clubs";
import { Post } from "@/lib/posts";
import { mapDocToPost } from "@/lib/hooks/use-feed";
import { ClubHeader } from "@/components/clubs/club-header";
import { ClubTab } from "@/components/clubs/club-tabs";
import { useRightSidebar } from "@/components/right-sidebar-context";
import { LockClosedIcon } from "@heroicons/react/24/outline";
import { fetchGlobalAdminEmails, isGlobalAdmin } from "@/lib/admin-utils";
import { useRouter } from "next/navigation";

interface ClubProfileViewProps {
    clubId: string;
    isModerationMode?: boolean;
}

export function ClubProfileView({ clubId, isModerationMode = false }: ClubProfileViewProps) {
    const router = useRouter();

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [club, setClub] = useState<Club | null>(null);
    const [membership, setMembership] = useState<ClubMember | null>(null);
    const [activeTab, setActiveTab] = useState<ClubTab>("posts");
    const [isGlobalAdminUser, setIsGlobalAdminUser] = useState(false);

    const { openView, isNarrow } = useRightSidebar();
    const [loading, setLoading] = useState(true);

    const [posts, setPosts] = useState<Post[]>([]);
    const [members, setMembers] = useState<ClubMember[]>([]);
    const [requests, setRequests] = useState<ClubMember[]>([]);
    const [stats, setStats] = useState({ totalPosts: 0, activityRate: 0 });

    const { adminModeOn } = useAdminMode();

    // In moderation mode, we override content visibility
    const canViewContent = isModerationMode || !club?.isPrivate || (membership?.status === "approved") || (isGlobalAdminUser && adminModeOn);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setCurrentUser(u));
        return () => unsub();
    }, []);

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

    useEffect(() => {
        if (!clubId || (!currentUser && !isModerationMode)) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const clubData = await getClub(clubId);
                setClub(clubData);

                if (currentUser) {
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
                }
            } catch (err) {
                console.error("Error fetching club data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [clubId, currentUser, isModerationMode]);

    const fetchContent = useCallback(async () => {
        if (!clubId || !canViewContent) return;

        if (activeTab === "posts") {
            const postsRef = collection(db, "posts");
            const q = query(
                postsRef,
                where("clubId", "==", clubId),
                where("isEvent", "==", false),
                orderBy("createdAt", "desc")
            );

            const snap = await getDocs(q);
            const items = snap.docs.map(d => mapDocToPost(d));

            // Final sort: Newest first
            items.sort((a, b) => {
                const timeA = a.createdAt?.seconds ?? a.createdAt?.toMillis?.() ?? 0;
                const timeB = b.createdAt?.seconds ?? b.createdAt?.toMillis?.() ?? 0;
                return timeB - timeA;
            });

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

    const handleJoin = async () => {
        if (!currentUser || !club) return;
        try {
            await joinClub(club.id, currentUser.uid, club.isPrivate);
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
        if (membership.status === "pending") {
            if (!confirm("Cancel your join request?")) return;
            try {
                if (membership._docId) {
                    await deleteDoc(doc(db, "clubs", clubId, "members", membership._docId));
                } else {
                    const memRef = collection(db, "clubs", clubId, "members");
                    const q = query(memRef, where("uid", "==", currentUser.uid));
                    const snap = await getDocs(q);
                    if (!snap.empty) {
                        await deleteDoc(snap.docs[0].ref);
                    }
                }
                setMembership(null);
                fetchContent();
                alert("Join request cancelled.");
            } catch (err) {
                console.error("Error cancelling request:", err);
                alert("Failed to cancel request.");
            }
            return;
        }

        if (!confirm("Are you sure you want to leave this club?")) return;

        try {
            const memRef = collection(db, "clubs", clubId, "members");
            const q = query(memRef, where("status", "==", "approved"), orderBy("joinedAt", "asc"));
            const snap = await getDocs(q);
            const allMembers = snap.docs.map(d => ({ ...d.data(), _docId: d.id } as ClubMember));

            if (allMembers.length <= 1) {
                alert("You are the only member. You cannot leave the club empty. Please delete the club instead.");
                return;
            }

            if (membership.role === "owner") {
                const candidates = allMembers.filter(m => m.uid !== currentUser.uid);
                let successor = candidates.find(m => m.role === "admin");
                if (!successor) {
                    successor = candidates[0];
                }

                if (successor && successor._docId) {
                    await updateDoc(doc(db, "clubs", clubId, "members", successor._docId), { role: "owner" });
                    alert(`Ownership has been transferred to ${successor.displayName || successor.name || "the next member"}.`);
                }
            }

            if (membership._docId) {
                await deleteDoc(doc(db, "clubs", clubId, "members", membership._docId));
                setMembership(null);
                setClub(prev => prev ? { ...prev, isMember: false, memberCount: Math.max(0, prev.memberCount - 1) } : null);
                router.refresh();
            }

        } catch (err) {
            console.error("Error leaving club:", err);
            alert("Failed to leave club.");
        }
    };

    const handleUpdateMember = async (memberDocId: string, updates: Partial<ClubMember>) => {
        if (!memberDocId) return;
        try {
            if (updates.role && (updates.role === "admin" || updates.role === "member")) {
                const memRef = collection(db, "clubs", clubId, "members");
                const q = query(memRef, where("status", "==", "approved"));
                const snap = await getDocs(q);
                const allMembers = snap.docs.map(d => ({ ...d.data(), _docId: d.id } as ClubMember));

                const targetMember = allMembers.find(m => (m as any)._docId === memberDocId);
                if (targetMember && targetMember.role === "owner") {
                    const otherOwners = allMembers.filter(m => m.role === "owner" && (m as any)._docId !== memberDocId);
                    if (otherOwners.length === 0) {
                        alert("Cannot demote the only owner of the club. Assign another owner first.");
                        return;
                    }
                }
            }

            await updateDoc(doc(db, "clubs", clubId, "members", memberDocId), updates);
            setMembers(prev => prev.map(m => (m as any)._docId === memberDocId ? { ...m, ...updates } : m));
            setRequests(prev => prev.map(m => (m as any)._docId === memberDocId ? { ...m, ...updates } : m));

            if (updates.status === "approved") {
                setRequests(prev => {
                    const found = prev.find(m => (m as any)._docId === memberDocId);
                    if (found) {
                        const updatedMember = { ...found, ...updates };
                        setMembers(curr => [updatedMember, ...curr]);
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
            const memRef = collection(db, "clubs", clubId, "members");
            const q = query(memRef, where("status", "==", "approved"), orderBy("joinedAt", "asc"));
            const snap = await getDocs(q);
            const allMembers = snap.docs.map(d => ({ ...d.data(), _docId: d.id } as ClubMember));

            const targetMember = allMembers.find(m => (m as any)._docId === memberDocId);

            if (targetMember) {
                if (allMembers.length <= 1) {
                    alert("Cannot remove the last member of the club.");
                    return;
                }

                if (targetMember.role === "owner") {
                    const candidates = allMembers.filter(m => (m as any)._docId !== memberDocId);
                    let successor = candidates.find(m => m.role === "admin");
                    if (!successor) {
                        successor = candidates[0];
                    }

                    if (successor && successor._docId) {
                        await updateDoc(doc(db, "clubs", clubId, "members", successor._docId), { role: "owner" });
                    }
                }
            }

            await deleteDoc(doc(db, "clubs", clubId, "members", memberDocId));
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
            } catch (err) { }
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
            <div className="flex h-screen w-full items-center justify-center cc-page">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-secondary/25 border-t-brand" />
            </div>
        );
    }

    if (!club) return <div className="pt-20 text-center text-foreground cc-page h-screen">Club not found</div>;

    const canSeeRequests = !!(club && club.isPrivate && (membership?.role === "owner" || membership?.role === "admin" || (isGlobalAdminUser && adminModeOn)));
    const tabs: { key: ClubTab; label: string }[] = [
        { key: "posts", label: "Posts" },
        { key: "members", label: "Members" },
        { key: "about", label: "About" },
        ...(canSeeRequests ? [{ key: "requests", label: "Requests" } as const] : [])
    ];

    return (
        <div className="w-full cc-page">
            <div className={`mx-auto w-full ${isNarrow ? 'px-3 py-4' : 'max-w-4xl px-4 py-8'} pb-32 space-y-6`}>
                {club.status === 'hidden' && (
                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 mb-2">
                        <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                        <p className="text-sm font-bold text-red-500 uppercase tracking-wider">This Club is Hidden</p>
                    </div>
                )}
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

                {!canViewContent ? (
                    <div className="mt-8 flex flex-col items-center justify-center cc-section cc-radius-24 p-12 text-center shadow-lg">
                        <div className="mb-4 rounded-full bg-secondary/10 p-6">
                            <LockClosedIcon className="h-10 w-10 text-secondary" />
                        </div>
                        <h2 className="text-xl font-bold text-foreground">This Club is Private</h2>
                        <p className="mt-2 cc-muted">Join this club to view its posts and members.</p>
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
        </div>
    );
}
