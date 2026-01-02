"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import { Club, getPublicClubs, getUserClubs, getAllClubs } from "../../lib/clubs";
import { ClubCard } from "../../components/clubs/club-card";
import Link from "next/link";
import { PlusIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { fetchGlobalAdminEmails, isGlobalAdmin } from "../../lib/admin-utils";
import { collection, query, where, getDocs, limit } from "firebase/firestore";

export default function ClubsHome() {
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [myClubs, setMyClubs] = useState<Club[]>([]);
    const [publicClubs, setPublicClubs] = useState<Club[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            setCurrentUser(u);

            setLoading(true);
            try {
                // 1. Check Admin Status
                let isAdmin = false;
                if (u && u.email) {
                    const globalAdmins = await fetchGlobalAdminEmails();
                    if (isGlobalAdmin(u.email, globalAdmins)) {
                        isAdmin = true;
                    } else {
                        // Check if Campus Admin (admin for at least one campus)
                        const qCampus = query(
                            collection(db, "campuses"),
                            where("adminEmails", "array-contains", u.email.toLowerCase())
                        );

                        const snapCampus = await getDocs(qCampus);

                        if (!snapCampus.empty) {
                            isAdmin = true;
                        }
                    }
                }

                // 2. Fetch User Profile to get CampusID
                let campusId = null;
                if (u) {
                    const userDoc = await import("firebase/firestore").then(fs => fs.getDoc(fs.doc(db, "users", u.uid)));
                    if (userDoc.exists()) {
                        const data = userDoc.data();
                        campusId = data.campusId || data.universityId; // Fallback to legacy
                    }
                }

                // 3. Fetch Clubs
                // If we have a campusId, filter by it. Otherwise show all public (or maybe none? Prompt implies only mine)
                // If user is guest, we might show generic public clubs or prompt login.
                const { getAllClubs, getUserClubs, getClubsForCampus } = await import("../../lib/clubs");

                let clubsList: Club[] = [];
                if (campusId) {
                    clubsList = await getClubsForCampus(campusId);
                } else {
                    // Fallback if no campus or guest: show all public (or generic)
                    clubsList = await getAllClubs();
                }

                const filteredPublic = (clubsList || []).filter(c => c.status !== 'hidden');
                const userList = u ? await getUserClubs(u.uid) : [];
                const filteredMy = (userList || []).filter(c => c.status !== 'hidden');

                setPublicClubs(filteredPublic);
                setMyClubs(filteredMy);
            } catch (err) {
                console.error("Error loading clubs:", err);
            } finally {
                setLoading(false);
            }
        });
        return () => unsub();
    }, []);

    const filteredMyClubs = myClubs.filter(club => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return club.name.toLowerCase().includes(q) || club.description?.toLowerCase().includes(q);
    });

    const filteredPublicClubs = publicClubs.filter(club => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return club.name.toLowerCase().includes(q) || club.description?.toLowerCase().includes(q);
    });

    return (
        <div className="cc-page min-h-screen pb-20">
            <div className="mx-auto max-w-7xl px-4 md:px-8 md:pt-4">

                {/* Header */}
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">Clubs</h1>
                        <p className="mt-1 text-secondary">Discover and join communities on campus.</p>
                    </div>

                    <Link
                        href="/clubs/create"
                        className="
                          flex items-center justify-center gap-2
                          rounded-full
                          bg-brand text-brand-foreground
                          px-5 py-2.5 text-sm font-bold
                          cc-hover-shadow
                          transition-transform
                          hover:scale-105
                          active:scale-95
                        "
                    >
                        <PlusIcon className="h-5 w-5" strokeWidth={2.5} />
                        Create Club
                    </Link>
                </div>

                {/* Search */}
                <div className="relative mb-10 cc-glass cc-radius-24 border border-secondary/25">
                    <MagnifyingGlassIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search for clubs..."
                        className="
                          h-12 w-full
                          bg-transparent
                          pl-12 pr-4
                          text-foreground
                          placeholder:text-secondary
                          focus:outline-none
                        "
                    />
                </div>

                {loading ? (
                    <div className="mt-20 flex justify-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-[#ffb200]" />
                    </div>
                ) : (
                    <>
                        {/* My Clubs */}
                        {filteredMyClubs.length > 0 && (
                            <div className="mb-12">
                                <h2 className="mb-4 text-xl font-semibold text-foreground">My Clubs</h2>
                                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                    {filteredMyClubs.map(club => (
                                        <ClubCard key={club.id} club={club} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Discovery */}
                        <div>
                            <h2 className="mb-4 text-xl font-semibold text-foreground">Discover</h2>
                            {filteredPublicClubs.length > 0 ? (
                                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                    {filteredPublicClubs.map(club => (
                                        <ClubCard key={club.id} club={club} />
                                    ))}
                                </div>
                            ) : (
                                <div className="cc-section cc-radius-24 py-12 text-center border border-dashed border-secondary/30">
                                    <p className="text-secondary">No public clubs found yet. Be the first to create one!</p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
