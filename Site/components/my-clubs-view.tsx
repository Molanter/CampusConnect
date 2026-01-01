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
}

import { CheckBadgeIcon } from "@heroicons/react/24/solid";

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
                            isVerified: clubData.isVerified
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
                    className="flex items-start gap-3 rounded-[24px] border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-all text-left"
                >
                    {/* Club Cover/Icon */}
                    <div className="shrink-0">
                        {club.coverImageUrl ? (
                            <img
                                src={club.coverImageUrl}
                                alt={club.name}
                                className="h-14 w-14 rounded-[18px] object-cover object-center"
                            />
                        ) : (
                            <div className="h-14 w-14 rounded-[18px] bg-gradient-to-br from-amber-500/20 to-orange-600/20 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7 text-amber-400">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                                </svg>
                            </div>
                        )}
                    </div>

                    {/* Club Info */}
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-white mb-0.5 truncate flex items-center gap-1">
                            {club.name}
                            {club.isVerified && (
                                <CheckBadgeIcon className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                            )}
                        </h3>
                        {club.description && (
                            <p className="text-xs text-neutral-400 line-clamp-2 mb-1">
                                {club.description}
                            </p>
                        )}
                        <p className="text-[10px] text-neutral-500">
                            {club.memberCount || 0} {club.memberCount === 1 ? 'member' : 'members'}
                        </p>
                    </div>

                    {/* Arrow */}
                    <div className="shrink-0 pt-1">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-neutral-400">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                    </div>
                </button>
            ))}
        </div>
    );
}
