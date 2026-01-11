"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import { Club, getPublicClubs, getUserClubs, getAllClubs } from "../../lib/clubs";
import { ClubListItem } from "../../components/clubs/club-list-item";
import Link from "next/link";
import { fetchGlobalAdminEmails, isGlobalAdmin } from "../../lib/admin-utils";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { PlusIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";

export default function ClubsHome() {
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [myClubs, setMyClubs] = useState<Club[]>([]);
    const [publicClubs, setPublicClubs] = useState<Club[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
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
        // Exclude clubs the user is already a member of
        const isMember = myClubs.some(myClub => myClub.id === club.id);
        if (isMember) return false;

        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return club.name.toLowerCase().includes(q) || club.description?.toLowerCase().includes(q);
    });

    return (
        <div className="cc-page min-h-screen pb-20">
            <div className="mx-auto max-w-7xl px-4 md:px-8 md:pt-4">

                {/* Header Container */}
                <div className="sticky top-0 z-30 -mt-4 -mx-4 px-4 md:-mx-8 md:px-8 pt-4 pb-12 pointer-events-none">
                    {/* Background Blur Layer (Sibling, so it doesn't mask the items) */}
                    <div className="absolute inset-0 backdrop-blur-3xl bg-background/90 [mask-image:linear-gradient(to_bottom,black_0%,black_20%,transparent_100%)]" />

                    <div className="relative flex items-center gap-3 h-12 pointer-events-auto">
                        {/* Title Capsule */}
                        <div
                            className={`relative transition-all duration-500 ease-out ${isSearchExpanded ? 'absolute scale-95 opacity-0 pointer-events-none' : 'scale-100 opacity-100'}`}
                            style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                        >
                            <div className="cc-glass-strong px-5 py-3 rounded-full border cc-header-item-stroke">
                                <h1 className="text-sm font-bold tracking-tight text-foreground uppercase whitespace-nowrap">Clubs</h1>
                            </div>
                        </div>

                        {/* Spacer */}
                        <div className={`transition-all duration-500 ease-out ${isSearchExpanded ? 'w-0' : 'flex-1'}`} style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }} />

                        {/* Expandable Search Input Container */}
                        <div
                            className={`absolute transition-all duration-500 ease-out ${isSearchExpanded ? 'left-0 right-14 scale-100 opacity-100 pointer-events-auto z-20' : 'left-auto right-0 w-12 scale-95 opacity-0 pointer-events-none z-0'}`}
                            style={{
                                transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                                transformOrigin: 'right center'
                            }}
                        >
                            <div className="cc-glass-strong rounded-full border cc-header-item-stroke">
                                <div
                                    className="relative flex items-center px-4 py-3 transition-opacity duration-300"
                                    style={{
                                        transitionDelay: isSearchExpanded ? '150ms' : '0ms',
                                        opacity: isSearchExpanded ? 1 : 0
                                    }}
                                >
                                    <MagnifyingGlassIcon className="w-4 h-4 text-secondary mr-3 flex-shrink-0" />
                                    <input
                                        autoFocus={isSearchExpanded}
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search clubs..."
                                        className="flex-1 bg-transparent outline-none text-foreground placeholder:text-secondary text-base"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Control Buttons Container */}
                        <div className="flex items-center gap-2 h-full z-10 ml-auto">
                            <AnimatePresence>
                                {!isSearchExpanded && (
                                    <motion.div
                                        key="plus"
                                        initial={{ opacity: 0, scale: 0.8, x: 20 }}
                                        animate={{ opacity: 1, scale: 1, x: 0 }}
                                        exit={{ opacity: 0, scale: 0.8, x: 20 }}
                                        transition={{
                                            duration: 0.4,
                                            ease: [0.34, 1.56, 0.64, 1]
                                        }}
                                    >
                                        <Link
                                            href="/clubs/create"
                                            className="
                                              inline-flex items-center justify-center
                                              rounded-full w-12 h-12
                                              cc-glass-strong
                                              text-foreground
                                              transition-all
                                              hover:scale-105 hover:bg-white/5
                                              active:scale-95
                                              border cc-header-item-stroke
                                            "
                                            title="Create Club"
                                        >
                                            <PlusIcon className="h-5 w-5 text-foreground" strokeWidth={2.5} />
                                        </Link>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Search Toggle */}
                            <button
                                onClick={() => {
                                    setIsSearchExpanded(!isSearchExpanded);
                                    if (isSearchExpanded) setSearchQuery("");
                                }}
                                className="relative flex-shrink-0 w-12 h-12 rounded-full active:scale-95 transition-all duration-500"
                                style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                            >
                                <div className="cc-glass-strong rounded-full absolute inset-0 border cc-header-item-stroke" />
                                <div className="relative flex items-center justify-center h-full">
                                    <div className={`absolute transition-all duration-300 ${isSearchExpanded ? 'opacity-0 scale-50 rotate-90' : 'opacity-100 scale-100 rotate-0'}`} style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                                        <MagnifyingGlassIcon className="h-5 w-5 text-foreground" strokeWidth={2.5} />
                                    </div>
                                    <div className={`absolute transition-all duration-300 ${isSearchExpanded ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 rotate-90'}`} style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                                        <XMarkIcon className="h-5 w-5 text-foreground" strokeWidth={2.5} />
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>



                {loading ? (
                    <div className="mt-20 flex justify-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-[#ffb200]" />
                    </div>
                ) : (
                    <>
                        {/* My Clubs */}
                        {filteredMyClubs.length > 0 && (
                            <div className="mb-10">
                                <h2 className="text-sm font-black text-foreground/50 uppercase tracking-[0.2em] ml-5 mb-3">My Clubs</h2>
                                <div className="cc-section cc-radius-24 overflow-hidden border border-white/5 shadow-lg">
                                    {filteredMyClubs.map((club, index) => (
                                        <ClubListItem
                                            key={club.id}
                                            club={club}
                                            isLast={index === filteredMyClubs.length - 1}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Discovery */}
                        <div className="mb-10">
                            <h2 className="text-sm font-black text-foreground/50 uppercase tracking-[0.2em] ml-5 mb-3">Discover</h2>
                            {filteredPublicClubs.length > 0 ? (
                                <div className="cc-section cc-radius-24 overflow-hidden border border-white/5 shadow-lg">
                                    {filteredPublicClubs.map((club, index) => (
                                        <ClubListItem
                                            key={club.id}
                                            club={club}
                                            isLast={index === filteredPublicClubs.length - 1}
                                        />
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
