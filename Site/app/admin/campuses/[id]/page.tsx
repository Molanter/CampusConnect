'use client';

import { useEffect, useState, use, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
    doc,
    getDoc,
    setDoc,
    collection,
    getDocs,
    query,
    where,
    updateDoc,
    deleteDoc,
    addDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '@/lib/firebase';
import { getCampusOrLegacy, campusDoc, getDormsForCampus } from '@/lib/firestore-paths';
import { Campus, Dorm } from '@/lib/types/campus';
import {
    ChevronLeftIcon,
    BuildingOffice2Icon,
    XMarkIcon,
    PhotoIcon,
    CameraIcon,
    TrashIcon,
    PlusIcon,
    CheckIcon
} from '@heroicons/react/24/outline';
import { Switch } from '@headlessui/react';
import Link from 'next/link';
import Cropper from 'react-easy-crop';

function isGlobalAdmin(email?: string | null, admins?: string[] | null) {
    if (!email || !admins) return false;
    return admins.includes(email.toLowerCase());
}

// Helper to create cropped image blob
async function getCroppedImg(imageSrc: string, pixelCrop: any): Promise<Blob> {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2D context');

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
    );

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas to Blob failed'));
        }, 'image/jpeg');
    });
}

function createImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.addEventListener('load', () => resolve(img));
        img.addEventListener('error', (error) => reject(error));
        img.src = url;
    });
}

