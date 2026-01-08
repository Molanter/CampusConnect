'use client';

import { useEffect, useState, useCallback, useRef } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
    collection,
    getDocs,
    doc,
    getDoc,
    query,
    updateDoc,
    deleteDoc,
    addDoc,
    setDoc,
    where,
    serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";
import Toast, { ToastData } from "@/components/Toast";
import { Campus, Dorm, CampusLocation } from "@/lib/types/campus";
import Cropper from "react-easy-crop";
import {
    ChevronLeftIcon,
    BuildingOfficeIcon,
    MapPinIcon,
    ChevronDownIcon,
    PlusIcon,
    TrashIcon,
    XMarkIcon,
    PhotoIcon,
    CameraIcon,
    CheckIcon,
    ExclamationTriangleIcon,
    ShieldExclamationIcon
} from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import Link from 'next/link';

// Helper to create cropped image blob
async function getCroppedImg(imageSrc: string, pixelCrop: any): Promise<Blob> {
    const image = new Image();
    image.src = imageSrc;
    await new Promise((resolve) => { image.onload = resolve; });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

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
        }, 'image/png');
    });
}

const ui = {
    page: "mx-auto w-full max-w-2xl px-4 py-4 pb-32",
    header: "flex flex-col gap-6 px-1 pt-2 pb-8",
    backBtn: "inline-flex h-10 w-10 items-center justify-center rounded-full cc-glass border border-secondary/15 text-foreground transition-all hover:bg-secondary/10",
    title: "text-2xl font-bold tracking-tight text-foreground",
    subtitle: "text-secondary text-[13px] font-medium leading-relaxed",
    section: "space-y-2.5",
    sectionLabel: "text-[12px] font-bold uppercase tracking-widest text-secondary ml-1.5",
    card: "cc-glass cc-section rounded-[28px] overflow-hidden shadow-xl border border-secondary/15",
    // Input patterns
    inputGroup: "px-5 py-4 space-y-1.5",
    label: "text-[11px] font-bold text-secondary uppercase tracking-wider block ml-0.5",
    input: "w-full bg-transparent text-[15px] font-medium text-foreground placeholder:text-secondary/40 focus:outline-none transition-colors",
    textarea: "w-full bg-transparent text-[15px] font-medium text-foreground placeholder:text-secondary/40 focus:outline-none transition-colors resize-none",
    footerText: "text-[11px] text-secondary/60 ml-1.5 leading-relaxed",
    // Item Inputs (for lists)
    itemTitleInput: "w-full bg-transparent text-[15px] font-bold text-foreground placeholder:text-secondary/40 focus:outline-none",
    itemSubInput: "w-full bg-transparent text-[12px] font-medium text-secondary placeholder:text-secondary/30 focus:outline-none",
    // Selection Dropdown
    dropdownBtn: "w-full flex items-center justify-between gap-3 px-5 py-3 rounded-full cc-glass border border-secondary/15 transition-all hover:bg-secondary/10 active:scale-[0.99]",
    dropdownMenu: "absolute top-full mt-2 w-full z-50 overflow-hidden rounded-[24px] cc-glass border border-secondary/15 shadow-2xl animate-in fade-in zoom-in-95 duration-200",
    dropdownItem: "w-full text-left px-4 py-3 rounded-[16px] flex items-center justify-between transition-all",
    // Buttons
    primaryBtn: "flex-1 rounded-full bg-brand py-3 text-base font-bold text-brand-foreground shadow-lg shadow-brand/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50",
    secondaryBtn: "flex h-12 w-full items-center justify-center rounded-full bg-secondary/10 text-[15px] font-bold text-foreground transition-all hover:bg-secondary/20 active:scale-[0.98]",
    mobileCancelBtn: "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-foreground transition-all hover:bg-secondary/20 active:scale-[0.98]",
    iconBtn: "flex h-10 w-10 items-center justify-center rounded-full bg-secondary/10 text-secondary transition-all hover:bg-secondary/20 active:scale-[0.95]",
    deleteBtn: "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-secondary transition-all hover:bg-red-500/20 hover:text-red-400 border border-secondary/10 hover:border-red-500/30",
    addBtn: "w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-secondary/20 bg-secondary/5 py-4 text-[13px] font-bold text-secondary transition-all hover:bg-secondary/10 hover:text-foreground hover:border-secondary/40",
    // Modal
    modalOverlay: "fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-md animate-in fade-in duration-200 p-4",
    modalContent: "w-full max-w-sm cc-glass border border-secondary/15 rounded-[32px] p-8 shadow-2xl animate-in zoom-in-95 duration-200",
};

