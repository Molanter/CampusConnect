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
    const [coverFile, setCoverFile] = useState<File | null>(null);

    // Crop modal state
    const [cropModalOpen, setCropModalOpen] = useState(false);
    const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

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
                setCropImageSrc(reader.result as string);
                setCropModalOpen(true);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setCoverFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setCoverPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleCropConfirm = async () => {
        if (!cropImageSrc || !croppedAreaPixels) return;
        try {
            const croppedBlob = await getCroppedImg(cropImageSrc, croppedAreaPixels);
            setLogoCroppedBlob(croppedBlob);
            setLogoPreview(URL.createObjectURL(croppedBlob));
            setCropModalOpen(false);
            setCropImageSrc(null);
            setCrop({ x: 0, y: 0 });
            setZoom(1);
        } catch (err) {
            console.error("Error cropping image:", err);
            alert("Failed to crop image.");
        }
    };

    const handleCropCancel = () => {
        setCropModalOpen(false);
        setCropImageSrc(null);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
    };

    const handleSave = async () => {
        if (!club || !name.trim()) {
            alert("Club name is required.");
            return;
        }

        setSaving(true);
        try {
            let logoUrl = club.logoUrl;
            let coverImageUrl = club.coverImageUrl;

            // Upload cropped logo if available
            if (logoCroppedBlob) {
                const storageRef = ref(storage, `clubs/${clubId}/logo-${Date.now()}.jpg`);
                await uploadBytes(storageRef, logoCroppedBlob);
                logoUrl = await getDownloadURL(storageRef);
            }

            // Upload cover image if available
            if (coverFile) {
                const storageRef = ref(storage, `clubs/${clubId}/cover-${Date.now()}`);
                await uploadBytes(storageRef, coverFile);
                coverImageUrl = await getDownloadURL(storageRef);
            }

            await updateDoc(doc(db, "clubs", clubId), {
                name: name.trim(),
                description: description.trim(),
                category: category.trim(),
                logoUrl: logoUrl || null,
                coverImageUrl: coverImageUrl || null
            });

            alert("Club updated successfully!");
            router.push(`/clubs/${clubId}/settings`);
        } catch (err) {
            console.error("Error saving club:", err);
            alert("Failed to save changes.");
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
            {/* Crop Modal */}
            {cropModalOpen && cropImageSrc && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
                    <div className="relative h-[80vh] w-[90vw] max-w-lg">
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
                    <div className="absolute bottom-32 left-1/2 -translate-x-1/2 flex items-center gap-4 rounded-full bg-black/60 px-6 py-3 backdrop-blur-sm">
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
                        <button
                            onClick={handleCropCancel}
                            className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-all hover:bg-white/20"
                        >
                            <XMarkIcon className="h-7 w-7" />
                        </button>
                        <button
                            onClick={handleCropConfirm}
                            className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ffb200] text-black transition-all hover:bg-[#ffc233]"
                        >
                            <CheckIcon className="h-7 w-7" />
                        </button>
                    </div>
                </div>
            )}

            <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8">
                <header className="mb-2">
                    <button
                        onClick={() => router.back()}
                        className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/70 hover:text-white hover:bg-white/10 transition-all"
                    >
                        <ChevronLeftIcon className="h-5 w-5" />
                    </button>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
                        Edit Club
                    </p>
                    <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
                        Edit Details
                    </h1>
                </header>

                {/* Cover Image Upload */}
                <section className="space-y-3">
                    <h2 className="px-4 text-[13px] font-semibold uppercase tracking-wider text-neutral-500">Cover Image</h2>
                    <div className="overflow-hidden rounded-2xl bg-[#1C1C1E]">
                        <div className="relative h-40 w-full bg-neutral-800">
                            {coverPreview ? (
                                <img
                                    src={coverPreview}
                                    alt="Cover"
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                    <PhotoIcon className="h-12 w-12 text-neutral-600" />
                                </div>
                            )}
                            <label className="absolute bottom-3 right-3 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-all hover:bg-black/80">
                                <CameraIcon className="h-5 w-5" />
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleCoverSelect}
                                    className="hidden"
                                />
                            </label>
                        </div>
                        <div className="px-4 py-3">
                            <p className="text-[13px] text-neutral-500">Recommended: 1200x400px or similar wide aspect ratio</p>
                        </div>
                    </div>
                </section>

                {/* Logo Upload */}
                <section className="space-y-3">
                    <h2 className="px-4 text-[13px] font-semibold uppercase tracking-wider text-neutral-500">Club Logo</h2>
                    <div className="overflow-hidden rounded-2xl bg-[#1C1C1E] p-6">
                        <div className="flex items-center gap-6">
                            <div className="relative">
                                <div className="h-24 w-24 overflow-hidden rounded-full border border-white/10 bg-neutral-800">
                                    {logoPreview ? (
                                        <img
                                            src={logoPreview}
                                            alt="Club Logo"
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center">
                                            <PhotoIcon className="h-10 w-10 text-neutral-600" />
                                        </div>
                                    )}
                                </div>
                                <label className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#ffb200] text-black shadow-lg transition-transform hover:scale-105">
                                    <CameraIcon className="h-4 w-4" />
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleLogoSelect}
                                        className="hidden"
                                    />
                                </label>
                            </div>
                            <div>
                                <p className="text-[15px] text-white">Upload a logo</p>
                                <p className="text-[13px] text-neutral-500">You can resize after selecting</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Club Name */}
                <section className="space-y-3">
                    <h2 className="px-4 text-[13px] font-semibold uppercase tracking-wider text-neutral-500">Club Name</h2>
                    <div className="overflow-hidden rounded-2xl bg-[#1C1C1E]">
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter club name"
                            className="w-full bg-transparent px-4 py-3 text-[15px] text-white placeholder-neutral-500 outline-none"
                        />
                    </div>
                </section>

                {/* Description */}
                <section className="space-y-3">
                    <h2 className="px-4 text-[13px] font-semibold uppercase tracking-wider text-neutral-500">Description</h2>
                    <div className="overflow-hidden rounded-2xl bg-[#1C1C1E]">
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe your club..."
                            rows={4}
                            className="w-full resize-none bg-transparent px-4 py-3 text-[15px] text-white placeholder-neutral-500 outline-none"
                        />
                    </div>
                </section>

                {/* Category */}
                <section className="space-y-3">
                    <h2 className="px-4 text-[13px] font-semibold uppercase tracking-wider text-neutral-500">Category</h2>
                    <div className="overflow-hidden rounded-2xl bg-[#1C1C1E]">
                        <input
                            type="text"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            placeholder="e.g., Sports, Academic, Social"
                            className="w-full bg-transparent px-4 py-3 text-[15px] text-white placeholder-neutral-500 outline-none"
                        />
                    </div>
                </section>

                {/* Save Button */}
                <div className="pt-4">
                    <button
                        onClick={handleSave}
                        disabled={saving || !name.trim()}
                        className="w-full rounded-2xl bg-[#ffb200] py-4 text-[17px] font-semibold text-black transition-all hover:bg-[#ffc233] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </div>
        </>
    );
}
