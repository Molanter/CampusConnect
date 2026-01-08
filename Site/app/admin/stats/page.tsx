"use client";

import { useEffect, useState, useMemo } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
    collection,
    collectionGroup,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    or,
    getCountFromServer,
    orderBy,
    limit
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAdminMode } from "@/components/admin-mode-context";
import { Campus } from "@/lib/types/campus";
import { getAllCampusesAndUniversities, getCampusOrLegacy } from "@/lib/firestore-paths";
import {
    ChartBarIcon,
    UserGroupIcon,
    BuildingLibraryIcon,
    ChatBubbleBottomCenterTextIcon,
    CalendarIcon,
    EyeIcon,
    MagnifyingGlassIcon,
    ArrowTrendingUpIcon,
    SparklesIcon,
    ChevronLeftIcon
} from "@heroicons/react/24/outline";
import clsx from "clsx";

type TimeFrame = "7d" | "30d" | "all";

type Stats = {
    totalMembers: number;
    activeMembers: number;
    reach: number;
    posts: number;
    engagementRate: number;
    activeClubs: number;
    totalClubs: number;
    activeEvents: number;
    totalEvents: number;
    comments: number;
    reactions: number;
    // Funnel
    activeUsersCount: number;
    postersCount: number;
    engagedUsersCount: number;
    updatedAt: Date;
};

const ui = {
    container: "flex h-screen bg-[#050505] text-[#FAFAFA] overflow-hidden font-sans",
    sidebar: "w-full lg:w-72 flex flex-col shrink-0 p-4 pr-2 pb-0 items-start",
    sidebarInner: "w-full bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[2rem] flex-shrink-0 flex flex-col h-fit max-h-[calc(100vh-2rem)] overflow-hidden shadow-2xl mb-4",
    main: "flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 scroll-smooth",
    header: "flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12 pb-8 border-b border-white/5",
    title: "text-4xl font-black tracking-tight text-white mb-2",
    subtitle: "text-zinc-400 text-base font-medium",
    // Grids
    primaryGrid: "grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8",
    secondaryGrid: "grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-12",
    // Cards
    card: "bg-white/5 backdrop-blur-xl border border-white/10 rounded-[22px] p-6 flex flex-col relative overflow-hidden transition-all hover:bg-white/[0.08] hover:scale-[1.01] shadow-xl",
    cardKPI: "bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[24px] p-7 flex flex-col gap-1 shadow-2xl transition-all hover:border-white/20",
    label: "text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em] mb-1",
    valueBig: "text-3xl md:text-4xl font-bold text-white tracking-tighter",
    valueSmall: "text-xl font-bold text-zinc-100",
    icon: "text-zinc-400 opacity-50",
    // Sections
    sectionTitle: "text-sm font-bold uppercase tracking-[0.25em] text-zinc-500 mb-6",
};

