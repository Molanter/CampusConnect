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
import { PostType } from "@/lib/posts";
import { CalendarIcon, ClockIcon, QuestionMarkCircleIcon, MegaphoneIcon, ChatBubbleBottomCenterTextIcon } from "@heroicons/react/24/outline";
import { useRightSidebar } from "@/components/right-sidebar-context";

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



export default function EditPostPage() {
    const router = useRouter();
    const params = useParams();
    const postId = params.id as string;

    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [loadingPost, setLoadingPost] = useState(true);
    const [toast, setToast] = useState<ToastData | null>(null);

    // Form fields
    const [type, setType] = useState<PostType>("post");
    const isEvent = type === "event";
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
    const [showMapPreview, setShowMapPreview] = useState(true);
    const { openView } = useRightSidebar();

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
                        setType(data.type ?? (data.isEvent ? "event" : "post"));
                        setClubName(data.clubName ?? null);

                        // Images
                        setExistingImages(data.imageUrls ?? (data.imageUrl ? [data.imageUrl] : []));

                        // Event Details
                        if (data.isEvent) {
                            setEventDate(data.date ?? "");
                            setStartTime(data.startTime ?? "");
                            setEndTime(data.endTime ?? "");
                            setLocationLabel(data.locationLabel ?? "");

                            // If we have coordinates but no URL, generate an Apple Maps link
                            if (data.coordinates && !data.locationUrl) {
                                const { lat, lng } = data.coordinates;
                                const appleMapsUrl = `https://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(data.locationLabel || "Location")}`;
                                setLocationUrl(appleMapsUrl);
                            } else {
                                setLocationUrl(data.locationUrl ?? "");
                            }

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

    // Helper to parse coordinates (Enhanced for both Google and Apple Maps)
    const parseCoordinatesFromUrl = async (url: string) => {
        if (!url) return null;
        let targetUrl = url;

        // Expand shortened URLs (Google and Apple Maps)
        const needsExpansion = url.includes("goo.gl") ||
            url.includes("maps.app.goo.gl") ||
            url.includes("maps.apple.com/p/") ||
            url.includes("maps.apple/p/") ||
            (url.includes("apple") && url.includes("/p/"));

        if (needsExpansion) {
            try {
                console.log("Expanding shortened URL:", url);
                const res = await fetch(`/api/expand-map-url?url=${encodeURIComponent(url)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.expandedUrl) {
                        targetUrl = data.expandedUrl;
                        console.log("Expanded to:", targetUrl);
                    } else {
                        console.log("API response did not contain expandedUrl:", data);
                    }
                } else {
                    console.log("API returned error status:", res.status, await res.text());
                }
            } catch (err) {
                console.error("Failed to expand URL:", err);
            }
        }

        // Helper to extract label from URL
        const extractLabel = (urlStr: string) => {
            try {
                const u = new URL(urlStr);
                // Apple Maps name param
                const nameParam = u.searchParams.get("name");
                if (nameParam) return decodeURIComponent(nameParam.replace(/\+/g, " "));

                // Google/Apple query param (if it's not JUST coordinates)
                const qParam = u.searchParams.get("q");
                if (qParam && !qParam.match(/^-?\d+\.\d+,-?\d+\.\d+$/)) {
                    return decodeURIComponent(qParam.replace(/\+/g, " "));
                }

                // Google Maps place path
                const placeMatch = urlStr.match(/\/place\/([^/@?]+)/);
                if (placeMatch && placeMatch[1]) {
                    return decodeURIComponent(placeMatch[1].replace(/\+/g, " "));
                }
            } catch (e) {
                // Not a full URL or other error
            }
            return null;
        };

        const foundLabel = extractLabel(targetUrl) || extractLabel(url);

        // Priority 1: Google Maps !3d and !4d params (most specific)
        const data3dRegex = /!3d(-?\d+\.\d+)/;
        const data4dRegex = /!4d(-?\d+\.\d+)/;
        const match3d = targetUrl.match(data3dRegex);
        const match4d = targetUrl.match(data4dRegex);
        if (match3d && match4d) {
            console.log("Found Google Maps !3d/!4d coordinates");
            return {
                lat: parseFloat(match3d[1]),
                lng: parseFloat(match4d[1]),
                label: foundLabel
            };
        }

        // Priority 2: Google Maps @ format
        const googleRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
        const googleMatch = targetUrl.match(googleRegex);
        if (googleMatch) {
            console.log("Found Google Maps @ coordinates");
            return {
                lat: parseFloat(googleMatch[1]),
                lng: parseFloat(googleMatch[2]),
                label: foundLabel
            };
        }

        // Priority 3: Apple Maps coordinate= format (full place URLs)
        const appleCoordinateRegex = /coordinate=(-?\d+\.?\d*),(-?\d+\.?\d*)/;
        const appleCoordinateMatch = targetUrl.match(appleCoordinateRegex);
        if (appleCoordinateMatch) {
            console.log("Found Apple Maps coordinate= parameter");
            return {
                lat: parseFloat(appleCoordinateMatch[1]),
                lng: parseFloat(appleCoordinateMatch[2]),
                label: foundLabel
            };
        }

        // Priority 4: Apple Maps ll= format (share URLs)
        const appleRegex = /ll=(-?\d+\.\d+),(-?\d+\.\d+)/;
        const appleMatch = targetUrl.match(appleRegex);
        if (appleMatch) {
            console.log("Found Apple Maps ll= coordinates");
            return {
                lat: parseFloat(appleMatch[1]),
                lng: parseFloat(appleMatch[2]),
                label: foundLabel
            };
        }

        // Priority 5: Google Maps ?q= format
        const googleQueryRegex = /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/;
        const googleQueryMatch = targetUrl.match(googleQueryRegex);
        if (googleQueryMatch) {
            console.log("Found Google Maps ?q= coordinates");
            return {
                lat: parseFloat(googleQueryMatch[1]),
                lng: parseFloat(googleQueryMatch[2]),
                label: foundLabel
            };
        }

        console.log("No coordinate patterns matched in URL:", targetUrl);
        return null;
    };

    useEffect(() => {
        const parse = async () => {
            if (!locationUrl) {
                // Clear coordinates if URL is removed
                setCoordinates(null);
                return;
            }

            const result = await parseCoordinatesFromUrl(locationUrl);
            if (result) {
                console.log("Parsed result:", result);
                setCoordinates({ lat: result.lat, lng: result.lng });
                if (result.label && !locationLabel) {
                    setLocationLabel(result.label);
                }
            } else {
                console.log("Could not parse coordinates from URL:", locationUrl);
                // Don't clear coordinates if parsing fails - keep existing ones
            }
        };
        parse();
    }, [locationUrl]);

    // Active section state for visual feedback
    const [activeSection, setActiveSection] = useState<
        "details" | "type" | "eventDetails" | "extraInfo" | null
    >(null);

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
                type: type,
                isEvent: isEvent,
                imageUrls: finalImageUrls,
                editCount: increment(1),
                editedAt: serverTimestamp(),
            };

            if (isEvent) {
                Object.assign(updateData, {
                    date: eventDate.trim(),
                    startTime: startTime.trim(),
                    endTime: endTime.trim(),
                    locationLabel: locationLabel.trim(),
                    coordinates: coordinates,
                    locationUrl: locationUrl.trim(),
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

                <form
                    onSubmit={handleUpdate}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
                            e.preventDefault();
                        }
                    }}
                    className="space-y-6"
                >

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
                                        <div key={`exist-${idx}`} className="relative h-20 w-20 flex-shrink-0 overflow-hidden cc-radius-24 ring-2 ring-inset ring-secondary/25 bg-secondary/10 group">
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
                                        <div key={`new-${idx}`} className="relative h-20 w-20 flex-shrink-0 overflow-hidden cc-radius-24 ring-2 ring-inset ring-secondary/25 bg-secondary/10 group">
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

                    {/* Post Type Selector */}
                    <div className="space-y-2">
                        <label className="ml-1 text-xs font-bold uppercase tracking-wider text-secondary">Post Type</label>
                        <div className="cc-section cc-shadow-soft p-1.5 flex transition-shadow">
                            {[
                                { id: "post", label: "Post", icon: ChatBubbleBottomCenterTextIcon },
                                { id: "event", label: "Event", icon: CalendarIcon },
                                { id: "announcement", label: "Announcement", icon: MegaphoneIcon },
                            ].map((t) => (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setType(t.id as PostType)}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-full transition-all ${type === t.id
                                        ? "bg-brand text-brand-foreground shadow-sm"
                                        : "text-secondary hover:text-foreground hover:bg-secondary/5"
                                        }`}
                                >
                                    <t.icon className="h-4 w-4" />
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Event Logistics */}
                    {isEvent && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="ml-1 text-xs font-bold uppercase tracking-wider text-secondary">Event Details</label>
                            <div
                                className={`cc-section cc-radius-24 overflow-hidden divide-y divide-secondary/10 transition-shadow ${activeSection === "eventDetails" ? "cc-shadow-soft" : ""
                                    }`}
                                onFocusCapture={() => setActiveSection("eventDetails")}
                                onClick={() => setActiveSection("eventDetails")}
                            >
                                {/* Date */}
                                <div className="flex items-center justify-between px-4 py-3.5 cc-row-hover focus-within:cc-row-active">
                                    <span className="text-sm text-secondary">Date</span>
                                    <div className="relative">
                                        <input
                                            type="date"
                                            value={eventDate}
                                            onChange={(e) => setEventDate(e.target.value)}
                                            className="cc-picker-input cursor-pointer"
                                            required={isEvent}
                                        />
                                        <CalendarIcon className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 cc-picker-icon" />
                                    </div>
                                </div>
                                {/* Start Time */}
                                <div className="flex items-center justify-between px-4 py-3.5 cc-row-hover focus-within:cc-row-active">
                                    <span className="text-sm text-secondary">Start Time</span>
                                    <div className="relative">
                                        <input
                                            type="time"
                                            value={startTime}
                                            onChange={(e) => setStartTime(e.target.value)}
                                            className="cc-picker-input cursor-pointer"
                                            required={isEvent}
                                        />
                                        <ClockIcon className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 cc-picker-icon" />
                                    </div>
                                </div>
                                {/* End Time */}
                                <div className="flex items-center justify-between px-4 py-3.5 cc-row-hover focus-within:cc-row-active">
                                    <span className="text-sm text-secondary">End Time</span>
                                    <div className="relative">
                                        <input
                                            type="time"
                                            value={endTime}
                                            onChange={(e) => setEndTime(e.target.value)}
                                            className="cc-picker-input cursor-pointer"
                                            required={isEvent}
                                        />
                                        <ClockIcon className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 cc-picker-icon" />
                                    </div>
                                </div>

                                {/* Location URL */}
                                <div className="relative flex items-center pl-4 pr-2.5 py-1 cc-row-hover focus-within:cc-row-active">
                                    <input
                                        value={locationUrl}
                                        onChange={(e) => setLocationUrl(e.target.value)}
                                        className="w-full bg-transparent py-2.5 text-sm text-foreground placeholder:text-secondary focus:outline-none"
                                        placeholder="Paste Map URL (Apple/Google)"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => openView("mapHelp", {})}
                                        className="ml-2 flex flex-none items-center justify-center rounded-full p-1.5 text-secondary hover:bg-secondary/10 hover:text-foreground transition-colors"
                                        title="Help"
                                    >
                                        <QuestionMarkCircleIcon className="h-5 w-5" />
                                    </button>
                                </div>

                                {/* Coordinates Display */}
                                {coordinates && (
                                    <div className="px-4 py-2 text-xs text-secondary border-t border-secondary/5">
                                        <span className="font-mono">lat: {coordinates.lat}, lng: {coordinates.lng}</span>
                                    </div>
                                )}

                                {/* Location Label */}
                                <input
                                    value={locationLabel}
                                    onChange={(e) => setLocationLabel(e.target.value)}
                                    className="w-full bg-transparent px-4 py-3.5 text-sm text-foreground placeholder:text-secondary focus:outline-none cc-row-hover focus-within:cc-row-active"
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


            </div>
        </div>
    );
}
