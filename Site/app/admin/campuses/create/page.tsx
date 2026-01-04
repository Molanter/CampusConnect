'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { addDoc, collection, serverTimestamp, setDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, auth, storage } from '@/lib/firebase';
import { campusesCol, campusDormsCol } from '@/lib/firestore-paths';
import { Campus } from '@/lib/types/campus';
import { onAuthStateChanged, User } from 'firebase/auth';
import { PhotoIcon, XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Switch } from '@headlessui/react';

const ui = {
    page: "mx-auto w-full max-w-2xl px-4 py-8 pb-32",
    header: "mb-8 space-y-1.5",
    title: "text-3xl font-bold tracking-tight text-foreground",
    subtitle: "text-secondary text-sm",
    section: "space-y-2",
    sectionLabel: "text-[12px] font-bold uppercase tracking-widest text-secondary ml-1.5",
    card: "cc-glass cc-section rounded-[28px] overflow-hidden shadow-xl border border-secondary/15 divide-y divide-secondary/10",
    inputRow: "w-full bg-transparent px-5 py-4 text-[15px] text-foreground placeholder:text-secondary/50 focus:outline-none hover:bg-secondary/5 transition-colors",
    textAreaRow: "w-full resize-none bg-transparent px-5 py-4 text-[15px] text-foreground placeholder:text-secondary/50 focus:outline-none hover:bg-secondary/5 transition-colors",
    footerText: "text-[11px] text-secondary/60 ml-1.5 leading-relaxed",
    // Toggle / Switch
    toggleContainer: "cc-glass cc-section rounded-[24px] px-5 py-4 flex items-center justify-between shadow-lg border border-secondary/15",
    toggleLabel: "text-[15px] font-semibold text-foreground",
    toggleSublabel: "text-[11px] text-secondary mt-0.5",
    // Item Cards (Clubs/Dorms)
    itemCard: "flex-1 cc-glass cc-section rounded-[24px] overflow-hidden shadow-lg border border-secondary/15",
    itemAvatar: "flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-secondary/10 text-secondary ring-1 ring-secondary/20 transition-all hover:bg-secondary/20 hover:text-foreground shadow-inner",
    // Buttons
    primaryBtn: "w-full rounded-full bg-brand py-4 text-base font-bold text-brand-foreground shadow-lg shadow-brand/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50",
    secondaryBtn: "w-full rounded-full bg-secondary/10 py-3.5 text-sm font-semibold text-foreground transition-all hover:bg-secondary/20 active:scale-[0.98]",
    actionBtn: "rounded-full bg-foreground/5 px-4 py-2 text-[12px] font-semibold text-foreground hover:bg-foreground/10 transition-colors border border-foreground/5",
    removeBtn: "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-secondary/40 transition-all hover:bg-red-500/10 hover:text-red-500",
};