export default function AdminStatsPage() {
    const { isGlobalAdminUser, isCampusAdminUser, adminModeOn } = useAdminMode();
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);

    const [campuses, setCampuses] = useState<Campus[]>([]);
    const [selectedCampus, setSelectedCampus] = useState<Campus | null | undefined>(undefined);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<Stats | null>(null);
    const [timeframe, setTimeframe] = useState<TimeFrame>("30d");
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(true);

    // Auth & Initial Setup
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setAuthLoading(false);
        });
        return () => unsub();
    }, []);

    // Load All Campuses (for Global Admin)
    useEffect(() => {
        async function load() {
            if (!isGlobalAdminUser) return;
            try {
                const data = await getAllCampusesAndUniversities();
                setCampuses(data.sort((a, b) => a.name.localeCompare(b.name)));
                // Removed auto-selection to wait for user choice
            } catch (err) {
                console.error("Error loading campuses:", err);
            }
        }
        if (isGlobalAdminUser) load();
    }, [isGlobalAdminUser]);

    // Handle Campus Admin's specific campus
    useEffect(() => {
        async function loadMyCampus() {
            if (!isCampusAdminUser || isGlobalAdminUser || !user) return;
            try {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    const campusId = userData.campusId;
                    if (campusId) {
                        const campusData = await getCampusOrLegacy(campusId);
                        if (campusData) {
                            setSelectedCampus(campusData);
                        }
                    }
                }
            } catch (err) {
                console.error("Error loading my campus:", err);
            }
        }
        loadMyCampus();
    }, [isCampusAdminUser, isGlobalAdminUser, user]);

    // Fetch Stats with timeframe
    useEffect(() => {
        async function fetchStats() {
            if (selectedCampus === undefined) return;
            setLoading(true);

            try {
                const campusId = selectedCampus?.id;
                const now = new Date();
                let startDate: Date | null = null;
                if (timeframe === "7d") {
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                } else if (timeframe === "30d") {
                    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                }

                // 1. Total Members
                const usersBase = collection(db, "users");
                const membersQ = campusId
                    ? query(usersBase, where("campusId", "==", campusId))
                    : usersBase;
                const totalMembersSnap = await getCountFromServer(membersQ);
                const totalMembers = totalMembersSnap.data().count;

                // 1b. Get all Member UIDs for this campus (to attribute posts by author)
                let campusUserIds = new Set<string>();
                if (campusId) {
                    const membersSnap = await getDocs(query(usersBase, where("campusId", "==", campusId)));
                    membersSnap.forEach(d => campusUserIds.add(d.id));
                    console.log(`[Stats Catch] Identified ${campusUserIds.size} campus members for filtering.`);
                }

                // 2. Active Members (period)
                const activeMembersQ = startDate
                    ? query(membersQ, where("lastActiveAt", ">=", startDate))
                    : membersQ;
                const activeMembersSnap = await getCountFromServer(activeMembersQ);
                const activeMembers = activeMembersSnap.data().count;

                // 3. Posts (period)
                const postsBase = collection(db, "posts");
                // Note: Fetching broader if campusId is selected so we can filter by author in memory
                const postsBaseQ = postsBase;


                // 4. Reach (Period)
                let reach = 0;
                let reachQuerySuccess = false;
                try {
                    const seenPostsCG = collectionGroup(db, "seenPosts");
                    const reachBaseQ = campusId
                        ? query(seenPostsCG, where("campusId", "==", campusId))
                        : seenPostsCG;
                    const reachPeriodQ = startDate ? query(reachBaseQ, where("seenAt", ">=", startDate)) : reachBaseQ;
                    const reachSnap = await getCountFromServer(reachPeriodQ);
                    reach = reachSnap.data().count;
                    reachQuerySuccess = true;
                } catch (e) {
                    console.warn("[Stats] High-precision Reach query failed (likely permissions). Falling back to seenCount sum.");
                }

                // 5. Engagement Metrics & Post Counting
                console.log("%c 📊 STATS FETCH STARTING... ", "background: #222; color: #bada55; font-size: 14px; font-weight: bold;");
                const contentPeriodQ = startDate ? query(postsBaseQ, where("createdAt", ">=", startDate)) : postsBaseQ;
                const analyticsSnap = await getDocs(query(contentPeriodQ, orderBy("createdAt", "desc")));

                console.log(`[Stats Catch] Fetched ${analyticsSnap.size} raw docs from 'posts' collection for filtering.`);

                const posters = new Set<string>();
                const engagers = new Set<string>();
                const activeClubIds = new Set<string>();
                let totalReactions = 0;
                let totalComments = 0;
                let ugcCount = 0;
                let eventPostsCount = 0;
                let fallbackReach = 0;

                analyticsSnap.forEach(d => {
                    const data = d.data();
                    const authorId = data.authorId || data.authorUid || data.createdBy;

                    // Filter by campus member if a specific campus is selected
                    if (campusId && !campusUserIds.has(authorId)) return;

                    fallbackReach += (data.seenCount || 0);

                    // Track club activity
                    if (data.clubId) {
                        activeClubIds.add(data.clubId);
                    }

                    // Identify content type
                    const isEventContent = data.type === "event" || data.isEvent === true;
                    const isAnnouncement = data.type === "announcement";

                    if (isEventContent) {
                        eventPostsCount++;
                    } else if (!isAnnouncement) {
                        ugcCount++;
                    }

                    if (authorId) {
                        posters.add(authorId);
                        engagers.add(authorId);
                    }
                    const likesArr = data.likes || data.likedByUids || [];
                    likesArr.forEach((uid: string) => engagers.add(uid));
                    totalReactions += likesArr.length;
                    totalComments += (data.commentsCount || data.commentCount || 0);
                });

                if (!reachQuerySuccess) {
                    reach = fallbackReach;
                }

                console.log(`[Stats Catch] UGC Posts Found: ${ugcCount}`);
                console.log(`[Stats Catch] Events Found: ${eventPostsCount}`);
                console.log(`[Stats Catch] Active Clubs Found from Posts: ${activeClubIds.size}`);
                console.log(`[Stats Catch] Reach: ${reach} (${reachQuerySuccess ? 'Accurate' : 'Estimated'})`);
                console.log(`[Stats Catch] Unique Posters: ${posters.size}`);
                console.log(`[Stats Catch] Total Reactions: ${totalReactions}, Comments: ${totalComments}`);
                console.log("%c ✅ STATS FETCH COMPLETE ", "background: #222; color: #55da55; font-size: 12px; font-weight: bold;");


                // 6. Clubs
                const clubsBase = collection(db, "clubs");
                const clubsBaseQ = campusId ? query(clubsBase, where("campusId", "==", campusId)) : clubsBase;
                const activeClubsQ = startDate ? query(clubsBaseQ, where("lastPostAt", ">=", startDate)) : clubsBaseQ;
                const [activeClubsSnap, totalClubsSnap] = await Promise.all([
                    getCountFromServer(activeClubsQ),
                    getCountFromServer(clubsBaseQ)
                ]);

                // 7. Events (Legacy 'events' collection check)
                const legacyEventsBase = collection(db, "events");
                const legacyEventsBaseQ = startDate ? query(legacyEventsBase, where("createdAt", ">=", startDate)) : legacyEventsBase;
                const legacyEventsSnap = await getDocs(legacyEventsBaseQ);

                let legacyCount = 0;
                legacyEventsSnap.forEach(d => {
                    const data = d.data();
                    const authorId = data.authorId || data.authorUid || data.createdBy || data.hostUserId;
                    if (campusId && !campusUserIds.has(authorId)) return;
                    legacyCount++;
                });

                const activeEvents = eventPostsCount + legacyCount;
                const totalEvents = activeEvents; // Simplified as we are only fetching period-based content now for consistency

                const postersCount = posters.size;
                const engagedUsersCount = engagers.size;

                // Logic: A user is "Active" if their lastActiveAt is in range OR they actually did something (Engaged)
                const activeUsersCount = Math.max(activeMembers || 0, engagedUsersCount);
                const engagementRate = activeUsersCount > 0 ? (engagedUsersCount / activeUsersCount) : 0;

                setStats({
                    totalMembers,
                    activeMembers: activeUsersCount, // Reflect the more accurate count
                    reach,
                    posts: ugcCount,
                    engagementRate,
                    activeClubs: Math.max(activeClubIds.size, activeClubsSnap.data().count),
                    totalClubs: totalClubsSnap.data().count,
                    activeEvents,
                    totalEvents,
                    comments: totalComments,
                    reactions: totalReactions,
                    activeUsersCount,
                    postersCount,
                    engagedUsersCount,
                    updatedAt: new Date()
                });

            } catch (err) {
                console.error("Error fetching live stats:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchStats();
    }, [selectedCampus, timeframe, isGlobalAdminUser]);

    const filteredCampuses = useMemo(() => {
        return campuses.filter(c =>
            c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.shortName?.toLowerCase().includes(search.toLowerCase())
        );
    }, [campuses, search]);

    if (authLoading) return null;
    if (selectedCampus === undefined) {
        return (
            <div className={ui.container}>
                {isGlobalAdminUser && (
                    <aside className={clsx(
                        ui.sidebar,
                        !isMobileSidebarOpen && "hidden lg:flex"
                    )}>
                        <div className="px-5 py-2 mb-2">
                            <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500">Selection</h2>
                        </div>
                        <div className={ui.sidebarInner}>
                            <div className="px-3 pt-4 pb-2">
                                <div className="relative group">
                                    <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 transition-colors group-focus-within:text-zinc-300" />
                                    <input
                                        type="text"
                                        placeholder="Search Campus"
                                        className="w-full bg-white/5 border border-white/10 rounded-full py-2.5 pl-10 pr-4 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-white/20 transition-all"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-4 space-y-1">
                                {isGlobalAdminUser && (
                                    <button
                                        onClick={() => {
                                            setSelectedCampus(null);
                                            setIsMobileSidebarOpen(false);
                                        }}
                                        className={clsx(
                                            "w-full text-left px-4 py-2.5 rounded-full transition-all flex items-center gap-3",
                                            "text-zinc-500 hover:text-white hover:bg-white/5"
                                        )}
                                    >
                                        <div className="w-9 h-9 rounded-xl flex items-center justify-center p-1">
                                            <ChartBarIcon className="w-5 h-5 text-brand" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="truncate text-sm font-bold">App-Wide</p>
                                            <p className="text-[10px] opacity-50 font-bold uppercase tracking-tight truncate">Network Stats</p>
                                        </div>
                                    </button>
                                )}
                                {filteredCampuses.map((c) => (
                                    <button
                                        key={c.id}
                                        onClick={() => {
                                            setSelectedCampus(c);
                                            setIsMobileSidebarOpen(false);
                                        }}
                                        className={clsx(
                                            "w-full text-left px-4 py-2.5 rounded-full transition-all flex items-center gap-3",
                                            "text-zinc-500 hover:text-white hover:bg-white/5"
                                        )}
                                    >
                                        <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
                                            {c.logoUrl ? (
                                                <img src={c.logoUrl} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-zinc-600">
                                                    {c.shortName || '?'}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="truncate text-sm font-bold">{c.name}</p>
                                            <p className="text-[10px] opacity-70 font-medium truncate uppercase tracking-tight">Campus</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </aside>
                )}
                <main className="flex-1 flex items-center justify-center p-8 bg-[#050505]">
                    <div className="text-center max-w-sm">
                        <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-white/10">
                            <ChartBarIcon className="w-10 h-10 text-zinc-600" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2">Select a Campus</h2>
                        <p className="text-zinc-500 text-sm">Please choose a campus from the sidebar to view detailed statistics and analytics.</p>
                    </div>
                </main>
            </div>
        );
    }

    if (!user || (!isGlobalAdminUser && !isCampusAdminUser)) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-secondary gap-4">
                <SparklesIcon className="h-12 w-12 text-secondary/30" />
                <p className="font-medium">Access Restricted</p>
            </div>
        );
    }

    return (
        <div className={ui.container}>
            {/* Sidebar for Global Admins */}
            {isGlobalAdminUser && (
                <aside className={clsx(
                    ui.sidebar,
                    !isMobileSidebarOpen && "hidden lg:flex"
                )}>
                    <div className="px-5 py-2 mb-2">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500">Selection</h2>
                    </div>
                    <div className={ui.sidebarInner}>
                        <div className="px-3 pt-4 pb-2">
                            <div className="relative group">
                                <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 transition-colors group-focus-within:text-zinc-300" />
                                <input
                                    type="text"
                                    placeholder="Search Campus"
                                    className="w-full bg-white/5 border border-white/10 rounded-full py-2.5 pl-10 pr-4 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-white/20 transition-all"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-4 space-y-1">
                            <button
                                className={clsx(
                                    "w-full text-left px-4 py-2.5 rounded-full transition-all flex items-center gap-3",
                                    selectedCampus === null ? "bg-white/10 text-white shadow-xl" : "text-zinc-500 hover:text-white hover:bg-white/5"
                                )}
                                onClick={() => {
                                    setSelectedCampus(null);
                                    setIsMobileSidebarOpen(false);
                                }}
                            >
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center p-1">
                                    <ChartBarIcon className="w-5 h-5 text-brand" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="truncate text-sm font-bold">App-Wide</p>
                                    <p className="text-[10px] opacity-50 font-bold uppercase tracking-tight truncate">Network Stats</p>
                                </div>
                            </button>

                            {filteredCampuses.map(c => (
                                <button
                                    key={c.id}
                                    className={clsx(
                                        "w-full text-left px-4 py-2.5 rounded-full transition-all flex items-center gap-3",
                                        selectedCampus?.id === c.id ? "bg-white/10 text-white shadow-xl" : "text-zinc-500 hover:text-white hover:bg-white/5"
                                    )}
                                    onClick={() => {
                                        setSelectedCampus(c);
                                        setIsMobileSidebarOpen(false);
                                    }}
                                >
                                    <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 p-1 flex items-center justify-center">
                                        {c.logoUrl ? (
                                            <img src={c.logoUrl} alt={c.name} className="w-full h-full object-contain" />
                                        ) : (
                                            <div className="text-xs font-black text-white/30">{c.name.charAt(0)}</div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="truncate text-sm font-bold">{c.name}</p>
                                        {c.shortName && <p className="text-[10px] opacity-50 font-bold uppercase tracking-tight truncate">{c.shortName}</p>}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </aside>
            )}

            {/* Main Content */}
            <main className={clsx(
                ui.main,
                isMobileSidebarOpen && isGlobalAdminUser && "hidden lg:block"
            )}>
                <div className="max-w-6xl mx-auto">
                    {/* Mobile Back Button */}
                    {isGlobalAdminUser && (
                        <button
                            onClick={() => setIsMobileSidebarOpen(true)}
                            className="lg:hidden flex h-10 w-10 items-center justify-center rounded-full cc-glass border border-white/10 text-white transition-all hover:bg-white/5 active:scale-95 mb-8 shadow-xl"
                        >
                            <ChevronLeftIcon className="h-6 w-6" />
                        </button>
                    )}

                    {/* 1. Header Row */}
                    <div className={ui.header}>
                        <div className="space-y-1">
                            <h1 className={ui.title}>{selectedCampus ? `${selectedCampus.name}` : "Network Overall"}</h1>
                            <p className={ui.subtitle}>Detailed insights and campus engagement metrics.</p>
                            {stats && (
                                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest pt-2">
                                    Last Updated: {stats.updatedAt.toLocaleTimeString()}
                                </p>
                            )}
                        </div>

                        <div className="flex flex-col items-end gap-3 self-center lg:self-end">
                            <div className="inline-flex bg-white/5 p-1 rounded-2xl border border-white/10 shadow-inner">
                                {(["7d", "30d", "all"] as TimeFrame[]).map((tf) => (
                                    <button
                                        key={tf}
                                        onClick={() => setTimeframe(tf)}
                                        className={clsx(
                                            "px-5 py-2 text-xs font-black uppercase tracking-widest transition-all rounded-xl",
                                            timeframe === tf ? "bg-white/10 text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300"
                                        )}
                                    >
                                        {tf === "7d" ? "7 Days" : tf === "30d" ? "30 Days" : "All-Time"}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-32 gap-4 animate-pulse">
                            <SparklesIcon className="h-12 w-12 text-white/10" />
                            <p className="text-zinc-500 font-bold uppercase tracking-widest">Compiling Analytics...</p>
                        </div>
                    ) : !stats ? (
                        <div className="text-center py-20 text-zinc-500">
                            <SparklesIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            <p>Select a campus to view performance data.</p>
                        </div>
                    ) : (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
                            {/* 2. Primary KPI Grid */}
                            <h3 className={ui.sectionTitle}>Primary Metrics</h3>
                            <div className={ui.primaryGrid}>
                                <div className={ui.cardKPI}>
                                    <div className="flex items-center justify-between mb-4">
                                        <p className={ui.label}>Active Members</p>
                                        <UserGroupIcon className="h-4 w-4 text-brand" />
                                    </div>
                                    <p className={ui.valueBig}>{stats.activeMembers.toLocaleString()}</p>
                                    <p className="text-[10px] text-zinc-600 font-bold mt-2">Total: {stats.totalMembers.toLocaleString()}</p>
                                </div>

                                <div className={ui.cardKPI}>
                                    <div className="flex items-center justify-between mb-4">
                                        <p className={ui.label}>Reach (Views)</p>
                                        <EyeIcon className="h-4 w-4 text-emerald-400" />
                                    </div>
                                    <p className={ui.valueBig}>{stats.reach.toLocaleString()}</p>
                                    <p className="text-[10px] text-zinc-600 font-bold mt-2">Total Impressions</p>
                                </div>

                                <div className={ui.cardKPI}>
                                    <div className="flex items-center justify-between mb-4">
                                        <p className={ui.label}>Posts</p>
                                        <ChatBubbleBottomCenterTextIcon className="h-4 w-4 text-amber-400" />
                                    </div>
                                    <p className={ui.valueBig}>{stats.posts.toLocaleString()}</p>
                                    <p className="text-[10px] text-zinc-600 font-bold mt-2">UGC Published</p>
                                </div>

                                <div className={ui.cardKPI}>
                                    <div className="flex items-center justify-between mb-4">
                                        <p className={ui.label}>Engagement Rate</p>
                                        <ArrowTrendingUpIcon className="h-4 w-4 text-purple-400" />
                                    </div>
                                    <p className={ui.valueBig}>{Math.round(stats.engagementRate * 100)}%</p>
                                    <p className="text-[10px] text-zinc-600 font-bold mt-2">Engaged / Active</p>
                                </div>
                            </div>

                            {/* 3. Secondary Metrics */}
                            <h3 className={ui.sectionTitle}>Interaction & Growth</h3>
                            <div className={ui.secondaryGrid}>
                                <div className={ui.card}>
                                    <p className={ui.label}>Active Clubs</p>
                                    <div className="flex items-baseline gap-2">
                                        <p className={ui.valueSmall}>{stats.activeClubs.toLocaleString()}</p>
                                        <p className="text-[10px] text-zinc-600 font-bold">/ {stats.totalClubs.toLocaleString()}</p>
                                    </div>
                                </div>
                                <div className={ui.card}>
                                    <p className={ui.label}>Events</p>
                                    <div className="flex items-baseline gap-2">
                                        <p className={ui.valueSmall}>{stats.activeEvents.toLocaleString()}</p>
                                        <p className="text-[10px] text-zinc-600 font-bold">/ {stats.totalEvents.toLocaleString()}</p>
                                    </div>
                                </div>
                                <div className={ui.card}>
                                    <p className={ui.label}>Comments</p>
                                    <p className={ui.valueSmall}>{stats.comments.toLocaleString()}</p>
                                </div>
                                <div className={ui.card}>
                                    <p className={ui.label}>Reactions</p>
                                    <p className={ui.valueSmall}>{stats.reactions.toLocaleString()}</p>
                                </div>
                            </div>

                            {/* 4. Engagement Funnel */}
                            <h3 className={ui.sectionTitle}>Engagement Funnel</h3>
                            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[28px] p-8 mb-12 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand/50 via-purple-500/50 to-emerald-500/50 opacity-20" />
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-12 relative">
                                    <div className="space-y-2">
                                        <p className={ui.label}>Members</p>
                                        <p className="text-2xl font-black">{stats.totalMembers.toLocaleString()}</p>
                                        <p className="text-[10px] text-zinc-600 font-bold">Campus Population</p>
                                    </div>
                                    <div className="space-y-2">
                                        <p className={ui.label}>Active Users</p>
                                        <p className="text-2xl font-black">{stats.activeUsersCount.toLocaleString()}</p>
                                        <p className="text-[10px] text-emerald-500/80 font-bold">
                                            {stats.totalMembers > 0 ? Math.round((stats.activeUsersCount / stats.totalMembers) * 100) : 0}% Liquidity
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <p className={ui.label}>Posters</p>
                                        <p className="text-2xl font-black">{stats.postersCount.toLocaleString()}</p>
                                        <p className="text-[10px] text-amber-500/80 font-bold">
                                            {stats.activeUsersCount > 0 ? Math.round((stats.postersCount / stats.activeUsersCount) * 100) : 0}% Creators
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <p className={ui.label}>Engaged</p>
                                        <p className="text-2xl font-black">{stats.engagedUsersCount.toLocaleString()}</p>
                                        <p className="text-[10px] text-purple-500 font-bold">
                                            {Math.round(stats.engagementRate * 100)}% Final Engagement
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-8 pt-6 border-t border-white/5">
                                    <p className="text-[10px] text-zinc-500 font-medium leading-loose max-w-2xl uppercase tracking-widest leading-relaxed">
                                        Engagement rate is calculated by dividing unique users who posted, commented, or reacted by the total active user base for this period.
                                    </p>
                                </div>
                            </div>

                            {/* 5. Usage Summary */}
                            <h3 className={ui.sectionTitle}>Benchmark Analysis</h3>
                            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[28px] p-8 mb-12 shadow-2xl">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                                    {[
                                        {
                                            label: "Active Students",
                                            pct: stats.totalMembers > 0 ? (stats.activeMembers / stats.totalMembers) * 100 : 0,
                                            color: "from-blue-500 to-indigo-600",
                                            def: "Percent of total members who logged in or interacted during the timeframe."
                                        },
                                        {
                                            label: "Club Participation",
                                            pct: stats.activeClubs > 0 ? (stats.activeClubs / stats.totalClubs) * 100 : 0,
                                            color: "from-purple-500 to-pink-600",
                                            def: "Ratio of clubs with recent publishing activity versus total registered clubs."
                                        },
                                        {
                                            label: "Community Activity",
                                            pct: Math.round(stats.engagementRate * 100),
                                            color: "from-amber-400 to-orange-600",
                                            def: "Percent of active users contributing content or interactions (Post/Comment/Like)."
                                        }
                                    ].map((item, i) => (
                                        <div key={i} className="group flex flex-col gap-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex flex-col">
                                                    <span className="text-[11px] text-zinc-400 font-black uppercase tracking-[0.2em]">{item.label}</span>
                                                    <span className="text-[9px] text-zinc-600 font-bold mt-1 max-w-[180px]">{item.def}</span>
                                                </div>
                                                <span className="text-xl font-black text-white">{Math.round(item.pct)}%</span>
                                            </div>
                                            <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                                                <div
                                                    className={clsx("h-full rounded-full transition-all duration-[1500ms] ease-out bg-gradient-to-r shadow-[0_0_15px_rgba(255,255,255,0.1)]", item.color)}
                                                    style={{ width: `${item.pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