type DefaultClub = {
    id?: string;
    name: string;
    description: string;
    logoUrl?: string;
};

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
    textarea: "w-full rounded-2xl bg-secondary/5 border border-secondary/10 px-4 py-3 text-[15px] text-foreground placeholder:text-secondary/40 focus:outline-none focus:border-secondary/20 transition-colors resize-none",
    inputGroup: "px-5 py-4",
    // Buttons
    primaryBtn: "flex-1 rounded-full bg-brand py-3 text-base font-bold text-brand-foreground shadow-lg shadow-brand/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50",
    secondaryBtn: "flex h-12 w-full items-center justify-center rounded-full bg-secondary/10 text-[15px] font-bold text-foreground transition-all hover:bg-secondary/20 active:scale-[0.98]",
    mobileCancelBtn: "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-foreground transition-all hover:bg-secondary/20 active:scale-[0.98]",
    footerText: "text-[11px] text-secondary/60 ml-1.5 leading-relaxed",
    // Item cards (dorms, clubs)
    itemCard: "flex items-center justify-between px-4 py-3 bg-secondary/5 rounded-2xl border border-secondary/10 hover:bg-secondary/10 transition-colors group",
    itemInput: "flex-1 bg-transparent text-[15px] font-medium text-foreground placeholder:text-secondary/40 focus:outline-none",
    itemAddBtn: "w-full rounded-2xl bg-secondary/5 border border-secondary/10 px-4 py-3 text-[15px] font-medium text-secondary hover:bg-secondary/10 hover:text-foreground transition-all flex items-center justify-center gap-2",
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
    const [defaultClubs, setDefaultClubs] = useState<DefaultClub[]>([]);
    const [adminEmailsText, setAdminEmailsText] = useState('');

    // Image cropping state
    const [cropModalOpen, setCropModalOpen] = useState(false);
    const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
    const [cropType, setCropType] = useState<'dorm' | 'club' | 'campus'>('campus');
    const [cropIndex, setCropIndex] = useState<number | undefined>(undefined);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

                // Load admin emails
                if (data.adminEmails && Array.isArray(data.adminEmails)) {
                    setAdminEmailsText(data.adminEmails.join('\n'));
                }

                // Load dorms
                if (data.isUniversity) {
                    const d = await getDormsForCampus(params.id);
                    setDorms(d);
                }

                // Load default clubs
                const clubsQuery = query(
                    collection(db, 'clubs'),
                    where('campusId', '==', params.id),
                    where('isDefault', '==', true)
                );
                const clubsSnap = await getDocs(clubsQuery);
                const clubs: DefaultClub[] = clubsSnap.docs.map(doc => ({
                    id: doc.id,
                    name: doc.data().name || '',
                    description: doc.data().description || '',
                    logoUrl: doc.data().logoUrl
                }));
                setDefaultClubs(clubs);

            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [params.id, router]);

    const onCropComplete = useCallback((_: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleImageSelect = (type: 'dorm' | 'club' | 'campus', index: number | undefined, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setCropImageSrc(reader.result as string);
                setCropType(type);
                setCropIndex(index);
                setCropModalOpen(true);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCropConfirm = async () => {
        if (!cropImageSrc || !croppedAreaPixels) return;

        try {
            const croppedBlob = await getCroppedImg(cropImageSrc, croppedAreaPixels);
            const fileName = `${cropType}_${Date.now()}.jpg`;
            const storageRef = ref(storage, `campuses/${params.id}/${fileName}`);
            await uploadBytes(storageRef, croppedBlob);
            const url = await getDownloadURL(storageRef);

            if (cropType === 'campus') {
                setCampus(prev => prev ? { ...prev, logoUrl: url } : null);
            } else if (cropType === 'dorm' && cropIndex !== undefined) {
                const newDorms = [...dorms];
                newDorms[cropIndex] = { ...newDorms[cropIndex], logoUrl: url };
                setDorms(newDorms);
            } else if (cropType === 'club' && cropIndex !== undefined) {
                const newClubs = [...defaultClubs];
                newClubs[cropIndex] = { ...newClubs[cropIndex], logoUrl: url };
                setDefaultClubs(newClubs);
            }

            setCropModalOpen(false);
            setCropImageSrc(null);
            setCrop({ x: 0, y: 0 });
            setZoom(1);
        } catch (error) {
            console.error('Error uploading image:', error);
            alert('Failed to upload image');
        }
    };

    const handleCropCancel = () => {
        setCropModalOpen(false);
        setCropImageSrc(null);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
    };

    const handleAddDorm = () => setDorms([...dorms, { id: '', name: '', campusId: params.id, locationId: '' }]);
    const handleRemoveDorm = (i: number) => {
        const newDorms = dorms.filter((_, idx) => idx !== i);
        setDorms(newDorms);
    };
    const handleDormChange = (i: number, field: string, value: string) => {
        const newDorms = [...dorms];
        newDorms[i] = { ...newDorms[i], [field]: value };
        setDorms(newDorms);
    };

    const handleAddDefaultClub = () => setDefaultClubs([...defaultClubs, { name: '', description: '' }]);
    const handleRemoveDefaultClub = (i: number) => {
        const newClubs = defaultClubs.filter((_, idx) => idx !== i);
        setDefaultClubs(newClubs);
    };
    const handleClubChange = (i: number, field: string, value: string) => {
        const newClubs = [...defaultClubs];
        newClubs[i] = { ...newClubs[i], [field]: value };
        setDefaultClubs(newClubs);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!campus) return;
        setSaving(true);
        try {
            // 1. Parse admin emails
            const adminEmails = adminEmailsText
                .split('\n')
                .map(line => line.trim().toLowerCase())
                .filter(email => email.length > 0);

            // 2. Resolve admin UIDs
            const adminUids: string[] = [];
            for (const email of adminEmails) {
                const usersQuery = query(collection(db, 'users'), where('email', '==', email));
                const usersSnap = await getDocs(usersQuery);
                if (!usersSnap.empty) {
                    const uid = usersSnap.docs[0].id;
                    if (!adminUids.includes(uid)) {
                        adminUids.push(uid);
                    }
                }
            }

            // 3. Update campus
            const campusUpdate = {
                ...campus,
                adminEmails,
                adminUids
            };
            await setDoc(campusDoc(campus.id), campusUpdate, { merge: true });

            // 4. Update/Create Dorms
            const existingDormIds = new Set(dorms.filter(d => d.id).map(d => d.id));
            const dormCollection = collection(db, 'dorms');

            for (const dorm of dorms) {
                if (dorm.id) {
                    // Update existing
                    await updateDoc(doc(db, 'dorms', dorm.id), {
                        name: dorm.name,
                        logoUrl: dorm.logoUrl || null
                    });
                } else {
                    // Create new
                    const newDormRef = await addDoc(dormCollection, {
                        name: dorm.name,
                        campusId: params.id,
                        logoUrl: dorm.logoUrl || null
                    });
                    dorm.id = newDormRef.id;
                }
            }

            // Delete removed dorms
            const allDormsSnap = await getDocs(query(collection(db, 'dorms'), where('campusId', '==', params.id)));
            for (const dormDoc of allDormsSnap.docs) {
                if (!existingDormIds.has(dormDoc.id)) {
                    await deleteDoc(doc(db, 'dorms', dormDoc.id));
                }
            }

            // 5. Update/Create Default Clubs
            const clubsQuery = query(
                collection(db, 'clubs'),
                where('campusId', '==', params.id),
                where('isDefault', '==', true)
            );
            const existingClubsSnap = await getDocs(clubsQuery);
            const existingClubIds = new Set<string>();

            for (let i = 0; i < defaultClubs.length; i++) {
                const club = defaultClubs[i];
                if (!club.name.trim()) continue;

                // Try to match by name
                const matchingDoc = existingClubsSnap.docs.find(d => d.data().name === club.name);

                if (matchingDoc) {
                    // Update existing
                    await updateDoc(doc(db, 'clubs', matchingDoc.id), {
                        description: club.description,
                        logoUrl: club.logoUrl || null
                    });
                    existingClubIds.add(matchingDoc.id);
                } else {
                    // Create new
                    const newClubRef = await addDoc(collection(db, 'clubs'), {
                        name: club.name,
                        description: club.description,
                        campusId: params.id,
                        logoUrl: club.logoUrl || null,
                        isDefault: true,
                        members: [],
                        createdAt: new Date()
                    });
                    existingClubIds.add(newClubRef.id);
                }
            }

            // Delete removed default clubs
            for (const clubDoc of existingClubsSnap.docs) {
                if (!existingClubIds.has(clubDoc.id)) {
                    await deleteDoc(doc(db, 'clubs', clubDoc.id));
                }
            }

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
        <>
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
                    {/* Campus Logo */}
                    <div className={ui.section}>
                        <label className={ui.sectionLabel}>Identity & Branding</label>
                        <div className={ui.card}>
                            <div className="px-5 py-4">
                                <label className={ui.label}>Campus Logo</label>
                                <div className="flex items-center gap-4 mt-3">
                                    <div className="relative h-20 w-20 rounded-2xl overflow-hidden bg-secondary/5 border border-secondary/10 flex items-center justify-center group cursor-pointer"
                                        onClick={() => fileInputRef.current?.click()}>
                                        {campus.logoUrl ? (
                                            <img src={campus.logoUrl} alt="Campus Logo" className="h-full w-full object-cover" />
                                        ) : (
                                            <CameraIcon className="h-8 w-8 text-secondary" />
                                        )}
                                        <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <PhotoIcon className="h-6 w-6 text-foreground" />
                                        </div>
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleImageSelect('campus', undefined, e)}
                                        className="hidden"
                                    />
                                    <div className="flex-1">
                                        <p className="text-[13px] text-secondary">Upload a square logo</p>
                                        <p className="text-[11px] text-secondary/60 mt-0.5">Recommended: 512x512px</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Basic Info */}
                    <div className={ui.section}>
                        <label className={ui.sectionLabel}>Basic Information</label>
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
                                <span className={ui.label}>Abbreviation <span className="text-red-500">*</span></span>
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
                            <label className={ui.sectionLabel}>Dorms & Residences</label>
                            <div className="space-y-4">
                                {dorms.map((dorm, i) => (
                                    <div key={i} className="flex items-start gap-4">
                                        <div className={`${ui.card} flex-1`}>
                                            <div className="flex items-center gap-4 p-4">
                                                <div
                                                    className="relative h-14 w-14 rounded-xl cc-glass cc-section border border-secondary/15 flex items-center justify-center cursor-pointer hover:ring-1 hover:ring-brand/30 transition-all overflow-hidden"
                                                    onClick={() => document.getElementById(`dorm-img-${i}`)?.click()}
                                                >
                                                    {dorm.logoUrl ? (
                                                        <img src={dorm.logoUrl} alt={dorm.name} className="h-full w-full object-contain p-1" />
                                                    ) : (
                                                        <CameraIcon className="h-6 w-6 text-secondary/30" />
                                                    )}
                                                </div>
                                                <input
                                                    type="file"
                                                    id={`dorm-img-${i}`}
                                                    className="hidden"
                                                    accept="image/*"
                                                    onChange={(e) => handleImageSelect('dorm', i, e)}
                                                />
                                                <div className="flex-1 min-w-0 space-y-1">
                                                    <input
                                                        placeholder="Dorm Name"
                                                        className="w-full bg-transparent text-[15px] font-medium text-foreground placeholder:text-secondary/40 focus:outline-none"
                                                        value={dorm.name}
                                                        onChange={e => handleDormChange(i, 'name', e.target.value)}
                                                    />
                                                    <input
                                                        placeholder="Admin email (optional)"
                                                        className="w-full bg-transparent text-[13px] text-secondary placeholder:text-secondary/40 focus:outline-none"
                                                        value={(dorm as any).adminEmail || ''}
                                                        onChange={e => handleDormChange(i, 'adminEmail', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveDorm(i)}
                                            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-secondary hover:bg-red-500/10 hover:text-red-500 transition-all"
                                        >
                                            <TrashIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                ))}

                                <button
                                    type="button"
                                    onClick={handleAddDorm}
                                    className={ui.itemAddBtn}
                                >
                                    <PlusIcon className="h-5 w-5" />
                                    Add Dorm
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Default Clubs */}
                    <div className={ui.section}>
                        <label className={ui.sectionLabel}>Default Clubs</label>
                        <div className="space-y-4">
                            {defaultClubs.map((club, i) => (
                                <div key={i} className="flex items-start gap-4">
                                    <div className={`${ui.card} flex-1`}>
                                        <div className="flex items-center gap-4 p-4">
                                            <div
                                                className="relative h-14 w-14 rounded-xl cc-glass cc-section border border-secondary/15 flex items-center justify-center cursor-pointer hover:ring-1 hover:ring-brand/30 transition-all overflow-hidden"
                                                onClick={() => document.getElementById(`club-img-${i}`)?.click()}
                                            >
                                                {club.logoUrl ? (
                                                    <img src={club.logoUrl} alt={club.name} className="h-full w-full object-contain p-1" />
                                                ) : (
                                                    <CameraIcon className="h-6 w-6 text-secondary/30" />
                                                )}
                                            </div>
                                            <input
                                                type="file"
                                                id={`club-img-${i}`}
                                                className="hidden"
                                                accept="image/*"
                                                onChange={(e) => handleImageSelect('club', i, e)}
                                            />
                                            <div className="flex-1 min-w-0 space-y-1">
                                                <input
                                                    placeholder="Club Name"
                                                    className="w-full bg-transparent text-[15px] font-medium text-foreground placeholder:text-secondary/40 focus:outline-none"
                                                    value={club.name}
                                                    onChange={e => handleClubChange(i, 'name', e.target.value)}
                                                />
                                                <input
                                                    placeholder="Description"
                                                    className="w-full bg-transparent text-[13px] text-secondary placeholder:text-secondary/40 focus:outline-none"
                                                    value={club.description}
                                                    onChange={e => handleClubChange(i, 'description', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveDefaultClub(i)}
                                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-secondary hover:bg-red-500/10 hover:text-red-500 transition-all"
                                    >
                                        <TrashIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            ))}

                            <button
                                type="button"
                                onClick={handleAddDefaultClub}
                                className={ui.itemAddBtn}
                            >
                                <PlusIcon className="h-5 w-5" />
                                Add Default Club
                            </button>
                        </div>
                        <p className={ui.footerText}>These clubs will be created automatically for all new users.</p>
                    </div>

                    {/* Authorized Moderators */}
                    <div className={ui.section}>
                        <label className={ui.sectionLabel}>Administrative Control</label>
                        <div className={ui.card}>
                            <div className={ui.inputGroup}>
                                <label className={ui.label}>Authorized Moderators <span className="text-red-500">*</span></label>
                                <textarea
                                    rows={4}
                                    className={ui.textarea}
                                    value={adminEmailsText}
                                    onChange={e => setAdminEmailsText(e.target.value)}
                                    placeholder="Enter admin emails (one per line)"
                                />
                            </div>
                        </div>
                        <p className={ui.footerText}>These users will have full administrative control over this campus profile.</p>
                    </div>

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
                                {saving ? 'Saving Changes...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            {/* Crop Modal */}
            {cropModalOpen && cropImageSrc && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="relative h-[70vh] w-full max-w-lg cc-glass border border-secondary/15 rounded-[40px] overflow-hidden shadow-2xl mx-4">
                        <div className="absolute inset-0">
                            <Cropper
                                image={cropImageSrc}
                                crop={crop}
                                zoom={zoom}
                                aspect={1}
                                onCropChange={setCrop}
                                onZoomChange={setZoom}
                                onCropComplete={onCropComplete}
                            />
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-background/80 backdrop-blur-xl border-t border-secondary/15 p-6">
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={handleCropCancel}
                                    className="flex-1 rounded-full bg-secondary/10 py-3 text-base font-bold text-foreground transition-all hover:bg-secondary/20"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCropConfirm}
                                    className="flex-1 rounded-full bg-brand py-3 text-base font-bold text-brand-foreground shadow-lg shadow-brand/20 transition-all hover:scale-[1.01]"
                                >
                                    <CheckIcon className="h-5 w-5 inline mr-2" />
                                    Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
