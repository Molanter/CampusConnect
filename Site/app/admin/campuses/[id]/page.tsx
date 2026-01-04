'use client';

import { useEffect, useState, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { getCampusOrLegacy, campusDoc, getDormsForCampus } from '@/lib/firestore-paths';
import { Campus, Dorm } from '@/lib/types/campus';
import { ChevronLeftIcon, BuildingOffice2Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { Switch } from '@headlessui/react';
import Link from 'next/link';

function isGlobalAdmin(email?: string | null, admins?: string[] | null) {
    if (!email || !admins) return false;
    return admins.includes(email.toLowerCase());
}

const ui = {
    page: "mx-auto w-full max-w-2xl px-4 py-6 pb-32",
    header: "flex items-center gap-3.5 px-1 pt-2 pb-8",
    backBtn: "inline-flex h-10 w-10 items-center justify-center rounded-full cc-glass border border-secondary/15 text-foreground transition-all hover:bg-secondary/10",
    title: "text-2xl font-bold tracking-tight text-foreground",
    subtitle: "text-secondary text-[13px] font-medium leading-relaxed",
    section: "space-y-2.5",
    sectionLabel: "text-[12px] font-bold uppercase tracking-widest text-secondary ml-1.5",
    card: "cc-glass cc-section rounded-[28px] overflow-hidden shadow-xl border border-secondary/15 divide-y divide-secondary/10",
    row: "flex items-center justify-between px-5 py-4 min-h-[56px]",
    label: "text-[14px] font-medium text-secondary shrink-0",
    input: "bg-transparent text-right text-[15px] font-medium text-foreground placeholder:text-secondary/40 focus:outline-none flex-1 ml-4",
    // Buttons
    primaryBtn: "flex-1 rounded-full bg-brand py-3 text-base font-bold text-brand-foreground shadow-lg shadow-brand/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50",
    secondaryBtn: "flex h-12 w-full items-center justify-center rounded-full bg-secondary/10 text-[15px] font-bold text-foreground transition-all hover:bg-secondary/20 active:scale-[0.98]",
    mobileCancelBtn: "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-foreground transition-all hover:bg-secondary/20 active:scale-[0.98]",
    footerText: "text-[11px] text-secondary/60 ml-1.5 leading-relaxed",
};

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
            <div className="flex h-screen items-center justify-center">
                <div className="cc-muted animate-pulse font-medium">Loading details...</div>
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

    if (!campus) return null;

    return (
        <div className={ui.page}>
            {/* Header */}
            <header className={ui.header}>
                <Link href="/admin/campuses" className={ui.backBtn}>
                    <ChevronLeftIcon className="h-5 w-5" />
                </Link>
                <div>
                    <h1 className={ui.title}>Edit Campus</h1>
                    <p className={ui.subtitle}>{campus.name}</p>
                </div>
            </header>

            <form onSubmit={handleSave} className="space-y-8">
                {/* Basic Info */}
                <div className={ui.section}>
                    <label className={ui.sectionLabel}>Identity & Details</label>
                    <div className={ui.card}>
                        {/* Name */}
                        <div className={ui.row}>
                            <span className={ui.label}>Name</span>
                            <input
                                type="text"
                                value={campus.name}
                                onChange={(e) => updateField('name', e.target.value)}
                                className={ui.input}
                                placeholder="Campus Name"
                            />
                        </div>
                        {/* Short Name */}
                        <div className={ui.row}>
                            <span className={ui.label}>Code <span className="text-red-500">*</span></span>
                            <input
                                type="text"
                                value={campus.shortName || ''}
                                onChange={(e) => updateField('shortName', e.target.value || null)}
                                className={ui.input}
                                placeholder="Acronym"
                            />
                        </div>
                        {/* ID (readonly) */}
                        <div className={ui.row}>
                            <span className={ui.label}>Database ID</span>
                            <span className="text-[13px] text-secondary/60 font-mono tracking-tighter">{campus.id}</span>
                        </div>
                    </div>
                </div>

                {/* Locations */}
                <div className={ui.section}>
                    <label className={ui.sectionLabel}>Locations <span className="text-red-500">*</span></label>
                    <div className={ui.card}>
                        {campus.locations.map((loc, i) => (
                            <div key={i} className={ui.row}>
                                <input
                                    type="text"
                                    value={loc.name}
                                    onChange={(e) => handleLocationChange(i, e.target.value)}
                                    className={ui.input}
                                    placeholder="Location Name"
                                />
                            </div>
                        ))}
                        {campus.locations.length === 0 && (
                            <div className="px-5 py-6 text-sm text-secondary/50 text-center italic">No locations defined.</div>
                        )}
                    </div>
                </div>

                {/* University Mode */}
                <div className={ui.section}>
                    <label className={ui.sectionLabel}>Features</label>
                    <div className={ui.card}>
                        <div className={ui.row}>
                            <div>
                                <span className="text-[15px] font-bold text-foreground">University Mode</span>
                                <p className="text-[11px] text-secondary mt-0.5">Enable dorms and campus life features</p>
                            </div>
                            <Switch
                                checked={campus.isUniversity || false}
                                onChange={(checked) => updateField('isUniversity', checked)}
                                className={`${campus.isUniversity ? 'bg-brand' : 'bg-secondary/20'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none`}
                            >
                                <span className={`${campus.isUniversity ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                            </Switch>
                        </div>
                    </div>
                </div>

                {/* Dorms (if university) */}
                {campus.isUniversity && (
                    <div className={ui.section}>
                        <label className={ui.sectionLabel}>Active Dorms ({dorms.length})</label>
                        <div className={ui.card}>
                            {dorms.length === 0 ? (
                                <div className="px-5 py-6 text-sm text-secondary/50 text-center italic">No dorms found for this campus.</div>
                            ) : (
                                dorms.map((dorm) => (
                                    <div key={dorm.id} className={ui.row}>
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary/5 text-secondary">
                                                <BuildingOffice2Icon className="h-5 w-5" />
                                            </div>
                                            <span className="text-[15px] font-bold text-foreground">{dorm.name}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <p className={ui.footerText}>New dorms must be added through the master registration form.</p>
                    </div>
                )}

                {/* Actions */}
                <div className="space-y-3 pt-6">
                    <div className="flex items-center gap-4">
                        {/* Desktop Cancel */}
                        <Link href="/admin/campuses" className="hidden sm:flex flex-1">
                            <div className={ui.secondaryBtn}>Cancel</div>
                        </Link>

                        {/* Mobile Cancel (X mark) */}
                        <Link href="/admin/campuses" className="flex sm:hidden">
                            <div className={ui.mobileCancelBtn}>
                                <XMarkIcon className="h-6 w-6" />
                            </div>
                        </Link>

                        <button
                            type="submit"
                            disabled={saving}
                            className={ui.primaryBtn}
                        >
                            {saving ? 'Processing...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
