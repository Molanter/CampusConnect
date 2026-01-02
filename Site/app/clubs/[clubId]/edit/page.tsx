"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, getDocs, collection, query, where, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import Link from "next/link";
import Cropper from "react-easy-crop";
import {
    ChevronLeftIcon,
    PhotoIcon,
    CameraIcon,
    XMarkIcon,
    CheckIcon
} from "@heroicons/react/24/outline";
import { auth, db, storage } from "../../../../lib/firebase";
import { Club } from "../../../../lib/clubs";
import { fetchGlobalAdminEmails, isGlobalAdmin } from "../../../../lib/admin-utils";
import { useAdminMode } from "../../../../components/admin-mode-context";

import Toast, { ToastData } from "@/components/Toast";

// Shared UI class definitions
const ui = {
    page: "mx-auto min-h-screen w-full max-w-2xl px-4 py-8 pb-32",
    headerBackBtn: "flex h-10 w-10 items-center justify-center rounded-full cc-header-btn transition-transform active:scale-95",
    title: "text-2xl font-bold text-foreground",
    sectionLabel: "px-4 text-[13px] font-semibold uppercase tracking-wider cc-muted mb-2",
    card: "cc-section cc-radius-24 shadow-lg overflow-hidden",
    row: "relative group/row mx-1 px-3 py-3 flex flex-col gap-1 rounded-[18px] transition-all hover:bg-secondary/10 cursor-pointer overflow-hidden",
    rowHover: "hover:bg-secondary/10 cursor-pointer", // Helper for non-interactive rows if needed
    rowDivider: "absolute bottom-0 left-0 right-0 h-px bg-secondary/15 group-last/row:hidden",
    label: "text-[11px] font-semibold text-neutral-500 uppercase tracking-wider",
    input: "w-full bg-transparent text-foreground placeholder-neutral-500 focus:outline-none text-[15px]",
    textarea: "w-full bg-transparent text-foreground placeholder-neutral-500 focus:outline-none text-[15px] resize-none",
    dropzone: "flex aspect-video w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/5 transition-colors hover:border-white/30 hover:bg-white/10",
    previewWrap: "relative aspect-video w-full overflow-hidden rounded-xl ring-1 ring-white/10 group",
    clearBtn: "absolute right-2 top-2 z-10 rounded-full bg-black/50 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-red-500",
    saveBtn: "w-full rounded-full bg-[#ffb200] py-4 text-[17px] font-semibold text-black transition-all hover:bg-[#ffc233] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed",
    cropOverlay: "fixed inset-0 z-50 flex items-center justify-center bg-black/90",
    cropPill: "absolute bottom-32 left-1/2 -translate-x-1/2 flex items-center gap-4 rounded-full bg-black/60 px-6 py-3 backdrop-blur-sm ring-1 ring-white/10",
    cropBtnGlass: "flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-all hover:bg-white/20 ring-1 ring-white/10",
    cropBtnPrimary: "flex h-14 w-14 items-center justify-center rounded-full bg-[#ffb200] text-black transition-all hover:bg-[#ffc233] shadow-lg shadow-orange-500/20"
};

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
        }, 'image/jpeg', 0.9);
    });
}

