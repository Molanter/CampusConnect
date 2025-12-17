"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { auth, storage } from "../../../lib/firebase";
import { createClub } from "../../../lib/clubs";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { ChevronLeftIcon, PhotoIcon, XMarkIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { Switch } from "@headlessui/react";

export default function CreateClubPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        name: "",
        description: "",
        isPrivate: false,
    });

    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!auth.currentUser) return;

        setLoading(true);
        try {
            let coverImageUrl = undefined;

            if (selectedImage) {
                // Upload Image
                const storagePath = `clubs/covers/${auth.currentUser.uid}/${Date.now()}_${selectedImage.name}`;
                const storageRef = ref(storage, storagePath);
                await uploadBytes(storageRef, selectedImage);
                coverImageUrl = await getDownloadURL(storageRef);
            }

            const clubId = await createClub(auth.currentUser.uid, {
                name: formData.name,
                description: formData.description,
                coverImageUrl,
                isPrivate: formData.isPrivate,
            });
            router.push(`/clubs/${clubId}`);
        } catch (error) {
            console.error("Error creating club:", error);
            setLoading(false);
        }
    };

    return (
        <div className="mx-auto min-h-screen w-full max-w-2xl px-6 py-8">

            {/* Header */}
            <div className="mb-8 flex items-center gap-4">
                <Link
                    href="/clubs"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
                >
                    <ChevronLeftIcon className="h-5 w-5" strokeWidth={2.5} />
                </Link>
                <h1 className="text-2xl font-bold text-white">Create a Club</h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">

                {/* Cover Image Section */}
                <div className="rounded-[28px] border border-white/10 bg-[#1C1C1E] p-4">
                    <div className="space-y-3">
                        <label className="block text-xs font-medium uppercase tracking-wider text-neutral-400 pl-2">Cover Image</label>

                        {previewUrl ? (
                            <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 group">
                                <img src={previewUrl} alt="Cover Preview" className="h-full w-full object-cover" />
                                <button
                                    type="button"
                                    onClick={clearImage}
                                    className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-red-500"
                                >
                                    <XMarkIcon className="h-5 w-5" />
                                </button>
                            </div>
                        ) : (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="flex aspect-video w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/5 transition-colors hover:border-white/30 hover:bg-white/10"
                            >
                                <PhotoIcon className="mb-2 h-8 w-8 text-zinc-500" />
                                <span className="text-sm font-medium text-zinc-400">Tap to select image</span>
                                <span className="text-xs text-zinc-600 mt-1">Recommended: 16:9 aspect ratio</span>
                            </div>
                        )}

                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="image/*"
                            className="hidden"
                        />
                    </div>
                </div>

                {/* Club Details Group */}
                <div className="rounded-[28px] border border-white/10 bg-[#1C1C1E] overflow-hidden">
                    {/* Name */}
                    <div className="px-6 py-4 border-b border-white/10">
                        <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2 block">Club Name</label>
                        <input
                            required
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full bg-transparent text-white placeholder-neutral-500 focus:outline-none text-base"
                            placeholder="e.g. Photography Club"
                        />
                    </div>

                    {/* Description */}
                    <div className="px-6 py-4 border-b border-white/10">
                        <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2 block">Description</label>
                        <textarea
                            required
                            rows={4}
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full bg-transparent text-white placeholder-neutral-500 focus:outline-none text-base resize-none"
                            placeholder="What is this club about? Tell us more..."
                        />
                    </div>

                    {/* Privacy Toggle */}
                    <div className="px-6 py-4 flex items-center justify-between">
                        <Switch.Group>
                            <div className="flex flex-col">
                                <Switch.Label className="cursor-pointer text-base font-medium text-white">
                                    Private Club
                                </Switch.Label>
                                <span className="text-sm text-neutral-500">
                                    Only approved members can see posts and join.
                                </span>
                            </div>
                            <Switch
                                checked={formData.isPrivate}
                                onChange={(val: boolean) => setFormData({ ...formData, isPrivate: val })}
                                className={`${formData.isPrivate ? 'bg-[#ffb200]' : 'bg-zinc-700'
                                    } relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none`}
                            >
                                <span
                                    className={`${formData.isPrivate ? 'translate-x-6' : 'translate-x-1'
                                        } inline-block h-5 w-5 transform rounded-full bg-white transition-transform`}
                                />
                            </Switch>
                        </Switch.Group>
                    </div>
                </div>

                {/* Submit */}
                <div className="pt-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-full bg-[#ffb200] py-4 text-center font-bold text-black shadow-lg shadow-[#ffb200]/20 transition-all hover:bg-[#ffc233] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? "Creating..." : "Create Club"}
                    </button>
                    <p className="text-center text-xs text-neutral-500 mt-4">
                        By creating a club, you agree to our Community Guidelines.
                    </p>
                </div>
            </form>
        </div>
    );
}
