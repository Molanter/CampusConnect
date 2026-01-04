"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, setDoc, getDocs, collection } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";
import Link from "next/link";
import { ChevronLeftIcon, XMarkIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { getAllCampusesAndUniversities, getDormsForCampus } from "@/lib/firestore-paths";
import { getUserOwnedClubs, getDefaultClubsForCampus, getDormClubForCampus, joinClub } from "@/lib/clubs";

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

export default function ProfileSetupPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form fields
    const [username, setUsername] = useState("");
    const [campusId, setCampusId] = useState("");
    const [originalCampusId, setOriginalCampusId] = useState(""); // Track original for change detection
    const [campusName, setCampusName] = useState("");
    const [role, setRole] = useState("student");
    const [major, setMajor] = useState("");
    const [yearOfStudy, setYearOfStudy] = useState("");
    const [dorm, setDorm] = useState("");

    // Campus and dorm data
    const [campuses, setCampuses] = useState<any[]>([]);
    const [dorms, setDorms] = useState<string[]>([]);
    const [loadingCampuses, setLoadingCampuses] = useState(false);
    const [error, setError] = useState("");

    // Selected campus info
    const selectedCampus = useMemo(() => {
        return campuses.find(c => c.id === campusId) || null;
    }, [campuses, campusId]);

    const isUniversityWithDorms = useMemo(() => {
        return selectedCampus?.isUniversity && dorms.length > 0;
    }, [selectedCampus, dorms]);

    const isCampusChanging = useMemo(() => {
        return originalCampusId && campusId && originalCampusId !== campusId;
    }, [originalCampusId, campusId]);

    // Fetch campuses on mount (merged new + legacy)
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
                console.log("Loaded dorms for campus:", dormsList);
                setDorms(dormsList.map(d => d.name));
            } catch (err) {
                console.error("Error fetching dorms:", err);
                setDorms([]);
            }
        };

        fetchDorms();
    }, [campusId]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            if (!u) {
                router.push("/");
                return;
            }

            // Load existing profile data
            try {
                const ref = doc(db, "users", u.uid);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const data = snap.data();
                    setUsername(data.username || "");
                    setCampusName(data.campus || "");
                    const existingCampusId = data.campusId || data.universityId || "";
                    setCampusId(existingCampusId);
                    setOriginalCampusId(existingCampusId); // Store original
                    setRole(data.role || "student");
                    setMajor(data.major || "");
                    setYearOfStudy(data.yearOfStudy || "");
                    setDorm(data.dorm || "");
                }
            } catch (err) {
                console.error("Error loading profile:", err);
            } finally {
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, [router]);

    const handleSave = async () => {
        if (!user) return;
        if (!username.trim() || !campusId) {
            setError("Please provide at least a username and campus.");
            return;
        }

        // Validate dorm if required
        if (role === "student" && isUniversityWithDorms && !dorm) {
            setError("Please select a dorm. This is required for students at university campuses.");
            return;
        }

        try {
            setSaving(true);
            setError("");

            // Check if username is already taken
            const usernameQuery = await getDocs(collection(db, "users"));
            const usernameTaken = usernameQuery.docs.some(
                (doc) => doc.data().username === username.trim() && doc.id !== user.uid
            );

            if (usernameTaken) {
                setError(`Username "${username.trim()}" is already taken. Please choose another.`);
                setSaving(false);
                return;
            }

            // If changing campuses, check for owned clubs
            if (isCampusChanging) {
                const ownedClubs = await getUserOwnedClubs(user.uid);
                if (ownedClubs.length > 0) {
                    const clubNames = ownedClubs.map(c => c.name).join(", ");
                    setError(`You are still the owner of: ${clubNames}. Please transfer ownership before changing campuses.`);
                    setSaving(false);
                    return;
                }
            }

            const userDocRef = doc(db, "users", user.uid);

            await setDoc(userDocRef, {
                username: username.trim(),
                campus: campusName.trim(),
                campusId: campusId,           // Save as campusId (preferred)
                universityId: campusId,       // Save as universityId (legacy compat)
                role: role || "student",
                major: major.trim() || "",
                yearOfStudy: yearOfStudy || "",
                dorm: dorm || "",
            }, { merge: true });

            // If campus changed, auto-join default clubs of new campus
            if (isCampusChanging) {
                try {
                    const defaultClubs = await getDefaultClubsForCampus(campusId);
                    for (const club of defaultClubs) {
                        await joinClub(club.id, user.uid, club.isPrivate);
                    }
                    console.log(`Auto-joined ${defaultClubs.length} default clubs for new campus`);
                } catch (err) {
                    console.error("Error auto-joining default clubs:", err);
                    // Don't block the save, just log the error
                }
            }

            // If user selected a dorm, join them to that specific dorm's club only
            if (dorm) {
                try {
                    const dormClub = await getDormClubForCampus(campusId, dorm);
                    if (dormClub) {
                        await joinClub(dormClub.id, user.uid, dormClub.isPrivate);
                        console.log(`Joined dorm club: ${dormClub.name}`);
                    }
                } catch (err) {
                    console.error("Error joining dorm club:", err);
                    // Don't block the save, just log the error
                }
            }

            router.push("/profile");
        } catch (err: any) {
            console.error("Error saving profile:", err);
            setError(err.message || "Failed to save profile. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <p className="text-secondary cc-muted animate-pulse">Loading setup...</p>
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
                <h1 className={ui.title}>Complete Profile</h1>
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

                {/* Campus Change Warning */}
                {isCampusChanging && (
                    <div className={ui.warningAlert}>
                        <ExclamationTriangleIcon className="h-5 w-5 text-brand shrink-0 mt-0.5" />
                        <div>
                            <p className="text-[13px] font-bold text-brand">Changing Campus</p>
                            <p className="text-[11px] text-brand/80 mt-1 leading-relaxed">
                                You will be auto-joined to default clubs of the new campus. Existing memberships remain.
                            </p>
                        </div>
                    </div>
                )}

                {/* Basic Info */}
                <div className={ui.section}>
                    <label className={ui.sectionLabel}>Identity</label>
                    <div className={ui.card}>
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
                                onChange={(e) => setRole(e.target.value as "student" | "faculty" | "staff")}
                                className={ui.select}
                            >
                                <option value="student" className="bg-background">Student</option>
                                <option value="faculty" className="bg-background">Faculty</option>
                                <option value="staff" className="bg-background">Staff</option>
                            </select>
                        </div>
                    </div>
                    <p className={ui.footerText}>Your profile identity is visible to other members on campus.</p>
                </div>

                {/* Academic Info */}
                {role === "student" && (
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

                            <div className={ui.inputGroup}>
                                <label className={ui.label}>
                                    Dorm / Residence <span className="text-red-500 ml-0.5">*</span>
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
                        </div>
                        {campusId && dorms.length === 0 && (
                            <p className={ui.footerText}>Residences are only available for designated university campuses.</p>
                        )}
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-4 pt-2">
                    {/* Desktop Cancel (Symmetric with Save) */}
                    <Link href="/profile" className="hidden sm:flex flex-1">
                        <div className={ui.secondaryBtn}>Cancel</div>
                    </Link>

                    {/* Mobile Cancel (X mark) */}
                    <Link href="/profile" className="flex sm:hidden">
                        <div className={ui.mobileCancelBtn}>
                            <XMarkIcon className="h-6 w-6" />
                        </div>
                    </Link>

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className={ui.primaryBtn}
                    >
                        {saving ? "Updating Profile..." : "Save Profile"}
                    </button>
                </div>
            </div>
        </div>
    );
}
