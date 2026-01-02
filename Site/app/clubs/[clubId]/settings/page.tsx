"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, getDocs, collection, query, where, deleteDoc, updateDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import Link from "next/link";
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    PencilSquareIcon,
    TrashIcon,
    LockClosedIcon,
    UserGroupIcon,
    CheckBadgeIcon,
    SparklesIcon,
    PencilIcon,
    ExclamationTriangleIcon,
    InformationCircleIcon
} from "@heroicons/react/24/outline";
import { CheckBadgeIcon as CheckBadgeSolidIcon } from "@heroicons/react/24/solid";
import { auth, db } from "../../../../lib/firebase";
import { Club } from "../../../../lib/clubs";
import { useAdminMode } from "../../../../components/admin-mode-context";
import { useRightSidebar } from "../../../../components/right-sidebar-context";
import Toast, { ToastData } from "@/components/Toast";
import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";

// Shared UI class definitions
const ui = {
    page: "mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8 pb-32",
    sectionLabel: "px-4 text-[13px] font-semibold uppercase tracking-wider cc-muted",
    card: "cc-section cc-radius-24 shadow-lg overflow-hidden",
    row: "relative group/row flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/20 active:bg-secondary/30",
    rowDivider: "absolute bottom-0 left-0 right-0 h-px bg-secondary/15 group-last/row:hidden",
    iconContainer: "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
    textTitle: "text-[15px] font-normal text-foreground",
    textSubtitle: "text-[11px] cc-muted",
    select: "rounded-full cc-section px-4 py-1.5 text-sm text-foreground border border-secondary/25 focus:outline-none focus:ring-1 focus:ring-brand transition-colors",
};

