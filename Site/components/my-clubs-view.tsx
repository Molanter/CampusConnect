"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";

interface Club {
    id: string;
    name: string;
    description?: string;
    coverImageUrl?: string;
    memberCount?: number;
    isVerified?: boolean;
    category?: string;
    type?: string;
    isDorm?: boolean;
}

import { CheckBadgeIcon, HomeIcon } from "@heroicons/react/24/solid";

export function MyClubsView({ userId }: { userId: string }) {
    const router = useRouter();
    const [clubs, setClubs] = useState<Club[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMyClubs = async () => {
            try {
                setLoading(true);
                const clubsRef = collection(db, "clubs");
                const clubsSnapshot = await getDocs(clubsRef);

                const myClubs: Club[] = [];

                for (const clubDoc of clubsSnapshot.docs) {
                    const membersRef = collection(db, "clubs", clubDoc.id, "members");
                    const memberQuery = query(membersRef, where("uid", "==", userId));
                    const memberSnapshot = await getDocs(memberQuery);

                    if (!memberSnapshot.empty) {
                        const clubData = clubDoc.data();
                        myClubs.push({
                            id: clubDoc.id,
                            name: clubData.name || "Unnamed Club",
                            description: clubData.description,
                            coverImageUrl: clubData.coverImageUrl,
                            memberCount: clubData.memberCount || 0,
                            isVerified: clubData.isVerified,
                            category: clubData.category,
                            type: clubData.type,
                            isDorm: clubData.isDorm
                        });
                    }
                }

                setClubs(myClubs);
            } catch (error) {
                console.error("Error fetching clubs:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchMyClubs();
    }, [userId]);

    if (loading) {
        return (
            <div className="flex flex-col gap-3">
                <div className="text-center text-sm text-neutral-500 py-10">
                    Loading your clubs...
                </div>
            </div>
        );
    }

    if (clubs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
                <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-neutral-400">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                    </svg>
                </div>
                <div className="text-center">
                    <p className="text-sm font-medium text-white mb-1">No clubs yet</p>
                    <p className="text-xs text-neutral-400 mb-4">Join a club to get started</p>
                    <button
                        onClick={() => router.push("/clubs")}
                        className="px-4 py-2 rounded-full bg-amber-500 text-black text-sm font-semibold hover:bg-amber-400 transition-colors"
                    >
                        Browse Clubs
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            {clubs.map((club) => (
                <button
                    key={club.id}
                    onClick={() => router.push(`/clubs/${club.id}`)}
                    className="flex items-start gap-3 rounded-2xl cc-section p-4 hover:bg-secondary/5 transition-all text-left shadow-sm"
                >
                    {/* Club Cover/Icon */}
                    <div className="shrink-0">
                        <div className="h-14 w-14 overflow-hidden rounded-2xl cc-avatar bg-surface-2 shadow-sm ring-1 ring-secondary/10">
                            {club.coverImageUrl ? (
                                <img
                                    src={club.coverImageUrl}
                                    alt={club.name}
                                    className="!h-full !w-full object-cover object-center transition-transform hover:scale-105"
                                />
                            ) : (club.category === "dorm" || (club as any).type === "dorm" || (club as any).isDorm || club.name?.toLowerCase().includes("dorm")) ? (
                                <div className="h-full w-full flex items-center justify-center bg-secondary text-white">
                                    <HomeIcon className="w-7 h-7" />
                                </div>
                            ) : (
                                <div className="h-full w-full flex items-center justify-center bg-secondary">
                                    <span className="text-xl font-bold text-white uppercase">{club.name.charAt(0)}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Club Info */}
                    <div className="flex-1 min-w-0 py-0.5">
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <h3 className="text-[15px] font-semibold text-foreground truncate">
                                {club.name}
                            </h3>
                            {club.isVerified && (
                                <CheckBadgeIcon className="h-3.5 w-3.5 text-brand shrink-0" />
                            )}
                        </div>
                        {club.description && (
                            <p className="text-xs text-secondary line-clamp-1 mb-1">
                                {club.description}
                            </p>
                        )}
                        <p className="text-[11px] font-medium cc-muted">
                            {club.memberCount || 0} {club.memberCount === 1 ? 'member' : 'members'} • {club.category || "General"}
                        </p>
                    </div>

                    {/* Arrow */}
                    <div className="shrink-0 self-center">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-secondary/30">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                    </div>
                </button>
            ))}
        </div>
    );
}
