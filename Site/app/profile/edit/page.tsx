"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, setDoc, getDocs, collection } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, storage, db } from "../../../lib/firebase";
import Link from "next/link";
import { ChevronLeftIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { getAllCampusesAndUniversities, getDormsForCampus } from "@/lib/firestore-paths";

type UserProfile = {
    username?: string;
    displayName?: string;
    photoURL?: string;
    campus?: string;
    universityId?: string; // Keeping field name for DB compat
    campusId?: string;     // Support both
    campusLocation?: string;
    yearOfStudy?: string;
    major?: string;
    dorm?: string;
};

export default function EditProfilePage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [saving, setSaving] = useState(false);

    // Form state
    const [displayName, setDisplayName] = useState("");
    const [username, setUsername] = useState("");
    const [campusId, setCampusId] = useState("");
    const [campusName, setCampusName] = useState("");
    const [major, setMajor] = useState("");
    const [yearOfStudy, setYearOfStudy] = useState("");
    const [dorm, setDorm] = useState("");
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");

    // Campus and dorm data
    const [campuses, setCampuses] = useState<any[]>([]);
    const [dorms, setDorms] = useState<string[]>([]);
    const [loadingCampuses, setLoadingCampuses] = useState(false);

    // Fetch campuses (merged new + legacy)
    useEffect(() => {
        const fetchCampuses = async () => {
            try {
                setLoadingCampuses(true);
                const all = await getAllCampusesAndUniversities();
                // Sort by name
                all.sort((a, b) => a.name.localeCompare(b.name));
                setCampuses(all);
            } catch (err) {
                console.error("Error fetching campuses:", err);
            } finally {
                setLoadingCampuses(false);
            }
        };
        fetchCampuses();
    }, []);

    // Fetch dorms when campus changes
    useEffect(() => {
        const fetchDorms = async () => {
            if (!campusId) {
                setDorms([]);
                return;
            }

            try {
                // Use dual-read helper
                const dormsList = await getDormsForCampus(campusId);
                setDorms(dormsList.map(d => d.name));
            } catch (err) {
                console.error("Error fetching dorms:", err);
                setDorms([]);
            }
        };

        fetchDorms();
    }, [campusId]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setLoading(false);
            if (!u) {
                router.push("/");
            }
        });
        return () => unsubscribe();
    }, [router]);

    // Load user profile
    useEffect(() => {
        if (!user) return;

        const loadProfile = async () => {
            try {
                const ref = doc(db, "users", user.uid);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const data = snap.data() as UserProfile;
                    setProfile(data);
                    setDisplayName(data.displayName || user.displayName || "");
                    setUsername(data.username || "");
                    setPhotoPreview(data.photoURL || user.photoURL || null);
                    // Handle field variations
                    setCampusName(data.campus || "");
                    setCampusId(data.campusId || data.universityId || "");
                    setMajor(data.major || "");
                    setYearOfStudy(data.yearOfStudy || "");
                    setDorm(data.dorm || "");
                } else {
                    setDisplayName(user.displayName || "");
                    setPhotoPreview(user.photoURL || null);
                }
            } catch (err) {
                console.error("Error loading profile:", err);
            }
        };

        loadProfile();
    }, [user]);

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPhotoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPhotoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        if (!user) return;
        if (!campusId) {
            setError("Please select a campus.");
            return;
        }

        try {
            setSaving(true);
            setError("");

            // Check if username is already taken (if username is being changed)
            if (username.trim() && username.trim() !== profile?.username) {
                const usernameQuery = await getDocs(collection(db, "users"));
                const usernameTaken = usernameQuery.docs.some(
                    (doc) => doc.data().username === username.trim() && doc.id !== user.uid
                );

                if (usernameTaken) {
                    setError(`Username "${username.trim()}" is already taken. Please choose another.`);
                    setSaving(false);
                    return;
                }
            }

            const userDocRef = doc(db, "users", user.uid);

            let photoURL = profile?.photoURL;

            // Upload photo to Firebase Storage if a new one was selected
            if (photoFile) {
                setUploading(true);
                const storageRef = ref(storage, `profile-pictures/${user.uid}-${Date.now()}`);
                await uploadBytes(storageRef, photoFile);
                photoURL = await getDownloadURL(storageRef);
                setUploading(false);
            }

            // Update profile in Firestore
            await setDoc(userDocRef, {
                name: displayName.trim() || user.displayName || "",
                username: username.trim() || "",
                photoURL: photoURL || user.photoURL || "",
                campus: campusName.trim() || "",
                campusId: campusId || "",           // Save as campusId (preferred)
                universityId: campusId || "",      // Save as universityId (legacy compat)
                major: major.trim() || "",
                yearOfStudy: yearOfStudy || "",
                dorm: dorm || "",
            }, { merge: true });

            // Redirect back to profile
            router.push("/profile");
        } catch (err: any) {
            console.error("Error saving profile:", err);
            setError(err.message || "Failed to save profile. Please try again.");
        } finally {
            setSaving(false);
            setUploading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <p className="text-neutral-400">Loading...</p>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <div className="mx-auto min-h-screen w-full max-w-4xl">
            {/* iOS-Style Navigation Bar - Scrollable */}
            <div className="relative flex items-center justify-center px-6 pt-6 pb-4">
                <Link
                    href="/profile"
                    className="absolute left-6 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                >
                    <ChevronLeftIcon className="h-5 w-5" />
                </Link>
                <h1 className="text-xl font-bold text-white">Edit Profile</h1>
            </div>

            {/* Content */}
            <div className="px-6 py-6 space-y-6">
                {/* Error Message */}
                {error && (
                    <div className="rounded-[28px] border border-red-500/20 bg-red-500/10 px-4 py-3">
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                )}

                {/* Profile Picture Section - Compact iOS Style */}
                <div className="flex items-center gap-4 rounded-[28px] border border-white/10 bg-[#1C1C1E] p-4">
                    <div className="relative h-20 w-20 shrink-0">
                        {photoPreview ? (
                            <img
                                src={photoPreview}
                                alt="Profile"
                                className="h-full w-full rounded-full object-cover ring-2 ring-white/20"
                            />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-2xl font-bold text-white ring-2 ring-white/20">
                                {(displayName || user.displayName || "?").charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>
                    <div className="flex-1">
                        <input
                            type="file"
                            id="photo-upload"
                            accept="image/*"
                            onChange={handlePhotoChange}
                            className="hidden"
                        />
                        <label
                            htmlFor="photo-upload"
                            className="inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-black hover:opacity-90 transition-opacity"
                            style={{ backgroundColor: '#ffb200' }}
                        >
                            Change Photo
                        </label>
                        <p className="mt-1 text-xs text-neutral-500">
                            JPG, PNG or GIF. Max 5MB.
                        </p>
                    </div>
                </div>

                {/* iOS-Style Form Group - Profile Info */}
                <div className="rounded-[28px] border border-white/10 bg-[#1C1C1E] overflow-hidden">
                    {/* Display Name */}
                    <div className="px-4 py-3 border-b border-white/10">
                        <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2 block">Display Name</label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Your name"
                            className="w-full bg-transparent text-white placeholder-neutral-500 focus:outline-none"
                        />
                    </div>

                    {/* Username */}
                    <div className="px-4 py-3 border-b border-white/10">
                        <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2 block">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="username"
                            className="w-full bg-transparent text-white placeholder-neutral-500 focus:outline-none"
                        />
                    </div>

                    {/* Campus (renamed UI) */}
                    <div className="px-4 py-3">
                        <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2 block">Campus</label>
                        <select
                            value={campusId}
                            onChange={(e) => {
                                const selectedId = e.target.value;
                                setCampusId(selectedId);
                                const selectedCampus = campuses.find(u => u.id === selectedId);
                                setCampusName(selectedCampus?.name || "");
                                setDorm("");
                            }}
                            disabled={loadingCampuses}
                            className="w-full bg-transparent text-white focus:outline-none"
                        >
                            <option value="" className="bg-[#1C1C1E]">Select a campus</option>
                            {campuses.map((c) => (
                                <option key={c.id} value={c.id} className="bg-[#1C1C1E]">
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* iOS-Style Form Group - Academic Info */}
                <div className="rounded-[28px] border border-white/10 bg-[#1C1C1E] overflow-hidden">
                    {/* Major */}
                    <div className="px-4 py-3 border-b border-white/10">
                        <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2 block">Major</label>
                        <input
                            type="text"
                            value={major}
                            onChange={(e) => setMajor(e.target.value)}
                            placeholder="e.g., Computer Science"
                            className="w-full bg-transparent text-white placeholder-neutral-500 focus:outline-none"
                        />
                    </div>

                    {/* Year of Study */}
                    <div className="px-4 py-3 border-b border-white/10">
                        <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2 block">Year of Study</label>
                        <select
                            value={yearOfStudy}
                            onChange={(e) => setYearOfStudy(e.target.value)}
                            className="w-full bg-transparent text-white focus:outline-none"
                        >
                            <option value="" className="bg-[#1C1C1E]">Select year</option>
                            <option value="Freshman" className="bg-[#1C1C1E]">Freshman</option>
                            <option value="Sophomore" className="bg-[#1C1C1E]">Sophomore</option>
                            <option value="Junior" className="bg-[#1C1C1E]">Junior</option>
                            <option value="Senior" className="bg-[#1C1C1E]">Senior</option>
                            <option value="Super Senior" className="bg-[#1C1C1E]">Super Senior</option>
                            <option value="Unc" className="bg-[#1C1C1E]">Unc</option>
                            <option value="Graduate" className="bg-[#1C1C1E]">Graduate</option>
                        </select>
                    </div>

                    {/* Dorm */}
                    <div className="px-4 py-3">
                        <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2 block">Dorm/Residence</label>
                        <select
                            value={dorm}
                            onChange={(e) => setDorm(e.target.value)}
                            disabled={!campusId || dorms.length === 0}
                            className="w-full bg-transparent text-white focus:outline-none disabled:opacity-50"
                        >
                            <option value="" className="bg-[#1C1C1E]">Select a dorm</option>
                            {dorms.map((dormName) => (
                                <option key={dormName} value={dormName} className="bg-[#1C1C1E]">
                                    {dormName}
                                </option>
                            ))}
                        </select>
                        {campusId && dorms.length === 0 && (
                            <p className="text-xs text-neutral-500 mt-2">No dorms available (only available for university campuses)</p>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pb-6">
                    <Link
                        href="/profile"
                        className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 text-white transition-colors hover:bg-white/10 sm:h-auto sm:w-auto sm:flex-1 sm:px-6 sm:py-3"
                    >
                        <XMarkIcon className="h-6 w-6 sm:hidden" />
                        <span className="hidden text-center font-semibold sm:inline">Cancel</span>
                    </Link>
                    <button
                        onClick={handleSave}
                        disabled={saving || uploading}
                        className="flex-1 rounded-full px-6 py-3 font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        style={{ backgroundColor: '#ffb200' }}
                    >
                        {uploading ? "Uploading..." : saving ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </div>
        </div>
    );
}