export default function ClubSettingsPage() {
    const params = useParams();
    const router = useRouter();
    const clubId = params.clubId as string;

    const [user, setUser] = useState<any>(null);
    const [club, setClub] = useState<Club | null>(null);
    const [membership, setMembership] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<ToastData | null>(null);

    // Delete confirmation dialog state
    // Delete confirmation dialog state
    const [deleteDialog, setDeleteDialog] = useState<{
        isOpen: boolean;
        step: 1 | 2 | 3;
        checking: boolean;
        isDormClub: boolean;
        isDefaultClub: boolean;
        detectedCampusId: string | null;
        detectionMode: "campusId" | "failsafe-scan" | null;
    }>({
        isOpen: false,
        step: 1,
        checking: false,
        isDormClub: false,
        isDefaultClub: false,
        detectedCampusId: null,
        detectionMode: null,
    });

    const { isGlobalAdminUser: ctxGlobalAdmin, adminModeOn } = useAdminMode();
    const { openView } = useRightSidebar();

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

    // --- Deletion Flow Helpers ---

    const detectClubDeletionRisk = async (clubId: string, currentClub: Club) => {
        let isDormClub = false;
        let isDefaultClub = false;
        let detectedCampusId: string | null = null;
        let detectionMode: "campusId" | "failsafe-scan" = "campusId";

        // DEBUG: Logging for visibility in devtools
        console.log(`[Risk Detection] Starting for Club: ${clubId} ("${currentClub.name}")`);

        try {
            // Step 0: Check the club object itself (Self-Identification)
            const c = currentClub as any;
            const nameLower = (c.name || "").toLowerCase();
            if (c.type === 'dorm' || c.category === 'dorm' || c.isDorm || c.isOfficial || nameLower.includes('dorm')) {
                console.log(`[Risk Detection] Step 0: Metadata Match Found (dorm/official/name)`);
                isDormClub = true;
            }
            if (c.type === 'default' || c.isDefault) {
                console.log(`[Risk Detection] Step 0: Metadata Match Found (default)`);
                isDefaultClub = true;
            }

            // Step 1: Specific Campus/University Check
            let campusId = c.campusId || c.campusID || c.universityId;
            if (campusId && typeof campusId === 'object' && (campusId as any).id) {
                campusId = (campusId as any).id;
            }

            const cleanClubId = (clubId || "").trim();
            const clubNameLower = currentClub.name.toLowerCase();
            let found = false;

            const checkDoc = async (docSnap: any, cid: string) => {
                if (!docSnap.exists()) return false;
                const data = docSnap.data();
                let matched = false;

                // 1. Check Default Clubs
                if (data.defaultClubs?.includes(cleanClubId)) {
                    isDefaultClub = true;
                    matched = true;
                }

                // 2. Check Dorms Array
                if (data.dorms && Array.isArray(data.dorms)) {
                    for (const d of data.dorms) {
                        if (d === cleanClubId || (typeof d === 'object' && d?.clubId === cleanClubId) || d?.clubs?.includes(cleanClubId)) {
                            isDormClub = true;
                            matched = true;
                            break;
                        }
                        if (typeof d === 'string' && d.toLowerCase() === clubNameLower) {
                            isDormClub = true;
                            matched = true;
                            break;
                        }
                    }
                }

                // 3. Check Sub-collection
                if (!matched) {
                    const collNames = ['dorms', 'clubs'];
                    for (const collName of collNames) {
                        const subSnap = await getDocs(collection(db, docSnap.ref.parent.id, docSnap.id, collName));
                        subSnap.forEach(sDoc => {
                            const sData = sDoc.data();
                            if (sDoc.id === cleanClubId || sData.clubId === cleanClubId || (sData.name && sData.name.toLowerCase() === clubNameLower)) {
                                console.log(`[Risk Detection] Sub-collection Match in ${collName}: ${sDoc.id}`);
                                isDormClub = true;
                                matched = true;
                            }
                        });
                        if (matched) break;
                    }
                }

                if (matched) {
                    detectedCampusId = cid;
                    console.log(`[Risk Detection] Match found in ${docSnap.ref.parent.id}/${cid}`);
                }
                return matched;
            };

            if (campusId) {
                console.log(`[Risk Detection] Step 1: Checking collections for ID: ${campusId}`);
                // Try campuses first
                const cSnap = await getDoc(doc(db, 'campuses', campusId));
                found = await checkDoc(cSnap, campusId);

                // Try universities as fallback
                if (!found) {
                    const uSnap = await getDoc(doc(db, 'universities', campusId));
                    found = await checkDoc(uSnap, campusId);
                }
            }

            // Step 2: Failsafe Global Scan
            if (!found && !isDormClub && !isDefaultClub) {
                console.log(`[Risk Detection] Step 2: Failsafe Scan (Multi-collection)`);
                detectionMode = "failsafe-scan";

                const collectionsToScan = ['campuses', 'universities'];
                for (const collName of collectionsToScan) {
                    const collSnap = await getDocs(collection(db, collName));
                    for (const uDoc of collSnap.docs) {
                        if (await checkDoc(uDoc, uDoc.id)) {
                            found = true;
                            break;
                        }
                    }
                    if (found) break;
                }
            }
        } catch (err) {
            console.error("Error detecting club risk:", err);
            // Default to safe side
            isDormClub = true;
        }

        console.log(`[Risk Detection] Final Result - isDorm: ${isDormClub}, isDefault: ${isDefaultClub}`);
        return { isDormClub, isDefaultClub, detectedCampusId, detectionMode };
    };

    const hideClub = async () => {
        if (!club) return;
        console.log(`[Hide Action] Hiding club ${club.id} ("${club.name}")`);
        const clubRef = doc(db, "clubs", club.id);
        await updateDoc(clubRef, {
            status: 'hidden',        // Use status for hiding
            isPrivate: true,         // Privacy flag
            visibility: 'hidden',     // Legacy/Alternative flag
            hiddenAt: serverTimestamp(),
            hiddenReason: "dormOrDefaultClub"
        });
        console.log(`[Hide Action] Success - Club document updated.`);
    };

    const deleteClubAndPosts = async () => {
        if (!club) return;
        console.log(`[Delete Action] Performing full deletion for ${club.id}`);
        try {
            const postsQ = query(collection(db, "posts"), where("clubId", "==", club.id));
            const postsSnap = await getDocs(postsQ);
            console.log(`[Delete Action] Found ${postsSnap.docs.length} posts to delete`);
            const chunks = [];
            const batchSize = 400;
            for (let i = 0; i < postsSnap.docs.length; i += batchSize) {
                chunks.push(postsSnap.docs.slice(i, i + batchSize));
            }
            for (const chunk of chunks) {
                const batch = writeBatch(db);
                chunk.forEach(d => batch.delete(d.ref));
                await batch.commit();
            }
            await deleteDoc(doc(db, "clubs", club.id));
            console.log(`[Delete Action] Success - Club and posts wiped`);
        } catch (error) {
            console.error("[Delete Action] Error during wiping:", error);
            throw error;
        }
    };

    const handleDeleteConfirm = async () => {
        if (!club) return;
        const { isDormClub, isDefaultClub } = deleteDialog;
        console.log(`[Deletion Flow] Final Confirmation Started. isDorm: ${isDormClub}, isDefault: ${isDefaultClub}`);

        try {
            if (isDormClub || isDefaultClub) {
                await hideClub();
                const type = isDormClub ? 'Dorm' : 'Default';
                setToast({ type: 'success', message: `${type} club hidden. Accessible to members only.` });
            } else {
                await deleteClubAndPosts();
                setToast({ type: 'success', message: 'Club and posts deleted permanently.' });
            }

            setTimeout(() => router.push("/clubs"), 1000);
            setDeleteDialog(prev => ({ ...prev, isOpen: false }));
        } catch (err) {
            console.error("Error executing deletion:", err);
            setToast({ type: 'error', message: "Action failed. Please try again." });
        }
    };

    const handleDeleteClub = async () => {
        if (!club) return;

        // Open Dialog in Step 1
        setDeleteDialog({
            isOpen: true,
            step: 1,
            checking: true,
            isDormClub: false,
            isDefaultClub: false,
            detectedCampusId: null,
            detectionMode: null
        });

        // Run detection in background while they read Step 1
        const risk = await detectClubDeletionRisk(clubId, club);

        setDeleteDialog(prev => ({
            ...prev,
            checking: false,
            isDormClub: risk.isDormClub,
            isDefaultClub: risk.isDefaultClub,
            detectedCampusId: risk.detectedCampusId,
            detectionMode: risk.detectionMode
        }));
    };
    const handleTogglePrivate = async () => {
        if (!club) return;
        try {
            const newValue = !club.isPrivate;
            await updateDoc(doc(db, "clubs", clubId), { isPrivate: newValue });
            setClub({ ...club, isPrivate: newValue });
            setToast({ type: 'success', message: `Club is now ${newValue ? 'private' : 'public'}` });
        } catch (err) {
            console.error("Error updating privacy:", err);
            setToast({ type: 'error', message: 'Failed to update privacy setting' });
        }
    };

    const handlePostingPermissionChange = async (value: 'anyone' | 'admins') => {
        if (!club) return;

        // Enforce verification requirement
        if (value === 'anyone' && !club.isVerified && club.verificationStatus !== 'approved') {
            setToast({ type: 'error', message: "Only verified clubs can post to the entire campus. Please request verification." });
            return;
        }

        try {
            await updateDoc(doc(db, "clubs", clubId), {
                postingPermission: value,
                allowMemberPosts: value === 'anyone'
            });
            setClub({ ...club, postingPermission: value, allowMemberPosts: value === 'anyone' });
            setToast({ type: 'success', message: 'Posting permission updated' });
        } catch (err) {
            console.error("Error updating posting permission:", err);
            setToast({ type: 'error', message: 'Failed to update posting permission' });
        }
    };

    const handleRequestCampusApproval = async () => {
        if (!club) return;
        if (club.verificationStatus === 'pending') {
            setToast({ type: 'success', message: 'Your verification request is already pending' });
            return;
        }
        if (club.verificationStatus === 'approved' || club.isVerified) {
            setToast({ type: 'success', message: 'This club is already verified!' });
            return;
        }
        try {
            await updateDoc(doc(db, "clubs", clubId), { verificationStatus: 'pending' });
            setClub({ ...club, verificationStatus: 'pending' });
            setToast({ type: 'success', message: 'Verification request submitted! A campus admin will review your club.' });
        } catch (err) {
            console.error("Error requesting verification:", err);
            setToast({ type: 'error', message: 'Failed to submit verification request' });
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-secondary/25 border-t-brand" />
            </div>
        );
    }

    // Access Check - Fixed to use context values
    const isAdminOrOwner = membership?.role === "owner" || membership?.role === "admin" || (ctxGlobalAdmin && adminModeOn);

    if (!club || !isAdminOrOwner) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-3">
                <p className="text-foreground">You do not have permission to view these settings.</p>
                <Link href={`/clubs/${clubId}`} className="text-brand hover:underline">
                    Return to Club
                </Link>
            </div>
        );
    }

    return (
        <div className={ui.page}>
            {/* Header */}
            <header className="mb-2">
                <button
                    onClick={() => router.back()}
                    className="mb-4 flex h-9 w-9 items-center justify-center rounded-full cc-header-btn transition-all active:scale-95"
                >
                    <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] cc-muted">
                    Club Settings
                </p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    {club.name}
                    {club.isVerified && (
                        <CheckBadgeSolidIcon className="h-7 w-7 text-brand shrink-0" />
                    )}
                </h1>
                <p className="mt-2 text-sm cc-muted">
                    Manage club details, privacy, and members
                </p>
            </header>

            {/* General Section */}
            <section className="space-y-3">
                <h2 className={ui.sectionLabel}>General</h2>
                <div className={ui.card}>
                    <Link
                        href={`/clubs/${clubId}/edit`}
                        className={ui.row}
                    >
                        <div className={`${ui.iconContainer} bg-blue-500`}>
                            <PencilSquareIcon className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                            <p className={ui.textTitle}>Edit Club Details</p>
                        </div>
                        <ChevronRightIcon className="h-5 w-5 text-secondary" />
                        <div className={ui.rowDivider} />
                    </Link>

                    <div className={ui.row}>
                        <div className={`${ui.iconContainer} bg-purple-500`}>
                            <UserGroupIcon className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                            <p className={ui.textTitle}>Manage Roles</p>
                        </div>
                        <div className="text-sm cc-muted">Coming soon</div>
                    </div>
                </div>
            </section>

            {/* Recognition Section */}
            <section className="space-y-3">
                <h2 className={ui.sectionLabel}>Recognition</h2>
                <div className={ui.card}>
                    <button
                        onClick={handleRequestCampusApproval}
                        disabled={club.verificationStatus === 'approved' || club.isVerified}
                        className={`${ui.row} w-full disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        <div className={`${ui.iconContainer} ${club.isVerified || club.verificationStatus === 'approved'
                            ? 'bg-blue-500'
                            : 'bg-amber-500'
                            }`}>
                            {club.isVerified || club.verificationStatus === 'approved' ? (
                                <CheckBadgeSolidIcon className="h-5 w-5 text-white" />
                            ) : (
                                <SparklesIcon className="h-5 w-5 text-white" />
                            )}
                        </div>
                        <div className="flex-1 text-left">
                            <p className={ui.textTitle}>
                                {club.isVerified || club.verificationStatus === 'approved'
                                    ? 'Campus Verified'
                                    : 'Request Campus Approval'}
                            </p>
                            <p className={ui.textSubtitle}>
                                {club.verificationStatus === 'pending'
                                    ? 'Verification pending review'
                                    : club.isVerified || club.verificationStatus === 'approved'
                                        ? 'This club is officially recognized'
                                        : 'Get a verified badge for your club'}
                            </p>
                        </div>
                        {club.isVerified || club.verificationStatus === 'approved' ? (
                            <CheckBadgeSolidIcon className="h-6 w-6 text-brand" />
                        ) : club.verificationStatus === 'pending' ? (
                            <span className="text-sm text-amber-500">Pending</span>
                        ) : (
                            <ChevronRightIcon className="h-5 w-5 text-secondary" />
                        )}
                    </button>
                </div>
            </section>

            {/* Privacy & Permissions Section */}
            <section className="space-y-3">
                <h2 className={ui.sectionLabel}>Privacy & Permissions</h2>
                <div className={ui.card}>
                    {/* Private Club Toggle */}
                    <div className={`${ui.row} cursor-pointer`}>
                        <div className={`${ui.iconContainer} bg-teal-500`}>
                            <LockClosedIcon className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 text-left">
                            <div className="flex items-center gap-2">
                                <p className={ui.textTitle}>Private Club</p>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        openView("club-privacy-info");
                                    }}
                                    className="text-secondary hover:text-foreground transition-colors"
                                >
                                    <InformationCircleIcon className="h-4 w-4" />
                                </button>
                            </div>
                            <p className={ui.textSubtitle}>Require approval to join</p>
                        </div>
                        {/* Toggle Switch */}
                        <div
                            onClick={handleTogglePrivate}
                            className={`relative h-7 w-12 rounded-full transition-colors cursor-pointer ${club.isPrivate ? 'bg-brand' : 'bg-secondary/40'}`}
                        >
                            <div className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${club.isPrivate ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </div>
                        <div className={ui.rowDivider} />
                    </div>

                    {/* Who Can Post Picker */}
                    <div className={ui.row}>
                        <div className={`${ui.iconContainer} bg-indigo-500`}>
                            <PencilIcon className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                            <p className={ui.textTitle}>Who Can Post</p>
                            {!club.isVerified && club.verificationStatus !== 'approved' && (
                                <p className="text-[10px] text-amber-500 mt-0.5">
                                    <ExclamationTriangleIcon className="inline h-3 w-3 mr-1" />
                                    Verify club to enable Campus Wide posting
                                </p>
                            )}
                        </div>
                        <select
                            value={club.postingPermission || 'anyone'}
                            onChange={(e) => {
                                handlePostingPermissionChange(e.target.value as 'anyone' | 'admins');
                            }}
                            className={ui.select}
                        >
                            <option value="anyone">All Members</option>
                            <option value="admins">Only Admins</option>
                        </select>
                    </div>
                </div>
            </section>



            {/* Danger Zone */}
            <section className="space-y-3">
                <h2 className="px-4 text-[13px] font-semibold uppercase tracking-wider text-red-500">Danger Zone</h2>
                <div className={ui.card}>
                    <button
                        onClick={handleDeleteClub}
                        className={`${ui.row} w-full`}
                    >
                        <div className={`${ui.iconContainer} bg-red-500`}>
                            <TrashIcon className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 text-left">
                            <p className="text-[15px] font-normal text-red-500">Delete Club</p>
                            <p className={ui.textSubtitle}>Permanently remove this club and all its data</p>
                        </div>
                    </button>
                </div>
            </section>

            {/* Delete Confirmation Dialog */}
            <Transition appear show={deleteDialog.isOpen} as={Fragment}>
                <Dialog as="div" className="relative z-[60]" onClose={() => setDeleteDialog({ ...deleteDialog, isOpen: false })}>
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-300"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
                    </Transition.Child>

                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4 text-center">
                            <Transition.Child
                                as={Fragment}
                                enter="ease-out duration-300"
                                enterFrom="opacity-0 scale-95"
                                enterTo="opacity-100 scale-100"
                                leave="ease-in duration-200"
                                leaveFrom="opacity-100 scale-100"
                                leaveTo="opacity-0 scale-95"
                            >
                                <Dialog.Panel className="w-full max-w-sm transform overflow-hidden cc-radius-24 cc-section p-6 text-left align-middle shadow-2xl transition-all border border-foreground/5">
                                    <div className="relative">
                                        {/* Step 1: Initial Intent */}
                                        {deleteDialog.step === 1 && (
                                            <div className="space-y-5">
                                                <div className="flex flex-col items-center text-center">
                                                    <TrashIcon className="h-8 w-8 text-red-500 mb-3" />
                                                    <Dialog.Title as="h3" className="text-xl font-bold text-foreground">
                                                        Delete Club?
                                                    </Dialog.Title>
                                                    <p className="mt-2 text-sm cc-muted">
                                                        Requesting removal of <strong className="text-foreground">{club?.name}</strong>.
                                                    </p>
                                                </div>

                                                <div className="flex justify-between gap-3 pt-2">
                                                    <button
                                                        type="button"
                                                        className="rounded-full px-5 py-2 text-sm font-medium cc-muted hover:text-foreground transition-all"
                                                        onClick={() => setDeleteDialog({ ...deleteDialog, isOpen: false })}
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={deleteDialog.checking}
                                                        className="rounded-full bg-foreground px-7 py-2 text-sm font-bold text-background hover:opacity-90 transition-all disabled:opacity-50"
                                                        onClick={() => setDeleteDialog(prev => ({ ...prev, step: 2 }))}
                                                    >
                                                        {deleteDialog.checking ? "Checking..." : "Confirm Deletion"}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Step 2: Risk Analysis Result */}
                                        {deleteDialog.step === 2 && (
                                            <div className="space-y-5">
                                                <div className="flex flex-col items-center text-center">
                                                    <Dialog.Title as="h3" className="text-xl font-bold text-foreground">
                                                        Security Assessment
                                                    </Dialog.Title>
                                                    <p className="mt-2 text-sm cc-muted">
                                                        Scan of campus configuration complete.
                                                    </p>
                                                </div>

                                                <div className="space-y-2 py-2">
                                                    {deleteDialog.isDormClub || deleteDialog.isDefaultClub ? (
                                                        <div className="flex items-start gap-3 p-3 rounded-2xl bg-red-500/5 border border-red-500/10">
                                                            <ExclamationTriangleIcon className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                                                            <div>
                                                                <p className="text-sm font-bold text-red-500">Essential Club</p>
                                                                <p className="text-[13px] text-foreground leading-relaxed">
                                                                    This is a {deleteDialog.isDormClub ? 'Dorm' : 'Default'} club. It will be hidden instead of deleted to protect data until campus admins will not aprove it.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-start gap-3 p-3 rounded-2xl bg-blue-500/5 border border-blue-500/10">
                                                            <InformationCircleIcon className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                                                            <div>
                                                                <p className="text-sm font-bold text-blue-500">Regular Club</p>
                                                                <p className="text-[13px] text-foreground leading-relaxed">
                                                                    Standard user club detected. Permanent removal is possible.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex justify-between gap-3 pt-2">
                                                    <button
                                                        type="button"
                                                        className="rounded-full px-5 py-2 text-sm font-medium cc-muted hover:text-foreground transition-all"
                                                        onClick={() => setDeleteDialog(prev => ({ ...prev, step: 1 }))}
                                                    >
                                                        Back
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="rounded-full bg-foreground px-7 py-2 text-sm font-bold text-background hover:opacity-90 transition-all"
                                                        onClick={() => setDeleteDialog(prev => ({ ...prev, step: 3 }))}
                                                    >
                                                        Proceed
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Step 3: Final Confirmation */}
                                        {deleteDialog.step === 3 && (
                                            <div className="space-y-5">
                                                <div className="flex flex-col items-center text-center">
                                                    <SparklesIcon className="h-8 w-8 text-red-500 mb-3" />
                                                    <Dialog.Title as="h3" className="text-xl font-bold text-foreground">
                                                        Final Confirmation
                                                    </Dialog.Title>
                                                    <p className="mt-2 text-sm cc-muted">
                                                        One last check before we proceed.
                                                    </p>
                                                </div>

                                                <div className="p-4 rounded-2xl border border-red-500/10 bg-red-500/5">
                                                    {(deleteDialog.isDormClub || deleteDialog.isDefaultClub) ? (
                                                        <p className="text-[13px] text-foreground leading-relaxed text-center">
                                                            This club will be <span className="font-bold text-red-500">Hidden</span>. It will vanish from search but stay active for existing members.
                                                        </p>
                                                    ) : (
                                                        <p className="text-[13px] text-foreground leading-relaxed text-center">
                                                            This club and all its history will be <span className="font-bold text-red-500">Permanently Erased</span>. This cannot be undone.
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="flex justify-between gap-3 pt-2">
                                                    <button
                                                        type="button"
                                                        className="rounded-full px-5 py-2 text-sm font-medium cc-muted hover:text-foreground transition-all"
                                                        onClick={() => setDeleteDialog(prev => ({ ...prev, step: 2 }))}
                                                    >
                                                        Back
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="rounded-full px-7 py-2 text-sm font-black text-white bg-red-500 shadow-lg shadow-red-500/10 hover:opacity-90 transition-all"
                                                        onClick={handleDeleteConfirm}
                                                    >
                                                        {(deleteDialog.isDefaultClub || deleteDialog.isDormClub) ? 'Hide Safely' : 'Delete Permanently'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>

            <Toast toast={toast} onClear={() => setToast(null)} />
        </div>
    );
}
