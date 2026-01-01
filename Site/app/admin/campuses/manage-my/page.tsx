'use client';

import { useEffect, useState } from "react";
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
    collectionGroup
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
    EnvelopeIcon,
    HomeIcon,
    ChevronDownIcon,
    CheckCircleIcon,
    CloudArrowUpIcon,
    PlusIcon,
    TrashIcon,
    XMarkIcon,
    UserGroupIcon,
    PhotoIcon,
    CameraIcon,
    CheckIcon,
    ExclamationTriangleIcon,
    ShieldExclamationIcon
} from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { useCallback, useRef } from "react";

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

            const updateData = {
                name: campus.name,
                shortName: campus.shortName || null,
                locations: campus.locations,
                isActive: campus.isActive,
                adminEmails: formattedEmails,
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
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-[#ffb200]" />
        </div>
    );

    if (!user) return (
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
            <div className="text-center">
                <h2 className="text-2xl font-semibold text-white mb-2">Sign In Required</h2>
                <p className="text-neutral-400">Please sign in to manage your campus.</p>
            </div>
        </div>
    );

    if (myCampuses.length === 0) return (
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
            <div className="text-center">
                <h2 className="text-2xl font-semibold text-white mb-2">No Access</h2>
                <p className="text-neutral-400">You are not an admin of any campus.</p>
            </div>
        </div>
    );

    const selectedCampus = myCampuses.find(c => c.id === selectedCampusId);

    return (
        <div className="min-h-[calc(100vh-64px)] text-white flex flex-col max-w-[1200px] mx-auto">
            <Toast toast={toast} onClear={() => setToast(null)} />

            <div className="pt-8 md:pt-12 px-8 pb-0 shrink-0">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                    <div>
                        <button
                            onClick={() => router.back()}
                            className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/70 hover:text-white hover:bg-white/10 transition-all border border-white/5"
                        >
                            <ChevronLeftIcon className="h-5 w-5" />
                        </button>
                        <h1 className="text-4xl font-bold tracking-tight mb-2">Manage Campus</h1>
                        <p className="text-neutral-400 text-lg">Update details for the campuses you moderate.</p>
                    </div>

                    {myCampuses.length > 1 && (
                        <div className="relative min-w-[240px]">
                            <button
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                className="w-full flex items-center justify-between gap-3 px-5 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-[#ffb200]/20 flex items-center justify-center">
                                        <BuildingOfficeIcon className="h-4 w-4 text-[#ffb200]" />
                                    </div>
                                    <span className="font-semibold text-sm">
                                        {selectedCampus?.name || "Select Campus"}
                                    </span>
                                </div>
                                <ChevronDownIcon className={`h-4 w-4 text-neutral-500 group-hover:text-white transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isDropdownOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                                    <div className="absolute top-full mt-2 w-full z-50 overflow-hidden rounded-2xl bg-[#1C1C1E]/95 backdrop-blur-xl border border-white/10 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                                        <div className="p-1.5">
                                            {myCampuses.map(c => (
                                                <button
                                                    key={c.id}
                                                    onClick={() => {
                                                        setSelectedCampusId(c.id);
                                                        setIsDropdownOpen(false);
                                                    }}
                                                    className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between group transition-all ${selectedCampusId === c.id ? 'bg-white/10' : 'hover:bg-white/5'}`}
                                                >
                                                    <span className={`text-sm font-medium ${selectedCampusId === c.id ? 'text-white' : 'text-neutral-400 group-hover:text-neutral-200'}`}>
                                                        {c.name}
                                                    </span>
                                                    {selectedCampusId === c.id && <CheckCircleIcon className="h-4 w-4 text-[#ffb200]" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 px-8 pb-12">
                {campus && (
                    <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Main Info */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="space-y-4">
                                <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 ml-1">Campus Info</label>
                                <div className="bg-[#1A1A1A] border border-white/10 rounded-[2rem] overflow-hidden shadow-lg p-6 flex flex-col sm:flex-row items-center gap-6">
                                    {/* Campus Logo Picker */}
                                    <div className="relative group/img h-24 w-24 shrink-0">
                                        <div
                                            className="h-24 w-24 rounded-2xl flex items-center justify-center text-neutral-500 overflow-hidden cursor-pointer hover:ring-2 hover:ring-[#ffb200]/50 transition-all"
                                            onClick={() => {
                                                const input = document.getElementById(`campus-logo-input`);
                                                input?.click();
                                            }}
                                        >
                                            {campus.logoUrl ? (
                                                <img src={campus.logoUrl} alt={campus.name} className="h-full w-full object-contain" />
                                            ) : (
                                                <CameraIcon className="h-10 w-10 opacity-30 group-hover/img:opacity-100 transition-opacity" />
                                            )}
                                        </div>
                                        <input
                                            type="file"
                                            id="campus-logo-input"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={(e) => handleImageSelect('campus', undefined, e)}
                                        />
                                    </div>

                                    <div className="flex-1 w-full space-y-3">
                                        <div className="bg-white/5 rounded-2xl border border-white/5 focus-within:border-[#ffb200]/30 transition-colors overflow-hidden">
                                            <input
                                                required
                                                type="text"
                                                value={campus.name}
                                                onChange={e => setCampus({ ...campus, name: e.target.value })}
                                                className="w-full bg-transparent px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none"
                                                placeholder="Full Name (e.g. Stanford University)"
                                            />
                                        </div>
                                        <div className="bg-white/5 rounded-2xl border border-white/5 focus-within:border-[#ffb200]/30 transition-colors overflow-hidden">
                                            <input
                                                type="text"
                                                value={campus.shortName || ''}
                                                onChange={e => setCampus({ ...campus, shortName: e.target.value })}
                                                className="w-full bg-transparent px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none"
                                                placeholder="Short Name / Acronym (e.g. STAN)"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 ml-1">Locations</label>
                                <div className="bg-[#1A1A1A] border border-white/10 rounded-3xl overflow-hidden shadow-lg divide-y divide-white/5">
                                    {campus.locations.map((loc, i) => (
                                        <div key={i} className="flex gap-4 items-center group">
                                            <div className="h-12 w-12 flex items-center justify-center text-neutral-600 bg-white/[0.01] border-r border-white/5 font-mono text-xs">
                                                {loc.id}
                                            </div>
                                            <input
                                                className="flex-1 bg-transparent px-2 py-3.5 text-sm text-white focus:outline-none hover:bg-white/[0.02] transition-colors"
                                                value={loc.name}
                                                onChange={e => {
                                                    const newLocs = [...campus.locations];
                                                    newLocs[i].name = e.target.value;
                                                    setCampus({ ...campus, locations: newLocs });
                                                }}
                                                placeholder="Main Campus"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {campus.isUniversity && (
                                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 ml-1">Dorms & Residences</label>
                                    <div className="space-y-3">
                                        {dorms.map((dorm, i) => (
                                            <div key={i} className="flex items-start gap-3">
                                                <div className="flex-1 bg-[#1A1A1A] border border-white/10 rounded-3xl overflow-hidden shadow-lg">
                                                    <div className="flex items-center gap-4 p-4">
                                                        <div className="relative group/img h-14 w-14 shrink-0">
                                                            <div
                                                                className="h-14 w-14 rounded-xl flex items-center justify-center text-neutral-500 overflow-hidden cursor-pointer hover:ring-1 hover:ring-[#ffb200]/50 transition-all"
                                                                onClick={() => {
                                                                    const input = document.getElementById(`dorm-img-${i}`);
                                                                    input?.click();
                                                                }}
                                                            >
                                                                {dorm.logoUrl ? (
                                                                    <img src={dorm.logoUrl} alt={dorm.name} className="h-full w-full object-contain" />
                                                                ) : (
                                                                    <CameraIcon className="h-6 w-6 opacity-40 group-hover/img:opacity-100 transition-opacity" />
                                                                )}
                                                            </div>
                                                            <input
                                                                type="file"
                                                                id={`dorm-img-${i}`}
                                                                className="hidden"
                                                                accept="image/*"
                                                                onChange={(e) => handleImageSelect('dorm', i, e)}
                                                            />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <input
                                                                placeholder="Dorm Name"
                                                                className="w-full bg-transparent text-sm font-semibold text-white placeholder:text-neutral-500 focus:outline-none"
                                                                value={dorm.name}
                                                                onChange={e => handleDormChange(i, 'name', e.target.value)}
                                                            />
                                                            <input
                                                                placeholder="Admin email (optional)"
                                                                className="w-full bg-transparent text-xs text-neutral-400 placeholder:text-neutral-600 focus:outline-none mt-1"
                                                                value={dorm.adminEmail}
                                                                onChange={e => handleDormChange(i, 'adminEmail', e.target.value)}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveDorm(i)}
                                                    className="flex h-9 w-9 mt-4 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-all hover:bg-red-500/20 hover:text-red-400 border border-white/5 hover:border-red-500/30"
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ))}

                                        <button
                                            type="button"
                                            onClick={handleAddDorm}
                                            className="w-full flex items-center justify-center gap-2 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] py-4 text-sm font-medium text-neutral-400 transition-all hover:bg-white/[0.04] hover:text-white hover:border-white/20"
                                        >
                                            <PlusIcon className="h-4 w-4" />
                                            Add Dorm
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Default Clubs Section */}
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300" style={{ animationDelay: '100ms' }}>
                                <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 ml-1">Default Clubs</label>
                                <div className="space-y-3">
                                    {defaultClubs.map((club, i) => (
                                        <div key={club.id || i} className="flex items-start gap-3">
                                            <div className="flex-1 bg-[#1A1A1A] border border-white/10 rounded-3xl overflow-hidden shadow-lg">
                                                <div className="flex items-center gap-4 p-4">
                                                    <div className="relative group/img h-14 w-14 shrink-0">
                                                        <div
                                                            className="h-14 w-14 rounded-xl flex items-center justify-center text-neutral-500 overflow-hidden cursor-pointer hover:ring-1 hover:ring-[#ffb200]/50 transition-all"
                                                            onClick={() => {
                                                                const input = document.getElementById(`club-img-${i}`);
                                                                input?.click();
                                                            }}
                                                        >
                                                            {club.logoUrl ? (
                                                                <img src={club.logoUrl} alt={club.name} className="h-full w-full object-contain" />
                                                            ) : (
                                                                <CameraIcon className="h-6 w-6 opacity-40 group-hover/img:opacity-100 transition-opacity" />
                                                            )}
                                                        </div>
                                                        <input
                                                            type="file"
                                                            id={`club-img-${i}`}
                                                            className="hidden"
                                                            accept="image/*"
                                                            onChange={(e) => handleImageSelect('club', i, e)}
                                                        />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <input
                                                            placeholder="Club Name"
                                                            className="w-full bg-transparent text-sm font-semibold text-white placeholder:text-neutral-500 focus:outline-none"
                                                            value={club.name}
                                                            onChange={e => {
                                                                const newClubs = [...defaultClubs];
                                                                newClubs[i].name = e.target.value;
                                                                setDefaultClubs(newClubs);
                                                            }}
                                                        />
                                                        <input
                                                            placeholder="Admin email (optional)"
                                                            className="w-full bg-transparent text-xs text-neutral-400 placeholder:text-neutral-600 focus:outline-none mt-1"
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
                                                className="flex h-9 w-9 mt-4 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-all hover:bg-red-500/20 hover:text-red-400 border border-white/5 hover:border-red-500/30"
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}

                                    <button
                                        type="button"
                                        onClick={handleAddDefaultClub}
                                        className="w-full flex items-center justify-center gap-2 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] py-4 text-sm font-medium text-neutral-400 transition-all hover:bg-white/[0.04] hover:text-white hover:border-white/20"
                                    >
                                        <PlusIcon className="h-4 w-4" />
                                        Add Club
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Sidebar */}
                        <div className="space-y-8">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 ml-1">Administration</label>
                                <div className="bg-[#1A1A1A] border border-white/10 rounded-3xl overflow-hidden shadow-lg">
                                    <textarea
                                        rows={4}
                                        className="w-full resize-none bg-transparent px-4 py-3.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none hover:bg-white/[0.02] transition-colors custom-scrollbar"
                                        value={adminEmailsText}
                                        onChange={e => setAdminEmailsText(e.target.value)}
                                        placeholder="Admin emails (one per line)"
                                    />
                                </div>
                                <p className="text-xs text-neutral-500 ml-1">These users gain control of this campus.</p>
                            </div>

                            <div className="flex items-center gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => router.back()}
                                    className="flex-1 rounded-full bg-neutral-800/50 py-3 text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white"
                                >
                                    <span className="hidden sm:inline">Cancel</span>
                                    <XMarkIcon className="h-5 w-5 sm:hidden" />
                                </button>

                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 rounded-full bg-[#ffb200] py-3.5 text-sm font-bold text-black shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:hover:scale-100"
                                >
                                    {saving ? "Saving..." : "Save"}
                                </button>
                            </div>
                        </div>
                    </form>
                )}
            </div>

            {/* Crop Modal */}
            {cropModalOpen && cropImageSrc && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/90 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="relative h-[80vh] w-[90vw] max-w-lg bg-neutral-800 rounded-3xl overflow-hidden shadow-2xl overflow-hidden">
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

                    {/* Zoom slider */}
                    <div className="absolute bottom-32 left-1/2 -translate-x-1/2 flex items-center gap-4 rounded-full bg-black/60 px-6 py-3 backdrop-blur-sm border border-white/10">
                        <span className="text-xs font-bold uppercase tracking-widest text-white/70">Zoom</span>
                        <input
                            type="range"
                            min={1}
                            max={3}
                            step={0.1}
                            value={zoom}
                            onChange={(e) => setZoom(Number(e.target.value))}
                            className="w-32 accent-[#ffb200] cursor-pointer"
                        />
                    </div>

                    {/* Action buttons */}
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4">
                        <button
                            onClick={handleCropCancel}
                            className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-all hover:bg-white/20 border border-white/10"
                        >
                            <XMarkIcon className="h-7 w-7" />
                        </button>
                        <button
                            onClick={handleCropConfirm}
                            className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ffb200] text-black shadow-xl transition-all hover:scale-110 active:scale-95"
                        >
                            <CheckIcon className="h-7 w-7" />
                        </button>
                    </div>
                </div>
            )}
            {/* Delete Confirmation Modal */}
            {confirmDeleteStep > 0 && (pendingDormDeletions.length > 0 || pendingClubDeletions.length > 0) && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200 p-4">
                    <div className="w-full max-w-sm bg-[#1A1A1A] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center space-y-6">
                            <div className={`h-20 w-20 rounded-full flex items-center justify-center transition-all duration-300 ${confirmDeleteStep === 1 ? 'bg-amber-500/10 text-amber-500' :
                                confirmDeleteStep === 2 ? 'bg-orange-500/20 text-orange-500 scale-110' :
                                    'bg-red-500/20 text-red-500 scale-125'
                                }`}>
                                {confirmDeleteStep === 1 && <TrashIcon className="h-10 w-10" />}
                                {confirmDeleteStep === 2 && <ExclamationTriangleIcon className="h-10 w-10" />}
                                {confirmDeleteStep === 3 && <ShieldExclamationIcon className="h-10 w-10" />}
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-xl font-bold text-white">
                                    {confirmDeleteStep === 1 && "Confirm Deletions"}
                                    {confirmDeleteStep === 2 && "Permanent Action"}
                                    {confirmDeleteStep === 3 && "Final Confirmation"}
                                </h3>
                                <div className="text-neutral-400 text-sm leading-relaxed">
                                    {confirmDeleteStep === 1 && (
                                        <div className="space-y-2">
                                            <p>You are about to delete following items:</p>
                                            <div className="bg-white/5 rounded-2xl p-3 text-left max-h-32 overflow-y-auto custom-scrollbar">
                                                {pendingDormDeletions.map(d => (
                                                    <div key={d.id || d.name} className="flex items-center gap-2 text-xs py-1 text-neutral-300">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                                        {d.name || 'Unnamed Dorm'} (Dorm)
                                                    </div>
                                                ))}
                                                {pendingClubDeletions.map(c => (
                                                    <div key={c.id || c.name} className="flex items-center gap-2 text-xs py-1 text-neutral-300">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                                                        {c.name || 'Unnamed Club'} (Club)
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {confirmDeleteStep === 2 && (
                                        <p>Deleting {pendingDormDeletions.length + pendingClubDeletions.length} items will remove all associated records from Firestore. This cannot be undone.</p>
                                    )}
                                    {confirmDeleteStep === 3 && (
                                        <p>This is your <span className="text-red-400 font-bold underline">final warning</span>. Proceed with saving and deleting these items?</p>
                                    )}
                                </div>
                            </div>

                            <div className="w-full grid grid-cols-2 gap-3 pt-2">
                                <button
                                    onClick={() => {
                                        setConfirmDeleteStep(0);
                                        // Reset confirm state but keep pending deletions in case they want to hit save again?
                                        // Actually, if they cancel the confirmation, they probably don't want to save yet.
                                    }}
                                    className="rounded-full bg-white/5 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        if (confirmDeleteStep < 3) {
                                            setConfirmDeleteStep(prev => prev + 1);
                                        } else {
                                            setIsConfirmed(true);
                                            setConfirmDeleteStep(0);
                                            // Handle the save after confirming
                                            setTimeout(() => performFinalSave(), 100);
                                        }
                                    }}
                                    className={`rounded-full py-3.5 text-sm font-bold text-black transition-all shadow-lg active:scale-95 ${confirmDeleteStep === 1 ? 'bg-amber-500 hover:bg-amber-400' :
                                        confirmDeleteStep === 2 ? 'bg-orange-500 hover:bg-orange-400' :
                                            'bg-red-500 hover:bg-red-400'
                                        }`}
                                >
                                    {confirmDeleteStep === 3 ? "CONFIRM" : "Next"}
                                </button>
                            </div>

                            {/* Step indicators */}
                            <div className="flex gap-2 pt-2">
                                {[1, 2, 3].map(step => (
                                    <div
                                        key={step}
                                        className={`h-1 rounded-full transition-all duration-300 ${step <= confirmDeleteStep
                                            ? (confirmDeleteStep === 3 ? 'w-8 bg-red-500' : 'w-8 bg-white/40')
                                            : 'w-2 bg-white/10'
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
