"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { Club } from "../../../lib/clubs";
import { UserRow } from "../../../components/user-row";
import { CheckBadgeIcon, XMarkIcon } from "@heroicons/react/24/outline";

export default function AdminClubsPage() {
    const [pendingClubs, setPendingClubs] = useState<Club[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchPendingClubs = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, "clubs"), where("verificationStatus", "==", "pending"));
            const snapshot = await getDocs(q);
            const clubs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Club));
            setPendingClubs(clubs);
        } catch (error) {
            console.error("Error fetching pending clubs:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPendingClubs();
    }, []);

    const handleAction = async (clubId: string, action: 'approve' | 'reject') => {
        try {
            const updates = action === 'approve'
                ? { verificationStatus: 'approved', isVerified: true, verifiedAt: serverTimestamp() }
                : { verificationStatus: 'rejected', isVerified: false };

            await updateDoc(doc(db, "clubs", clubId), updates);

            // Remove from local list
            setPendingClubs(prev => prev.filter(c => c.id !== clubId));

            alert(`Club ${action}d successfully.`);
        } catch (error) {
            console.error(`Error ${action}ing club:`, error);
            alert(`Failed to ${action} club.`);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto min-h-screen text-white">
            <h1 className="text-3xl font-bold mb-8">Club Verification Requests</h1>

            {loading ? (
                <div className="flex justify-center p-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-[#ffb200]" />
                </div>
            ) : pendingClubs.length === 0 ? (
                <div className="rounded-[24px] bg-[#1C1C1E] p-12 text-center border border-white/5">
                    <p className="text-neutral-500">No pending verification requests.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {pendingClubs.map(club => (
                        <div key={club.id} className="rounded-[24px] bg-[#1C1C1E] p-6 border border-white/5 flex items-center justify-between gap-4">
                            <div className="flex-1">
                                <UserRow
                                    userData={{
                                        displayName: club.name,
                                        photoURL: club.coverImageUrl, // Using cover as avatar substitute for now if logo unavailable
                                        username: club.description ? club.description.slice(0, 50) + "..." : "No description"
                                    }}
                                    subtitle={`Members: ${club.memberCount}`}
                                    onlyAvatar={false}
                                    isVerified={club.isVerified}
                                />
                                <div className="mt-2 ml-[52px]">
                                    <span className="text-xs font-mono text-neutral-500 bg-white/5 px-2 py-1 rounded">
                                        ID: {club.id}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => handleAction(club.id, 'reject')}
                                    className="p-2 rounded-full hover:bg-red-500/20 text-red-500 transition-colors"
                                    title="Reject"
                                >
                                    <XMarkIcon className="h-6 w-6" />
                                </button>
                                <button
                                    onClick={() => handleAction(club.id, 'approve')}
                                    className="p-2 rounded-full hover:bg-green-500/20 text-green-500 transition-colors"
                                    title="Approve"
                                >
                                    <CheckBadgeIcon className="h-6 w-6" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
