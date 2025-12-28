'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { getAllCampusesAndUniversities } from '@/lib/firestore-paths';
import { Campus } from '@/lib/types/campus';
import { PlusIcon, MagnifyingGlassIcon, BuildingOffice2Icon } from '@heroicons/react/24/outline';

function isGlobalAdmin(email?: string | null, admins?: string[] | null) {
    if (!email || !admins) return false;
    return admins.includes(email.toLowerCase());
}

export default function AdminCampusesPage() {
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [globalAdminEmails, setGlobalAdminEmails] = useState<string[] | null>(null);
    const [adminConfigLoading, setAdminConfigLoading] = useState(true);

    const [campuses, setCampuses] = useState<Campus[]>([]);
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
            <div className="flex h-screen items-center justify-center text-neutral-400">
                <div className="animate-pulse">Loading...</div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-4 text-neutral-300">
                <p>You must sign in to access the admin area.</p>
            </div>
        );
    }

    if (!userIsGlobalAdmin) {
        return (
            <div className="flex h-screen items-center justify-center text-neutral-400">
                You are not authorized to view this admin page.
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-2xl px-4 py-8">
            {/* Header */}
            <header className="mb-8 space-y-1">
                <h1 className="text-2xl font-bold tracking-tight text-white">Campuses</h1>
                <p className="text-neutral-400 text-sm">Manage all campuses and universities.</p>
            </header>

            {/* Search & Create */}
            <div className="space-y-4 mb-6">
                {/* Search */}
                <div className="bg-[#1A1A1A] border border-white/10 rounded-3xl overflow-hidden shadow-lg">
                    <div className="flex items-center px-4 py-3 gap-3">
                        <MagnifyingGlassIcon className="h-5 w-5 text-neutral-500" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search campuses..."
                            className="flex-1 bg-transparent text-sm text-white placeholder:text-neutral-500 focus:outline-none"
                        />
                    </div>
                </div>

                {/* Create Button */}
                <Link
                    href="/admin/campuses/create"
                    className="flex items-center justify-center gap-2 w-full rounded-full bg-[#ffb200] py-3 text-sm font-bold text-black shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
                >
                    <PlusIcon className="h-5 w-5" />
                    Create Campus
                </Link>
            </div>

            {/* Campus List */}
            <div className="space-y-3">
                {loading ? (
                    <div className="text-center py-12 text-neutral-500">Loading campuses...</div>
                ) : filteredCampuses.length === 0 ? (
                    <div className="bg-[#1A1A1A] border border-white/10 rounded-3xl p-8 text-center">
                        <p className="text-neutral-400 text-sm">
                            {search ? 'No campuses match your search.' : 'No campuses found.'}
                        </p>
                    </div>
                ) : (
                    filteredCampuses.map((campus) => (
                        <Link
                            key={campus.id}
                            href={`/admin/campuses/${campus.id}`}
                            className="block bg-[#1A1A1A] border border-white/10 rounded-3xl overflow-hidden shadow-lg transition-all hover:bg-white/[0.04] hover:border-white/20"
                        >
                            <div className="flex items-center gap-4 p-4">
                                {/* Icon */}
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/5 text-neutral-500">
                                    <BuildingOffice2Icon className="h-6 w-6" />
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-medium text-white truncate">{campus.name}</h3>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        {campus.shortName && (
                                            <span className="text-xs text-neutral-500">{campus.shortName}</span>
                                        )}
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${campus.isUniversity
                                            ? 'bg-[#ffb200]/10 text-[#ffb200]'
                                            : 'bg-white/5 text-neutral-400'
                                            }`}>
                                            {campus.isUniversity ? 'University' : 'Campus'}
                                        </span>
                                    </div>
                                </div>

                                {/* Locations count */}
                                <div className="text-right shrink-0">
                                    <span className="text-xs text-neutral-500">
                                        {campus.locations?.length || 0} location{campus.locations?.length !== 1 ? 's' : ''}
                                    </span>
                                </div>
                            </div>
                        </Link>
                    ))
                )}
            </div>
        </div>
    );
}
