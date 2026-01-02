"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { db, storage } from "../lib/firebase";
import { collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { User } from "firebase/auth";
import { PhotoIcon, CalendarIcon, XMarkIcon } from "@heroicons/react/24/outline";

interface PostComposerProps {
    user: User | null;
    onPostCreated?: () => void;
}

export function PostComposer({ user, onPostCreated }: PostComposerProps) {
    const router = useRouter();

    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.photoURL || null);

    const [selectedImages, setSelectedImages] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea based on content
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
    }, [content]);

    // Fetch avatar from Firestore to ensure it's up to date
    useEffect(() => {
        const fetchAvatar = async () => {
            if (!user) return;
            try {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    if (userData.photoURL) setAvatarUrl(userData.photoURL);
                }
            } catch (error) {
                console.error("Error fetching user avatar:", error);
            }
        };

        fetchAvatar();
    }, [user]);

    // Cleanup object URLs on unmount
    useEffect(() => {
        return () => {
            previewUrls.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [previewUrls]);

    const handleImageClick = () => fileInputRef.current?.click();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            const newUrls = newFiles.map((file) => URL.createObjectURL(file));
            setSelectedImages((prev) => [...prev, ...newFiles]);
            setPreviewUrls((prev) => [...prev, ...newUrls]);
        }
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeImage = (index: number) => {
        const url = previewUrls[index];
        if (url) URL.revokeObjectURL(url);
        setSelectedImages((prev) => prev.filter((_, i) => i !== index));
        setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
    };

    const clearAllImages = () => {
        previewUrls.forEach((url) => URL.revokeObjectURL(url));
        setSelectedImages([]);
        setPreviewUrls([]);
    };

    const handlePost = async () => {
        if (!user || (!content.trim() && selectedImages.length === 0)) return;

        setLoading(true);
        try {
            const uploadedImageUrls: string[] = [];

            if (selectedImages.length > 0) {
                const uploadPromises = selectedImages.map(async (file) => {
                    const storagePath = `posts/${user.uid}/${Date.now()}_${file.name}`;
                    const storageRef = ref(storage, storagePath);
                    await uploadBytes(storageRef, file);
                    return getDownloadURL(storageRef);
                });
                const urls = await Promise.all(uploadPromises);
                uploadedImageUrls.push(...urls);
            }

            const docData: any = {
                authorId: user.uid,
                content: content.trim(),
                createdAt: serverTimestamp(),
                isEvent: false,
                likes: [],
                visibility: "visible",
                reportCount: 0,
            };

            if (uploadedImageUrls.length > 0) {
                docData.imageUrls = uploadedImageUrls;
            }

            await addDoc(collection(db, "posts"), docData);

            setContent("");
            clearAllImages();
            onPostCreated?.();
        } catch (error) {
            console.error("Error creating post:", error);
            alert("Failed to create post. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (!user) return null;

    return (
        // SECTION COLOR CARD (light: white, dark: dark gray) + theme border
        <div className="mb-6 cc-section cc-shadow-soft px-3 py-5 w-full @3xl:mx-auto @3xl:max-w-[600px]">
            <div className="relative flex gap-3">
                {/* Avatar with light stroke that adapts to theme */}
                <div className="shrink-0 w-9 h-9">
                    <div className="h-9 w-9 overflow-hidden rounded-full bg-surface-2 border border-border aspect-square">
                        {avatarUrl ? (
                            <img
                                src={avatarUrl}
                                alt={user.displayName || "User"}
                                className="!h-full !w-full object-cover object-center"
                            />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-600 to-neutral-700 text-sm font-bold text-white">
                                {(user.displayName || "U").charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>
                </div>

                {/* Input Area */}
                <div className="flex-1 min-w-0">
                    <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="What's happening?"
                        className="w-full resize-none bg-transparent pt-2.5 text-[17px] text-foreground placeholder:text-muted focus:outline-none min-h-[40px] max-h-[160px] overflow-y-auto"
                        style={{ overflowAnchor: "none" }}
                    />

                    {/* Image Preview */}
                    {previewUrls.length > 0 && (
                        <div className="flex gap-3 overflow-x-auto pb-2 mt-3 no-scrollbar">
                            {previewUrls.map((url, index) => (
                                <div key={url} className="relative flex-shrink-0">
                                    {/* Media background = section color, + light stroke */}
                                    <div className="h-20 w-20 rounded-xl bg-surface-2 border border-border overflow-hidden">
                                        <img
                                            src={url}
                                            alt={`Selected ${index + 1}`}
                                            className="h-full w-full object-cover"
                                        />
                                    </div>

                                    <button
                                        onClick={() => removeImage(index)}
                                        className="absolute -right-1.5 -top-1.5 rounded-full bg-black/70 p-0.5 text-white hover:bg-black border border-border/40 transition-colors"
                                        aria-label="Remove image"
                                    >
                                        <XMarkIcon className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        multiple
                        className="hidden"
                    />

                    {/* Action Bar */}
                    <div className="flex items-center justify-between pt-4 mt-1 border-t border-divider">
                        <div className="flex items-center gap-2">
                            {/* Event button: theme-safe background/text */}
                            <button
                                onClick={() => router.push("/posts/new")}
                                className="flex items-center gap-2 rounded-full bg-secondary/15 hover:bg-secondary/25 px-4 py-2 text-sm font-medium text-foreground transition-colors"
                            >
                                <CalendarIcon className="h-4.5 w-4.5 text-secondary" />
                                <span className="hidden @3xl:inline">Create event</span>
                                <span className="@3xl:hidden">Event</span>
                            </button>

                            {/* Media Attachment button */}
                            <button
                                onClick={handleImageClick}
                                className={`flex items-center justify-center h-9 w-9 rounded-full transition-colors ${previewUrls.length > 0
                                    ? "bg-surface-3 text-foreground"
                                    : "text-muted hover:bg-surface-3 hover:text-foreground"
                                    }`}
                                aria-label="Add media"
                            >
                                <PhotoIcon className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Post Button */}
                        <button
                            onClick={handlePost}
                            disabled={loading || (!content.trim() && selectedImages.length === 0)}
                            className={`rounded-full px-5 py-2 text-sm font-bold transition-all duration-200 ${content.trim() || selectedImages.length > 0
                                ? "bg-brand text-brand-foreground hover:scale-[1.02] active:scale-[0.98]"
                                : "bg-secondary/15 text-secondary cursor-not-allowed"
                                }`}
                        >
                            {loading ? "Posting..." : "Post"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}