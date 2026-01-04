'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getCountFromServer } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { getAllCampusesAndUniversities } from '@/lib/firestore-paths';
import { Campus } from '@/lib/types/campus';
import { PlusIcon, MagnifyingGlassIcon, BuildingOffice2Icon, UserGroupIcon } from '@heroicons/react/24/outline';

function isGlobalAdmin(email?: string | null, admins?: string[] | null) {
    if (!email || !admins) return false;
    return admins.includes(email.toLowerCase());
}

const ui = {
    page: "mx-auto w-full max-w-2xl px-4 py-6 pb-32",
    header: "mb-8 space-y-1.5 px-1",
    title: "text-2xl font-bold tracking-tight text-foreground",
    subtitle: "text-secondary text-[13px] font-medium leading-relaxed",
    section: "space-y-4 mb-8",
    card: "block cc-section rounded-[28px] overflow-hidden shadow-xl border border-secondary/15 transition-all hover:bg-secondary/10 active:scale-[0.99]",
    inputGroup: "cc-glass border border-secondary/15 rounded-full overflow-hidden shadow-lg focus-within:ring-2 focus-within:ring-brand/20 transition-all",
    input: "flex-1 bg-transparent px-5 py-3.5 text-[15px] text-foreground placeholder:text-secondary/40 focus:outline-none",
    // Buttons
    primaryBtn: "flex items-center justify-center gap-2 w-full rounded-full bg-brand py-3.5 text-base font-bold text-brand-foreground shadow-lg shadow-brand/20 transition-all hover:scale-[1.01] active:scale-[0.99]",
    // Item styling
    itemContainer: "flex items-center gap-4 p-4",
    itemIcon: "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-secondary transition-colors group-hover:text-brand",
    itemTitle: "text-[15px] font-bold text-foreground truncate",
    itemMeta: "text-[12px] font-medium text-secondary truncate",
    badge: "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
    universityBadge: "bg-brand/15 text-brand",
    campusBadge: "bg-secondary/10 text-secondary",
    emptyState: "cc-glass border border-secondary/15 rounded-[28px] p-10 text-center",
};

export default function AdminCampusesPage() {
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [globalAdminEmails, setGlobalAdminEmails] = useState<string[] | null>(null);
    const [adminConfigLoading, setAdminConfigLoading] = useState(true);

    const [campuses, setCampuses] = useState<Campus[]>([]);
    const [userCounts, setUserCounts] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Auth
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setAuthLoading(false);
        });
        return () => unsub();
    }, []);

    // Load global admin config
    useEffect(() => {
        const loadAdminConfig = async () => {
            try {
                const ref = doc(db, 'config', 'admin');
                const snap = await getDoc(ref);
                const data = snap.data() as any;
                const emails: string[] = data?.globalAdminEmails ?? [];
                setGlobalAdminEmails(emails.map((e) => e.toLowerCase()));
            } catch (err) {
                console.error('Error loading admin config:', err);
                setGlobalAdminEmails([]);
            } finally {
                setAdminConfigLoading(false);
            }
        };
        void loadAdminConfig();
    }, []);

    const userIsGlobalAdmin = useMemo(
        () => isGlobalAdmin(user?.email, globalAdminEmails),
        [user?.email, globalAdminEmails]
    );

    // Load campuses
    useEffect(() => {
        async function load() {
            try {
                const data = await getAllCampusesAndUniversities();
                data.sort((a, b) => a.name.localeCompare(b.name));
                setCampuses(data);

                // Fetch user counts for each campus
                const counts: Record<string, number> = {};
                await Promise.all(data.map(async (c) => {
                    try {
                        const q = query(collection(db, 'users'), where('campusId', '==', c.id));
                        const snapshot = await getCountFromServer(q);
                        counts[c.id] = snapshot.data().count;
                    } catch (e) {
                        console.error(`Error counting users for ${c.id}:`, e);
                        counts[c.id] = 0;
                    }
                }));
                setUserCounts(counts);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const filteredCampuses = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return campuses;
        return campuses.filter((c) => {
            const name = c.name?.toLowerCase() ?? '';
            const short = c.shortName?.toLowerCase() ?? '';
            return name.includes(term) || short.includes(term);
        });
    }, [campuses, search]);

    // Guards
    if (authLoading || adminConfigLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="cc-muted animate-pulse font-medium">Authenticating...</div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-4 text-secondary">
                <p className="font-medium">You must sign in to access the admin area.</p>
            </div>
        );
    }

    if (!userIsGlobalAdmin) {
        return (
            <div className="flex h-screen items-center justify-center text-secondary font-medium">
                You are not authorized to view this admin page.
            </div>
        );
    }

    return (
        <div className={ui.page}>
            {/* Header */}
            <header className={ui.header}>
                <h1 className={ui.title}>Campuses</h1>
                <p className={ui.subtitle}>Manage all campuses and universities in the system.</p>
            </header>

            {/* Search & Create */}
            <div className={ui.section}>
                {/* Search */}
                <div className={ui.inputGroup}>
                    <div className="flex items-center px-4 gap-3">
                        <MagnifyingGlassIcon className="h-5 w-5 text-secondary/50" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name or code..."
                            className={ui.input}
                        />
                    </div>
                </div>

                {/* Create Button */}
                <Link href="/admin/campuses/create" className={ui.primaryBtn}>
                    <PlusIcon className="h-5 w-5" strokeWidth={2.5} />
                    <span>Create New Campus</span>
                </Link>
            </div>

            {/* Campus List */}
            <div className="space-y-3">
                {loading ? (
                    <div className="text-center py-12 text-secondary animate-pulse font-medium">Loading network...</div>
                ) : filteredCampuses.length === 0 ? (
                    <div className={ui.emptyState}>
                        <p className="text-secondary font-medium text-[15px]">
                            {search ? 'No campuses match your criteria.' : 'No campuses registered yet.'}
                        </p>
                    </div>
                ) : (
                    filteredCampuses.map((campus) => (
                        <Link
                            key={campus.id}
                            href={`/admin/campuses/${campus.id}`}
                            className={`${ui.card} group`}
                        >
                            <div className={ui.itemContainer}>
                                {/* Icon */}
                                <div className={`${ui.itemIcon} ${!campus.logoUrl ? 'bg-secondary/10' : ''}`}>
                                    {campus.logoUrl ? (
                                        <img
                                            src={campus.logoUrl}
                                            alt={campus.name}
                                            className="h-full w-full rounded-xl object-contain"
                                        />
                                    ) : (
                                        <BuildingOffice2Icon className="h-6 w-6" />
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <h3 className={ui.itemTitle}>{campus.name}</h3>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        {campus.shortName && (
                                            <span className={ui.itemMeta}>{campus.shortName}</span>
                                        )}
                                        <span className={`${ui.badge} ${campus.isUniversity ? ui.universityBadge : ui.campusBadge}`}>
                                            {campus.isUniversity ? 'University' : 'Campus'}
                                        </span>
                                    </div>
                                </div>

                                {/* User count */}
                                <div className="text-right shrink-0">
                                    <span className="text-[11px] font-bold text-secondary/60 uppercase tracking-tight">
                                        {userCounts[campus.id] || 0} {userCounts[campus.id] === 1 ? 'member' : 'members'}
                                    </span>
                                </div>
                            </div>
                        </Link>
                    ))
                )}
            </div>
        </div >
    );
}

