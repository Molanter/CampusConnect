
"use client";

import { useState, useEffect, useMemo } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, orderBy, getDocs, doc, getDoc } from "firebase/firestore";
import { CheckCircleIcon, EyeSlashIcon, XMarkIcon, EllipsisVerticalIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { formatDistanceToNow } from "date-fns";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import type { ModerationQueueItem } from "@/lib/types/moderation";
import type { Post } from "@/lib/posts";
import { useAdminMode } from "@/components/admin-mode-context";
import { useRightSidebar } from "@/components/right-sidebar-context";

type ModerationTab = "posts" | "profiles" | "clubs";

interface ReportData {
    username: string;
    uid: string;
    reason: string;
    details: string;
    createdAt: any;
}

interface UniversityData {
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
    university?: UniversityData | null;
}

export default function ModerationPage() {
    const { isGlobalAdminUser, adminModeOn } = useAdminMode();
    const { openView } = useRightSidebar();
    const [activeTab, setActiveTab] = useState<ModerationTab>("posts");
    const [queueItems, setQueueItems] = useState<QueueItemWithPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
    const [selectedUniversity, setSelectedUniversity] = useState<string>("all");
    const [isUniversityDropdownOpen, setIsUniversityDropdownOpen] = useState(false);
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

    // Fetch current user's campus ID and determine admin type
    useEffect(() => {
        const fetchUserCampus = async () => {
            const user = auth.currentUser;
            if (!user) return;

            try {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    const campusId = userDoc.data().campusId;
                    setUserCampusId(campusId || null);

                    // Campus admin = has campusId AND is NOT a global admin
                    const isCampus = !!(campusId && !isGlobalAdminUser);
                    setIsCampusAdmin(isCampus);

                    // Auto-select campus for campus admins
                    if (isCampus && campusId) {
                        setSelectedUniversity(campusId);
                    }
                }
            } catch (err) {
                console.error("Error fetching user campus:", err);
            }
        };

        fetchUserCampus();
    }, [isGlobalAdminUser]);

    // Load moderation queue
    useEffect(() => {
        if (activeTab !== "posts") return;

        const loadQueue = async () => {
            setLoading(true);
            setError(null);

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

                // Fetch post data and reporters for each queue item
                for (const queueDoc of snapshot.docs) {
                    const queueData = queueDoc.data() as ModerationQueueItem;
                    const postId = queueData.targetId;

                    let post: Post | null = null;
                    let reporters: string[] = [];
                    let reportsData: ReportData[] = [];
                    let university: UniversityData | null = null;

                    try {
                        const postDoc = await getDoc(doc(db, "posts", postId));
                        if (postDoc.exists()) {
                            post = { id: postDoc.id, ...postDoc.data() } as Post;
                        }

                        // Fetch full report data
                        const reportsSnapshot = await getDocs(collection(db, "posts", postId, "reports"));
                        const rawReports = reportsSnapshot.docs.map(d => ({
                            uid: d.data().reporterUid,
                            reason: d.data().reason || "No reason provided",
                            details: d.data().details || "",
                            createdAt: d.data().createdAt
                        })).filter(r => r.uid);

                        // Fetch usernames for each report
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

                        // Fetch university data via post author
                        if (post && post.authorId) {
                            try {
                                const authorDoc = await getDoc(doc(db, "users", post.authorId));
                                if (authorDoc.exists()) {
                                    const campusId = authorDoc.data().campusId;
                                    if (campusId) {
                                        const uniDoc = await getDoc(doc(db, "universities", campusId));
                                        if (uniDoc.exists()) {
                                            university = {
                                                id: uniDoc.id,
                                                name: uniDoc.data().name || "",
                                                shortName: uniDoc.data().shortName || "",
                                                logo: uniDoc.data().logo
                                            };
                                        }
                                    }
                                }
                            } catch (uniErr) {
                                console.error(`Failed to fetch university for post ${postId}: `, uniErr);
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
                        university,
                    });
                }

                setQueueItems(items);
            } catch (err: any) {
                console.error("Error loading moderation queue:", err);
                setError(err.message || "Failed to load moderation queue");
            } finally {
                setLoading(false);
            }
        };

        loadQueue();
    }, [activeTab]);

    // Compute available universities from queue items
    const availableUniversities = useMemo(() => {
        const univs = new Map<string, UniversityData>();
        queueItems.forEach(item => {
            if (item.university && item.university.shortName) {
                univs.set(item.university.id, item.university);
            }
        });
        return Array.from(univs.values()).sort((a, b) =>
            a.shortName.localeCompare(b.shortName)
        );
    }, [queueItems]);

    // Sort queue items by report count (descending) then by createdAt (ascending/oldest first)
    const sortedQueueItems = useMemo(() => {
        let filtered = selectedUniversity !== "all"
            ? queueItems.filter(item => item.university?.id === selectedUniversity)
            : queueItems;

        return [...filtered].sort((a, b) => {
            // First sort by report count (descending - more reports first)
            const reportDiff = (b.reportsData?.length || 0) - (a.reportsData?.length || 0);
            if (reportDiff !== 0) return reportDiff;

            // Then sort by createdAt (ascending - oldest first)
            if (a.createdAt && b.createdAt) {
                return a.createdAt.toMillis() - b.createdAt.toMillis();
            }
            return 0;
        });
    }, [queueItems, selectedUniversity]);

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

        // Validation for required notes
        if ((type === "hide" || type === "restore") && (!note || note.trim().length === 0)) {
            // Shake effect or error indication could be added here
            // For now we rely on the button being disabled if empty (to be implemented in UI)
            return;
        }

        setProcessingIds(prev => new Set(prev).add(item.id));
        setConfirmModal(prev => ({ ...prev, isOpen: false })); // Close modal immediately or wait? Better wait or close.
        // Let's close it to show the processing on the list item

        try {
            const moderatePost = httpsCallable(functions, "moderatePost");
            await moderatePost({
                postId: item.targetId,
                action: type,
                ...((note && note.trim().length > 0) && { note: note.trim() })
            });

            // Remove from local state
            setQueueItems(prev => prev.filter(i => i.id !== item.id));
        } catch (err: any) {
            console.error(`Error performing ${type}: `, err);
            // Replace with toast or custom error UI if possible, for now console/alert fallback or maybe set error state in modal if we kept it open. 
            // Since modal is closed, we alert. Ideally toast.
            alert(`Failed to ${type} post: ${err.message}`);
        } finally {
            setProcessingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(item.id);
                return newSet;
            });
            // Reset modal state
            setConfirmModal({ isOpen: false, type: null, item: null, note: "" });
        }
    };

    // Authorization check - only allow global admins with admin mode ON
    if (!isGlobalAdminUser || !adminModeOn) {
        return (
            <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="mb-6">
                        <h1 className="text-6xl font-bold text-white/20 mb-2">404</h1>
                        <h2 className="text-2xl font-semibold text-white mb-2">No Access</h2>
                        <p className="text-neutral-400">
                            You do not have the right to access this page.
                        </p>
                    </div>
                    <p className="text-sm text-neutral-600">
                        Only administrators can access the moderation panel.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen text-white p-6">
            {/* Confirmation Modal */}
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
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Moderation</h1>
                    <p className="text-neutral-400">Reported content requiring review</p>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 border-b border-white/10">
                    <button
                        onClick={() => setActiveTab("posts")}
                        className={`px - 4 py - 3 font - medium transition - colors relative ${activeTab === "posts"
                            ? "text-white"
                            : "text-neutral-500 hover:text-neutral-300"
                            } `}
                    >
                        Posts
                        {activeTab === "posts" && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
                        )}
                    </button>
                    <button
                        disabled
                        className="px-4 py-3 font-medium text-neutral-600 cursor-not-allowed"
                    >
                        Profiles
                        <span className="ml-2 text-xs">(Coming soon)</span>
                    </button>
                    <button
                        disabled
                        className="px-4 py-3 font-medium text-neutral-600 cursor-not-allowed"
                    >
                        Clubs
                        <span className="ml-2 text-xs">(Coming soon)</span>
                    </button>
                </div>

                {/* University Filter */}
                {availableUniversities.length > 0 && (
                    <div className="mb-6 flex gap-3 items-center">
                        <label className="text-sm font-medium text-neutral-400">Filter by University:</label>
                        {isCampusAdmin ? (
                            // Campus admins see their university (read-only)
                            <div className="px-4 py-2.5 rounded-[14px] bg-white/5 border border-white/10 text-white backdrop-blur-xl shadow-lg cursor-default flex items-center gap-2">
                                <span className="font-semibold text-[#ffb200]">
                                    {availableUniversities.find(u => u.id === userCampusId)?.shortName || "Your University"}
                                </span>
                                {availableUniversities.find(u => u.id === userCampusId)?.name && (
                                    <span className="text-neutral-400 text-sm">
                                        — {availableUniversities.find(u => u.id === userCampusId)?.name}
                                    </span>
                                )}
                            </div>
                        ) : (

                            // Global admins can filter all universities
                            <div className="relative z-20">
                                <button
                                    onClick={() => setIsUniversityDropdownOpen(!isUniversityDropdownOpen)}
                                    className={`appearance-none pl-3 pr-8 py-2 rounded-full bg-white/5 border border-white/10 text-white text-xs font-medium backdrop-blur-[12px] hover:bg-white/10 transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] focus:outline-none focus:ring-2 focus:ring-[#ffb200]/50 cursor-pointer min-w-[180px] text-left relative overflow-hidden group ${isUniversityDropdownOpen ? 'bg-white/10' : ''}`}
                                >


                                    <span className="block truncate flex items-center gap-2 relative z-10">
                                        {selectedUniversity === "all"
                                            ? "All Universities"
                                            : (() => {
                                                const uni = availableUniversities.find(u => u.id === selectedUniversity);
                                                return uni ? (
                                                    <>
                                                        {uni.logo ? (
                                                            <div className="w-4 h-4 flex items-center justify-center overflow-hidden shrink-0">
                                                                <img src={uni.logo} alt={uni.shortName} className="w-full h-full object-contain" />
                                                            </div>
                                                        ) : (
                                                            <span className="font-bold text-[#ffb200] text-[10px] tracking-wide bg-white/10 px-1 py-px rounded-md">{uni.shortName}</span>
                                                        )}
                                                        <span className="font-medium tracking-wide">{uni.name}</span>
                                                    </>
                                                ) : "Select University";
                                            })()
                                        }
                                    </span>
                                    <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-white/50 group-hover:text-white transition-colors duration-300">
                                        <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform duration-500 cubic-bezier(0.34,1.56,0.64,1) ${isUniversityDropdownOpen ? 'rotate-180' : ''}`} />
                                    </span>
                                </button>

                                {/* Backdrop to close dropdown */}
                                {isUniversityDropdownOpen && (
                                    <div
                                        className="fixed inset-0 z-10 cursor-default"
                                        onClick={() => setIsUniversityDropdownOpen(false)}
                                    />
                                )}

                                {/* Glassmorphism Dropdown Menu */}
                                {isUniversityDropdownOpen && (
                                    <div className="absolute right-0 mt-2 w-full min-w-[220px] max-h-[260px] overflow-y-auto rounded-[20px] bg-[#121212]/30 backdrop-blur-[12px] border border-white/10 shadow-[0_40px_80px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.08)_inset] z-30 p-1.5 custom-scrollbar animate-in fade-in zoom-in-95 duration-200">
                                        <button
                                            onClick={() => {
                                                setSelectedUniversity("all");
                                                setIsUniversityDropdownOpen(false);
                                            }}
                                            className={`w-full px-3 py-2.5 text-left text-[13px] font-medium rounded-full transition-all duration-200 flex items-center gap-2.5 group ${selectedUniversity === "all"
                                                ? "bg-white/15 text-white shadow-[0_4px_12px_rgba(0,0,0,0.1)] border border-white/5"
                                                : "text-neutral-300 hover:bg-white/10 hover:text-white hover:scale-[0.98] active:scale-[0.96]"
                                                }`}
                                        >
                                            <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                                                </svg>
                                            </div>
                                            All Universities
                                        </button>
                                        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-1.5 mx-3" />
                                        {availableUniversities.map(uni => (
                                            <button
                                                key={uni.id}
                                                onClick={() => {
                                                    setSelectedUniversity(uni.id);
                                                    setIsUniversityDropdownOpen(false);
                                                }}
                                                className={`w-full px-3 py-2.5 text-left text-[13px] rounded-full transition-all duration-200 flex items-center gap-2.5 group ${selectedUniversity === uni.id
                                                    ? "bg-white/15 text-white font-medium shadow-[0_4px_12px_rgba(0,0,0,0.1)] border border-white/5"
                                                    : "text-neutral-300 hover:bg-white/10 hover:text-white hover:scale-[0.98] active:scale-[0.96]"
                                                    }`}
                                            >
                                                {uni.logo ? (
                                                    <div className="w-7 h-7 flex items-center justify-center overflow-hidden shrink-0">
                                                        <img src={uni.logo} alt={uni.shortName} className="w-full h-full object-contain" />
                                                    </div>
                                                ) : (
                                                    <span className="font-bold text-[#ffb200] w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-[10px] shrink-0 border border-white/5 group-hover:border-white/20 transition-colors">{uni.shortName}</span>
                                                )}
                                                <div className="flex flex-col min-w-0">
                                                    <span className="truncate font-medium leading-none mb-0.5">{uni.name}</span>
                                                    <span className="text-[10px] text-neutral-500 group-hover:text-neutral-400 uppercase tracking-wider">{uni.shortName}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                        }
                    </div >
                )}

                {/* Content */}
                {
                    loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="animate-pulse">
                                    <div className="rounded-2xl bg-neutral-900/50 p-6 h-32" />
                                </div>
                            ))}
                        </div>
                    ) : error ? (
                        <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-6">
                            <p className="text-red-400 mb-4">{error}</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                            >
                                Retry
                            </button>
                        </div>
                    ) : queueItems.length === 0 ? (
                        <div className="text-center py-16">
                            <CheckCircleIcon className="h-16 w-16 text-green-400 mx-auto mb-4" />
                            <p className="text-xl text-neutral-300">No posts need review right now.</p>
                            <p className="text-sm text-neutral-500 mt-2">All caught up!</p>
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
                    )
                }
            </div >
        </div >
    );
}

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

    const handleViewPost = () => {
        if (post) {
            router.push(`/posts/${post.id}`);
        }
    };

    return (
        <div className="rounded-2xl bg-neutral-900/50 border border-white/10 p-6 hover:border-white/20 transition-colors">
            <div className="flex items-start gap-4">
                {/* Content */}
                <div className="flex-1 min-w-0">
                    {/* Metadata Row */}
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                        <span className="text-sm font-bold text-red-400">
                            {item.reportsData?.length || 0} {(item.reportsData?.length || 0) === 1 ? "report" : "reports"}
                        </span>
                        {post?.visibility && (
                            <span className={`px - 2 py - 0.5 rounded - md text - xs font - medium ${post.visibility === "under_review"
                                ? "bg-yellow-500/20 text-yellow-400"
                                : "bg-neutral-500/20 text-neutral-400"
                                } `}>
                                {post.visibility === "under_review" ? "Under Review" : post.visibility}
                            </span>
                        )}
                        {item.createdAt && (
                            <span className="text-xs text-neutral-500">
                                {formatDistanceToNow(item.createdAt.toDate(), { addSuffix: true })}
                            </span>
                        )}
                        {item.university && (
                            item.university.logo ? (
                                <img
                                    src={item.university.logo}
                                    alt={item.university.shortName}
                                    className="w-5 h-5 object-contain"
                                    title={item.university.name}
                                />
                            ) : (
                                item.university.shortName && (
                                    <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-400 text-xs font-medium">
                                        {item.university.shortName}
                                    </span>
                                )
                            )
                        )}
                    </div>

                    {/* Post Actions */}
                    {post ? (
                        <button
                            onClick={handleViewPost}
                            className="inline-flex items-center gap-1 text-sm text-[#ffb200] hover:text-[#ffa000] transition-colors font-medium"
                        >
                            View full post →
                        </button>
                    ) : (
                        <p className="text-sm text-neutral-500 italic">Post not found or deleted</p>
                    )}

                    {/* Reporters */}
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

                    {/* Reasons Breakdown */}
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

                {/* Right: Actions Menu */}
                <div className="relative">
                    <button
                        onClick={() => setShowMenu(!showMenu)}
                        className={`p-2.5 rounded-full transition-all duration-300 ${showMenu
                            ? "bg-white/20 text-white"
                            : "bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white"
                            }`}
                        aria-label="Actions"
                    >
                        <EllipsisVerticalIcon className="h-6 w-6" />
                    </button>

                    {showMenu && (
                        <>
                            <div
                                className="fixed inset-0 z-40 cursor-default"
                                onClick={() => setShowMenu(false)}
                            />
                            <div className="absolute right-0 mt-3 w-[220px] rounded-[20px] bg-[#121212]/30 backdrop-blur-[12px] border border-white/10 shadow-[0_40px_80px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.08)_inset] z-50 overflow-hidden transform animate-in fade-in zoom-in-95 duration-200 origin-top-right p-1.5 flex flex-col gap-1">


                                <div className="relative z-10 flex flex-col gap-1">
                                    <button
                                        onClick={() => {
                                            setShowMenu(false);
                                            onAction(item, "restore");
                                        }}
                                        disabled={isProcessing || !post}
                                        className="group w-full px-3 py-2.5 text-left flex items-center gap-2.5 text-neutral-200 hover:text-white hover:bg-white/10 active:scale-[0.98] transition-all duration-200 rounded-full disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                                    >
                                        <div className="flex items-center justify-center w-6 h-6">
                                            <CheckCircleIcon className="h-5 w-5 text-green-400" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[15px] font-semibold leading-tight">Restore</span>
                                            <span className="text-[11px] text-neutral-500 font-medium group-hover:text-neutral-400">Put back in feed</span>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => {
                                            setShowMenu(false);
                                            onAction(item, "hide");
                                        }}
                                        disabled={isProcessing || !post}
                                        className="group w-full px-3 py-2.5 text-left flex items-center gap-2.5 text-neutral-200 hover:text-white hover:bg-white/10 active:scale-[0.98] transition-all duration-200 rounded-full disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                                    >
                                        <div className="flex items-center justify-center w-6 h-6">
                                            <EyeSlashIcon className="h-5 w-5 text-red-400" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[15px] font-semibold leading-tight text-red-100">Hide Post</span>
                                            <span className="text-[11px] text-neutral-500 font-medium group-hover:text-neutral-400">Remove from feed</span>
                                        </div>
                                    </button>

                                    <div className="h-px bg-white/10 my-0.5 mx-2" />

                                    <button
                                        onClick={() => {
                                            setShowMenu(false);
                                            onAction(item, "dismiss");
                                        }}
                                        disabled={isProcessing}
                                        className="group w-full px-3 py-2.5 text-left flex items-center gap-2.5 text-neutral-300 hover:text-white hover:bg-white/10 active:scale-[0.98] transition-all duration-200 rounded-full disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                                    >
                                        <div className="flex items-center justify-center w-6 h-6">
                                            <XMarkIcon className="h-5 w-5 text-neutral-400" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[15px] font-semibold leading-tight">Dismiss</span>
                                            <span className="text-[11px] text-neutral-500 font-medium group-hover:text-neutral-400">Ignore reports</span>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {
                isProcessing && (
                    <div className="mt-4 text-center">
                        <p className="text-sm text-neutral-400">Processing...</p>
                    </div>
                )
            }


        </div >
    );
}
