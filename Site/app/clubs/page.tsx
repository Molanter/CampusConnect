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
                        // Check if Campus Admin (admin for at least one university)
                        // Note: We use array-contains. Ensure emails in DB are lowercased if u.email is.
                        // Ideally we should handle case sensitivity, but standard query here is:
                        const qUni = query(
                            collection(db, "universities"),
                            where("adminEmails", "array-contains", u.email.toLowerCase())
                        );
                        const snapUni = await getDocs(qUni);
                        if (!snapUni.empty) {
                            isAdmin = true;
                        }
                    }
                }

                // 2. Fetch Clubs - show all clubs including private (users can request to join private clubs)
                const [clubsList, userList] = await Promise.all([
                    getAllClubs(), // Show all clubs to everyone
                    u ? getUserClubs(u.uid) : Promise.resolve([])
                ]);

                setPublicClubs(clubsList);
                setMyClubs(userList);
            } catch (err) {
                console.error("Error loading clubs:", err);
            } finally {
                setLoading(false);
            }
        });
        return () => unsub();
    }, []);

    return (
        <div className="min-h-screen pb-20">
            <div className="mx-auto max-w-7xl px-4 md:px-8 md:pt-4">

                {/* Header */}
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-white">Clubs</h1>
                        <p className="mt-1 text-zinc-400">Discover and join communities on campus.</p>
                    </div>

                    <Link
                        href="/clubs/create"
                        className="flex items-center justify-center gap-2 rounded-full bg-[#ffb200] px-5 py-2.5 text-sm font-bold text-black shadow-lg shadow-[#ffb200]/20 transition-all hover:scale-105 hover:bg-[#ffc233] active:scale-95"
                    >
                        <PlusIcon className="h-5 w-5" strokeWidth={2.5} />
                        Create Club
                    </Link>
                </div>

                {/* Search (Visual Only for now) */}
                <div className="relative mb-10">
                    <MagnifyingGlassIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Search for clubs..."
                        className="h-12 w-full rounded-full border border-white/10 bg-[#111] pl-12 pr-4 text-white placeholder-zinc-500 shadow-sm focus:border-[#ffb200]/50 focus:outline-none focus:ring-1 focus:ring-[#ffb200]/50"
                    />
                </div>

                {loading ? (
                    <div className="mt-20 flex justify-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-[#ffb200]" />
                    </div>
                ) : (
                    <>
                        {/* My Clubs */}
                        {myClubs.length > 0 && (
                            <div className="mb-12">
                                <h2 className="mb-4 text-xl font-semibold text-white">My Clubs</h2>
                                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                    {myClubs.map(club => (
                                        <ClubCard key={club.id} club={club} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Discovery */}
                        <div>
                            <h2 className="mb-4 text-xl font-semibold text-white">Discover</h2>
                            {publicClubs.length > 0 ? (
                                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                    {publicClubs.map(club => (
                                        <ClubCard key={club.id} club={club} />
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 py-12 text-center">
                                    <p className="text-zinc-400">No public clubs found yet. Be the first to create one!</p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
