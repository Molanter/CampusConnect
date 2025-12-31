"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
    onAuthStateChanged,
    type User,
} from "firebase/auth";
import {
    collection,
    doc,
    getDoc,
    updateDoc,
    serverTimestamp,
    increment,
    getDocs,
    query,
    where
} from "firebase/firestore";
import { auth, db } from "../../../../lib/firebase";
import Toast, { ToastData } from "@/components/Toast";
import { ClubMember } from "@/lib/clubs";

type UserProfile = {
    preferredName?: string;
    username?: string;
    campus?: string;
    campusId?: string;
    campusLocation?: string;
    campusLocationId?: string;
    role?: "student" | "staff";
    photoURL?: string;
};

// Reusing MapHelpModal from create page for consistency
function MapHelpModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-md p-4">
            <div className="relative w-full max-w-md overflow-hidden cc-radius-24 cc-glass-strong cc-glass-highlight">
                <div className="flex items-center justify-between border-b border-secondary/10 p-4">
                    <h3 className="text-lg font-bold text-foreground">How to get a Map Link</h3>
                    <button
                        onClick={onClose}
                        className="rounded-full p-2 text-secondary hover:bg-secondary/10 hover:text-foreground transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="p-6 space-y-6">
                    <div className="space-y-2">
                        <h4 className="font-semibold text-foreground flex items-center gap-2">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C7.31 0 3.5 3.81 3.5 8.5c0 5.42 7.72 14.73 8.06 15.13.19.23.53.23.72 0 .34-.4 8.06-9.71 8.06-15.13C20.5 3.81 16.69 0 12 0zm0 12.5c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" /></svg>
                            Google Maps
                        </h4>
                        <p className="text-sm text-secondary">
                            You can copy the URL from your browser's address bar, or use the "Share" button and click "Copy Link".
                        </p>
                        <code className="block rounded bg-secondary/10 p-2 text-xs text-secondary">
                            maps.app.goo.gl/... or google.com/maps/...
                        </code>
                    </div>
                    <div className="space-y-2">
                        <h4 className="font-semibold text-foreground flex items-center gap-2">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" /></svg>
                            Apple Maps
                        </h4>
                        <p className="text-sm text-secondary">
                            Select a location, click the "Share" button, and choose "Copy Link". It usually looks like:
                        </p>
                        <code className="block rounded bg-secondary/10 p-2 text-xs text-secondary">
                            maps.apple.com/?...&ll=lat,lng...
                        </code>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function EditPostPage() {
    const router = useRouter();
    const params = useParams();
    const postId = params.id as string;

    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [loadingPost, setLoadingPost] = useState(true);
    const [toast, setToast] = useState<ToastData | null>(null);

    // Form fields
    const [isEvent, setIsEvent] = useState(false);
    const [description, setDescription] = useState("");
    const [imageUrl, setImageUrl] = useState(""); // Kept for logic compatibility, effectively unused in multi-image flow
    const [eventDate, setEventDate] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");

    // Location fields
    const [locationUrl, setLocationUrl] = useState("");
    const [locationLabel, setLocationLabel] = useState("");
    const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);

    const [dressCode, setDressCode] = useState("");
    const [extraNotes, setExtraNotes] = useState("");

    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [isMapHelpOpen, setIsMapHelpOpen] = useState(false);
    const [showMapPreview, setShowMapPreview] = useState(true);

    // Club context (read-only for edit usually, but good to know)
    const [clubName, setClubName] = useState<string | null>(null);

    // Images
    const [existingImages, setExistingImages] = useState<string[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);

    // Tracking deleted images
    const [deletedImageUrls, setDeletedImageUrls] = useState<string[]>([]);

    // ---- Auth & Post Loading ----
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            setAuthLoading(false);

            if (u) {
                // Load Post Data
                try {
                    const docRef = doc(db, "posts", postId);
                    const snap = await getDoc(docRef);

                    if (snap.exists()) {
                        const data = snap.data();

                        // Authorization Check
                        if (data.authorId !== u.uid) {
                            // Check if user is admin of the club
                            if (data.clubId) {
                                const memberSnap = await getDocs(
                                    query(collection(db, "clubs", data.clubId, "members"), where("uid", "==", u.uid))
                                );
                                let isAdmin = false;
                                if (!memberSnap.empty) {
                                    const memberData = memberSnap.docs[0].data() as ClubMember;
                                    if (memberData.role === "owner" || memberData.role === "admin") {
                                        isAdmin = true;
                                    }
                                }
                                if (!isAdmin) {
                                    router.push(`/posts/${postId}`);
                                    return;
                                }
                            } else {
                                router.push(`/posts/${postId}`);
                                return;
                            }
                        }

                        setDescription(data.description ?? data.content ?? "");
                        setIsEvent(Boolean(data.isEvent));
                        setClubName(data.clubName ?? null);

                        // Images
                        setExistingImages(data.imageUrls ?? (data.imageUrl ? [data.imageUrl] : []));

                        // Event Details
                        if (data.isEvent) {
                            setEventDate(data.date ?? "");
                            setStartTime(data.startTime ?? "");
                            setEndTime(data.endTime ?? "");
                            setLocationLabel(data.locationLabel ?? "");
                            setLocationUrl(data.locationUrl ?? "");
                            setCoordinates(data.coordinates ?? null);

                            // Try to find extra info in description if we don't have dedicated fields
                            // (This is separate from core description)
                        }
                    } else {
                        setFormError("Post not found.");
                    }
                } catch (err) {
                    console.error("Error loading post:", err);
                    setFormError("Failed to load post.");
                } finally {
                    setLoadingPost(false);
                }
            } else {
                setLoadingPost(false);
            }
        });
        return () => unsub();
    }, [postId, router]);

    // Helper to parse coordinates (Same as create page)
    const parseCoordinatesFromUrl = async (url: string) => {
        if (!url) return null;
        let targetUrl = url;

        // Reuse parsing logic from create page
        if (url.includes("goo.gl") || url.includes("maps.app.goo.gl")) {
            try {
                const res = await fetch(`/api/expand-map-url?url=${encodeURIComponent(url)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.expandedUrl) targetUrl = data.expandedUrl;
                }
            } catch (err) { console.error(err); }
        }

        const data3dRegex = /!3d(-?\d+\.\d+)/;
        const data4dRegex = /!4d(-?\d+\.\d+)/;
        const match3d = targetUrl.match(data3dRegex);
        const match4d = targetUrl.match(data4dRegex);
        if (match3d && match4d) return { lat: parseFloat(match3d[1]), lng: parseFloat(match4d[1]) };

        const googleRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
        const matches = targetUrl.match(googleRegex);
        if (matches) return { lat: parseFloat(matches[1]), lng: parseFloat(matches[2]) };

        // ... simplified reuse ...
        return null;
    };

    useEffect(() => {
        const parse = async () => {
            // Only parse if URL changed and differs from what we might have loaded? 
            // Actually just re-parsing is fine to ensure consistency
            const coords = await parseCoordinatesFromUrl(locationUrl);
            if (coords) setCoordinates(coords);
        };
        if (locationUrl) parse();
    }, [locationUrl]);

    // Image handling
    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            setSelectedFiles((prev) => [...prev, ...newFiles]);
            const newUrls = newFiles.map((file) => URL.createObjectURL(file));
            setPreviewUrls((prev) => [...prev, ...newUrls]);
        }
    };

    const removeNewImage = (index: number) => {
        setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
        setPreviewUrls((prev) => {
            const urlToRemove = prev[index];
            URL.revokeObjectURL(urlToRemove);
            return prev.filter((_, i) => i !== index);
        });
    };

    const removeExistingImage = (index: number) => {
        setDeletedImageUrls(prev => [...prev, existingImages[index]]);
        setExistingImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setFormError(null);

        // Validation
        if (isEvent) {
            if (!eventDate || !startTime || !endTime) {
                setFormError("Please set date, start time, and end time.");
                return;
            }
            if (!locationLabel.trim()) {
                setFormError("Please add a location label.");
                return;
            }
        }

        if ((!description || !description.trim()) && selectedFiles.length === 0 && existingImages.length === 0) {
            setFormError("Post must have a description or image.");
            return;
        }

        try {
            setSaving(true);
            setUploading(true);

            // Upload new images
            const newImageUrls: string[] = [];
            if (selectedFiles.length > 0) {
                const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
                const { storage } = await import("../../../../lib/firebase");

                for (const file of selectedFiles) {
                    const storageRef = ref(storage, `posts/${Date.now()}_${file.name}`);
                    await uploadBytes(storageRef, file);
                    const url = await getDownloadURL(storageRef);
                    newImageUrls.push(url);
                }
            }

            const finalImageUrls = [...existingImages, ...newImageUrls];

            const updateData: any = {
                description: description.trim(),
                isEvent: isEvent,
                imageUrls: finalImageUrls,
                editCount: increment(1),
                editedAt: serverTimestamp(),
            };

            if (isEvent) {
                Object.assign(updateData, {
                    date: eventDate,
                    startTime: startTime,
                    endTime: endTime,
                    locationLabel: locationLabel.trim(),
                    coordinates: coordinates,
                    // keep locationUrl if we tracked it, otherwise it might be lost if we don't save it
                    locationUrl: locationUrl,
                });
            }

            await updateDoc(doc(db, "posts", postId), updateData);

            setToast({ type: "success", message: "Post updated." });
            setTimeout(() => {
                router.push(`/posts/${postId}`);
            }, 1000);

        } catch (err) {
            console.error("Error updating post:", err);
            setFormError("Failed to update post.");
            setToast({ type: "error", message: "Update failed." });
        } finally {
            setSaving(false);
            setUploading(false);
        }
    };

    if (authLoading || loadingPost) {
        return (
            <div className="flex h-screen items-center justify-center cc-page text-secondary">
                <div className="animate-pulse">Loading...</div>
            </div>
        );
    }

    if (!user) {
        router.push("/login");
        return null;
    }

    return (
        <div className="cc-page">
            <Toast toast={toast} onClear={() => setToast(null)} />

            <div className="mx-auto w-full max-w-2xl px-4 py-8">
                <header className="mb-8 space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Edit Post</h1>
                    <p className="text-sm text-secondary">Update your post details.</p>
                </header>

                <form onSubmit={handleUpdate} className="space-y-6">

                    {/* Context Info */}
                    {clubName && (
                        <div className="cc-section cc-shadow-soft px-4 py-3 text-sm text-foreground">
                            <span className="text-secondary">Editing post for </span><strong className="text-foreground">{clubName}</strong>
                        </div>
                    )}

                    {/* Description */}
                    <div className="space-y-2">
                        <label className="ml-1 text-xs font-bold uppercase tracking-wider text-secondary">Content</label>
                        <div className="cc-section cc-shadow-soft overflow-hidden">
                            <textarea
                                rows={4}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full resize-none bg-transparent px-4 py-3.5 text-sm text-foreground placeholder:text-secondary focus:outline-none"
                                placeholder="What's going on?"
                            />

                            {/* Image Management */}
                            <div className="flex flex-col gap-3 px-4 py-3 border-t border-secondary/10">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-secondary">
                                        {existingImages.length + selectedFiles.length} photo(s)
                                    </span>
                                    <label className="cursor-pointer rounded-full bg-secondary/15 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/25 transition-colors">
                                        Add Photos
                                        <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
                                    </label>
                                </div>

                                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                    {/* Existing Images */}
                                    {existingImages.map((url, idx) => (
                                        <div key={`exist-${idx}`} className="relative h-20 w-20 flex-shrink-0 overflow-hidden cc-radius-24 ring-1 ring-inset ring-secondary/20 bg-secondary/10 group">
                                            <img src={url} alt="Existing" className="h-full w-full object-cover" />
                                            <button type="button" onClick={() => removeExistingImage(idx)} className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-foreground/10 cc-glass-strong text-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80 hover:text-white">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                    {/* New Images */}
                                    {previewUrls.map((url, idx) => (
                                        <div key={`new-${idx}`} className="relative h-20 w-20 flex-shrink-0 overflow-hidden cc-radius-24 ring-1 ring-inset ring-secondary/20 bg-secondary/10 group">
                                            <img src={url} alt="New Preview" className="h-full w-full object-cover" />
                                            <button type="button" onClick={() => removeNewImage(idx)} className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-foreground/10 cc-glass-strong text-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80 hover:text-white">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Is Event Toggle */}
                    <div className="cc-section cc-shadow-soft px-4 py-3 flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">Is this an event?</span>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={isEvent}
                            onClick={() => setIsEvent(!isEvent)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isEvent ? 'bg-brand' : 'bg-secondary/40'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isEvent ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>

                    {/* Event Logistics */}
                    {isEvent && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="ml-1 text-xs font-bold uppercase tracking-wider text-secondary">Event Details</label>
                            <div className="cc-section cc-shadow-soft overflow-hidden divide-y divide-secondary/10">
                                {/* Date */}
                                <div className="flex items-center justify-between px-4 py-3.5 hover:bg-secondary/10 transition-colors">
                                    <span className="text-sm text-secondary">Date</span>
                                    <input
                                        type="date"
                                        value={eventDate}
                                        onChange={(e) => setEventDate(e.target.value)}
                                        className="bg-transparent text-right text-sm text-foreground focus:outline-none focus:text-brand"
                                        required={isEvent}
                                    />
                                </div>
                                {/* Start Time */}
                                <div className="flex items-center justify-between px-4 py-3.5 hover:bg-secondary/10 transition-colors">
                                    <span className="text-sm text-secondary">Start Time</span>
                                    <input
                                        type="time"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        className="bg-transparent text-right text-sm text-foreground focus:outline-none focus:text-brand"
                                        required={isEvent}
                                    />
                                </div>
                                {/* End Time */}
                                <div className="flex items-center justify-between px-4 py-3.5 hover:bg-secondary/10 transition-colors">
                                    <span className="text-sm text-secondary">End Time</span>
                                    <input
                                        type="time"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        className="bg-transparent text-right text-sm text-foreground focus:outline-none focus:text-brand"
                                        required={isEvent}
                                    />
                                </div>

                                {/* Location URL */}
                                <div className="relative flex items-center px-4 py-1 hover:bg-secondary/10 transition-colors">
                                    <input
                                        value={locationUrl}
                                        onChange={(e) => setLocationUrl(e.target.value)}
                                        className="w-full bg-transparent py-2.5 text-sm text-foreground placeholder:text-secondary focus:outline-none"
                                        placeholder="Paste Map URL (Apple/Google)"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setIsMapHelpOpen(true)}
                                        className="ml-2 text-secondary hover:text-brand transition-colors"
                                        title="Help"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM8.94 6.94a.75.75 0 11-1.06-1.06 5.312 5.312 0 017.56 0 .75.75 0 01-1.06 1.06 3.812 3.812 0 00-5.44 0zM8.94 13.06a.75.75 0 11-1.06-1.06 2.31 2.31 0 013.25 0 .75.75 0 01-1.06 1.06 1.5 1.5 0 00-1.13 0z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                                {/* Location Label */}
                                <input
                                    value={locationLabel}
                                    onChange={(e) => setLocationLabel(e.target.value)}
                                    className="w-full bg-transparent px-4 py-3.5 text-sm text-foreground placeholder:text-secondary focus:outline-none hover:bg-secondary/10 transition-colors"
                                    placeholder="Location Label (e.g. Library)"
                                />
                            </div>
                        </div>
                    )}

                    {formError && (
                        <div className="w-full rounded-xl bg-red-500/10 p-3 text-xs text-red-500 font-medium">
                            {formError}
                        </div>
                    )}

                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="flex-1 rounded-full bg-secondary/15 py-3 text-sm font-medium text-foreground hover:bg-secondary/25 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving || uploading}
                            className="flex-1 rounded-full bg-brand py-3 text-sm font-bold text-brand-foreground cc-shadow-soft transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70"
                        >
                            {saving ? "Saving..." : "Save Changes"}
                        </button>
                    </div>

                </form>

                <MapHelpModal isOpen={isMapHelpOpen} onClose={() => setIsMapHelpOpen(false)} />
            </div>
        </div>
    );
}
