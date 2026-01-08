"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, setDoc, getDocs, collection } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, storage, db } from "../../../lib/firebase";
import Link from "next/link";
import { ChevronLeftIcon, XMarkIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
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
    role?: string;
};

const ui = {
    page: "mx-auto w-full max-w-2xl px-4 py-4 pb-32",
    header: "flex items-center gap-3.5 px-2 pt-2 pb-6",
    backBtn: "inline-flex h-10 w-10 items-center justify-center rounded-full cc-glass border border-secondary/15 text-foreground transition-all hover:bg-secondary/10",
    title: "text-2xl font-bold tracking-tight text-foreground",
    section: "space-y-2",
    sectionLabel: "text-[12px] font-bold uppercase tracking-widest text-secondary ml-1.5",
    card: "cc-glass cc-section rounded-[28px] overflow-hidden shadow-xl border border-secondary/15 divide-y divide-secondary/10",
    inputGroup: "px-5 py-4 space-y-1.5",
    label: "text-[11px] font-bold text-secondary uppercase tracking-wider block ml-0.5",
    input: "w-full bg-transparent text-[15px] text-foreground placeholder:text-secondary/40 focus:outline-none transition-colors",
    select: "w-full bg-transparent text-[15px] text-foreground focus:outline-none transition-colors cursor-pointer",
    footerText: "text-[11px] text-secondary/60 ml-1.5 leading-relaxed",
    // Alerts
    errorAlert: "rounded-[24px] border border-red-500/20 bg-red-500/5 px-5 py-4 flex items-start gap-3 backdrop-blur-xl",
    warningAlert: "rounded-[24px] border border-brand/20 bg-brand/5 px-5 py-4 flex items-start gap-3 backdrop-blur-xl",
    // Buttons
    primaryBtn: "flex-1 rounded-full bg-brand py-3 text-base font-bold text-brand-foreground shadow-lg shadow-brand/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50",
    secondaryBtn: "flex h-12 w-full items-center justify-center rounded-full bg-secondary/10 text-[15px] font-bold text-foreground transition-all hover:bg-secondary/20 active:scale-[0.98]",
    mobileCancelBtn: "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-foreground transition-all hover:bg-secondary/20 active:scale-[0.98]",
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
    const [role, setRole] = useState("student");
    const [dorm, setDorm] = useState("");
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");

    // Campus and dorm data
    const [campuses, setCampuses] = useState<any[]>([]);
    const [dorms, setDorms] = useState<string[]>([]);
    const [loadingCampuses, setLoadingCampuses] = useState(false);
    const [originalCampusId, setOriginalCampusId] = useState("");

    const selectedCampus = useMemo(() => {
        return campuses.find(c => c.id === campusId) || null;
    }, [campuses, campusId]);

    const isUniversityWithDorms = useMemo(() => {
        return selectedCampus?.isUniversity && dorms.length > 0;
    }, [selectedCampus, dorms]);

    const isCampusChanging = useMemo(() => {
        return originalCampusId && campusId && originalCampusId !== campusId;
    }, [originalCampusId, campusId]);

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
                    const existingCampusId = data.campusId || data.universityId || "";
                    setCampusId(existingCampusId);
                    setOriginalCampusId(existingCampusId);
                    setMajor(data.major || "");
                    setYearOfStudy(data.yearOfStudy || "");
                    setRole(data.role || "student");
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

        // Validate dorm if required (only for students)
        if (role === "student" && isUniversityWithDorms && !dorm) {
            setError("Please select a dorm. This is required for students at university campuses.");
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
                displayName: displayName.trim() || user.displayName || "",
                username: username.trim() || "",
                photoURL: photoURL || user.photoURL || "",
                campus: campusName.trim() || "",
                campusId: campusId || "",           // Save as campusId (preferred)
                universityId: campusId || "",      // Save as universityId (legacy compat)
                major: major.trim() || "",
                yearOfStudy: yearOfStudy || "",
                role: role || "student",
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
                <p className="text-secondary cc-muted animate-pulse">Loading settings...</p>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className={ui.page}>
            {/* iOS-Style Navigation Bar */}
            <div className={ui.header}>
                <Link href="/profile" className={ui.backBtn}>
                    <ChevronLeftIcon className="h-5 w-5" />
                </Link>
                <h1 className={ui.title}>Edit Profile</h1>
            </div>

            {/* Content */}
            <div className="space-y-6">
                {/* Error Message */}
                {error && (
                    <div className={ui.errorAlert}>
                        <ExclamationTriangleIcon className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                        <p className="text-[13px] font-medium text-red-500 leading-snug">{error}</p>
                    </div>
                )}

                {/* Profile Picture Section */}
                <div className={ui.section}>
                    <label className={ui.sectionLabel}>Avatar</label>
                    <div className="flex items-center gap-5 cc-glass cc-section rounded-[28px] p-5 shadow-xl border border-secondary/15">
                        <div className="relative h-20 w-20 shrink-0">
                            {photoPreview ? (
                                <img
                                    src={photoPreview}
                                    alt="Profile"
                                    className="h-full w-full rounded-full object-cover ring-4 ring-secondary/10"
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand/60 text-2xl font-bold text-brand-foreground ring-4 ring-secondary/10">
                                    {(displayName || user.displayName || "?").charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>
                        <div className="flex-1 space-y-2">
                            <input
                                type="file"
                                id="photo-upload"
                                accept="image/*"
                                onChange={handlePhotoChange}
                                className="hidden"
                            />
                            <label
                                htmlFor="photo-upload"
                                className="inline-flex cursor-pointer items-center justify-center rounded-full bg-brand px-5 py-2 text-[13px] font-bold text-brand-foreground transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-brand/20"
                            >
                                Change Photo
                            </label>
                            <p className={ui.footerText}>
                                Suggested: square JPG/PNG. Max 5MB.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Identity Info */}
                <div className={ui.section}>
                    <label className={ui.sectionLabel}>Identity</label>
                    <div className={ui.card}>
                        <div className={ui.inputGroup}>
                            <label className={ui.label}>Display Name</label>
                            <input
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Your full name"
                                className={ui.input}
                            />
                        </div>

                        <div className={ui.inputGroup}>
                            <label className={ui.label}>Username <span className="text-red-500 ml-0.5">*</span></label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Choose a unique username"
                                className={ui.input}
                            />
                        </div>

                        <div className={ui.inputGroup}>
                            <label className={ui.label}>Campus <span className="text-red-500 ml-0.5">*</span></label>
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
                                className={ui.select}
                            >
                                <option value="" className="bg-background">Select your campus</option>
                                {campuses.map((c) => (
                                    <option key={c.id} value={c.id} className="bg-background">
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className={ui.inputGroup}>
                            <label className={ui.label}>Primary Role <span className="text-red-500 ml-0.5">*</span></label>
                            <select
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                className={ui.select}
                            >
                                <option value="student" className="bg-background">Student</option>
                                <option value="faculty" className="bg-background">Faculty</option>
                                <option value="staff" className="bg-background">Staff</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Academic Details */}
                <div className={ui.section}>
                    <label className={ui.sectionLabel}>Academic Details</label>
                    <div className={ui.card}>
                        <div className={ui.inputGroup}>
                            <label className={ui.label}>Major</label>
                            <input
                                type="text"
                                value={major}
                                onChange={(e) => setMajor(e.target.value)}
                                placeholder="e.g. Computer Science"
                                className={ui.input}
                            />
                        </div>

                        <div className={ui.inputGroup}>
                            <label className={ui.label}>Year of Study</label>
                            <select
                                value={yearOfStudy}
                                onChange={(e) => setYearOfStudy(e.target.value)}
                                className={ui.select}
                            >
                                <option value="" className="bg-background">Select year</option>
                                <option value="Freshman" className="bg-background">Freshman</option>
                                <option value="Sophomore" className="bg-background">Sophomore</option>
                                <option value="Junior" className="bg-background">Junior</option>
                                <option value="Senior" className="bg-background">Senior</option>
                                <option value="Super Senior" className="bg-background">Super Senior</option>
                                <option value="Unc" className="bg-background">Unc</option>
                                <option value="Graduate" className="bg-background">Graduate</option>
                            </select>
                        </div>

                        {role === "student" && (
                            <div className={ui.inputGroup}>
                                <label className={ui.label}>
                                    Dorm / Residence {isUniversityWithDorms && <span className="text-red-500 ml-0.5">*</span>}
                                </label>
                                <select
                                    value={dorm}
                                    onChange={(e) => setDorm(e.target.value)}
                                    disabled={!campusId || dorms.length === 0}
                                    className={`${ui.select} disabled:opacity-40`}
                                >
                                    <option value="" className="bg-background">Select a dorm</option>
                                    {dorms.map((dormName) => (
                                        <option key={dormName} value={dormName} className="bg-background">
                                            {dormName}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                    {role === "student" && campusId && dorms.length === 0 && (
                        <p className={ui.footerText}>Residences are only available for designated university campuses.</p>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-4 pt-2">
                    {/* Desktop Cancel */}
                    <Link href="/profile" className="hidden sm:flex flex-1">
                        <div className={ui.secondaryBtn}>Cancel</div>
                    </Link>

                    {/* Mobile Cancel */}
                    <Link href="/profile" className="flex sm:hidden">
                        <div className={ui.mobileCancelBtn}>
                            <XMarkIcon className="h-6 w-6" />
                        </div>
                    </Link>

                    <button
                        onClick={handleSave}
                        disabled={saving || uploading}
                        className={ui.primaryBtn}
                    >
                        {uploading ? "Uploading..." : saving ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </div>
        </div>
    );
}
