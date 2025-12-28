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
                <h1 className="text-xl font-bold text-white">Complete Profile</h1>
            </div>

            {/* Content */}
            <div className="px-6 py-6 space-y-6">
                {/* Error Message */}
                {error && (
                    <div className="rounded-[28px] border border-red-500/20 bg-red-500/10 px-4 py-3 flex items-start gap-3">
                        <ExclamationTriangleIcon className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                )}

                {/* Campus Change Warning */}
                {isCampusChanging && (
                    <div className="rounded-[28px] border border-[#ffb200]/20 bg-[#ffb200]/10 px-4 py-3 flex items-start gap-3">
                        <ExclamationTriangleIcon className="h-5 w-5 text-[#ffb200] shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-[#ffb200]">Changing Campus</p>
                            <p className="text-xs text-[#ffb200]/70 mt-1">You will be automatically added to default clubs of the new campus. Your existing club memberships will remain.</p>
                        </div>
                    </div>
                )}

                {/* iOS-Style Form Group - Profile Info */}
                <div className="rounded-[28px] border border-white/10 bg-[#1C1C1E] overflow-hidden">
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
                    <div className="px-4 py-3 border-b border-white/10">
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

                    {/* Role */}
                    <div className="px-4 py-3">
                        <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2 block">Role</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value as "student" | "faculty" | "staff")}
                            className="w-full bg-transparent text-white focus:outline-none"
                        >
                            <option value="" className="bg-[#1C1C1E]">Select role</option>
                            <option value="student" className="bg-[#1C1C1E]">Student</option>
                            <option value="faculty" className="bg-[#1C1C1E]">Faculty</option>
                            <option value="staff" className="bg-[#1C1C1E]">Staff</option>
                        </select>
                    </div>
                </div>

                {/* iOS-Style Form Group - Academic Info (Only for Students) */}
                {role === "student" && (
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
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                                    Dorm/Residence
                                    {isUniversityWithDorms && <span className="text-red-400 ml-1">*</span>}
                                </label>
                                {isUniversityWithDorms && (
                                    <span className="text-[10px] text-red-400/70 uppercase tracking-wider">Required</span>
                                )}
                            </div>
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
                )}

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
                        disabled={saving}
                        className="flex-1 rounded-full px-6 py-3 font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        style={{ backgroundColor: '#ffb200' }}
                    >
                        {saving ? "Saving..." : "Save Profile"}
                    </button>
                </div>
            </div>
        </div>
    );
}
