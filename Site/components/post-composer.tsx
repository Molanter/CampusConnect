"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { auth, db, storage } from "../lib/firebase";
import { collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore/lite";
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

    // Fetch avatar from Firestore to ensure it's up to date
    useEffect(() => {
        const fetchAvatar = async () => {
            if (!user) return;
            try {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    if (userData.photoURL) {
                        setAvatarUrl(userData.photoURL);
                    }
                }
            } catch (error) {
                console.error("Error fetching user avatar:", error);
            }
        };

        if (user) {
            fetchAvatar();
        }
    }, [user]);

    // Cleanup object URLs on unmount
    useEffect(() => {
        return () => {
            previewUrls.forEach(url => URL.revokeObjectURL(url));
        };
    }, [previewUrls]);

    const handleImageClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            const newUrls = newFiles.map(file => URL.createObjectURL(file));

            setSelectedImages(prev => [...prev, ...newFiles]);
            setPreviewUrls(prev => [...prev, ...newUrls]);
        }
        // Reset input so validation logic or re-selecting same file works
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeImage = (index: number) => {
        URL.revokeObjectURL(previewUrls[index]);
        setSelectedImages(prev => prev.filter((_, i) => i !== index));
        setPreviewUrls(prev => prev.filter((_, i) => i !== index));
    };

    const handlePost = async () => {
        if (!user || (!content.trim() && selectedImages.length === 0)) return;

        setLoading(true);
        try {
            const uploadedImageUrls: string[] = [];

            if (selectedImages.length > 0) {
                const uploadPromises = selectedImages.map(async (file) => {
                    const storagePath = 'posts/' + user.uid + '/' + Date.now() + '_' + file.name;
                    const storageRef = ref(storage, storagePath);
                    await uploadBytes(storageRef, file);
                    return getDownloadURL(storageRef);
                });
                const urls = await Promise.all(uploadPromises);
                uploadedImageUrls.push(...urls);
            }

            const docData: any = {
                authorId: user.uid,
                authorName: user.displayName || "Anonymous",
                authorUsername: (user as any).username || null, // Best effort username
                authorAvatarUrl: avatarUrl, // Use the fetched avatar
                content: content.trim(),
                createdAt: serverTimestamp(),
                isEvent: false, // Standard post
                likes: [],
                imageUrls: uploadedImageUrls,
            };

            await addDoc(collection(db, "events"), docData); // Using 'events' collection as shared posts collection

            setContent("");
            // Clear images
            selectedImages.forEach((_, i) => removeImage(i));
            setSelectedImages([]);
            setPreviewUrls([]);

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
        <div className="mb-6 rounded-[24px] border border-white/10 bg-[#1C1C1E] p-5 ring-1 ring-white/5 shadow-soft">
            <div className="flex gap-4">
                {/* User Avatar */}
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-neutral-700 ring-2 ring-white/5">
                    {avatarUrl ? (
                        <img
                            src={avatarUrl}
                            alt={user.displayName || "User"}
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-600 to-neutral-700 text-sm font-bold text-white">
                            {(user.displayName || "U").charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div className="flex-1 min-w-0">
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="What's happening?"
                        className="w-full resize-none bg-transparent pt-2.5 text-[17px] text-white placeholder:text-neutral-500 focus:outline-none min-h-[50px]"
                        rows={Math.max(2, content.split('\n').length)}
                        style={{ overflowAnchor: "none" }}
                    />

                    {/* Image Preview - Horizontal Scroll */}
                    {previewUrls.length > 0 && (
                        <div className="flex gap-3 overflow-x-auto pb-2 mt-3 no-scrollbar">
                            {previewUrls.map((url, index) => (
                                <div key={url} className="relative flex-shrink-0">
                                    <img
                                        src={url}
                                        alt={`Selected ${index + 1}`}
                                        className="h-20 w-20 rounded-xl border border-white/10 object-cover"
                                    />
                                    <button
                                        onClick={() => removeImage(index)}
                                        className="absolute -right-1.5 -top-1.5 rounded-full bg-black/70 p-0.5 text-white hover:bg-black ring-1 ring-white/10 transition-colors"
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
                    <div className="flex items-center justify-between pt-4 mt-1 border-t border-white/5">
                        <div className="flex items-center gap-2">
                            {/* Mark as Event -> Navigates to /posts/new */}
                            <button
                                onClick={() => router.push("/posts/new")}
                                className="flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm font-medium text-neutral-300 transition-colors hover:bg-white/10 hover:text-white group"
                            >
                                <CalendarIcon className="h-4.5 w-4.5 text-neutral-400 group-hover:text-white transition-colors" />
                                <span className="hidden sm:inline">Create event</span>
                                <span className="sm:hidden">Event</span>
                            </button>

                            {/* Media Attachment */}
                            <button
                                onClick={handleImageClick}
                                className={`flex items-center justify-center h-9 w-9 rounded-full transition-colors ${previewUrls.length > 0 ? "bg-white/10 text-white" : "text-neutral-400 hover:bg-white/10 hover:text-white"
                                    }`}
                            >
                                <PhotoIcon className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Post Button */}
                        <button
                            onClick={handlePost}
                            disabled={loading || (!content.trim() && selectedImages.length === 0)}
                            className={`rounded-full px-5 py-2 text-sm font-bold transition-all duration-200 ${content.trim() || selectedImages.length > 0
                                ? "bg-[#ffb200] text-black hover:scale-[1.02] active:scale-[0.98]"
                                : "bg-white/5 text-neutral-500 cursor-not-allowed"
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
