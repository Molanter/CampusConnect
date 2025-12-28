'use client';

import { useEffect, useState, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { getCampusOrLegacy, campusDoc, getDormsForCampus } from '@/lib/firestore-paths';
import { Campus, Dorm } from '@/lib/types/campus';
import { ChevronLeftIcon, BuildingOffice2Icon } from '@heroicons/react/24/outline';
import { Switch } from '@headlessui/react';
import Link from 'next/link';

function isGlobalAdmin(email?: string | null, admins?: string[] | null) {
    if (!email || !admins) return false;
    return admins.includes(email.toLowerCase());
}

export default function EditCampusPage(props: { params: Promise<{ id: string }> }) {
    const params = use(props.params);
    const router = useRouter();

    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [globalAdminEmails, setGlobalAdminEmails] = useState<string[] | null>(null);
    const [adminConfigLoading, setAdminConfigLoading] = useState(true);

    const [campus, setCampus] = useState<Campus | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dorms, setDorms] = useState<Dorm[]>([]);

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

    // Load campus data
    useEffect(() => {
        async function load() {
            try {
                const data = await getCampusOrLegacy(params.id);
                if (!data) {
                    router.push('/admin/campuses');
                    return;
                }
                setCampus(data);

                if (data.isUniversity) {
                    const d = await getDormsForCampus(params.id);
                    setDorms(d);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [params.id, router]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!campus) return;
        setSaving(true);
        try {
            const ref = campusDoc(campus.id);
            await setDoc(ref, { ...campus }, { merge: true });
            router.push('/admin/campuses');
        } catch (err: any) {
            console.error(err);
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    const updateField = (field: keyof Campus, value: any) => {
        if (campus) setCampus({ ...campus, [field]: value });
    };

    const handleLocationChange = (index: number, val: string) => {
        if (!campus) return;
        const newLocs = [...campus.locations];
        newLocs[index].name = val;
        setCampus({ ...campus, locations: newLocs });
    };

    // Guards
    if (authLoading || adminConfigLoading || loading) {
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

    if (!campus) return null;

    return (
        <div className="mx-auto w-full max-w-2xl px-4 py-8 pb-24">
            {/* Header */}
            <header className="mb-8 flex items-center gap-4">
                <Link
                    href="/admin/campuses"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-neutral-400 transition-all hover:bg-white/10 hover:text-white"
                >
                    <ChevronLeftIcon className="h-5 w-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Edit Campus</h1>
                    <p className="text-neutral-400 text-sm">{campus.name}</p>
                </div>
            </header>

            <form onSubmit={handleSave} className="space-y-6">

                {/* Basic Info */}
                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 ml-1">Basic Info</label>
                    <div className="bg-[#1A1A1A] border border-white/10 rounded-3xl overflow-hidden shadow-lg divide-y divide-white/5">
                        {/* Name */}
                        <div className="flex items-center justify-between px-4 py-3.5">
                            <span className="text-sm text-neutral-300">Name</span>
                            <input
                                type="text"
                                value={campus.name}
                                onChange={(e) => updateField('name', e.target.value)}
                                className="bg-transparent text-right text-sm text-white focus:outline-none flex-1 ml-4"
                                placeholder="Campus Name"
                            />
                        </div>
                        {/* Short Name */}
                        <div className="flex items-center justify-between px-4 py-3.5">
                            <span className="text-sm text-neutral-300">Short Name</span>
                            <input
                                type="text"
                                value={campus.shortName || ''}
                                onChange={(e) => updateField('shortName', e.target.value || null)}
                                className="bg-transparent text-right text-sm text-white focus:outline-none flex-1 ml-4"
                                placeholder="Acronym"
                            />
                        </div>
                        {/* ID (readonly) */}
                        <div className="flex items-center justify-between px-4 py-3.5">
                            <span className="text-sm text-neutral-300">ID</span>
                            <span className="text-xs text-neutral-500 font-mono">{campus.id}</span>
                        </div>
                    </div>
                </div>

                {/* Locations */}
                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 ml-1">Locations</label>
                    <div className="bg-[#1A1A1A] border border-white/10 rounded-3xl overflow-hidden shadow-lg divide-y divide-white/5">
                        {campus.locations.map((loc, i) => (
                            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                                <span className="text-xs text-neutral-500 font-mono bg-white/5 px-2 py-1 rounded">{loc.id}</span>
                                <input
                                    type="text"
                                    value={loc.name}
                                    onChange={(e) => handleLocationChange(i, e.target.value)}
                                    className="flex-1 bg-transparent text-sm text-white focus:outline-none"
                                    placeholder="Location Name"
                                />
                            </div>
                        ))}
                        {campus.locations.length === 0 && (
                            <div className="px-4 py-3.5 text-sm text-neutral-500">No locations defined.</div>
                        )}
                    </div>
                </div>

                {/* University Mode */}
                <div className="bg-[#1A1A1A] border border-white/10 rounded-3xl px-4 py-3.5 flex items-center justify-between shadow-lg">
                    <div>
                        <span className="text-sm font-medium text-white">University Mode</span>
                        <p className="text-xs text-neutral-500 mt-0.5">Enable dorms and campus life features</p>
                    </div>
                    <Switch
                        checked={campus.isUniversity || false}
                        onChange={(checked) => updateField('isUniversity', checked)}
                        className={`${campus.isUniversity ? 'bg-[#ffb200]' : 'bg-neutral-700'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none`}
                    >
                        <span className={`${campus.isUniversity ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                    </Switch>
                </div>

                {/* Dorms (if university) */}
                {campus.isUniversity && (
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 ml-1">Dorms ({dorms.length})</label>
                        <div className="bg-[#1A1A1A] border border-white/10 rounded-3xl overflow-hidden shadow-lg divide-y divide-white/5">
                            {dorms.length === 0 ? (
                                <div className="px-4 py-3.5 text-sm text-neutral-500">No dorms found.</div>
                            ) : (
                                dorms.map((dorm) => (
                                    <div key={dorm.id} className="flex items-center gap-4 px-4 py-3.5">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-neutral-500">
                                            <BuildingOffice2Icon className="h-5 w-5" />
                                        </div>
                                        <span className="text-sm text-white">{dorm.name}</span>
                                    </div>
                                ))
                            )}
                        </div>
                        <p className="text-xs text-neutral-500 ml-1">Use the Create form to add new dorms.</p>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col gap-3 pt-4">
                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full rounded-full bg-[#ffb200] py-3.5 text-sm font-bold text-black shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:hover:scale-100"
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="w-full rounded-full bg-neutral-800/50 py-3 text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white"
                    >
                        Cancel
                    </button>
                </div>

            </form>
        </div>
    );
}
