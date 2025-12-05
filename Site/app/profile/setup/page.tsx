"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, setDoc, getFirestore, collection, getDocs } from "firebase/firestore";
import { auth } from "../../../lib/firebase";
import Link from "next/link";
import { ChevronLeftIcon, XMarkIcon } from "@heroicons/react/24/outline";

export default function ProfileSetupPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form fields
    const [username, setUsername] = useState("");
    const [universityId, setUniversityId] = useState("");
    const [universityName, setUniversityName] = useState("");
    const [role, setRole] = useState("student");
    const [major, setMajor] = useState("");
    const [yearOfStudy, setYearOfStudy] = useState("");
    const [dorm, setDorm] = useState("");

    // University and dorm data
    const [universities, setUniversities] = useState<any[]>([]);
    const [dorms, setDorms] = useState<string[]>([]);
    const [loadingUniversities, setLoadingUniversities] = useState(false);
    const [error, setError] = useState("");

    // Fetch universities on mount
    useEffect(() => {
        const fetchUniversities = async () => {
            try {
                setLoadingUniversities(true);
                const db = getFirestore();
                const snapshot = await getDocs(collection(db, "universities"));
                const univs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setUniversities(univs);
            } catch (err) {
                console.error("Error fetching universities:", err);
            } finally {
                setLoadingUniversities(false);
            }
        };
        fetchUniversities();
    }, []);

    // Fetch dorms when university changes
    useEffect(() => {
        const fetchDorms = async () => {
            if (!universityId) {
                setDorms([]);
                return;
            }

            try {
                const db = getFirestore();
                const dormsSnapshot = await getDocs(
                    collection(db, "universities", universityId, "dorms")
                );
                const dormsList = dormsSnapshot.docs.map(doc => doc.data().name || doc.id);
                console.log("Loaded dorms from subcollection:", dormsList);
                setDorms(dormsList);
            } catch (err) {
                console.error("Error fetching dorms:", err);
                setDorms([]);
            }
        };

        fetchDorms();
    }, [universityId]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            if (!u) {
                router.push("/");
                return;
            }

            // Load existing profile data
            try {
                const db = getFirestore();
                const ref = doc(db, "users", u.uid);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const data = snap.data();
                    setUsername(data.username || "");
                    setUniversityName(data.campus || "");
                    setUniversityId(data.universityId || "");
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
        if (!username.trim() || !universityName.trim()) {
            setError("Please provide at least a username and university.");
            return;
        }

        try {
            setSaving(true);
            setError("");
            const db = getFirestore();

            // Check if username is already taken
            const usernameQuery = await getDocs(
                collection(db, "users")
            );
            const usernameTaken = usernameQuery.docs.some(
                (doc) => doc.data().username === username.trim() && doc.id !== user.uid
            );

            if (usernameTaken) {
                setError(`Username "${username.trim()}" is already taken. Please choose another.`);
                setSaving(false);
                return;
            }

            const userDocRef = doc(db, "users", user.uid);

            await setDoc(userDocRef, {
                username: username.trim(),
                campus: universityName.trim(),
                universityId: universityId || "",
                role: role || "student",
                major: major.trim() || "",
                yearOfStudy: yearOfStudy || "",
                dorm: dorm || "",
            }, { merge: true });

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
                    <div className="rounded-[28px] border border-red-500/20 bg-red-500/10 px-4 py-3">
                        <p className="text-sm text-red-400">{error}</p>
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

                    {/* University */}
                    <div className="px-4 py-3 border-b border-white/10">
                        <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2 block">University</label>
                        <select
                            value={universityId}
                            onChange={(e) => {
                                const selectedId = e.target.value;
                                setUniversityId(selectedId);
                                const selectedUniv = universities.find(u => u.id === selectedId);
                                setUniversityName(selectedUniv?.name || "");
                                setDorm("");
                            }}
                            disabled={loadingUniversities}
                            className="w-full bg-transparent text-white focus:outline-none"
                        >
                            <option value="" className="bg-[#1C1C1E]">Select a university</option>
                            {universities.map((univ) => (
                                <option key={univ.id} value={univ.id} className="bg-[#1C1C1E]">
                                    {univ.name}
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
                            <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2 block">Dorm/Residence</label>
                            <select
                                value={dorm}
                                onChange={(e) => setDorm(e.target.value)}
                                disabled={!universityId || dorms.length === 0}
                                className="w-full bg-transparent text-white focus:outline-none disabled:opacity-50"
                            >
                                <option value="" className="bg-[#1C1C1E]">Select a dorm</option>
                                {dorms.map((dormName) => (
                                    <option key={dormName} value={dormName} className="bg-[#1C1C1E]">
                                        {dormName}
                                    </option>
                                ))}
                            </select>
                            {universityId && dorms.length === 0 && (
                                <p className="text-xs text-neutral-500 mt-2">No dorms available for this university</p>
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
