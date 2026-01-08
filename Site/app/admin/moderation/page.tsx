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
    const { isGlobalAdminUser, isCampusAdminUser, adminModeOn } = useAdminMode();
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

    const isAdmin = isGlobalAdminUser || isCampusAdminUser;

    if (!isAdmin || !adminModeOn) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="mb-6">
                        <h1 className="text-6xl font-bold text-secondary/20 mb-2">404</h1>
                        <h2 className="text-2xl font-semibold text-foreground mb-2">No Access</h2>
                        <p className="text-secondary">You do not have the right to access this page.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-64px)] text-foreground flex flex-col">
            {/* Modal */}
            {confirmModal.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div
                        className="fixed inset-0 bg-background/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
                        onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                    ></div>
                    <div className="relative w-full max-w-md bg-popover/95 backdrop-blur-xl border border-secondary/20 rounded-[24px] shadow-2xl p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-200 ring-1 ring-secondary/10">
                        <div className="flex flex-col gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-foreground mb-1">
                                    {confirmModal.type === "restore" && "Restore Post"}
                                    {confirmModal.type === "hide" && "Hide Post"}
                                    {confirmModal.type === "dismiss" && "Dismiss Reports"}
                                </h3>
                                <p className="text-secondary text-[13px] leading-relaxed">
                                    {confirmModal.type === "restore" && "Are you sure you want to restore this post? This will remove all reports and place it back in the feed."}
                                    {confirmModal.type === "hide" && "This post will be hidden from everyone except the author. A reason is required."}
                                    {confirmModal.type === "dismiss" && "This will clear all reports on the post without taking further action."}
                                </p>
                            </div>

                            {(confirmModal.type === "restore" || confirmModal.type === "hide") && (
                                <div className="space-y-2">
                                    <label className="block text-xs font-medium text-secondary/80 ml-1">
                                        Reason (Required)
                                    </label>
                                    <textarea
                                        autoFocus
                                        value={confirmModal.note}
                                        onChange={(e) => setConfirmModal(prev => ({ ...prev, note: e.target.value }))}
                                        placeholder={confirmModal.type === "hide" ? "Why is this post being hidden?" : "Why is this post being restored?"}
                                        className="w-full bg-secondary/10 border border-secondary/20 rounded-[16px] p-3 text-foreground text-sm placeholder:text-secondary/60 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/50 min-h-[100px] resize-none transition-all"
                                    />
                                </div>
                            )}

                            <div className="flex gap-3 justify-end mt-2">
                                <button
                                    onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                                    className="px-5 py-2.5 rounded-full text-xs font-medium text-secondary hover:text-foreground hover:bg-secondary/10 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={executeModerationAction}
                                    disabled={(confirmModal.type === "restore" || confirmModal.type === "hide") && !confirmModal.note.trim()}
                                    className={`px-6 py-2.5 rounded-full text-xs font-bold transition-all shadow-lg text-brand-foreground ${(confirmModal.type === "restore" || confirmModal.type === "hide") && !confirmModal.note.trim()
                                        ? "bg-secondary/20 cursor-not-allowed opacity-50 text-secondary"
                                        : "bg-brand hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]"
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
                    <h1 className="text-3xl font-bold mb-2 text-foreground">Moderation</h1>
                    <p className="text-secondary">Manage reported content and requests.</p>
                </div>

                <div className="flex gap-8 border-b border-secondary/20">
                    <button
                        onClick={() => setViewMode("requests")}
                        className={`pb-4 text-sm font-semibold transition-colors relative ${viewMode === "requests" ? "text-foreground" : "text-secondary hover:text-secondary/80"}`}
                    >
                        Club Requests
                        {viewMode === "requests" && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand" />
                        )}
                    </button>
                    <button
                        onClick={() => setViewMode("reports")}
                        className={`pb-4 text-sm font-semibold transition-colors relative ${viewMode === "reports" ? "text-foreground" : "text-secondary hover:text-secondary/80"}`}
                    >
                        Reports
                        {viewMode === "reports" && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand" />
                        )}
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex min-h-0 overflow-hidden px-8 pt-6">
                {viewMode === "requests" && (
                    <div className="w-full h-full flex gap-8 relative">
                        {/* Requests Sidebar */}
                        <div className="hidden md:flex flex-col sticky top-0 w-64 pt-4 px-2 bg-card border border-secondary/15 rounded-[1.8rem] h-fit max-h-[calc(100vh-120px)] z-10 overflow-hidden">
                            <div className="px-4 py-2 mb-2">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-secondary">Pending Requests</h3>
                            </div>
                            <div className="overflow-y-auto custom-scrollbar flex-1 space-y-1 pb-2">
                                {clubsLoading ? (
                                    <div className="px-4 py-4 text-center">
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-secondary/30 border-t-brand mx-auto" />
                                    </div>
                                ) : pendingClubs.length === 0 ? (
                                    <div className="px-4 py-8 text-center text-sm text-secondary">
                                        No pending requests
                                    </div>
                                ) : (
                                    pendingClubs.map(club => (
                                        <button
                                            key={club.id}
                                            onClick={() => setSelectedClubId(club.id)}
                                            className={`w-full text-left px-3 py-2 rounded-[1.2rem] flex items-center gap-3 transition-all ${selectedClub?.id === club.id
                                                ? "bg-secondary/15 shadow-sm"
                                                : "hover:bg-secondary/10"
                                                }`}
                                        >
                                            <div className="h-8 w-8 rounded-full overflow-hidden shrink-0 bg-secondary/10 border border-secondary/20">
                                                {club.profileImageUrl ? (
                                                    <img src={club.profileImageUrl} alt={club.name} className="h-full w-full object-cover object-center" />
                                                ) : (
                                                    <div className="h-full w-full flex items-center justify-center text-[10px] font-bold text-secondary">
                                                        {club.name.charAt(0)}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className={`text-sm font-medium truncate ${selectedClub?.id === club.id ? "text-foreground" : "text-secondary"}`}>
                                                    {club.name}
                                                </p>
                                                <p className="text-[10px] text-secondary/70 truncate">
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
                                        <div className="flex items-center justify-between p-4 rounded-[24px] bg-brand/10 border border-brand/20 mb-6">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-brand/20 flex items-center justify-center">
                                                    <CheckBadgeIcon className="h-6 w-6 text-brand" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-foreground text-sm">Pending Verification</p>
                                                    <p className="text-secondary text-xs text-wrap max-w-sm">Review this club's details and decide whether to approve it for the campus.</p>
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
                                                    className="px-5 py-2.5 rounded-full bg-brand text-brand-foreground hover:brightness-110 font-bold text-sm transition-all shadow-lg hover:shadow-brand/20 hover:scale-105 active:scale-95 flex items-center gap-2"
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
                                ) : (<div className="flex flex-col items-center justify-center py-20 text-secondary">
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
                        <div className="hidden md:flex flex-col sticky top-0 w-64 pt-4 px-2 bg-card border border-secondary/15 rounded-[1.8rem] h-fit z-10">
                            <div className="space-y-1 mb-2">
                                <button
                                    onClick={() => setActiveReportTab("posts")}
                                    className={`w-full text-left px-4 py-3 rounded-[1.2rem] text-sm font-medium transition-all ${activeReportTab === "posts"
                                        ? "bg-secondary/15 text-foreground shadow-sm"
                                        : "text-secondary hover:text-foreground hover:bg-secondary/10"
                                        }`}
                                >
                                    Posts
                                </button>
                                <button
                                    disabled
                                    className="w-full text-left px-4 py-3 rounded-[1.2rem] text-sm font-medium transition-all text-secondary/50 cursor-not-allowed flex justify-between items-center"
                                >
                                    Profiles
                                    <span className="text-[10px] bg-secondary/10 px-1.5 py-0.5 rounded text-secondary">Soon</span>
                                </button>
                                <button
                                    disabled
                                    className="w-full text-left px-4 py-3 rounded-[1.2rem] text-sm font-medium transition-all text-secondary/50 cursor-not-allowed flex justify-between items-center"
                                >
                                    Clubs
                                    <span className="text-[10px] bg-secondary/10 px-1.5 py-0.5 rounded text-secondary">Soon</span>
                                </button>
                            </div>
                        </div>

                        {/* Reports Content */}
                        <div className="flex-1 overflow-y-auto min-w-0 p-0 py-2 custom-scrollbar">
                            <div className="max-w-4xl mx-auto">
                                {/* Campus Filter for Reports */}
                                {availableCampuses.length > 0 && (
                                    <div className="mb-6 flex gap-3 items-center">
                                        <label className="text-sm font-medium text-secondary">Filter:</label>
                                        {isCampusAdmin ? (
                                            <div className="px-4 py-2.5 rounded-[14px] bg-card border border-secondary/20 text-foreground backdrop-blur-xl shadow-lg cursor-default flex items-center gap-2">
                                                <span className="font-semibold text-brand">
                                                    {availableCampuses.find(u => u.id === userCampusId)?.shortName || "Your Campus"}
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="relative z-20">
                                                <button
                                                    onClick={() => setIsCampusDropdownOpen(!isCampusDropdownOpen)}
                                                    className={`appearance-none pl-3 pr-8 py-2 rounded-full bg-card border border-secondary/20 text-foreground text-xs font-medium backdrop-blur-xl hover:bg-secondary/10 transition-all focus:outline-none focus:ring-2 focus:ring-brand/50 cursor-pointer min-w-[180px] text-left relative overflow-hidden group ${isCampusDropdownOpen ? 'bg-secondary/20' : ''}`}
                                                >
                                                    <span className="block truncate flex items-center gap-2 relative z-10">
                                                        {selectedCampus === "all"
                                                            ? "All Campuses"
                                                            : availableCampuses.find(u => u.id === selectedCampus)?.name || "Select Campus"
                                                        }
                                                        <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-secondary group-hover:text-foreground transition-colors duration-300">
                                                            <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform duration-500 ${isCampusDropdownOpen ? 'rotate-180' : ''}`} />
                                                        </span>
                                                    </span>
                                                </button>

                                                {isCampusDropdownOpen && (
                                                    <>
                                                        <div className="fixed inset-0 z-10 cursor-default" onClick={() => setIsCampusDropdownOpen(false)} />
                                                        <div className="absolute left-0 mt-2 w-full min-w-[220px] max-h-[260px] overflow-y-auto rounded-[20px] bg-popover/95 backdrop-blur-xl border border-secondary/15 shadow-2xl z-30 p-1.5 custom-scrollbar">
                                                            <button
                                                                onClick={() => { setSelectedCampus("all"); setIsCampusDropdownOpen(false); }}
                                                                className="w-full px-3 py-2.5 text-left text-[13px] font-medium rounded-full hover:bg-secondary/10 text-secondary hover:text-foreground transition-all"
                                                            >
                                                                All Campuses
                                                            </button>
                                                            <div className="h-px bg-secondary/10 my-1.5 mx-3" />
                                                            {availableCampuses.map(camp => (
                                                                <button
                                                                    key={camp.id}
                                                                    onClick={() => { setSelectedCampus(camp.id); setIsCampusDropdownOpen(false); }}
                                                                    className="w-full px-3 py-2.5 text-left text-[13px] rounded-full hover:bg-secondary/10 text-secondary hover:text-foreground transition-all flex items-center gap-2"
                                                                >
                                                                    {camp.logo ? <img src={camp.logo} className="w-5 h-5 object-contain" /> : <span className="text-brand font-bold text-xs">{camp.shortName}</span>}
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
                                                <div className="rounded-2xl bg-secondary/5 p-6 h-32" />
                                            </div>
                                        ))}
                                    </div>
                                ) : reportsError ? (
                                    <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-6">
                                        <p className="text-red-400 mb-4">{reportsError}</p>
                                    </div>
                                ) : sortedQueueItems.length === 0 ? (
                                    <div className="text-center py-16">
                                        <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
                                        <p className="text-xl text-secondary">No content reports found.</p>
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

// Subcomponent: ModerationQueueItem
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
        <div className="rounded-2xl bg-card border border-secondary/15 p-6 hover:border-secondary/30 transition-colors">
            <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                        <span className="text-sm font-bold text-red-500">
                            {item.reportsData?.length || 0} {(item.reportsData?.length || 0) === 1 ? "report" : "reports"}
                        </span>
                        {post?.visibility && (
                            <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${post.visibility === "under_review" ? "bg-yellow-500/15 text-yellow-500" : "bg-secondary/15 text-secondary"}`}>
                                {post.visibility === "under_review" ? "Under Review" : post.visibility}
                            </span>
                        )}
                        {item.createdAt && (
                            <span className="text-xs text-secondary">
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
                                    <span className="px-2 py-0.5 rounded-md bg-brand/10 text-brand text-xs font-medium">
                                        {item.campus.shortName}
                                    </span>
                                )
                            )
                        )}
                    </div>

                    {post ? (
                        <button
                            onClick={() => router.push(`/posts/${post.id}`)}
                            className="inline-flex items-center gap-1 text-sm text-brand hover:brightness-110 transition-colors font-medium"
                        >
                            View full post →
                        </button>
                    ) : (
                        <p className="text-sm text-secondary italic">Post not found or deleted</p>
                    )}

                    {item.reportsData && item.reportsData.length > 0 && (
                        <div className="mt-3">
                            <p className="text-xs text-secondary mb-1">Reported by:</p>
                            <div className="flex flex-wrap gap-2">
                                {(showAllReporters ? item.reportsData : item.reportsData.slice(0, INITIAL_REPORTERS_SHOWN)).map((report, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => onReportClick(report)}
                                        className="px-2 py-1 rounded-full bg-secondary/10 text-xs text-secondary hover:text-foreground hover:bg-secondary/20 transition-colors cursor-pointer"
                                    >
                                        @{report.username}
                                    </button>
                                ))}
                                {item.reportsData.length > INITIAL_REPORTERS_SHOWN && (
                                    <button
                                        onClick={() => setShowAllReporters(!showAllReporters)}
                                        className="px-2 py-1 rounded-full bg-secondary/5 text-xs text-secondary hover:bg-secondary/15 hover:text-foreground transition-colors"
                                    >
                                        {showAllReporters ? 'Show less' : `+ ${item.reportsData.length - INITIAL_REPORTERS_SHOWN} more`}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {item.reasonsBreakdown && Object.keys(item.reasonsBreakdown).length > 0 && (
                        <div className="mt-3">
                            <p className="text-xs text-secondary mb-1">Reasons:</p>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(item.reasonsBreakdown).map(([reason, count]) => (
                                    <span key={reason} className="px-2 py-1 rounded-md bg-red-500/10 text-xs text-red-500">
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
                        className={`p-2.5 rounded-full transition-all duration-300 ${showMenu ? "bg-secondary/20 text-foreground" : "bg-secondary/5 text-secondary hover:bg-secondary/10 hover:text-foreground"}`}
                    >
                        <EllipsisVerticalIcon className="h-6 w-6" />
                    </button>
                    {showMenu && (
                        <>
                            <div className="fixed inset-0 z-40 cursor-default" onClick={() => setShowMenu(false)} />
                            <div className="absolute right-0 mt-3 w-[220px] rounded-[20px] bg-popover/95 backdrop-blur-xl border border-secondary/15 shadow-2xl z-50 overflow-hidden p-1.5 flex flex-col gap-1">
                                <button
                                    onClick={() => { setShowMenu(false); onAction(item, "restore"); }}
                                    disabled={isProcessing || !post}
                                    className="w-full px-3 py-2.5 text-left flex items-center gap-2.5 text-foreground hover:bg-secondary/10 rounded-full disabled:opacity-40"
                                >
                                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                                    Restore
                                </button>
                                <button
                                    onClick={() => { setShowMenu(false); onAction(item, "hide"); }}
                                    disabled={isProcessing || !post}
                                    className="w-full px-3 py-2.5 text-left flex items-center gap-2.5 text-foreground hover:bg-secondary/10 rounded-full disabled:opacity-40"
                                >
                                    <EyeSlashIcon className="h-5 w-5 text-yellow-500" />
                                    Hide from Feed
                                </button>
                                <button
                                    onClick={() => { setShowMenu(false); onAction(item, "dismiss"); }}
                                    disabled={isProcessing}
                                    className="w-full px-3 py-2.5 text-left flex items-center gap-2.5 text-foreground hover:bg-secondary/10 rounded-full disabled:opacity-40"
                                >
                                    <XMarkIcon className="h-5 w-5 text-secondary" />
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
