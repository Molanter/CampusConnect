"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, storage } from "../../../lib/firebase";
import { createClub } from "@/lib/clubs";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { ChevronLeftIcon, PhotoIcon, XMarkIcon, CameraIcon, CheckIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { Switch } from "@headlessui/react";
import Cropper from "react-easy-crop";

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

// Shared UI class definitions
const ui = {
    page: "mx-auto min-h-screen w-full max-w-2xl px-4 py-8 pb-32",
    headerBackBtn: "flex h-10 w-10 items-center justify-center rounded-full cc-header-btn transition-transform active:scale-95",
    title: "text-2xl font-bold text-foreground",
    sectionLabel: "px-4 text-[13px] font-semibold uppercase tracking-wider cc-muted mb-2",
    card: "cc-section cc-radius-24 shadow-lg overflow-hidden",
    row: "relative group/row mx-1 px-3 py-3 flex flex-col gap-1 rounded-[18px] transition-all hover:bg-secondary/10 cursor-pointer overflow-hidden",
    rowDivider: "absolute bottom-0 left-0 right-0 h-px bg-secondary/15 group-last/row:hidden",
    label: "text-[11px] font-semibold text-neutral-500 uppercase tracking-wider",
    input: "w-full bg-transparent text-foreground placeholder-neutral-500 focus:outline-none text-[15px]",
    textarea: "w-full bg-transparent text-foreground placeholder-neutral-500 focus:outline-none text-[15px] resize-none",
    dropzone: "flex aspect-video w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/5 transition-colors hover:border-white/30 hover:bg-white/10",
    previewWrap: "relative aspect-video w-full overflow-hidden rounded-xl ring-1 ring-white/10 group",
    clearBtn: "absolute right-2 top-2 z-10 rounded-full bg-black/50 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-red-500",
    toggleTrack: (checked: boolean) => `${checked ? 'bg-[#ffb200]' : 'bg-secondary/40'} relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ring-1 ring-white/10`,
    toggleThumb: (checked: boolean) => `${checked ? 'translate-x-6' : 'translate-x-1'} inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm`,
    select: "rounded-full cc-section px-4 py-1.5 text-sm text-foreground border border-secondary/25 focus:outline-none focus:ring-1 focus:ring-brand transition-colors",
};

export default function CreateClubPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        name: "",
        description: "",
        isPrivate: false,
        postingPermission: 'anyone' as 'anyone' | 'admins',
    });

    // Cover image state
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [coverCroppedBlob, setCoverCroppedBlob] = useState<Blob | null>(null);

    // Logo state
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [logoCroppedBlob, setLogoCroppedBlob] = useState<Blob | null>(null);

    // Crop modal state
    const [croppingTarget, setCroppingTarget] = useState<'logo' | 'cover' | null>(null);
    const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setCropImageSrc(reader.result as string);
                setCroppingTarget('cover');
            };
            reader.readAsDataURL(file);
        }
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setCropImageSrc(reader.result as string);
                setCroppingTarget('logo');
            };
            reader.readAsDataURL(file);
        }
        if (logoInputRef.current) logoInputRef.current.value = "";
    };

    const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleCropConfirm = async () => {
        if (!cropImageSrc || !croppedAreaPixels || !croppingTarget) return;
        try {
            const croppedBlob = await getCroppedImg(cropImageSrc, croppedAreaPixels);

            if (croppingTarget === 'logo') {
                setLogoCroppedBlob(croppedBlob);
                if (logoPreview) URL.revokeObjectURL(logoPreview);
                setLogoPreview(URL.createObjectURL(croppedBlob));
            } else {
                setCoverCroppedBlob(croppedBlob);
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                setPreviewUrl(URL.createObjectURL(croppedBlob));
            }

            setCroppingTarget(null);
            setCropImageSrc(null);
            setCrop({ x: 0, y: 0 });
            setZoom(1);
        } catch (err) {
            console.error("Error cropping image:", err);
            alert("Failed to crop image.");
        }
    };

    const handleCropCancel = () => {
        setCroppingTarget(null);
        setCropImageSrc(null);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
    };

    const clearImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setCoverCroppedBlob(null);
    };

    const clearLogo = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (logoPreview) URL.revokeObjectURL(logoPreview);
        setLogoPreview(null);
        setLogoCroppedBlob(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!auth.currentUser) return;

        setLoading(true);
        try {
            let coverImageUrl = undefined;
            let logoUrl = undefined;

            // Upload Cover Image
            if (coverCroppedBlob) {
                const storagePath = `clubs/covers/${auth.currentUser.uid}/${Date.now()}_cover.jpg`;
                const storageRef = ref(storage, storagePath);
                await uploadBytes(storageRef, coverCroppedBlob);
                coverImageUrl = await getDownloadURL(storageRef);
            }

            // Upload Logo
            if (logoCroppedBlob) {
                const storagePath = `clubs/logos/${auth.currentUser.uid}/${Date.now()}_logo.jpg`;
                const storageRef = ref(storage, storagePath);
                await uploadBytes(storageRef, logoCroppedBlob);
                logoUrl = await getDownloadURL(storageRef);
            }

            const clubId = await createClub(auth.currentUser.uid, {
                name: formData.name,
                description: formData.description,
                coverImageUrl,
                logoUrl,
                isPrivate: formData.isPrivate,
                postingPermission: formData.postingPermission,
            });
            router.push(`/clubs/${clubId}`);
        } catch (error) {
            console.error("Error creating club:", error);
            setLoading(false);
        }
    };

    return (
        <>
            {/* Crop Modal */}
            {croppingTarget && cropImageSrc && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md">
                    <div className="relative h-[80vh] w-[90vw] max-w-lg overflow-hidden rounded-3xl ring-1 ring-white/20">
                        <Cropper
                            image={cropImageSrc}
                            crop={crop}
                            zoom={zoom}
                            aspect={croppingTarget === 'logo' ? 1 : 16 / 9}
                            cropShape="rect"
                            showGrid={false}
                            onCropChange={setCrop}
                            onZoomChange={setZoom}
                            onCropComplete={onCropComplete}
                            classes={{
                                containerClassName: "rounded-3xl",
                                cropAreaClassName: `!border-2 border-[#ffb200] ${croppingTarget === 'logo' ? '!rounded-[24px]' : '!rounded-xl'}`
                            }}
                        />
                    </div>

                    {/* Zoom slider */}
                    <div className="absolute bottom-32 left-1/2 -translate-x-1/2 flex items-center gap-4 rounded-full bg-black/60 px-6 py-3 backdrop-blur-sm ring-1 ring-white/10">
                        <span className="text-sm font-semibold text-white/70">Zoom</span>
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
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6">
                        <button
                            type="button"
                            onClick={handleCropCancel}
                            className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-xl transition-all hover:bg-white/20 ring-1 ring-white/20 shadow-2xl"
                        >
                            <XMarkIcon className="h-8 w-8" />
                        </button>
                        <button
                            type="button"
                            onClick={handleCropConfirm}
                            className="flex h-16 w-16 items-center justify-center rounded-full bg-[#ffb200] text-black transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-[#ffb200]/40"
                        >
                            <CheckIcon className="h-8 w-8" strokeWidth={3} />
                        </button>
                    </div>
                </div>
            )}

            <div className={ui.page}>
                {/* Header */}
                <div className="mb-8 flex items-center gap-4">
                    <Link href="/clubs" className={ui.headerBackBtn}>
                        <ChevronLeftIcon className="h-5 w-5" strokeWidth={2.5} />
                    </Link>
                    <h1 className={ui.title}>Create a Club</h1>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
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
                                    {previewUrl ? (
                                        <div className={ui.previewWrap}>
                                            <img src={previewUrl} alt="Cover Preview" className="h-full w-full object-cover" />
                                            <button type="button" onClick={clearImage} className={ui.clearBtn}>
                                                <XMarkIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div onClick={() => fileInputRef.current?.click()} className={ui.dropzone}>
                                            <PhotoIcon className="mb-2 h-8 w-8 text-zinc-500" />
                                            <span className="text-sm font-medium text-zinc-400">Tap to select header image</span>
                                            <span className="text-[10px] text-zinc-600 mt-1">Recommended: 16:9 aspect ratio</span>
                                        </div>
                                    )}
                                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Information Section */}
                    <div className="space-y-2">
                        <label className={ui.sectionLabel}>Information</label>
                        <div className={ui.card}>
                            <div className={ui.row}>
                                <label className={ui.label}>Club Name</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className={ui.input}
                                    placeholder="e.g. Photography Club"
                                />
                                <div className={ui.rowDivider} />
                            </div>

                            <div className={ui.row}>
                                <label className={ui.label}>Description</label>
                                <textarea
                                    required
                                    rows={4}
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className={ui.textarea}
                                    placeholder="What is this club about? Tell us more..."
                                />
                                <div className={ui.rowDivider} />
                            </div>

                            {/* Who Can Post Picker */}
                            <div className={ui.row}>
                                <div className="flex items-center justify-between w-full pr-1">
                                    <div className="flex flex-col">
                                        <p className="text-[15px] font-medium text-foreground leading-tight">
                                            Who Can Post
                                        </p>
                                        <span className="text-[11px] text-neutral-500">
                                            Choose who can create posts in the club.
                                        </span>
                                    </div>
                                    <select
                                        value={formData.postingPermission}
                                        onChange={(e) => setFormData({ ...formData, postingPermission: e.target.value as 'anyone' | 'admins' })}
                                        className={ui.select}
                                    >
                                        <option value="anyone">All Members</option>
                                        <option value="admins">Only Admins</option>
                                    </select>
                                </div>
                                <div className={ui.rowDivider} />
                            </div>

                            {/* Privacy Toggle */}
                            <div className={`${ui.row} cursor-default hover:bg-transparent`}>
                                <Switch.Group>
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex flex-col">
                                            <Switch.Label className="cursor-pointer text-[15px] font-medium text-foreground leading-tight">
                                                Private Club
                                            </Switch.Label>
                                            <span className="text-[11px] text-neutral-500">
                                                Only approved members can see posts and join.
                                            </span>
                                        </div>
                                        <Switch
                                            checked={formData.isPrivate}
                                            onChange={(val: boolean) => setFormData({ ...formData, isPrivate: val })}
                                            className={ui.toggleTrack(formData.isPrivate)}
                                        >
                                            <span className={ui.toggleThumb(formData.isPrivate)} />
                                        </Switch>
                                    </div>
                                </Switch.Group>
                            </div>
                        </div>
                    </div>

                    {/* Submit Section */}
                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-full bg-[#ffb200] py-4 text-center font-bold text-black shadow-lg shadow-[#ffb200]/20 transition-all hover:bg-[#ffc233] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? "Creating..." : "Create Club"}
                        </button>
                        <p className="text-center text-xs text-neutral-500 mt-4">
                            By creating a club, you agree to our{" "}
                            <Link
                                href="/guidelines"
                                target="_blank"
                                className="text-brand hover:underline font-medium"
                            >
                                Community Guidelines
                            </Link>
                            .
                        </p>
                    </div>
                </form>
            </div>
        </>
    );
}