export default function CreateCampusPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Identity
    const [name, setName] = useState('');
    const [shortName, setShortName] = useState('');

    // Logo State
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Config
    const [adminEmails, setAdminEmails] = useState('');
    const [locationName, setLocationName] = useState('');

    // Default Clubs: Name, Description, Admin Email, Image
    const [defaultClubs, setDefaultClubs] = useState<{
        name: string;
        description: string;
        adminEmail: string;
        imageFile?: File;
        previewUrl?: string;
    }[]>([{ name: 'General', description: '', adminEmail: '' }, { name: 'Announcements', description: '', adminEmail: '' }]);

    // University Mode
    const [isUniversity, setIsUniversity] = useState(false);

    // Dorms: Name, Admin Email, Image (for Club creation)
    const [dorms, setDorms] = useState<{
        name: string;
        adminEmail: string;
        imageFile?: File;
        previewUrl?: string;
    }[]>([{ name: '', adminEmail: '' }]);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, u => setCurrentUser(u));
        return () => unsub();
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.type !== 'image/png') {
                alert("Only PNG files are allowed for logos.");
                return;
            }
            setSelectedImage(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const clearImage = () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setSelectedImage(null);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    // Club Helpers
    const handleAddDefaultClub = () => setDefaultClubs([...defaultClubs, { name: '', description: '', adminEmail: '' }]);
    const handleRemoveDefaultClub = (i: number) => setDefaultClubs(defaultClubs.filter((_, idx) => idx !== i));
    const handleDefaultClubChange = (i: number, field: 'name' | 'adminEmail' | 'description', value: string) => {
        const newClubs = [...defaultClubs];
        newClubs[i][field] = value;
        setDefaultClubs(newClubs);
    };
    const handleDefaultClubImage = (i: number, file: File) => {
        if (file.type !== 'image/png') return alert("Only PNG allowed");
        const newClubs = [...defaultClubs];
        newClubs[i].imageFile = file;
        newClubs[i].previewUrl = URL.createObjectURL(file);
        setDefaultClubs(newClubs);
    };

    // Dorm Helpers
    const handleAddDorm = () => setDorms([...dorms, { name: '', adminEmail: '' }]);
    const handleRemoveDorm = (i: number) => setDorms(dorms.filter((_, idx) => idx !== i));
    const handleDormChange = (i: number, field: 'name' | 'adminEmail', value: string) => {
        const newDorms = [...dorms];
        newDorms[i][field] = value;
        setDorms(newDorms);
    };
    const handleDormImage = (i: number, file: File) => {
        if (file.type !== 'image/png') return alert("Only PNG allowed");
        const newDorms = [...dorms];
        newDorms[i].imageFile = file;
        newDorms[i].previewUrl = URL.createObjectURL(file);
        setDorms(newDorms);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return alert('Name is required');
        if (!locationName.trim()) return alert('Location (City) is required');
        if (!currentUser) return alert("You must be logged in.");

        setLoading(true);

        try {
            // --- 1. PREPARE DATA ---
            const campusAdmins = adminEmails.split('\n').map(e => e.trim().toLowerCase()).filter(Boolean);

            const locId = locationName.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
            const formattedLocations = [{
                id: locId,
                name: locationName.trim()
            }];

            // Initial Object without Logo
            const campusData: Omit<Campus, 'id'> = {
                name: name.trim(),
                shortName: shortName.trim() || null,
                locations: formattedLocations,
                isActive: true,
                adminEmails: campusAdmins,
                themeColor: '#000000',
                primaryColor: null,
                secondaryColor: null,
                isUniversity,
                createdAt: serverTimestamp() as any,
                createdBy: currentUser.uid
            };

            // --- 2. CREATE CAMPUS DOC FIRST (To get ID) ---
            const docRef = await addDoc(campusesCol(), campusData);
            const campusId = docRef.id;

            // --- 3. UPLOAD LOGO (If exists) ---
            if (selectedImage) {
                const storagePath = `campuses/${campusId}/logo.png`;
                const storageRef = ref(storage, storagePath);
                await uploadBytes(storageRef, selectedImage);
                const downloadUrl = await getDownloadURL(storageRef);

                await updateDoc(docRef, { logoUrl: downloadUrl });
            }

            // --- 4. HANDLE EXTRAS ---
            const batchPromises = [];

            // A. UNIVERSITY ONLY: DORMS & DORM CLUBS
            if (isUniversity) {
                const validDorms = dorms.filter(d => d.name.trim());
                if (validDorms.length > 0) {
                    const dormsRef = campusDormsCol(campusId);
                    const clubsRef = collection(db, 'clubs'); // For Dorm Clubs
                    const defaultLocationId = formattedLocations[0].id;

                    const dormPromises = validDorms.map(async (d) => {
                        // 1. Create Dorm Doc
                        const specificAdmin = d.adminEmail.trim().toLowerCase();
                        const dormAdmins = [...campusAdmins];
                        if (specificAdmin && !dormAdmins.includes(specificAdmin)) {
                            dormAdmins.push(specificAdmin);
                        }

                        await addDoc(dormsRef, {
                            name: d.name.trim(),
                            locationId: defaultLocationId,
                            createdAt: serverTimestamp(),
                            adminEmails: dormAdmins
                        });

                        // 2. Create Club for Dorm
                        const dormClubName = d.name.trim();
                        const clubDoc = await addDoc(clubsRef, {
                            name: dormClubName,
                            description: `One of the dorms (residences) of ${name}`,
                            campusId: campusId,
                            isPrivate: false,
                            isDefault: false,
                            memberCount: 1,
                            memberIds: [currentUser.uid],
                            adminUids: [currentUser.uid],
                            adminEmails: dormAdmins,
                            createdBy: currentUser.uid,
                            createdAt: serverTimestamp(),
                            allowMemberPosts: true,
                            category: "dorm",
                            coverImageUrl: "",
                        });

                        // 3. Upload Dorm Logo to Club (if exists)
                        if (d.imageFile) {
                            const logoPath = `clubs/${clubDoc.id}/logo.png`;
                            const logoRef = ref(storage, logoPath);
                            await uploadBytes(logoRef, d.imageFile);
                            const logoUrl = await getDownloadURL(logoRef);
                            await updateDoc(clubDoc, { coverImageUrl: logoUrl });
                        }

                        // 4. Join Owner
                        await setDoc(doc(db, "clubs", clubDoc.id, "members", currentUser.uid), {
                            uid: currentUser.uid,
                            clubId: clubDoc.id,
                            role: "owner",
                            status: "approved",
                            joinedAt: serverTimestamp(),
                        });
                    });

                    batchPromises.push(...dormPromises);
                }
            }

            // B. GLOBAL: DEFAULT CLUBS
            const validClubs = defaultClubs.filter(c => c.name.trim());
            if (validClubs.length > 0) {
                const clubsRef = collection(db, 'clubs');

                const clubPromises = validClubs.map(async (club) => {
                    const clubName = club.name.trim();
                    const clubDesc = club.description.trim() || `Official ${clubName} club for ${name}`;

                    // Merge campus admins + specific club admin
                    const specificAdmin = club.adminEmail.trim().toLowerCase();
                    const clubAdmins = [...campusAdmins];
                    if (specificAdmin && !clubAdmins.includes(specificAdmin)) {
                        clubAdmins.push(specificAdmin);
                    }

                    const newClubRef = await addDoc(clubsRef, {
                        name: clubName,
                        description: clubDesc,
                        campusId: campusId,
                        isPrivate: false,
                        isDefault: true,
                        memberCount: 1,
                        memberIds: [currentUser.uid],
                        adminUids: [currentUser.uid],
                        adminEmails: clubAdmins,
                        createdBy: currentUser.uid,
                        createdAt: serverTimestamp(),
                        allowMemberPosts: false,
                        coverImageUrl: "",
                    });

                    // Upload Logo if exists
                    if (club.imageFile) {
                        const logoPath = `clubs/${newClubRef.id}/logo.png`;
                        const logoRef = ref(storage, logoPath);
                        await uploadBytes(logoRef, club.imageFile);
                        const logoUrl = await getDownloadURL(logoRef);
                        await updateDoc(newClubRef, { coverImageUrl: logoUrl });
                    }

                    // Join Owner
                    await setDoc(doc(db, "clubs", newClubRef.id, "members", currentUser.uid), {
                        uid: currentUser.uid,
                        clubId: newClubRef.id,
                        role: "owner",
                        status: "approved",
                        joinedAt: serverTimestamp(),
                    });
                });

                batchPromises.push(...clubPromises);
            }

            await Promise.all(batchPromises);

            router.push('/admin/campuses');
        } catch (err: any) {
            console.error(err);
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={ui.page}>
            {/* Header */}
            <header className={ui.header}>
                <h1 className={ui.title}>Create Campus</h1>
                <p className={ui.subtitle}>Set up a new campus or university directory.</p>
            </header>

            <form onSubmit={handleSubmit} className="space-y-8">

                {/* Campus Identity */}
                <div className={ui.section}>
                    <label className={ui.sectionLabel}>Identity</label>
                    <div className={ui.card}>
                        {/* Logo Upload */}
                        <div className="flex items-center justify-between px-5 py-4">
                            <span className="text-[15px] font-medium text-foreground">Campus Logo</span>
                            {previewUrl ? (
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 overflow-hidden rounded-2xl cc-avatar bg-surface-2 ring-1 ring-secondary/15 shadow-sm">
                                        <img src={previewUrl} alt="Logo" className="h-full w-full object-contain" />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={clearImage}
                                        className="rounded-full bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-500 hover:bg-red-500/20 transition-colors"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ) : (
                                <label className={ui.actionBtn}>
                                    Upload PNG
                                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png" className="hidden" />
                                </label>
                            )}
                        </div>
                        {/* Name */}
                        <input
                            required
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className={ui.inputRow}
                            placeholder="Full Name (e.g. Stanford University)"
                        />
                        {/* Short Name */}
                        <input
                            type="text"
                            value={shortName}
                            onChange={(e) => setShortName(e.target.value)}
                            className={ui.inputRow}
                            placeholder="Short Name / Acronym (e.g. STAN)"
                        />
                    </div>
                </div>

                {/* Location */}
                <div className={ui.section}>
                    <label className={ui.sectionLabel}>Location</label>
                    <div className={ui.card}>
                        <input
                            required
                            type="text"
                            value={locationName}
                            onChange={(e) => setLocationName(e.target.value)}
                            className={ui.inputRow}
                            placeholder="City, State/Country"
                        />
                    </div>
                    <p className={ui.footerText}>Used for regional discovery and map clustering.</p>
                </div>

                {/* Admin Emails */}
                <div className={ui.section}>
                    <label className={ui.sectionLabel}>Administration</label>
                    <div className={ui.card}>
                        <textarea
                            rows={3}
                            value={adminEmails}
                            onChange={(e) => setAdminEmails(e.target.value)}
                            className={ui.textAreaRow}
                            placeholder="Admin emails (one per line)"
                        />
                    </div>
                    <p className={ui.footerText}>These users gain root-level control of this campus.</p>
                </div>

                {/* Default Clubs */}
                <div className={ui.section}>
                    <label className={ui.sectionLabel}>Default Clubs</label>
                    <div className="space-y-4">
                        {defaultClubs.map((club, i) => (
                            <div key={i} className="flex items-center gap-3">
                                {/* Club Card */}
                                <div className={ui.itemCard}>
                                    <div className="flex items-center gap-4 p-4">
                                        {/* Club Logo */}
                                        <input
                                            type="file"
                                            id={`club-logo-${i}`}
                                            className="hidden"
                                            accept="image/png"
                                            onChange={(e) => e.target.files?.[0] && handleDefaultClubImage(i, e.target.files[0])}
                                        />
                                        <label htmlFor={`club-logo-${i}`} className={ui.itemAvatar}>
                                            {club.previewUrl ? <img src={club.previewUrl} className="h-full w-full object-cover" /> : <PhotoIcon className="h-5 w-5" />}
                                        </label>

                                        {/* Club Info */}
                                        <div className="flex-1 min-w-0">
                                            <input
                                                placeholder="Club Name"
                                                className="w-full bg-transparent text-[15px] font-semibold text-foreground placeholder:text-secondary/50 focus:outline-none"
                                                value={club.name} onChange={e => handleDefaultClubChange(i, 'name', e.target.value)}
                                            />
                                            <input
                                                placeholder="Admin email (optional)"
                                                className="w-full bg-transparent text-[11px] font-medium text-secondary placeholder:text-secondary/30 focus:outline-none mt-1"
                                                value={club.adminEmail} onChange={e => handleDefaultClubChange(i, 'adminEmail', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    {/* Description */}
                                    <input
                                        placeholder="Add a description (optional)"
                                        className="w-full border-t border-secondary/10 bg-transparent px-5 py-3 text-[12px] text-secondary placeholder:text-secondary/30 focus:outline-none hover:bg-secondary/5 transition-colors"
                                        value={club.description} onChange={e => handleDefaultClubChange(i, 'description', e.target.value)}
                                    />
                                </div>

                                <button
                                    type="button"
                                    onClick={() => handleRemoveDefaultClub(i)}
                                    className={ui.removeBtn}
                                >
                                    <TrashIcon className="h-5 w-5" />
                                </button>
                            </div>
                        ))}

                        <button
                            type="button"
                            onClick={handleAddDefaultClub}
                            className="w-full flex items-center justify-center gap-2 rounded-[24px] border border-dashed border-secondary/30 bg-secondary/5 py-5 text-sm font-bold text-secondary transition-all hover:bg-secondary/10 hover:text-foreground hover:border-secondary/50"
                        >
                            <PlusIcon className="h-5 w-5" />
                            Add Preferred Club
                        </button>
                    </div>
                    <p className={ui.footerText}>Default clubs are auto-joined by all members.</p>
                </div>

                {/* University Mode Toggle */}
                <div className={ui.toggleContainer}>
                    <div>
                        <span className={ui.toggleLabel}>University Mode</span>
                        <p className={ui.toggleSublabel}>Enable housing, dorms, and campus life features</p>
                    </div>
                    <Switch
                        checked={isUniversity}
                        onChange={setIsUniversity}
                        className={`${isUniversity ? 'bg-brand' : 'bg-secondary/20'} relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none shadow-inner`}
                    >
                        <span className={`${isUniversity ? 'translate-x-6' : 'translate-x-1'} inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform`} />
                    </Switch>
                </div>

                {/* Dorms Section (University Only) */}
                {isUniversity && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-3 duration-500">
                        <label className={ui.sectionLabel}>Dorms & Residences</label>
                        <div className="space-y-4">
                            {dorms.map((dorm, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className={ui.itemCard}>
                                        <div className="flex items-center gap-4 p-4">
                                            <input
                                                type="file"
                                                id={`dorm-logo-${i}`}
                                                className="hidden"
                                                accept="image/png"
                                                onChange={(e) => e.target.files?.[0] && handleDormImage(i, e.target.files[0])}
                                            />
                                            <label htmlFor={`dorm-logo-${i}`} className={ui.itemAvatar}>
                                                {dorm.previewUrl ? <img src={dorm.previewUrl} className="h-full w-full object-cover" /> : <PhotoIcon className="h-5 w-5" />}
                                            </label>

                                            <div className="flex-1 min-w-0">
                                                <input
                                                    placeholder="Dorm Name"
                                                    className="w-full bg-transparent text-[15px] font-semibold text-foreground placeholder:text-secondary/50 focus:outline-none"
                                                    value={dorm.name} onChange={(e) => handleDormChange(i, 'name', e.target.value)}
                                                />
                                                <input
                                                    placeholder="Admin email (optional)"
                                                    className="w-full bg-transparent text-[11px] font-medium text-secondary placeholder:text-secondary/30 focus:outline-none mt-1"
                                                    value={dorm.adminEmail} onChange={(e) => handleDormChange(i, 'adminEmail', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handleRemoveDorm(i)}
                                        className={ui.removeBtn}
                                    >
                                        <TrashIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            ))}

                            <button
                                type="button"
                                onClick={handleAddDorm}
                                className="w-full flex items-center justify-center gap-2 rounded-[24px] border border-dashed border-secondary/30 bg-secondary/5 py-5 text-sm font-bold text-secondary transition-all hover:bg-secondary/10 hover:text-foreground hover:border-secondary/50"
                            >
                                <PlusIcon className="h-5 w-5" />
                                Add Residence
                            </button>
                        </div>
                        <p className={ui.footerText}>Dorms are created as clubs. Students will be required to join at least one.</p>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col gap-4 pt-6">
                    <button
                        type="submit"
                        disabled={loading}
                        className={ui.primaryBtn}
                    >
                        {loading ? "Creating Campus..." : "Create Campus"}
                    </button>
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className={ui.secondaryBtn}
                    >
                        Cancel
                    </button>
                </div>

            </form>
        </div>
    );
}
