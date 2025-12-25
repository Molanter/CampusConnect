"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, getDocs, collection, query, where, deleteDoc, updateDoc } from "firebase/firestore";
import Link from "next/link";
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    PencilSquareIcon,
    TrashIcon,
    ShieldCheckIcon,
    LockClosedIcon,
    UserGroupIcon,
    ArrowRightOnRectangleIcon,
    CheckBadgeIcon,
    SparklesIcon,
    PencilIcon
} from "@heroicons/react/24/outline";
import { CheckBadgeIcon as CheckBadgeSolidIcon } from "@heroicons/react/24/solid";
import { auth, db } from "../../../../lib/firebase";
import { Club } from "../../../../lib/clubs";
import { fetchGlobalAdminEmails, isGlobalAdmin } from "../../../../lib/admin-utils";
import { useAdminMode } from "../../../../components/admin-mode-context";

export default function ClubSettingsPage() {
    const params = useParams();
    const router = useRouter();
    const clubId = params.clubId as string;

    const [user, setUser] = useState<any>(null);
    const [club, setClub] = useState<Club | null>(null);
    const [membership, setMembership] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isGlobalAdminUser, setIsGlobalAdminUser] = useState(false);
    const { adminModeOn } = useAdminMode();

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
            if (!u) {
                setLoading(false);
            }
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        if (!user || !clubId) return;

        const fetchData = async () => {
            try {
                // 1. Fetch Club
                const clubRef = doc(db, "clubs", clubId);
                const clubSnap = await getDoc(clubRef);
                if (clubSnap.exists()) {
                    setClub({ id: clubSnap.id, ...clubSnap.data() } as Club);
                }

                // 2. Fetch Membership to verify Admin/Owner
                const memRef = collection(db, "clubs", clubId, "members");
                const q = query(memRef, where("uid", "==", user.uid));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    setMembership(snap.docs[0].data());
                }
            } catch (err) {
                console.error("Error fetching settings data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user, clubId]);

    // Check Global Admin Status
    useEffect(() => {
        if (!user) return;
        const checkAdmin = async () => {
            const globalAdmins = await fetchGlobalAdminEmails();
            if (isGlobalAdmin(user.email, globalAdmins)) {
                setIsGlobalAdminUser(true);
            }
        };
        checkAdmin();
    }, [user]);

    const handleDeleteClub = async () => {
        if (!club) return;
        if (confirm("Are you sure you want to delete this club? This action cannot be undone.")) {
            if (confirm("Please confirm again: Do you really want to DELETE this club and all its data?")) {
                try {
                    await deleteDoc(doc(db, "clubs", clubId));
                    alert("Club deleted.");
                    router.push("/clubs");
                } catch (err) {
                    console.error("Error deleting club:", err);
                    alert("Failed to delete club.");
                }
            }
        }
    };

    const handleTogglePrivate = async () => {
        if (!club) return;
        try {
            const newValue = !club.isPrivate;
            await updateDoc(doc(db, "clubs", clubId), { isPrivate: newValue });
            setClub({ ...club, isPrivate: newValue });
        } catch (err) {
            console.error("Error updating privacy:", err);
            alert("Failed to update privacy setting.");
        }
    };

    const handlePostingPermissionChange = async (value: 'anyone' | 'admins') => {
        if (!club) return;
        try {
            await updateDoc(doc(db, "clubs", clubId), { postingPermission: value });
            setClub({ ...club, postingPermission: value });
        } catch (err) {
            console.error("Error updating posting permission:", err);
            alert("Failed to update posting permission.");
        }
    };

    const handleRequestCampusApproval = async () => {
        if (!club) return;
        if (club.verificationStatus === 'pending') {
            alert("Your verification request is already pending.");
            return;
        }
        if (club.verificationStatus === 'approved' || club.isVerified) {
            alert("This club is already verified!");
            return;
        }
        try {
            await updateDoc(doc(db, "clubs", clubId), { verificationStatus: 'pending' });
            setClub({ ...club, verificationStatus: 'pending' });
            alert("Verification request submitted! A campus admin will review your club.");
        } catch (err) {
            console.error("Error requesting verification:", err);
            alert("Failed to submit verification request.");
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center text-neutral-300">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-[#ffb200]" />
            </div>
        );
    }

    // Access Check
    const isAdminOrOwner = membership?.role === "owner" || membership?.role === "admin" || (isGlobalAdminUser && adminModeOn);

    if (!club || !isAdminOrOwner) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-3 text-neutral-200">
                <p>You do not have permission to view these settings.</p>
                <Link href={`/clubs/${clubId}`} className="text-[#ffb200] hover:underline">
                    Return to Club
                </Link>
            </div>
        );
    }

    return (
        <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8">
            <header className="mb-2">
                <button
                    onClick={() => router.back()}
                    className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/70 hover:text-white hover:bg-white/10 transition-all"
                >
                    <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
                    Club Settings
                </p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
                    {club.name}
                </h1>
                <p className="mt-2 text-sm text-neutral-400">
                    Manage club details, privacy, and members
                </p>
            </header>

            {/* General Section */}
            <section className="space-y-3">
                <h2 className="px-4 text-[13px] font-semibold uppercase tracking-wider text-neutral-500">General</h2>
                <div className="overflow-hidden rounded-2xl bg-[#1C1C1E]">
                    <Link
                        href={`/clubs/${clubId}/edit`} // Assume this route will be created or exists
                        className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5"
                    >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600">
                            <PencilSquareIcon className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                            <p className="text-[15px] font-normal text-white">Edit Club Details</p>
                        </div>
                        <ChevronRightIcon className="h-5 w-5 text-neutral-600" />
                    </Link>

                    <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-purple-600">
                            <UserGroupIcon className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                            <p className="text-[15px] font-normal text-white">Manage Roles</p>
                        </div>
                        <div className="text-sm text-neutral-500">Coming soon</div>
                    </div>
                </div>
            </section>

            {/* Recognition Section */}
            <section className="space-y-3">
                <h2 className="px-4 text-[13px] font-semibold uppercase tracking-wider text-neutral-500">Recognition</h2>
                <div className="overflow-hidden rounded-2xl bg-[#1C1C1E]">
                    <button
                        onClick={handleRequestCampusApproval}
                        disabled={club.verificationStatus === 'approved' || club.isVerified}
                        className="flex w-full items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${club.isVerified || club.verificationStatus === 'approved'
                            ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                            : 'bg-gradient-to-br from-amber-500 to-amber-600'
                            }`}>
                            {club.isVerified || club.verificationStatus === 'approved' ? (
                                <CheckBadgeSolidIcon className="h-5 w-5 text-white" />
                            ) : (
                                <SparklesIcon className="h-5 w-5 text-white" />
                            )}
                        </div>
                        <div className="flex-1 text-left">
                            <p className="text-[15px] font-normal text-white">
                                {club.isVerified || club.verificationStatus === 'approved'
                                    ? 'Campus Verified'
                                    : 'Request Campus Approval'}
                            </p>
                            <p className="text-[11px] text-neutral-500">
                                {club.verificationStatus === 'pending'
                                    ? 'Verification pending review'
                                    : club.isVerified || club.verificationStatus === 'approved'
                                        ? 'This club is officially recognized'
                                        : 'Get a verified badge for your club'}
                            </p>
                        </div>
                        {club.isVerified || club.verificationStatus === 'approved' ? (
                            <CheckBadgeSolidIcon className="h-6 w-6 text-blue-500" />
                        ) : club.verificationStatus === 'pending' ? (
                            <span className="text-sm text-amber-500">Pending</span>
                        ) : (
                            <ChevronRightIcon className="h-5 w-5 text-neutral-600" />
                        )}
                    </button>
                </div>
            </section>

            {/* Privacy & Permissions Section */}
            <section className="space-y-3">
                <h2 className="px-4 text-[13px] font-semibold uppercase tracking-wider text-neutral-500">Privacy & Permissions</h2>
                <div className="overflow-hidden rounded-2xl bg-[#1C1C1E]">
                    {/* Private Club Toggle */}
                    <button
                        onClick={handleTogglePrivate}
                        className="flex w-full items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5"
                    >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-teal-600">
                            <LockClosedIcon className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 text-left">
                            <p className="text-[15px] font-normal text-white">Private Club</p>
                            <p className="text-[11px] text-neutral-500">Require approval to join</p>
                        </div>
                        {/* Toggle Switch */}
                        <div className={`relative h-7 w-12 rounded-full transition-colors ${club.isPrivate ? 'bg-[#ffb200]' : 'bg-neutral-700'}`}>
                            <div className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${club.isPrivate ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </div>
                    </button>

                    {/* Who Can Post Picker */}
                    <div className="flex items-center gap-3 px-4 py-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600">
                            <PencilIcon className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                            <p className="text-[15px] font-normal text-white">Who Can Post</p>
                        </div>
                        <select
                            value={club.postingPermission || 'anyone'}
                            onChange={(e) => handlePostingPermissionChange(e.target.value as 'anyone' | 'admins')}
                            className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm text-white border border-white/10 focus:outline-none focus:ring-1 focus:ring-[#ffb200]"
                        >
                            <option value="anyone">Anyone</option>
                            <option value="admins">Admins Only</option>
                        </select>
                    </div>
                </div>
            </section>

            {/* Danger Zone */}
            <section className="space-y-3">
                <h2 className="px-4 text-[13px] font-semibold uppercase tracking-wider text-red-500">Danger Zone</h2>
                <div className="overflow-hidden rounded-2xl bg-[#1C1C1E]">
                    <button
                        onClick={handleDeleteClub}
                        className="flex w-full items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                    >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-red-600">
                            <TrashIcon className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 text-left">
                            <p className="text-[15px] font-normal text-red-400">Delete Club</p>
                            <p className="text-[11px] text-neutral-500">Permanently remove this club and all its data</p>
                        </div>
                    </button>
                </div>
            </section>
        </div>
    );
}
