"use client";

import { useState, useEffect, useMemo } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, orderBy, getDocs, doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { CheckCircleIcon, EyeSlashIcon, XMarkIcon, EllipsisVerticalIcon, ChevronDownIcon, CheckBadgeIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { formatDistanceToNow } from "date-fns";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import type { ModerationQueueItem } from "@/lib/types/moderation";
import type { Post } from "@/lib/posts";
import type { Club } from "@/lib/clubs";
import { useAdminMode } from "@/components/admin-mode-context";
import { useRightSidebar } from "@/components/right-sidebar-context";
import { UserRow } from "@/components/user-row";
import { ClubProfileView } from "@/components/clubs/club-profile-view";
import { ClubTab } from "@/components/clubs/club-tabs";
import { getCampusOrLegacy } from "@/lib/firestore-paths";
import { Campus } from "@/lib/types/campus";

type ViewMode = "requests" | "reports";
type ReportTab = "posts" | "profiles" | "clubs";

interface ReportData {
    username: string;
    uid: string;
    reason: string;
    details: string;
    createdAt: any;
}

// Reusing Campus type partially or mapping to it
interface CampusData {
    id: string;
    name: string;
    shortName: string;
    logo?: string;
}

interface QueueItemWithPost extends ModerationQueueItem {
    id: string;
    post?: Post | null;
    reporters?: string[];
    reportsData?: ReportData[];
    campus?: CampusData | null;
}

export default function ModerationPage() {
    const { isGlobalAdminUser, adminModeOn } = useAdminMode();
    const { openView } = useRightSidebar();
    const router = useRouter();

    // Top Level View State
    const [viewMode, setViewMode] = useState<ViewMode>("requests");

    // Reports State
    const [activeReportTab, setActiveReportTab] = useState<ReportTab>("posts");
    const [queueItems, setQueueItems] = useState<QueueItemWithPost[]>([]);
    const [reportsLoading, setReportsLoading] = useState(true);
    const [reportsError, setReportsError] = useState<string | null>(null);
    const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
    const [selectedCampus, setSelectedCampus] = useState<string>("all");
    const [isCampusDropdownOpen, setIsCampusDropdownOpen] = useState(false);

    const [pendingClubs, setPendingClubs] = useState<Club[]>([]);
    const [clubsLoading, setClubsLoading] = useState(true);
    const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
    const [activeClubTab, setActiveClubTab] = useState<ClubTab>("about");

    // Admin Context
    const [userCampusId, setUserCampusId] = useState<string | null>(null);
    const [isCampusAdmin, setIsCampusAdmin] = useState(false);

    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        type: "restore" | "hide" | "dismiss" | null;
        item: QueueItemWithPost | null;
        note: string;
    }>({
        isOpen: false,
        type: null,
        item: null,
        note: ""
    });

    // 1. Fetch User Campus & Admin Type
    useEffect(() => {
        const fetchUserCampus = async () => {
            const user = auth.currentUser;
            if (!user) return;

            try {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    const campusId = userDoc.data().campusId || userDoc.data().universityId;
                    setUserCampusId(campusId || null);

                    const isCampus = !!(campusId && !isGlobalAdminUser);
                    setIsCampusAdmin(isCampus);

                    if (isCampus && campusId) {
                        setSelectedCampus(campusId);
                    }
                }
            } catch (err) {
                console.error("Error fetching user campus:", err);
            }
        };

        fetchUserCampus();
    }, [isGlobalAdminUser]);

    // 2. Fetch Club Requests
    const fetchPendingClubs = async () => {
        setClubsLoading(true);
        try {
            const q = query(collection(db, "clubs"), where("verificationStatus", "==", "pending"));
            const snapshot = await getDocs(q);
            const clubs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Club));
            setPendingClubs(clubs);
            if (clubs.length > 0 && !selectedClubId) {
                setSelectedClubId(clubs[0].id);
            }
        } catch (error) {
            console.error("Error fetching pending clubs:", error);
        } finally {
            setClubsLoading(false);
        }
    };

    useEffect(() => {
        if (viewMode === "requests") {
            fetchPendingClubs();
        }
    }, [viewMode]);

    const handleClubAction = async (clubId: string, action: 'approve' | 'reject') => {
        try {
            const updates = action === 'approve'
                ? { verificationStatus: 'approved', isVerified: true, verifiedAt: serverTimestamp() }
                : { verificationStatus: 'rejected', isVerified: false };

            await updateDoc(doc(db, "clubs", clubId), updates);
            setPendingClubs(prev => {
                const updated = prev.filter(c => c.id !== clubId);
                // If we approved/rejected the selected club, select the next one if available
                if (selectedClubId === clubId) {
                    setSelectedClubId(updated.length > 0 ? updated[0].id : null);
                }
                return updated;
            });
            alert(`Club ${action}d successfully.`);
        } catch (error) {
            console.error(`Error ${action}ing club:`, error);
            alert(`Failed to ${action} club.`);
        }
    };

    // 3. Fetch Moderation Queue (Reports)
    useEffect(() => {
        if (viewMode !== "reports") return;
        if (activeReportTab !== "posts") return;

        const loadQueue = async () => {
            setReportsLoading(true);
            setReportsError(null);

            try {
                const queueRef = collection(db, "moderationQueue");
                const q = query(
                    queueRef,
                    where("targetType", "==", "post"),
                    where("state", "==", "needs_review"),
                    orderBy("createdAt", "desc")
                );

                const snapshot = await getDocs(q);
                const items: QueueItemWithPost[] = [];

                for (const queueDoc of snapshot.docs) {
                    const queueData = queueDoc.data() as ModerationQueueItem;
                    const postId = queueData.targetId;

                    let post: Post | null = null;
                    let reporters: string[] = [];
                    let reportsData: ReportData[] = [];
                    let campus: CampusData | null = null;

                    try {
                        const postDoc = await getDoc(doc(db, "posts", postId));
                        if (postDoc.exists()) {
                            post = { id: postDoc.id, ...postDoc.data() } as Post;
                        }

                        const reportsSnapshot = await getDocs(collection(db, "posts", postId, "reports"));
                        const rawReports = reportsSnapshot.docs.map(d => ({
                            uid: d.data().reporterUid,
                            reason: d.data().reason || "No reason provided",
                            details: d.data().details || "",
                            createdAt: d.data().createdAt
                        })).filter(r => r.uid);

                        reportsData = await Promise.all(
                            rawReports.map(async (report) => {
                                try {
                                    const userDoc = await getDoc(doc(db, "users", report.uid));
                                    const username = userDoc.exists() ? userDoc.data().username || "Unknown" : "Unknown";
                                    return {
                                        username,
                                        uid: report.uid,
                                        reason: report.reason,
                                        details: report.details,
                                        createdAt: report.createdAt
                                    };
                                } catch {
                                    return {
                                        username: "Unknown",
                                        uid: report.uid,
                                        reason: report.reason,
                                        details: report.details,
                                        createdAt: report.createdAt
                                    };
                                }
                            })
                        );
                        reporters = reportsData.map(r => r.username);

                        if (post && post.authorId) {
                            try {
                                const authorDoc = await getDoc(doc(db, "users", post.authorId));
                                if (authorDoc.exists()) {
                                    const cId = authorDoc.data().campusId || authorDoc.data().universityId;
                                    if (cId) {
                                        // Use helper
                                        const cData = await getCampusOrLegacy(cId);
                                        if (cData) {
                                            campus = {
                                                id: cData.id,
                                                name: cData.name || "",
                                                shortName: cData.shortName || "",
                                                logo: undefined // Logo handling might be tricky with legacy paths, but keeping undefined is safe for now if not critical
                                            };
                                        }
                                    }
                                }
                            } catch (uniErr) {
                                console.error(`Failed to fetch campus for post ${postId}: `, uniErr);
                            }
                        }
                    } catch (err) {
                        console.error(`Failed to fetch data for post ${postId}: `, err);
                    }

                    items.push({
                        id: queueDoc.id,
                        ...queueData,
                        post,
                        reporters,
                        reportsData,
                        campus,
                    });
                }

                setQueueItems(items);
            } catch (err: any) {
                console.error("Error loading moderation queue:", err);
                setReportsError(err.message || "Failed to load moderation queue");
            } finally {
                setReportsLoading(false);
            }
        };

        loadQueue();
    }, [viewMode, activeReportTab]);

    // Computed Values
    const availableCampuses = useMemo(() => {
        const camps = new Map<string, CampusData>();
        queueItems.forEach(item => {
            if (item.campus && item.campus.shortName) {
                camps.set(item.campus.id, item.campus);
            }
        });
        return Array.from(camps.values()).sort((a, b) =>
            a.shortName.localeCompare(b.shortName)
        );
    }, [queueItems]);

    const sortedQueueItems = useMemo(() => {
        let filtered = selectedCampus !== "all"
            ? queueItems.filter(item => item.campus?.id === selectedCampus)
            : queueItems;

        return [...filtered].sort((a, b) => {
            const reportDiff = (b.reportsData?.length || 0) - (a.reportsData?.length || 0);
            if (reportDiff !== 0) return reportDiff;

            if (a.createdAt && b.createdAt) {
                return a.createdAt.toMillis() - b.createdAt.toMillis();
            }
            return 0;
        });
    }, [queueItems, selectedCampus]);

    const selectedClub = useMemo(() =>
        selectedClubId ? pendingClubs.find(c => c.id === selectedClubId) : null
        , [pendingClubs, selectedClubId]);

    const handleAction = (item: QueueItemWithPost, action: "restore" | "hide" | "dismiss") => {
        setConfirmModal({
            isOpen: true,
            type: action,
            item: item,
            note: ""
        });
    };

    const executeModerationAction = async () => {
        const { item, type, note } = confirmModal;
        if (!item || !type) return;

        if ((type === "hide" || type === "restore") && (!note || note.trim().length === 0)) {
            return;
        }

        setProcessingIds(prev => new Set(prev).add(item.id));
        setConfirmModal(prev => ({ ...prev, isOpen: false }));

        try {
            const moderatePost = httpsCallable(functions, "moderatePost");
            await moderatePost({
                postId: item.targetId,
                action: type,
                ...((note && note.trim().length > 0) && { note: note.trim() })
            });

            setQueueItems(prev => prev.filter(i => i.id !== item.id));
        } catch (err: any) {
            console.error(`Error performing ${type}: `, err);
            alert(`Failed to ${type} post: ${err.message}`);
        } finally {
            setProcessingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(item.id);
                return newSet;
            });
            setConfirmModal({ isOpen: false, type: null, item: null, note: "" });
        }
    };

    if (!isGlobalAdminUser || !adminModeOn) {
        return (
            <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="mb-6">
                        <h1 className="text-6xl font-bold text-white/20 mb-2">404</h1>
                        <h2 className="text-2xl font-semibold text-white mb-2">No Access</h2>
                        <p className="text-neutral-400">You do not have the right to access this page.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-64px)] text-white flex flex-col">
            {/* Modal */}
            {confirmModal.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
                        onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                    ></div>
                    <div className="relative w-full max-w-md bg-[#121212]/80 backdrop-blur-[50px] border border-white/10 rounded-[24px] shadow-2xl p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-200 ring-1 ring-white/5">
                        <div className="flex flex-col gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-white mb-1">
                                    {confirmModal.type === "restore" && "Restore Post"}
                                    {confirmModal.type === "hide" && "Hide Post"}
                                    {confirmModal.type === "dismiss" && "Dismiss Reports"}
                                </h3>
                                <p className="text-neutral-400 text-[13px] leading-relaxed">
                                    {confirmModal.type === "restore" && "Are you sure you want to restore this post? This will remove all reports and place it back in the feed."}
                                    {confirmModal.type === "hide" && "This post will be hidden from everyone except the author. A reason is required."}
                                    {confirmModal.type === "dismiss" && "This will clear all reports on the post without taking further action."}
                                </p>
                            </div>

                            {(confirmModal.type === "restore" || confirmModal.type === "hide") && (
                                <div className="space-y-2">
                                    <label className="block text-xs font-medium text-neutral-500 ml-1">
                                        Reason (Required)
                                    </label>
                                    <textarea
                                        autoFocus
                                        value={confirmModal.note}
                                        onChange={(e) => setConfirmModal(prev => ({ ...prev, note: e.target.value }))}
                                        placeholder={confirmModal.type === "hide" ? "Why is this post being hidden?" : "Why is this post being restored?"}
                                        className="w-full bg-white/5 border border-white/10 rounded-[16px] p-3 text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/10 focus:border-white/20 min-h-[100px] resize-none transition-all"
                                    />
                                </div>
                            )}

                            <div className="flex gap-3 justify-end mt-2">
                                <button
                                    onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                                    className="px-5 py-2.5 rounded-full text-xs font-medium text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={executeModerationAction}
                                    disabled={(confirmModal.type === "restore" || confirmModal.type === "hide") && !confirmModal.note.trim()}
                                    className={`px-6 py-2.5 rounded-full text-xs font-bold text-black transition-all shadow-lg ${(confirmModal.type === "restore" || confirmModal.type === "hide") && !confirmModal.note.trim()
                                        ? "bg-white/20 cursor-not-allowed opacity-50"
                                        : "bg-white hover:bg-neutral-200 hover:scale-[1.02] active:scale-[0.98]"
                                        }`}
                                >
                                    Confirm {confirmModal.type === "hide" ? "Hide" : confirmModal.type === "restore" ? "Restore" : "Dismiss"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header / Nav */}
            <div className={`pt-8 md:pt-4 px-8 pb-0 shrink-0 transition-all duration-300`}>
                <div className="mb-6">
                    <h1 className="text-3xl font-bold mb-2">Moderation</h1>
                    <p className="text-neutral-400">Manage reported content and requests.</p>
                </div>

                <div className="flex gap-8 border-b border-white/10">
                    <button
                        onClick={() => setViewMode("requests")}
                        className={`pb-4 text-sm font-semibold transition-colors relative ${viewMode === "requests" ? "text-white" : "text-neutral-500 hover:text-neutral-300"}`}
                    >
                        Club Requests
                        {viewMode === "requests" && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ffb200]" />
                        )}
                    </button>
                    <button
                        onClick={() => setViewMode("reports")}
                        className={`pb-4 text-sm font-semibold transition-colors relative ${viewMode === "reports" ? "text-white" : "text-neutral-500 hover:text-neutral-300"}`}
                    >
                        Reports
                        {viewMode === "reports" && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ffb200]" />
                        )}
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex min-h-0 overflow-hidden px-8 pt-6">
                {viewMode === "requests" && (
                    <div className="w-full h-full flex gap-8 relative">
                        {/* Requests Sidebar */}
                        <div className="hidden md:flex flex-col sticky top-0 w-64 pt-4 px-2 bg-white/[0.02] border border-white/5 rounded-[1.8rem] h-fit max-h-[calc(100vh-120px)] z-10 overflow-hidden">
                            <div className="px-4 py-2 mb-2">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Pending Requests</h3>
                            </div>
                            <div className="overflow-y-auto custom-scrollbar flex-1 space-y-1 pb-2">
                                {clubsLoading ? (
                                    <div className="px-4 py-4 text-center">
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-[#ffb200] mx-auto" />
                                    </div>
                                ) : pendingClubs.length === 0 ? (
                                    <div className="px-4 py-8 text-center text-sm text-neutral-500">
                                        No pending requests
                                    </div>
                                ) : (
                                    pendingClubs.map(club => (
                                        <button
                                            key={club.id}
                                            onClick={() => setSelectedClubId(club.id)}
                                            className={`w-full text-left px-3 py-2 rounded-[1.2rem] flex items-center gap-3 transition-all ${selectedClub?.id === club.id
                                                ? "bg-white/10 shadow-sm"
                                                : "hover:bg-white/5"
                                                }`}
                                        >
                                            <div className="h-8 w-8 rounded-full overflow-hidden shrink-0 bg-neutral-800 border border-white/5">
                                                {club.profileImageUrl ? (
                                                    <img src={club.profileImageUrl} alt={club.name} className="h-full w-full object-cover" />
                                                ) : (
                                                    <div className="h-full w-full flex items-center justify-center text-[10px] font-bold text-neutral-500">
                                                        {club.name.charAt(0)}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className={`text-sm font-medium truncate ${selectedClub?.id === club.id ? "text-white" : "text-neutral-300"}`}>
                                                    {club.name}
                                                </p>
                                                <p className="text-[10px] text-neutral-500 truncate">
                                                    {formatDistanceToNow(club.createdAt?.toDate?.() || new Date(), { addSuffix: true })}
                                                </p>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Requests Detail Content */}
                        <div className="flex-1 overflow-y-auto min-w-0 p-0 py-2 custom-scrollbar">
                            <div className="max-w-4xl mx-auto">
                                {selectedClub ? (
                                    <div className="space-y-6 animate-in fade-in duration-300">
                                        {/* Moderation Actions Banner */}
                                        <div className="flex items-center justify-between p-4 rounded-[24px] bg-[#ffb200]/10 border border-[#ffb200]/20 mb-6">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-[#ffb200]/20 flex items-center justify-center">
                                                    <CheckBadgeIcon className="h-6 w-6 text-[#ffb200]" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-white text-sm">Pending Verification</p>
                                                    <p className="text-neutral-400 text-xs text-wrap max-w-sm">Review this club's details and decide whether to approve it for the campus.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => handleClubAction(selectedClub.id, 'reject')}
                                                    className="px-5 py-2.5 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500/20 font-medium text-sm transition-colors flex items-center gap-2"
                                                >
                                                    <XMarkIcon className="h-5 w-5" />
                                                    Reject
                                                </button>
                                                <button
                                                    onClick={() => handleClubAction(selectedClub.id, 'approve')}
                                                    className="px-5 py-2.5 rounded-full bg-[#ffb200] text-black hover:bg-[#ffb200]/80 font-bold text-sm transition-all shadow-lg hover:shadow-[#ffb200]/20 hover:scale-105 active:scale-95 flex items-center gap-2"
                                                >
                                                    <CheckBadgeIcon className="h-5 w-5" />
                                                    Approve Club
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <ClubProfileView clubId={selectedClub.id} isModerationMode={true} />
                                        </div>
                                    </div>
                                ) : (<div className="flex flex-col items-center justify-center py-20 text-neutral-500">
                                    <UserGroupIcon className="h-16 w-16 mb-4 opacity-20" />
                                    <p className="text-lg font-medium">Select a club to view details</p>
                                </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {viewMode === "reports" && (
                    <div className="w-full h-full flex gap-8 relative">
                        {/* Reports Sidebar - Sticky Inline */}
                        <div className="hidden md:flex flex-col sticky top-0 w-64 pt-4 px-2 bg-white/[0.02] border border-white/5 rounded-[1.8rem] h-fit z-10">
                            <div className="space-y-1 mb-2">
                                <button
                                    onClick={() => setActiveReportTab("posts")}
                                    className={`w-full text-left px-4 py-3 rounded-[1.2rem] text-sm font-medium transition-all ${activeReportTab === "posts"
                                        ? "bg-white/10 text-white shadow-sm"
                                        : "text-neutral-400 hover:text-white hover:bg-white/5"
                                        }`}
                                >
                                    Posts
                                </button>
                                <button
                                    disabled
                                    className="w-full text-left px-4 py-3 rounded-[1.2rem] text-sm font-medium transition-all text-neutral-600 cursor-not-allowed flex justify-between items-center"
                                >
                                    Profiles
                                    <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-neutral-500">Soon</span>
                                </button>
                                <button
                                    disabled
                                    className="w-full text-left px-4 py-3 rounded-[1.2rem] text-sm font-medium transition-all text-neutral-600 cursor-not-allowed flex justify-between items-center"
                                >
                                    Clubs
                                    <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-neutral-500">Soon</span>
                                </button>
                            </div>
                        </div>

                        {/* Reports Content */}
                        <div className="flex-1 overflow-y-auto min-w-0 p-0 py-2 custom-scrollbar">
                            <div className="max-w-4xl mx-auto">
                                {/* Campus Filter for Reports */}
                                {availableCampuses.length > 0 && (
                                    <div className="mb-6 flex gap-3 items-center">
                                        <label className="text-sm font-medium text-neutral-400">Filter:</label>
                                        {isCampusAdmin ? (
                                            <div className="px-4 py-2.5 rounded-[14px] bg-white/5 border border-white/10 text-white backdrop-blur-xl shadow-lg cursor-default flex items-center gap-2">
                                                <span className="font-semibold text-[#ffb200]">
                                                    {availableCampuses.find(u => u.id === userCampusId)?.shortName || "Your Campus"}
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="relative z-20">
                                                <button
                                                    onClick={() => setIsCampusDropdownOpen(!isCampusDropdownOpen)}
                                                    className={`appearance-none pl-3 pr-8 py-2 rounded-full bg-white/5 border border-white/10 text-white text-xs font-medium backdrop-blur-[12px] hover:bg-white/10 transition-all focus:outline-none focus:ring-2 focus:ring-[#ffb200]/50 cursor-pointer min-w-[180px] text-left relative overflow-hidden group ${isCampusDropdownOpen ? 'bg-white/10' : ''}`}
                                                >
                                                    <span className="block truncate flex items-center gap-2 relative z-10">
                                                        {selectedCampus === "all"
                                                            ? "All Campuses"
                                                            : availableCampuses.find(u => u.id === selectedCampus)?.name || "Select Campus"
                                                        }
                                                    </span>
                                                    <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-white/50 group-hover:text-white transition-colors duration-300">
                                                        <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform duration-500 ${isCampusDropdownOpen ? 'rotate-180' : ''}`} />
                                                    </span>
                                                </button>

                                                {isCampusDropdownOpen && (
                                                    <>
                                                        <div className="fixed inset-0 z-10 cursor-default" onClick={() => setIsCampusDropdownOpen(false)} />
                                                        <div className="absolute left-0 mt-2 w-full min-w-[220px] max-h-[260px] overflow-y-auto rounded-[20px] bg-[#121212]/95 backdrop-blur-xl border border-white/10 shadow-2xl z-30 p-1.5 custom-scrollbar">
                                                            <button
                                                                onClick={() => { setSelectedCampus("all"); setIsCampusDropdownOpen(false); }}
                                                                className="w-full px-3 py-2.5 text-left text-[13px] font-medium rounded-full hover:bg-white/10 text-neutral-300 hover:text-white transition-all"
                                                            >
                                                                All Campuses
                                                            </button>
                                                            <div className="h-px bg-white/10 my-1.5 mx-3" />
                                                            {availableCampuses.map(camp => (
                                                                <button
                                                                    key={camp.id}
                                                                    onClick={() => { setSelectedCampus(camp.id); setIsCampusDropdownOpen(false); }}
                                                                    className="w-full px-3 py-2.5 text-left text-[13px] rounded-full hover:bg-white/10 text-neutral-300 hover:text-white transition-all flex items-center gap-2"
                                                                >
                                                                    {camp.logo ? <img src={camp.logo} className="w-5 h-5 object-contain" /> : <span className="text-[#ffb200] font-bold text-xs">{camp.shortName}</span>}
                                                                    <span className="truncate">{camp.name}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {reportsLoading ? (
                                    <div className="space-y-4">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="animate-pulse">
                                                <div className="rounded-2xl bg-neutral-900/50 p-6 h-32" />
                                            </div>
                                        ))}
                                    </div>
                                ) : reportsError ? (
                                    <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-6">
                                        <p className="text-red-400 mb-4">{reportsError}</p>
                                    </div>
                                ) : sortedQueueItems.length === 0 ? (
                                    <div className="text-center py-16">
                                        <CheckCircleIcon className="h-16 w-16 text-green-400 mx-auto mb-4" />
                                        <p className="text-xl text-neutral-300">No content reports found.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {sortedQueueItems.map(item => (
                                            <ModerationQueueItem
                                                key={item.id}
                                                item={item}
                                                onAction={handleAction}
                                                isProcessing={processingIds.has(item.id)}
                                                onReportClick={(report) => openView("report-details", report)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Subcomponent: ModerationQueueItem (Kept as is, simplified logic slightly for brevity where possible, largely identical)
interface ModerationQueueItemProps {
    item: QueueItemWithPost;
    onAction: (item: QueueItemWithPost, action: "restore" | "hide" | "dismiss") => void;
    isProcessing: boolean;
    onReportClick: (report: ReportData) => void;
}

function ModerationQueueItem({ item, onAction, isProcessing, onReportClick }: ModerationQueueItemProps) {
    const post = item.post;
    const router = useRouter();
    const [showMenu, setShowMenu] = useState(false);
    const [showAllReporters, setShowAllReporters] = useState(false);
    const INITIAL_REPORTERS_SHOWN = 3;

    return (
        <div className="rounded-2xl bg-neutral-900/50 border border-white/10 p-6 hover:border-white/20 transition-colors">
            <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                        <span className="text-sm font-bold text-red-400">
                            {item.reportsData?.length || 0} {(item.reportsData?.length || 0) === 1 ? "report" : "reports"}
                        </span>
                        {post?.visibility && (
                            <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${post.visibility === "under_review" ? "bg-yellow-500/20 text-yellow-400" : "bg-neutral-500/20 text-neutral-400"}`}>
                                {post.visibility === "under_review" ? "Under Review" : post.visibility}
                            </span>
                        )}
                        {item.createdAt && (
                            <span className="text-xs text-neutral-500">
                                {formatDistanceToNow(item.createdAt.toDate(), { addSuffix: true })}
                            </span>
                        )}
                        {item.campus && (
                            item.campus.logo ? (
                                <img
                                    src={item.campus.logo}
                                    alt={item.campus.shortName}
                                    className="w-5 h-5 object-contain"
                                    title={item.campus.name}
                                />
                            ) : (
                                item.campus.shortName && (
                                    <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-400 text-xs font-medium">
                                        {item.campus.shortName}
                                    </span>
                                )
                            )
                        )}
                    </div>

                    {post ? (
                        <button
                            onClick={() => router.push(`/posts/${post.id}`)}
                            className="inline-flex items-center gap-1 text-sm text-[#ffb200] hover:text-[#ffa000] transition-colors font-medium"
                        >
                            View full post →
                        </button>
                    ) : (
                        <p className="text-sm text-neutral-500 italic">Post not found or deleted</p>
                    )}

                    {item.reportsData && item.reportsData.length > 0 && (
                        <div className="mt-3">
                            <p className="text-xs text-neutral-500 mb-1">Reported by:</p>
                            <div className="flex flex-wrap gap-2">
                                {(showAllReporters ? item.reportsData : item.reportsData.slice(0, INITIAL_REPORTERS_SHOWN)).map((report, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => onReportClick(report)}
                                        className="px-2 py-1 rounded-full bg-neutral-800 text-xs text-neutral-300 hover:bg-neutral-700 transition-colors cursor-pointer"
                                    >
                                        @{report.username}
                                    </button>
                                ))}
                                {item.reportsData.length > INITIAL_REPORTERS_SHOWN && (
                                    <button
                                        onClick={() => setShowAllReporters(!showAllReporters)}
                                        className="px-2 py-1 rounded-full bg-neutral-700/50 text-xs text-neutral-400 hover:bg-neutral-700 hover:text-neutral-300 transition-colors"
                                    >
                                        {showAllReporters ? 'Show less' : `+ ${item.reportsData.length - INITIAL_REPORTERS_SHOWN} more`}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {item.reasonsBreakdown && Object.keys(item.reasonsBreakdown).length > 0 && (
                        <div className="mt-3">
                            <p className="text-xs text-neutral-500 mb-1">Reasons:</p>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(item.reasonsBreakdown).map(([reason, count]) => (
                                    <span key={reason} className="px-2 py-1 rounded-md bg-red-500/10 text-xs text-red-400">
                                        {reason}: {count}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="relative">
                    <button
                        onClick={() => setShowMenu(!showMenu)}
                        className={`p-2.5 rounded-full transition-all duration-300 ${showMenu ? "bg-white/20 text-white" : "bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white"}`}
                    >
                        <EllipsisVerticalIcon className="h-6 w-6" />
                    </button>
                    {showMenu && (
                        <>
                            <div className="fixed inset-0 z-40 cursor-default" onClick={() => setShowMenu(false)} />
                            <div className="absolute right-0 mt-3 w-[220px] rounded-[20px] bg-[#121212]/95 backdrop-blur-xl border border-white/10 shadow-2xl z-50 overflow-hidden p-1.5 flex flex-col gap-1">
                                <button
                                    onClick={() => { setShowMenu(false); onAction(item, "restore"); }}
                                    disabled={isProcessing || !post}
                                    className="w-full px-3 py-2.5 text-left flex items-center gap-2.5 text-neutral-200 hover:bg-white/10 rounded-full disabled:opacity-40"
                                >
                                    <CheckCircleIcon className="h-5 w-5 text-green-400" />
                                    Restore
                                </button>
                                <button
                                    onClick={() => { setShowMenu(false); onAction(item, "hide"); }}
                                    disabled={isProcessing || !post}
                                    className="w-full px-3 py-2.5 text-left flex items-center gap-2.5 text-neutral-200 hover:bg-white/10 rounded-full disabled:opacity-40"
                                >
                                    <EyeSlashIcon className="h-5 w-5 text-yellow-500" />
                                    Hide from Feed
                                </button>
                                <button
                                    onClick={() => { setShowMenu(false); onAction(item, "dismiss"); }}
                                    disabled={isProcessing}
                                    className="w-full px-3 py-2.5 text-left flex items-center gap-2.5 text-neutral-200 hover:bg-white/10 rounded-full disabled:opacity-40"
                                >
                                    <XMarkIcon className="h-5 w-5 text-neutral-400" />
                                    Dismiss Reports
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