export default function ManageMyCampusPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [myCampuses, setMyCampuses] = useState<Campus[]>([]);
    const [selectedCampusId, setSelectedCampusId] = useState<string>("");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // Edit State
    const [campus, setCampus] = useState<Campus | null>(null);
    const [dorms, setDorms] = useState<{ id?: string; name: string; adminEmail: string; logoUrl?: string; imageFile?: Blob | null }[]>([]);
    const [defaultClubs, setDefaultClubs] = useState<{ id?: string; name: string; adminEmail: string; logoUrl?: string; imageFile?: Blob | null }[]>([]);
    const [adminEmailsText, setAdminEmailsText] = useState("");
    const [campusImageFile, setCampusImageFile] = useState<Blob | null>(null);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<ToastData | null>(null);

    // Image Cropping Meta
    const [cropModalOpen, setCropModalOpen] = useState(false);
    const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
    const [cropTarget, setCropTarget] = useState<{ type: 'dorm' | 'club' | 'campus', index?: number } | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

    // Deletion Confirmation State
    const [pendingDormDeletions, setPendingDormDeletions] = useState<any[]>([]);
    const [pendingClubDeletions, setPendingClubDeletions] = useState<any[]>([]);
    const [confirmDeleteStep, setConfirmDeleteStep] = useState(0); // 0 = closed, 1, 2, 3 = steps
    const [isConfirmed, setIsConfirmed] = useState(false);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            if (u && u.email) {
                await loadMyCampuses(u.email);
            } else {
                setLoading(false);
            }
        });
        return () => unsub();
    }, []);

    const loadMyCampuses = async (email: string) => {
        try {
            const emailLower = email.toLowerCase();
            const cQuery = query(collection(db, 'campuses'), where('adminEmails', 'array-contains', emailLower));
            const uQuery = query(collection(db, 'universities'), where('adminEmails', 'array-contains', emailLower));

            const [cSnap, uSnap] = await Promise.all([getDocs(cQuery), getDocs(uQuery)]);

            const cData = cSnap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                logoUrl: d.data().logoUrl || d.data().logo || undefined // Fallback for legacy
            } as Campus));
            const uData = uSnap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                logoUrl: d.data().logoUrl || d.data().logo || undefined, // Fallback for legacy
                isUniversity: d.data().isUniversity ?? true
            } as Campus));

            const cIds = new Set(cData.map(c => c.id));
            const merged = [...cData];
            for (const u of uData) {
                if (!cIds.has(u.id)) merged.push(u);
            }

            setMyCampuses(merged);
            if (merged.length > 0) {
                setSelectedCampusId(merged[0].id);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!selectedCampusId || myCampuses.length === 0) return;
        const found = myCampuses.find(c => c.id === selectedCampusId);
        if (found) {
            setCampus(found);
            setAdminEmailsText(found.adminEmails?.join('\n') || "");
            loadDorms(found.id, found.isUniversity);
            loadDefaultClubs(found.id);
        }
    }, [selectedCampusId, myCampuses]);

    const loadDefaultClubs = async (campusId: string) => {
        try {
            const q = query(collection(db, 'clubs'), where('campusId', '==', campusId), where('isDefault', '==', true));
            const snap = await getDocs(q);
            setDefaultClubs(snap.docs.map(d => ({
                id: d.id,
                name: d.data().name,
                adminEmail: (d.data().adminEmails?.[0] || ""),
                logoUrl: d.data().coverImageUrl || d.data().logoUrl || ""
            })));
        } catch (err) {
            console.error("Error loading default clubs:", err);
        }
    };

    const loadDorms = async (id: string, isUni: boolean) => {
        if (!isUni) {
            setDorms([]);
            return;
        }

        const { getDormsForCampus } = await import("@/lib/firestore-paths");
        const ds = await getDormsForCampus(id);

        // Fetch corresponding clubs to get logos
        const clubsRef = collection(db, 'clubs');
        const dormClubsQuery = query(clubsRef, where('campusId', '==', id), where('isDefault', '==', false));
        const clubsSnap = await getDocs(dormClubsQuery);
        const logoMap = new Map(clubsSnap.docs.map(doc => [doc.data().name, doc.data().coverImageUrl]));

        setDorms(ds.map(d => ({
            id: d.id,
            name: d.name,
            adminEmail: (d as any).adminEmails?.[0] || "",
            logoUrl: logoMap.get(d.name) || ""
        })));
    };

    const handleImageSelect = (type: 'dorm' | 'club' | 'campus', index: number | undefined, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setCropImageSrc(reader.result as string);
                setCropTarget({ type, index });
                setCropModalOpen(true);
            };
            reader.readAsDataURL(file);
        }
    };

    const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleCropConfirm = async () => {
        if (!cropImageSrc || !croppedAreaPixels || !cropTarget) return;
        try {
            const croppedBlob = await getCroppedImg(cropImageSrc, croppedAreaPixels);
            if (cropTarget.type === 'dorm' && cropTarget.index !== undefined) {
                const newDorms = [...dorms];
                newDorms[cropTarget.index].imageFile = croppedBlob;
                newDorms[cropTarget.index].logoUrl = URL.createObjectURL(croppedBlob);
                setDorms(newDorms);
            } else if (cropTarget.type === 'club' && cropTarget.index !== undefined) {
                const newClubs = [...defaultClubs];
                newClubs[cropTarget.index].imageFile = croppedBlob;
                newClubs[cropTarget.index].logoUrl = URL.createObjectURL(croppedBlob);
                setDefaultClubs(newClubs);
            } else if (cropTarget.type === 'campus') {
                setCampusImageFile(croppedBlob);
                if (campus) {
                    setCampus({
                        ...campus,
                        logoUrl: URL.createObjectURL(croppedBlob)
                    });
                }
            }
            handleCropCancel();
        } catch (err) {
            console.error("Error cropping image:", err);
            setToast({ type: 'error', message: "Failed to crop image." });
        }
    };

    const handleCropCancel = () => {
        setCropModalOpen(false);
        setCropImageSrc(null);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setCropTarget(null);
    };

    const handleAddDorm = () => setDorms([...dorms, { name: '', adminEmail: '' }]);
    const handleRemoveDorm = (i: number) => {
        const dormToRemove = dorms[i];
        if (dormToRemove.id) {
            setPendingDormDeletions([...pendingDormDeletions, dormToRemove]);
        }
        setDorms(dorms.filter((_, idx) => idx !== i));
    };

    const handleDormChange = (i: number, field: string, value: string) => {
        const newDorms = [...dorms];
        (newDorms[i] as any)[field] = value;
        setDorms(newDorms);
    };

    const handleAddDefaultClub = () => setDefaultClubs([...defaultClubs, { name: '', adminEmail: '' }]);

    const handleRemoveDefaultClub = (i: number) => {
        const clubToRemove = defaultClubs[i];
        if (clubToRemove.id) {
            setPendingClubDeletions([...pendingClubDeletions, clubToRemove]);
        }
        setDefaultClubs(defaultClubs.filter((_, idx) => idx !== i));
    };

    const handleSave = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        // If there are pending deletions and we haven't confirmed yet, show triple confirmation
        if ((pendingDormDeletions.length > 0 || pendingClubDeletions.length > 0) && !isConfirmed) {
            setConfirmDeleteStep(1);
            return;
        }

        performFinalSave();
    };

    const performFinalSave = async () => {
        if (!campus) return;
        setSaving(true);
        try {
            let logoUrl = campus.logoUrl || "";

            // Handle Campus Logo Upload
            if (campusImageFile) {
                const logoPath = `campuses/${campus.id}/logo-${Date.now()}.png`;
                const logoRef = ref(storage, logoPath);
                await uploadBytes(logoRef, campusImageFile);
                logoUrl = await getDownloadURL(logoRef);
            }

            const formattedEmails = adminEmailsText.split('\n').map(e => e.trim().toLowerCase()).filter(Boolean);

            // Resolve UIDs for moderators
            let adminUids: string[] = [];
            if (formattedEmails.length > 0) {
                const uidPromises = formattedEmails.map(async (email) => {
                    const q = query(collection(db, 'users'), where('email', '==', email));
                    const snap = await getDocs(q);
                    return snap.docs[0]?.id;
                });
                const resolved = await Promise.all(uidPromises);
                adminUids = resolved.filter((uid): uid is string => !!uid);
            }

            const updateData = {
                name: campus.name,
                shortName: campus.shortName || null,
                locations: campus.locations,
                isActive: campus.isActive,
                adminEmails: formattedEmails,
                adminUids: adminUids,
                isUniversity: campus.isUniversity,
                logoUrl: logoUrl
            };

            await setDoc(doc(db, 'campuses', campus.id), updateData, { merge: true });
            if (campus.isUniversity) {
                await setDoc(doc(db, 'universities', campus.id), updateData, { merge: true });
            }

            const cDormsRef = collection(db, 'campuses', campus.id, 'dorms');
            const uDormsRef = collection(db, 'universities', campus.id, 'dorms');

            // 1. Cleanup legacy university dorms
            const uSn = await getDocs(uDormsRef);
            await Promise.all(uSn.docs.map(d => deleteDoc(doc(uDormsRef, d.id))));

            // 2. Reconcile campus dorms
            const existingSnap = await getDocs(cDormsRef);
            const existingMap = new Map(existingSnap.docs.map(d => [d.id, d.data()]));
            const currentDormIds = new Set();

            if (campus.isUniversity) {
                const defaultLoc = campus.locations[0]?.id || "main";

                for (const d of dorms) {
                    if (!d.name.trim()) continue;
                    const dormData = {
                        name: d.name.trim(),
                        locationId: defaultLoc,
                        category: "dorm",
                        adminEmails: d.adminEmail ? [d.adminEmail.trim().toLowerCase()] : formattedEmails
                    };

                    let finalDormId = d.id;
                    if (d.id && existingMap.has(d.id)) {
                        await updateDoc(doc(cDormsRef, d.id), dormData);
                        currentDormIds.add(d.id);
                    } else {
                        const newDoc = await addDoc(cDormsRef, dormData);
                        finalDormId = newDoc.id;
                        currentDormIds.add(newDoc.id);
                    }

                    // Handle Dorm Club Logo and Category
                    const cRef = collection(db, 'clubs');
                    const qObj = query(cRef, where('campusId', '==', campus.id), where('name', '==', d.name.trim()), where('isDefault', '==', false));
                    const snap = await getDocs(qObj);

                    let clubDocId = snap.docs[0]?.id;
                    if (clubDocId) {
                        // Update existing club
                        const updateObj: any = { category: "dorm" };
                        if (d.imageFile) {
                            const logoPath = `clubs/${clubDocId}/logo-${Date.now()}.png`;
                            const logoRef = ref(storage, logoPath);
                            await uploadBytes(logoRef, d.imageFile);
                            updateObj.coverImageUrl = await getDownloadURL(logoRef);
                        }
                        await updateDoc(doc(db, 'clubs', clubDocId), updateObj);
                    } else if (finalDormId) {
                        // Create missing dorm club
                        const currentUser = auth.currentUser;
                        const newClubRef = doc(collection(db, 'clubs'));
                        let initialLogoUrl = "";
                        if (d.imageFile) {
                            const logoPath = `clubs/${newClubRef.id}/logo-${Date.now()}.png`;
                            const logoRef = ref(storage, logoPath);
                            await uploadBytes(logoRef, d.imageFile);
                            initialLogoUrl = await getDownloadURL(logoRef);
                        }
                        await setDoc(newClubRef, {
                            name: d.name.trim(),
                            description: `One of the dorms (residences) of ${campus.name}`,
                            campusId: campus.id,
                            isPrivate: false,
                            isDefault: false,
                            category: "dorm",
                            memberCount: currentUser ? 1 : 0,
                            memberIds: currentUser ? [currentUser.uid] : [],
                            adminUids: currentUser ? [currentUser.uid] : [],
                            adminEmails: dormData.adminEmails,
                            createdBy: currentUser?.uid || "system",
                            createdAt: serverTimestamp(),
                            allowMemberPosts: true,
                            coverImageUrl: initialLogoUrl
                        });
                        if (currentUser) {
                            await setDoc(doc(db, "clubs", newClubRef.id, "members", currentUser.uid), {
                                uid: currentUser.uid,
                                clubId: newClubRef.id,
                                role: "owner",
                                status: "approved",
                                joinedAt: serverTimestamp(),
                            });
                        }
                    }
                }
            }

            // 3. Delete orphans (or all if not university)
            for (const docId of existingMap.keys()) {
                if (!currentDormIds.has(docId)) {
                    await deleteDoc(doc(cDormsRef, docId));
                }
            }

            // 4. Handle Pending Club Deletions
            if (pendingClubDeletions.length > 0) {
                await Promise.all(pendingClubDeletions.map(async (club) => {
                    if (club.id) {
                        await deleteDoc(doc(db, 'clubs', club.id));
                    }
                }));
            }

            // 5. Update/Create Default Clubs
            if (defaultClubs.length > 0) {
                await Promise.all(defaultClubs.map(async (club) => {
                    let logoUrl = club.logoUrl || "";

                    const clubData: any = {
                        name: club.name.trim(),
                        adminEmails: club.adminEmail ? [club.adminEmail.trim().toLowerCase()] : formattedEmails,
                        isDefault: true,
                        campusId: campus.id,
                        updatedAt: serverTimestamp()
                    };

                    if (club.id) {
                        if (club.imageFile) {
                            const logoPath = `clubs/${club.id}/logo-${Date.now()}.png`;
                            const logoRef = ref(storage, logoPath);
                            await uploadBytes(logoRef, club.imageFile);
                            logoUrl = await getDownloadURL(logoRef);
                        }
                        clubData.coverImageUrl = logoUrl;
                        await updateDoc(doc(db, 'clubs', club.id), clubData);
                    } else if (club.name.trim()) {
                        const currentUser = auth.currentUser;
                        let initialLogoUrl = "";
                        const tempClubRef = doc(collection(db, 'clubs'));
                        if (club.imageFile) {
                            const logoPath = `clubs/${tempClubRef.id}/logo-${Date.now()}.png`;
                            const logoRef = ref(storage, logoPath);
                            await uploadBytes(logoRef, club.imageFile);
                            initialLogoUrl = await getDownloadURL(logoRef);
                        }

                        const finalClubData = {
                            ...clubData,
                            description: `Official ${club.name.trim()} club for ${campus.name}`,
                            isPrivate: false,
                            memberCount: currentUser ? 1 : 0,
                            memberIds: currentUser ? [currentUser.uid] : [],
                            adminUids: currentUser ? [currentUser.uid] : [],
                            createdBy: currentUser?.uid || "system",
                            createdAt: serverTimestamp(),
                            allowMemberPosts: false,
                            coverImageUrl: initialLogoUrl
                        };
                        await setDoc(tempClubRef, finalClubData);

                        if (currentUser) {
                            await setDoc(doc(db, "clubs", tempClubRef.id, "members", currentUser.uid), {
                                uid: currentUser.uid,
                                clubId: tempClubRef.id,
                                role: "owner",
                                status: "approved",
                                joinedAt: serverTimestamp(),
                            });
                        }
                    }
                }));
            }

            setToast({ type: 'success', message: 'Campus updated successfully' });
            // Reset pending deletions
            setPendingDormDeletions([]);
            setPendingClubDeletions([]);
            setCampusImageFile(null);
            setIsConfirmed(false);

            if (user?.email) loadMyCampuses(user.email);
        } catch (err: any) {
            console.error(err);
            setToast({ type: 'error', message: err.message });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="flex h-screen items-center justify-center">
            <div className="cc-muted animate-pulse font-medium">Loading network...</div>
        </div>
    );

    if (!user) return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 text-secondary">
            <p className="font-medium">Please sign in to manage your campus.</p>
        </div>
    );

    if (myCampuses.length === 0) return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 text-secondary">
            <p className="font-medium text-center px-8">You are not an admin of any campus currently.</p>
        </div>
    );

    const selectedCampus = myCampuses.find(c => c.id === selectedCampusId);

    return (
        <div className={ui.page}>
            <Toast toast={toast} onClear={() => setToast(null)} />

            <div className={ui.header}>
                <div className="flex items-center justify-between">
                    <button onClick={() => router.back()} className={ui.backBtn}>
                        <ChevronLeftIcon className="h-5 w-5" />
                    </button>

                    {myCampuses.length > 1 && (
                        <div className="relative min-w-[200px]">
                            <button
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                className={ui.dropdownBtn}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="h-6 w-6 rounded-full flex items-center justify-center overflow-hidden shrink-0">
                                        {selectedCampus?.logoUrl ? (
                                            <img src={selectedCampus.logoUrl} className="h-full w-full object-contain" alt="" />
                                        ) : (
                                            <BuildingOfficeIcon className="h-3.5 w-3.5 text-brand" />
                                        )}
                                    </div>
                                    <span className="font-bold text-[13px] text-foreground">
                                        {selectedCampus?.name || "Select Campus"}
                                    </span>
                                </div>
                                <ChevronDownIcon className={`h-4 w-4 text-secondary/50 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isDropdownOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                                    <div className={ui.dropdownMenu}>
                                        <div className="p-1.5 flex flex-col gap-1">
                                            {myCampuses.map(c => (
                                                <button
                                                    key={c.id}
                                                    onClick={() => {
                                                        setSelectedCampusId(c.id);
                                                        setIsDropdownOpen(false);
                                                    }}
                                                    className={`${ui.dropdownItem} ${selectedCampusId === c.id ? 'bg-secondary/10' : 'hover:bg-secondary/5'}`}
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <div className="h-5 w-5 rounded-full flex items-center justify-center overflow-hidden shrink-0">
                                                            {c.logoUrl ? (
                                                                <img src={c.logoUrl} className="h-full w-full object-contain" alt="" />
                                                            ) : (
                                                                <BuildingOfficeIcon className="h-3 w-3 text-secondary/50" />
                                                            )}
                                                        </div>
                                                        <span className={`text-[13px] font-bold truncate ${selectedCampusId === c.id ? 'text-foreground' : 'text-secondary'}`}>
                                                            {c.name}
                                                        </span>
                                                    </div>
                                                    {selectedCampusId === c.id && <CheckIcon className="h-4 w-4 text-brand shrink-0" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                <div>
                    <h1 className={ui.title}>Manage Campus</h1>
                    <p className={ui.subtitle}>Update details for the campuses you moderate.</p>
                </div>
            </div>

            <div className="space-y-8">
                {campus && (
                    <form onSubmit={handleSave} className="space-y-10">
                        {/* Identity Section */}
                        <div className={ui.section}>
                            <label className={ui.sectionLabel}>Identity & Branding</label>
                            <div className={ui.card}>
                                <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-secondary/10">
                                    <div className="p-5 flex flex-col items-center justify-center shrink-0">
                                        <div
                                            className="relative h-28 w-28 rounded-[24px] overflow-hidden flex items-center justify-center cursor-pointer group hover:ring-2 hover:ring-brand/30 transition-all shadow-md"
                                            onClick={() => document.getElementById(`campus-logo-input`)?.click()}
                                        >
                                            {campus.logoUrl ? (
                                                <img src={campus.logoUrl} alt={campus.name} className="h-full w-full object-contain p-1" />
                                            ) : (
                                                <CameraIcon className="h-10 w-10 text-secondary/30 group-hover:text-secondary group-hover:scale-110 transition-all" />
                                            )}
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <PhotoIcon className="h-8 w-8 text-white" />
                                            </div>
                                        </div>
                                        <input
                                            type="file"
                                            id="campus-logo-input"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={(e) => handleImageSelect('campus', undefined, e)}
                                        />
                                        <p className="text-[10px] font-bold text-secondary/50 uppercase tracking-widest mt-2">Campus Logo</p>
                                    </div>

                                    <div className="flex-1 divide-y divide-secondary/10">
                                        <div className={ui.inputGroup}>
                                            <label className={ui.label}>Institutional Name <span className="text-red-500">*</span></label>
                                            <input
                                                required
                                                type="text"
                                                value={campus.name}
                                                onChange={e => setCampus({ ...campus, name: e.target.value })}
                                                className={ui.input}
                                                placeholder="e.g. Stanford University"
                                            />
                                        </div>
                                        <div className={ui.inputGroup}>
                                            <label className={ui.label}>Abbreviation <span className="text-red-500">*</span></label>
                                            <input
                                                type="text"
                                                value={campus.shortName || ''}
                                                onChange={e => setCampus({ ...campus, shortName: e.target.value })}
                                                className={ui.input}
                                                placeholder="e.g. STAN"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Locations Section */}
                        <div className={ui.section}>
                            <label className={ui.sectionLabel}>Locations <span className="text-red-500">*</span></label>
                            <div className={ui.card}>
                                <div className="divide-y divide-secondary/10">
                                    {campus.locations.map((loc, i) => (
                                        <div key={i} className="flex items-center gap-4 px-5 py-4 min-h-[56px] hover:bg-secondary/5 transition-colors group">
                                            <input
                                                className="flex-1 bg-transparent text-[15px] font-medium text-foreground placeholder:text-secondary/40 focus:outline-none"
                                                value={loc.name}
                                                onChange={e => {
                                                    const newLocs = [...campus.locations];
                                                    newLocs[i].name = e.target.value;
                                                    setCampus({ ...campus, locations: newLocs });
                                                }}
                                                placeholder="Main Campus"
                                            />
                                            <MapPinIcon className="h-4 w-4 text-secondary/20 group-hover:text-secondary/40 transition-colors" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Dorms Section */}
                        {campus.isUniversity && (
                            <div className={ui.section}>
                                <label className={ui.sectionLabel}>Dorms & Residences</label>
                                <div className="space-y-4">
                                    {dorms.map((dorm, i) => (
                                        <div key={i} className="flex items-start gap-4">
                                            <div className={`${ui.card} flex-1`}>
                                                <div className="flex items-center gap-4 p-4">
                                                    <div
                                                        className="relative h-14 w-14 rounded-xl border border-secondary/15 flex items-center justify-center cursor-pointer hover:ring-1 hover:ring-brand/30 transition-all overflow-hidden"
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
                                                            className={ui.itemTitleInput}
                                                            value={dorm.name}
                                                            onChange={e => handleDormChange(i, 'name', e.target.value)}
                                                        />
                                                        <input
                                                            placeholder="Admin email (optional)"
                                                            className={ui.itemSubInput}
                                                            value={dorm.adminEmail}
                                                            onChange={e => handleDormChange(i, 'adminEmail', e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveDorm(i)}
                                                className={ui.deleteBtn}
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}

                                    <button
                                        type="button"
                                        onClick={handleAddDorm}
                                        className={ui.addBtn}
                                    >
                                        <PlusIcon className="h-4 w-4" />
                                        Add Dorm
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Default Clubs Section */}
                        <div className={ui.section}>
                            <label className={ui.sectionLabel}>Default Clubs</label>
                            <div className="space-y-4">
                                {defaultClubs.map((club, i) => (
                                    <div key={club.id || i} className="flex items-start gap-4">
                                        <div className={`${ui.card} flex-1`}>
                                            <div className="flex items-center gap-4 p-4">
                                                <div
                                                    className="relative h-14 w-14 rounded-xl border border-secondary/15 flex items-center justify-center cursor-pointer hover:ring-1 hover:ring-brand/30 transition-all overflow-hidden"
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
                                                        className={ui.itemTitleInput}
                                                        value={club.name}
                                                        onChange={e => {
                                                            const newClubs = [...defaultClubs];
                                                            newClubs[i].name = e.target.value;
                                                            setDefaultClubs(newClubs);
                                                        }}
                                                    />
                                                    <input
                                                        placeholder="Admin email (optional)"
                                                        className={ui.itemSubInput}
                                                        value={club.adminEmail}
                                                        onChange={e => {
                                                            const newClubs = [...defaultClubs];
                                                            newClubs[i].adminEmail = e.target.value;
                                                            setDefaultClubs(newClubs);
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveDefaultClub(i)}
                                            className={ui.deleteBtn}
                                        >
                                            <TrashIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}

                                <button
                                    type="button"
                                    onClick={handleAddDefaultClub}
                                    className={ui.addBtn}
                                >
                                    <PlusIcon className="h-4 w-4" />
                                    Add Club
                                </button>
                            </div>
                        </div>

                        {/* Admin Emails Section */}
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
                        <div className="flex items-center gap-4 pt-4">
                            {/* Desktop Cancel */}
                            <Link href="/profile" className="hidden sm:flex flex-1">
                                <div className={ui.secondaryBtn}>Cancel</div>
                            </Link>

                            {/* Mobile Cancel (X mark) */}
                            <Link href="/profile" className="flex sm:hidden">
                                <div className={ui.mobileCancelBtn}>
                                    <XMarkIcon className="h-6 w-6" />
                                </div>
                            </Link>

                            <button
                                type="submit"
                                disabled={saving}
                                className={ui.primaryBtn}
                            >
                                {saving ? "Saving Changes..." : "Save Changes"}
                            </button>
                        </div>
                    </form>
                )}
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
                                cropShape="round"
                                showGrid={false}
                                onCropChange={setCrop}
                                onZoomChange={setZoom}
                                onCropComplete={onCropComplete}
                            />
                        </div>

                        {/* Zoom toolbar */}
                        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 flex items-center gap-4 cc-glass border border-secondary/15 px-6 py-3 rounded-full backdrop-blur-xl shadow-xl">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-secondary/60">Zoom</span>
                            <input
                                type="range"
                                min={1}
                                max={3}
                                step={0.1}
                                value={zoom}
                                onChange={(e) => setZoom(Number(e.target.value))}
                                className="w-24 accent-brand cursor-pointer"
                            />
                        </div>

                        {/* Control buttons */}
                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4">
                            <button
                                onClick={handleCropCancel}
                                className="flex h-14 w-14 items-center justify-center rounded-full cc-glass border border-secondary/15 text-foreground shadow-lg transition-all hover:bg-secondary/10"
                            >
                                <XMarkIcon className="h-7 w-7" />
                            </button>
                            <button
                                onClick={handleCropConfirm}
                                className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-lg shadow-brand/30 transition-all hover:scale-110 active:scale-95"
                            >
                                <CheckIcon className="h-7 w-7" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {confirmDeleteStep > 0 && (pendingDormDeletions.length > 0 || pendingClubDeletions.length > 0) && (
                <div className={ui.modalOverlay}>
                    <div className={ui.modalContent}>
                        <div className="flex flex-col items-center text-center space-y-6">
                            <div className={`h-20 w-20 rounded-full flex items-center justify-center transition-all duration-300 ${confirmDeleteStep === 3 ? 'bg-red-500/20 text-red-500 scale-110' : 'bg-brand/10 text-brand'
                                }`}>
                                {confirmDeleteStep === 1 && <TrashIcon className="h-10 w-10 text-brand" />}
                                {confirmDeleteStep === 2 && <ExclamationTriangleIcon className="h-10 w-10 text-brand" />}
                                {confirmDeleteStep === 3 && <ShieldExclamationIcon className="h-10 w-10 text-red-500" />}
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-xl font-bold text-foreground">
                                    {confirmDeleteStep === 1 && "Confirm Deletions"}
                                    {confirmDeleteStep === 2 && "Permanent Action"}
                                    {confirmDeleteStep === 3 && "Final Confirmation"}
                                </h3>
                                <div className="text-secondary text-sm font-medium leading-relaxed">
                                    {confirmDeleteStep === 1 && (
                                        <div className="space-y-4">
                                            <p>The following items will be removed:</p>
                                            <div className="bg-secondary/5 rounded-2xl p-4 text-left max-h-40 overflow-y-auto cc-muted border border-secondary/10">
                                                {pendingDormDeletions.map(d => (
                                                    <div key={d.id || d.name} className="flex items-center gap-2 text-[12px] font-bold py-1.5 text-secondary">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-brand" />
                                                        {d.name} (Dorm)
                                                    </div>
                                                ))}
                                                {pendingClubDeletions.map(c => (
                                                    <div key={c.id || c.name} className="flex items-center gap-2 text-[12px] font-bold py-1.5 text-secondary">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-brand" />
                                                        {c.name} (Club)
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {confirmDeleteStep === 2 && (
                                        <p>Deleting {pendingDormDeletions.length + pendingClubDeletions.length} items will purge all associated records. This action cannot be reversed.</p>
                                    )}
                                    {confirmDeleteStep === 3 && (
                                        <p>This is your <span className="text-red-500 font-bold underline decoration-2 underline-offset-4">final warning</span>. Proceed with the deletion?</p>
                                    )}
                                </div>
                            </div>

                            <div className="w-full flex flex-col gap-3 pt-4">
                                <button
                                    onClick={() => {
                                        if (confirmDeleteStep < 3) {
                                            setConfirmDeleteStep(prev => prev + 1);
                                        } else {
                                            setIsConfirmed(true);
                                            setConfirmDeleteStep(0);
                                            setTimeout(() => performFinalSave(), 100);
                                        }
                                    }}
                                    className={`w-full py-4 rounded-full text-[15px] font-bold shadow-lg transition-all active:scale-[0.98] ${confirmDeleteStep === 3 ? 'bg-red-500 text-white' : 'bg-brand text-brand-foreground'
                                        }`}
                                >
                                    {confirmDeleteStep === 3 ? "DELETE FOREVER" : "Understand & Continue"}
                                </button>
                                <button
                                    onClick={() => setConfirmDeleteStep(0)}
                                    className="w-full py-3.5 rounded-full text-[15px] font-bold text-secondary hover:bg-secondary/10 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>

                            {/* Step indicators */}
                            <div className="flex gap-2.5 pt-4">
                                {[1, 2, 3].map(step => (
                                    <div
                                        key={step}
                                        className={`h-1.5 rounded-full transition-all duration-300 ${step <= confirmDeleteStep
                                            ? (confirmDeleteStep === 3 ? 'w-10 bg-red-500' : 'w-10 bg-brand')
                                            : 'w-2.5 bg-secondary/10'
                                            }`}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