export default function EditClubPage() {
    const params = useParams();
    const router = useRouter();
    const clubId = params.clubId as string;

    const [user, setUser] = useState<any>(null);
    const [club, setClub] = useState<Club | null>(null);
    const [membership, setMembership] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<ToastData | null>(null);
    const { isGlobalAdminUser, isCampusAdminUser, adminModeOn } = useAdminMode();

    // Form state
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("");

    // Logo state
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [logoCroppedBlob, setLogoCroppedBlob] = useState<Blob | null>(null);

    // Cover image state
    const [coverPreview, setCoverPreview] = useState<string | null>(null);
    const [coverCroppedBlob, setCoverCroppedBlob] = useState<Blob | null>(null);

    // Crop modal state
    const [cropModalOpen, setCropModalOpen] = useState(false);
    const [cropType, setCropType] = useState<'logo' | 'cover'>('logo');
    const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

    // Refs for hidden inputs
    const logoInputRef = React.useRef<HTMLInputElement>(null);
    const coverInputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
            if (!u) {
                setLoading(false);
            }
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        if (!user || !clubId) return;

        const fetchData = async () => {
            try {
                const clubRef = doc(db, "clubs", clubId);
                const clubSnap = await getDoc(clubRef);
                if (clubSnap.exists()) {
                    const data = { id: clubSnap.id, ...clubSnap.data() } as Club;
                    setClub(data);
                    setName(data.name);
                    setDescription(data.description || "");
                    setCategory(data.category || "");
                    if (data.logoUrl) {
                        setLogoPreview(data.logoUrl);
                    }
                    if (data.coverImageUrl) {
                        setCoverPreview(data.coverImageUrl);
                    }
                }

                const memRef = collection(db, "clubs", clubId, "members");
                const q = query(memRef, where("uid", "==", user.uid));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    setMembership(snap.docs[0].data());
                }
            } catch (err) {
                console.error("Error fetching club data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user, clubId]);

    const isAdmin = isGlobalAdminUser || isCampusAdminUser;
    const isAdminOrOwner = membership?.role === "owner" || membership?.role === "admin" || (isAdmin && adminModeOn);

    const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setCropType('logo');
                setCropImageSrc(reader.result as string);
                setCropModalOpen(true);
            };
            reader.readAsDataURL(file);
        }
        if (logoInputRef.current) logoInputRef.current.value = "";
    };

    const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setCropType('cover');
                setCropImageSrc(reader.result as string);
                setCropModalOpen(true);
            };
            reader.readAsDataURL(file);
        }
        if (coverInputRef.current) coverInputRef.current.value = "";
    };

    const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleCropConfirm = async () => {
        if (!cropImageSrc || !croppedAreaPixels) return;
        try {
            const croppedBlob = await getCroppedImg(cropImageSrc, croppedAreaPixels);

            if (cropType === 'logo') {
                setLogoCroppedBlob(croppedBlob);
                setLogoPreview(URL.createObjectURL(croppedBlob));
            } else {
                setCoverCroppedBlob(croppedBlob);
                setCoverPreview(URL.createObjectURL(croppedBlob));
            }

            setCropModalOpen(false);
            setCropImageSrc(null);
            setCrop({ x: 0, y: 0 });
            setZoom(1);
        } catch (err) {
            console.error("Error cropping image:", err);
            setToast({ type: 'error', message: 'Failed to crop image.' });
        }
    };

    const handleCropCancel = () => {
        setCropModalOpen(false);
        setCropImageSrc(null);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
    };

    const clearCover = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCoverPreview(null);
        setCoverCroppedBlob(null);
    };

    const clearLogo = (e: React.MouseEvent) => {
        e.stopPropagation();
        setLogoPreview(null);
        setLogoCroppedBlob(null);
    }

    const handleSave = async () => {
        if (!club || !name.trim()) {
            setToast({ type: 'error', message: "Club name is required." });
            return;
        }

        setSaving(true);
        try {
            let logoUrl: string | null | undefined = club.logoUrl;
            let coverImageUrl: string | null | undefined = club.coverImageUrl;

            // Upload cropped logo if available
            if (logoCroppedBlob) {
                const storageRef = ref(storage, `clubs/${clubId}/logo-${Date.now()}.jpg`);
                await uploadBytes(storageRef, logoCroppedBlob);
                logoUrl = await getDownloadURL(storageRef);
            }

            // Upload cover image if available
            if (coverCroppedBlob) {
                const storageRef = ref(storage, `clubs/${clubId}/cover-${Date.now()}`);
                await uploadBytes(storageRef, coverCroppedBlob);
                coverImageUrl = await getDownloadURL(storageRef);
            }

            // Handle removal scenarios if cleared (logic simplified, assuming replace/update mostly)
            if (!logoPreview) logoUrl = null;
            if (!coverPreview) coverImageUrl = null;

            await updateDoc(doc(db, "clubs", clubId), {
                name: name.trim(),
                description: description.trim(),
                category: category.trim(),
                logoUrl: logoUrl as any,
                coverImageUrl: coverImageUrl as any
            });

            setToast({ type: 'success', message: 'Club updated successfully' });

            // Wait a moment before navigating back for user to see toast
            setTimeout(() => {
                router.push(`/clubs/${clubId}/settings`);
            }, 1000);

        } catch (err) {
            console.error("Error saving club:", err);
            setToast({ type: 'error', message: 'Failed to save changes.' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center text-neutral-300">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-[#ffb200]" />
            </div>
        );
    }

    if (!club || !isAdminOrOwner) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-3 text-neutral-200">
                <p>You do not have permission to edit this club.</p>
                <Link href={`/clubs/${clubId}`} className="text-[#ffb200] hover:underline">
                    Return to Club
                </Link>
            </div>
        );
    }

    return (
        <>
            <Toast toast={toast} onClear={() => setToast(null)} />

            {/* Crop Modal */}
            {cropModalOpen && cropImageSrc && (
                <div className={ui.cropOverlay}>
                    <div className="relative h-[80vh] w-[90vw] max-w-lg">
                        <Cropper
                            image={cropImageSrc}
                            crop={crop}
                            zoom={zoom}
                            aspect={cropType === 'logo' ? 1 : 16 / 9}
                            cropShape={cropType === 'logo' ? 'rect' : 'rect'}
                            showGrid={false}
                            onCropChange={setCrop}
                            onZoomChange={setZoom}
                            onCropComplete={onCropComplete}
                            classes={{
                                containerClassName: "rounded-3xl",
                                cropAreaClassName: !cropImageSrc ? "" : "!border-2 border-[#ffb200] !rounded-[32px]"
                            }}
                        />
                    </div>

                    {/* Zoom slider */}
                    <div className={ui.cropPill}>
                        <span className="text-sm text-white/70">Zoom</span>
                        <input
                            type="range"
                            min={1}
                            max={3}
                            step={0.1}
                            value={zoom}
                            onChange={(e) => setZoom(Number(e.target.value))}
                            className="w-32 accent-[#ffb200]"
                        />
                    </div>

                    {/* Action buttons */}
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4">
                        <button onClick={handleCropCancel} className={ui.cropBtnGlass}>
                            <XMarkIcon className="h-7 w-7" />
                        </button>
                        <button onClick={handleCropConfirm} className={ui.cropBtnPrimary}>
                            <CheckIcon className="h-7 w-7" />
                        </button>
                    </div>
                </div>
            )}

            <div className={ui.page}>
                <header className="mb-8 flex items-center gap-4">
                    <button onClick={() => router.back()} className={ui.headerBackBtn}>
                        <ChevronLeftIcon className="h-5 w-5" />
                    </button>
                    <h1 className={ui.title}>Edit Details</h1>
                </header>

                {/* Identity Section */}
                <div className="space-y-2">
                    <label className={ui.sectionLabel}>Identity</label>
                    <div className={ui.card}>
                        {/* Logo Row */}
                        <div
                            onClick={() => logoInputRef.current?.click()}
                            className={ui.row}
                        >
                            <div className="flex items-center gap-6 py-2">
                                <div className="relative h-20 w-20 shrink-0">
                                    <div className="h-20 w-20 overflow-hidden rounded-[20px] cc-avatar ring-1 ring-secondary/20 bg-secondary/10 flex items-center justify-center aspect-square shadow-sm group">
                                        {logoPreview ? (
                                            <img src={logoPreview} alt="Logo Preview" className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center bg-secondary/10 text-secondary">
                                                <PhotoIcon className="h-8 w-8" />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-[20px]">
                                            <CameraIcon className="h-6 w-6 text-white" strokeWidth={2.5} />
                                        </div>
                                    </div>
                                    {logoPreview && (
                                        <button
                                            type="button"
                                            onClick={clearLogo}
                                            className="absolute -top-1 -right-1 z-10 rounded-full bg-black/60 p-1 text-white backdrop-blur-sm transition-colors hover:bg-red-500"
                                        >
                                            <XMarkIcon className="h-3 w-3" />
                                        </button>
                                    )}
                                </div>
                                <div className="flex flex-col">
                                    <p className="text-[15px] font-semibold text-foreground">Club Logo</p>
                                    <p className="text-[11px] text-neutral-500">Square organization branding</p>
                                </div>
                            </div>
                            <div className={ui.rowDivider} />
                            <input type="file" ref={logoInputRef} accept="image/*" onChange={handleLogoSelect} className="hidden" />
                        </div>

                        {/* Cover Row */}
                        <div className="p-4">
                            <div className="space-y-2">
                                <label className={ui.label}>Cover Image</label>
                                {coverPreview ? (
                                    <div className={ui.previewWrap}>
                                        <img src={coverPreview} alt="Cover Preview" className="h-full w-full object-cover" />
                                        <button type="button" onClick={clearCover} className={ui.clearBtn}>
                                            <XMarkIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                ) : (
                                    <div onClick={() => coverInputRef.current?.click()} className={ui.dropzone}>
                                        <PhotoIcon className="mb-2 h-8 w-8 text-zinc-500" />
                                        <span className="text-sm font-medium text-zinc-400">Tap to select header image</span>
                                        <span className="text-[10px] text-zinc-600 mt-1">Recommended: 16:9 aspect ratio</span>
                                    </div>
                                )}
                                <input type="file" ref={coverInputRef} onChange={handleCoverSelect} accept="image/*" className="hidden" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Information Section */}
                <div className="space-y-2">
                    <label className={ui.sectionLabel}>Information</label>
                    <div className={ui.card}>
                        {/* Name */}
                        <div className={`${ui.row} !cursor-text`}>
                            <label className={ui.label}>Club Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Photography Club"
                                className={ui.input}
                            />
                            <div className={ui.rowDivider} />
                        </div>

                        {/* Description */}
                        <div className={`${ui.row} !cursor-text`}>
                            <label className={ui.label}>Description</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="What is this club about?"
                                rows={4}
                                className={ui.textarea}
                            />
                            <div className={ui.rowDivider} />
                        </div>

                        {/* Category */}
                        <div className={`${ui.row} !cursor-text`}>
                            <label className={ui.label}>Category</label>
                            <input
                                type="text"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                placeholder="e.g., Sports, Academic"
                                className={ui.input}
                            />
                            {/* No divider on last item */}
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                <div className="pt-4">
                    <button
                        onClick={handleSave}
                        disabled={saving || !name.trim()}
                        className={ui.saveBtn}
                    >
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </div>
        </>
    );
}
