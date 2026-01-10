"use client";

import { BellIcon, XMarkIcon, ChevronLeftIcon, PaperAirplaneIcon, ExclamationTriangleIcon, LockClosedIcon, UserGroupIcon, TrashIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useRightSidebar } from "./right-sidebar-context";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { MobileFullScreenModal } from "./mobile-full-screen-modal";
import { UserRow } from "./user-row";
import { auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { formatDistanceToNow } from "date-fns";

// Note: We now use the full firebase/firestore SDK across the project to support real-time listeners.
// The db instance from lib/firebase.ts is already configured with the full SDK.
// We import from "firebase/firestore" for real-time listeners and other features.

import {
    collection,
    query,
    orderBy,
    onSnapshot,
    addDoc,
    doc,
    getDoc,
    updateDoc,
    arrayUnion,
    arrayRemove,
    serverTimestamp,
    increment,
    where,
    getDocs,
    deleteDoc,
    writeBatch
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { CommentMessage, type CommentRecord } from "./comment-message";
import { fetchGlobalAdminEmails, isGlobalAdmin } from "@/lib/admin-utils";
import { ReportSheet } from "./report-sheet";
import { ReportModal } from "./report-modal";
import { REPORT_REASON_LABELS } from "@/lib/types/moderation";
import { CommentsView } from "./comments-view";
import { type Post } from "@/lib/posts";

import { PostDetailMainInfo } from "./post-detail/post-detail-main-info";
import { MediaHorizontalScroll } from "./post-detail/media-horizontal-scroll";
import { MyClubsView } from "./my-clubs-view";

export function RightSidebar({ headerVisible = false }: { headerVisible?: boolean }) {
    const { isVisible, view, data, toggle, showNotifications, sidebarWidth, setSidebarWidth } = useRightSidebar();
    const [mounted, setMounted] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [isTablet, setIsTablet] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setCurrentUser(u));
        return () => unsub();
    }, []);

    useEffect(() => {
        setMounted(true);
        // Always reset to default width of 347px on mount (empirically tuned for 300px visible)
        setSidebarWidth(347);

        // Detect mobile and tablet
        const checkViewport = () => {
            const width = window.innerWidth;
            setIsMobile(width < 768);
            setIsTablet(width >= 768 && width <= 1024);
        };

        checkViewport();
        window.addEventListener('resize', checkViewport);
        return () => window.removeEventListener('resize', checkViewport);
    }, [setSidebarWidth]);

    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            const MAIN_MIN_WIDTH = 500;
            const SIDEBAR_MIN_WIDTH = 347; // Empirically tuned to give 300px visible content
            const SIDEBAR_MAX_WIDTH = 800;

            const proposedWidth = window.innerWidth - e.clientX - 12; // 12px for right margin

            // Calculate max allowed sidebar width to preserve main view
            // Using Math.max(0, ...) to avoid negative numbers if window is tiny
            const maxAllowedWidth = Math.max(0, window.innerWidth - MAIN_MIN_WIDTH);

            // Apply constraints:
            // 1. Sidebar Max (800)
            // 2. Main View Safety (maxAllowedWidth)
            // 3. Sidebar Min (334) - Applied last? 
            // User requested "MAIN NEVEr below 450". If we apply 324 last, we might violate Main Min.
            // However, preventing sidebar from being < 324 might be necessary for basic usability.
            // Given tablet breakpoint is 768, 768-450 = 318. 
            // If we enforce 450 strict, sidebar becomes 318. This is acceptable.
            // So we apply standard MIN first, then Safe MAX to override it?
            // No, usually you clamp between Min and Max.
            // If Min > Max, you have to choose one. User prioritized Main View.

            // Priority: Sidebar has a HARD minimum of 300px

            let finalWidth = proposedWidth;
            finalWidth = Math.min(finalWidth, SIDEBAR_MAX_WIDTH);
            finalWidth = Math.min(finalWidth, maxAllowedWidth); // Main protection
            finalWidth = Math.max(finalWidth, SIDEBAR_MIN_WIDTH); // Hard minimum - applied last

            setSidebarWidth(finalWidth);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, sidebarWidth]);

    if (!mounted) return null;

    // Mobile bottom sheet
    if (isMobile) {
        if (!isVisible) {
            // Don't show bell button on mobile - removed per user request
            return null;
        }

        const getTitle = () => {
            if (view === "notifications") return "Notifications";
            if (view === "comments") return "Comments";
            if (view === "attendance") return "Guest List";
            if (view === "report") return "Report Content";
            if (view === "report-details") return "Report Details";
            if (view === "post-history") return "Post History";
            if (view === "likes") return "Likes";
            if (view === "my-clubs") return "My Clubs";
            if (view === "club-privacy-info") return "Club Privacy";
            if (view === "support-ticket-info") return "Ticket Info";
            if (view === "mapHelp") return "How to get a Map Link";
            if (view === "details") return "";
            return "Details";
        };

        return (
            <MobileFullScreenModal isOpen={isVisible} onClose={toggle} title={getTitle()}>
                <div className="px-4 py-4">
                    {view === "notifications" && <NotificationsView />}
                    {view === "comments" && <CommentsView data={data} />}
                    {view === "details" && <PostDetailsSidebarView data={data} />}
                    {view === "attendance" && <AttendanceView data={data} />}
                    {view === "report" && <ReportView data={data} />}
                    {view === "report-details" && <ReportDetailsView data={data} />}
                    {view === "likes" && <LikesView data={data} />}
                    {view === "my-clubs" && currentUser && <MyClubsView userId={currentUser.uid} />}
                    {view === "post-history" && <PostHistoryView data={data} />}
                    {view === "support-ticket-info" && <SupportTicketInfoView data={data} />}
                    {view === "mapHelp" && <MapHelpView />}
                </div>
            </MobileFullScreenModal>
        );
    }

    // Desktop/Tablet: Bell button in top-right when sidebar is closed - REMOVED per user request
    if (!isVisible) {
        return null;
    }

    // Desktop/Tablet sidebar
    return (
        <>
            {isResizing && (
                <div className="fixed inset-0 z-50 cursor-ew-resize" />
            )}
            <div className="h-full w-full flex flex-col py-4 pr-4 pl-0">
                {/* Floating sidebar card */}
                <div
                    className="flex-1 flex flex-col rounded-3xl overflow-hidden cc-glass-strong cc-shadow-floating border border-secondary/15 relative"
                >
                    {/* Resize Handle */}
                    <div
                        className="absolute -left-1 top-0 bottom-0 w-3 cursor-ew-resize group z-10"
                        onMouseDown={() => setIsResizing(true)}
                    >
                        <div className="absolute left-1 top-0 bottom-0 w-px bg-secondary/10 group-hover:bg-secondary/20 transition-colors" />
                        <div className="absolute left-0.5 top-1/2 -translate-y-1/2 w-1 h-16 bg-secondary/20 group-hover:bg-secondary/40 rounded-full transition-colors" />
                    </div>
                    {/* Header - Floating Overlay */}
                    <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-4 pb-2 pointer-events-none bg-gradient-to-b from-transparent to-transparent">
                        <div className="flex items-center gap-3 pointer-events-auto">
                            {view !== "notifications" && (
                                <button
                                    onClick={showNotifications}
                                    className="flex h-10 w-10 items-center justify-center rounded-full cc-header-btn active:scale-95 transition-all text-secondary hover:text-foreground"
                                >
                                    <ChevronLeftIcon className="h-5 w-5" />
                                </button>
                            )}
                            {view !== "details" && view !== "notifications" && (
                                <div className="flex items-center rounded-full cc-glass-strong px-5 py-1.5 shadow-sm border-2 border-secondary/20">
                                    <h1 className="text-sm font-bold text-foreground">

                                        {view === "comments" && "Comments"}
                                        {view === "attendance" && "Guest List"}
                                        {view === "report" && "Report Content"}
                                        {view === "report-details" && "Report Details"}
                                        {view === "post-history" && "Post History"}
                                        {view === "likes" && "Likes"}
                                        {view === "my-clubs" && "My Clubs"}
                                        {view === "club-privacy-info" && "Club Privacy"}
                                        {view === "support-ticket-info" && "Ticket Info"}
                                        {view === "mapHelp" && "How to get a Map Link"}
                                    </h1>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Content */}
                    {/* Content */}
                    <div className={`flex-1 overflow-y-auto px-2 pb-2 ${view === 'notifications' ? 'pt-3' : 'pt-14'}`}>
                        {view === "notifications" && <NotificationsView />}
                        {view === "comments" && <CommentsView data={data} />}
                        {view === "details" && <PostDetailsSidebarView data={data} />}
                        {view === "attendance" && <AttendanceView data={data} />}
                        {view === "report" && <ReportView data={data} />}
                        {view === "likes" && <LikesView data={data} />}
                        {view === "my-clubs" && currentUser && <MyClubsView userId={currentUser.uid} />}
                        {view === "report-details" && <ReportDetailsView data={data} />}
                        {view === "post-history" && <PostHistoryView data={data} />}
                        {view === "club-privacy-info" && <ClubPrivacyInfoView />}
                        {view === "support-ticket-info" && <SupportTicketInfoView data={data} />}
                        {view === "mapHelp" && <MapHelpView />}
                    </div>
                </div>
            </div>
        </>
    );
}

function NotificationsView() {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const { close, view, isVisible } = useRightSidebar();
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, notif: any } | null>(null);
    const [filter, setFilter] = useState<'all' | 'unread' | 'mentions' | 'comments' | 'likes'>('all');

    // Reset filter to 'all' when the view is active and potentially becomes visible
    useEffect(() => {
        if (isVisible && view === 'notifications') {
            setFilter('all');
        }
    }, [isVisible, view]);

    // Refs for measuring button positions (iOS 26 glass segmented control)
    const containerRef = useRef<HTMLDivElement>(null);
    const buttonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
    const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
    const pickerRef = useRef<HTMLDivElement>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [shouldStretch, setShouldStretch] = useState(true);



    // Update indicator position when filter changes
    useEffect(() => {
        const button = buttonRefs.current[filter];
        const container = containerRef.current;
        if (button && container) {
            const containerRect = container.getBoundingClientRect();
            const buttonRect = button.getBoundingClientRect();
            setIndicatorStyle({
                left: buttonRect.left - containerRect.left,
                width: buttonRect.width
            });
        }
    }, [filter]);

    // Initialize indicator position on mount
    useEffect(() => {
        const button = buttonRefs.current[filter];
        const container = containerRef.current;
        if (button && container) {
            const containerRect = container.getBoundingClientRect();
            const buttonRect = button.getBoundingClientRect();
            setIndicatorStyle({
                left: buttonRect.left - containerRect.left,
                width: buttonRect.width
            });
        }
    }, []);

    // Global click listener to close context menu
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setCurrentUser(u));
        return () => unsub();
    }, []);

    useEffect(() => {
        if (!currentUser) return;

        // Query top-level notifications collection
        const q = query(
            collection(db, "notifications"),
            where("toUid", "==", currentUser.uid),
            orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot: any) => {
            const notifs = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
            setNotifications(notifs);
            setLoading(false);
        }, (error: any) => {
            console.error("Notifications fetch error:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);

    // Automatically mark all unread notifications as read when вони showing in the view
    useEffect(() => {
        if (!notifications || notifications.length === 0) return;

        const unreadNotifs = notifications.filter(n => !n.isRead);
        if (unreadNotifs.length === 0) return;

        const markAllAsRead = async () => {
            const batch = writeBatch(db);
            unreadNotifs.forEach(notif => {
                const docRef = doc(db, "notifications", notif.id);
                batch.update(docRef, {
                    isRead: true,
                    readAt: serverTimestamp()
                });
            });

            try {
                await batch.commit();
            } catch (e) {
                console.error("Error marking notifications as read:", e);
            }
        };

        // Delay slightly to ensure user actually sees them/component is stable
        const timeoutId = setTimeout(markAllAsRead, 1000);
        return () => clearTimeout(timeoutId);
    }, [notifications]);


    // Check if picker should stretch to fill width
    const checkIfShouldStretch = useCallback(() => {
        if (pickerRef.current && containerRef.current) {
            const pickerWidth = pickerRef.current.offsetWidth;
            // 5 tabs, if sidebar is wide enough to give each ~80px, stretch them
            setShouldStretch(pickerWidth > 400);
        }
    }, []);

    // Function to calculate and update indicator position
    const updateIndicator = useCallback(() => {
        const button = buttonRefs.current[filter];
        const container = containerRef.current;
        if (button && container) {
            const containerRect = container.getBoundingClientRect();
            const buttonRect = button.getBoundingClientRect();
            if (buttonRect.width > 0) {
                setIndicatorStyle({
                    left: buttonRect.left - containerRect.left,
                    width: buttonRect.width
                });
            }
        }
    }, [filter]);

    // Update indicator when filter or loading changes
    useEffect(() => {
        if (!loading) {
            // Give a tiny bit for the browser to paint
            const raf = requestAnimationFrame(() => {
                checkIfShouldStretch();
                updateIndicator();
            });
            return () => cancelAnimationFrame(raf);
        }
    }, [filter, loading, checkIfShouldStretch, updateIndicator]);

    // Handle search toggle
    const handleSearchToggle = () => {
        setIsSearchExpanded(!isSearchExpanded);
        if (isSearchExpanded) {
            setSearchQuery('');
        }
    };

    // ResizeObserver for robust layout tracking
    useEffect(() => {
        if (loading || !containerRef.current) return;

        const observer = new ResizeObserver(() => {
            checkIfShouldStretch();
            updateIndicator();
        });

        observer.observe(containerRef.current);
        if (pickerRef.current) observer.observe(pickerRef.current);

        return () => observer.disconnect();
    }, [loading, checkIfShouldStretch, updateIndicator]);

    const handleContextMenu = (e: React.MouseEvent, notif: any) => {
        e.preventDefault();
        e.stopPropagation();

        // Adjust menu position to keep it on screen
        let x = e.clientX;
        let y = e.clientY;

        const MENU_WIDTH = 200;
        const MENU_HEIGHT = 120;

        if (x + MENU_WIDTH > window.innerWidth) x -= MENU_WIDTH;
        if (y + MENU_HEIGHT > window.innerHeight) y -= MENU_HEIGHT;

        setContextMenu({ x, y, notif });
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteDoc(doc(db, "notifications", id));
        } catch (e) {
            console.error("Error deleting notification:", e);
        }
    };

    const toggleRead = async (id: string, currentRead: boolean) => {
        try {
            await updateDoc(doc(db, "notifications", id), { isRead: !currentRead });
        } catch (e) {
            console.error("Error updating notification status:", e);
        }
    };

    // Removed auto-close logic to keep sidebar open on desktop by default as requested


    if (loading) {
        return <div className="text-center text-sm text-neutral-500 py-10">Loading...</div>;
    }

    if (notifications.length === 0) {
        return (
            <div className="flex flex-col gap-4">
                <div className="text-center text-sm text-neutral-500 py-10">
                    No new notifications
                </div>
            </div>
        );
    }



    // Filter notifications based on selected filter and search query
    const filteredNotifications = notifications.filter(notif => {
        // First apply tab filter
        let passesTabFilter = true;
        if (filter === 'unread') passesTabFilter = !notif.isRead;
        else if (filter === 'mentions') passesTabFilter = notif.type === 'mention' || notif.body?.includes('@');
        else if (filter === 'comments') passesTabFilter = notif.type === 'comment' || notif.type === 'reply';
        else if (filter === 'likes') passesTabFilter = notif.type === 'like' || notif.type === 'post_like';

        if (!passesTabFilter) return false;

        // Then apply search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            const title = (notif.title || "").toLowerCase();
            const body = (notif.body || "").toLowerCase();
            const actorName = (notif.actorName || "").toLowerCase();

            return (
                title.includes(query) ||
                body.includes(query) ||
                actorName.includes(query)
            );
        }

        return true;
    });

    return (
        <>
            {/* Telegram iOS Style Search/Filter Header */}
            <div className="sticky top-0 z-10 -mx-2 px-2 space-y-3 pb-3">
                {/* Search Bar Row */}
                <div className="relative flex items-center gap-3">
                    {/* Notifications Title Capsule - fades out with scale */}
                    <div className={`relative transition-all duration-500 ease-out ${isSearchExpanded ? 'absolute scale-95 pointer-events-none' : 'scale-100'
                        }`} style={{
                            transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                            opacity: isSearchExpanded ? 0 : 1
                        }}>
                        <div className="cc-glass-strong px-5 py-3 rounded-full border-2 border-secondary/20 shadow-sm">
                            <span className="text-foreground font-semibold text-base whitespace-nowrap">
                                Notifications
                            </span>
                        </div>
                    </div>

                    {/* Spacer - pushes button to right when search is collapsed */}
                    <div className={`transition-all duration-500 ease-out ${isSearchExpanded ? 'w-0' : 'flex-1'
                        }`} style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }} />

                    {/* Search Input Container - liquid glass expansion */}
                    <div className={`absolute transition-all duration-500 ease-out ${isSearchExpanded
                            ? 'left-0 right-14 scale-100 pointer-events-auto z-20'
                            : 'left-auto right-0 w-12 scale-95 pointer-events-none z-0'
                        }`} style={{
                            transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                            transformOrigin: 'right center',
                            opacity: isSearchExpanded ? 1 : 0
                        }}>
                        <div className="cc-glass-strong rounded-full border-2 border-secondary/20 shadow-sm">
                            <div className="relative flex items-center px-5 py-3 transition-opacity duration-300"
                                style={{
                                    transitionDelay: isSearchExpanded ? '150ms' : '0ms',
                                    opacity: isSearchExpanded ? 1 : 0
                                }}>
                                <MagnifyingGlassIcon className="w-4 h-4 text-secondary mr-3 flex-shrink-0" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search notifications"
                                    className="flex-1 bg-transparent outline-none text-foreground placeholder-secondary text-base"
                                    autoFocus={isSearchExpanded}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Search/Close button - always on right with icon transition */}
                    <button
                        onClick={handleSearchToggle}
                        className="relative flex-shrink-0 w-12 h-12 rounded-full transition-all duration-300 active:scale-95 z-10 ml-auto"
                        style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                    >
                        <div className="cc-glass-strong rounded-full border-2 border-secondary/20 shadow-sm transition-all duration-500 absolute inset-0"
                            style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                        </div>

                        <div className="relative flex items-center justify-center h-full">
                            <div className={`absolute transition-all duration-300 ${isSearchExpanded ? 'opacity-0 scale-50 rotate-90' : 'opacity-100 scale-100 rotate-0'
                                }`} style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                                <MagnifyingGlassIcon className="w-5 h-5 text-secondary" strokeWidth={2.5} />
                            </div>
                            <div className={`absolute transition-all duration-300 ${isSearchExpanded ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 rotate-90'
                                }`} style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                                <XMarkIcon className="w-5 h-5 text-secondary" strokeWidth={2.5} />
                            </div>
                        </div>
                    </button>
                </div>

                {/* Telegram iOS Filter Picker */}
                <div className="relative w-full">
                    {/* Fixed background pill */}
                    <div className="absolute inset-0 cc-glass rounded-full border-2 border-secondary/20 shadow-sm pointer-events-none">

                    </div>

                    {/* Scrollable content */}
                    <div ref={pickerRef} className="relative overflow-hidden rounded-full">
                        <div className="p-1 overflow-x-auto scrollbar-hide">
                            <div ref={containerRef} className={`relative flex items-center gap-1 ${shouldStretch ? 'w-full' : 'w-max min-w-full'}`}>
                                {/* Animated sliding capsule */}
                                <div
                                    className="absolute bg-foreground/10 border border-secondary/20 rounded-full shadow-sm pointer-events-none"
                                    style={{
                                        left: `${indicatorStyle.left}px`,
                                        width: `${indicatorStyle.width}px`,
                                        height: 'calc(100% - 2px)',
                                        top: '1px',
                                        transition: 'left 0.22s cubic-bezier(0.2, 0.8, 0.2, 1), width 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)',
                                    }}
                                >
                                    <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/5 to-transparent" />
                                </div>

                                {/* Filter buttons */}
                                {[
                                    { id: 'all', label: 'All' },
                                    { id: 'unread', label: 'Unread' },
                                    { id: 'mentions', label: 'Mentions' },
                                    { id: 'comments', label: 'Comments' },
                                    { id: 'likes', label: 'Likes' }
                                ].map((tab) => {
                                    const isActive = filter === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            ref={(el) => { buttonRefs.current[tab.id] = el; }}
                                            onClick={() => setFilter(tab.id as any)}
                                            role="tab"
                                            aria-selected={isActive}
                                            aria-controls="notifications-panel"
                                            className={`relative ${shouldStretch ? 'flex-1 px-2' : 'flex-shrink-0 px-5'} py-2 rounded-full font-semibold text-[16px] group z-10`}
                                        >
                                            {!isActive && (
                                                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 rounded-full transition-all duration-200" />
                                            )}

                                            <span className={`relative flex items-center justify-center whitespace-nowrap transition-all duration-400 ${isActive ? "text-foreground" : "text-secondary"}`}
                                                style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
                                                {tab.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>


            {/* Notifications List */}
            <div id="notifications-panel">
                {filteredNotifications.length === 0 ? (
                    <div className="text-center text-sm text-neutral-500 py-10">
                        No {filter === 'all' ? '' : filter} notifications
                    </div>
                ) : (
                    <div className="flex flex-col gap-3 pb-8">
                        {filteredNotifications.map((notif) => (
                            <div
                                key={notif.id}
                                className={`flex items-start gap-3 rounded-[24px] p-3 border transition-all duration-200 cursor-pointer ${notif.isRead
                                    ? "bg-secondary/5 border-transparent opacity-60"
                                    : "bg-secondary/10 border-secondary/20 shadow-sm"
                                    }`}
                                onClick={() => {
                                    // Mark as read
                                    if (!notif.isRead) {
                                        updateDoc(doc(db, "notifications", notif.id), { isRead: true }).catch(console.error);
                                    }

                                    if (notif.deeplink?.params?.postId) {
                                        window.location.href = `/posts/${notif.deeplink.params.postId}`;
                                    } else if (notif.deeplink?.params?.clubId) {
                                        window.location.href = `/clubs/${notif.deeplink.params.clubId}`;
                                    }
                                }}
                                onContextMenu={(e) => handleContextMenu(e, notif)}
                            >
                                <div className="shrink-0 pt-0.5">
                                    <div className="relative">
                                        <div className="h-10 w-10 overflow-hidden rounded-full bg-surface-2 ring-1 ring-secondary/30 aspect-square shadow-sm relative">
                                            {notif.actorPhotoURL ? (
                                                <img
                                                    src={notif.actorPhotoURL}
                                                    alt=""
                                                    className="absolute inset-0 !h-full !w-full block object-cover object-center"
                                                />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center bg-foreground/10 text-sm font-bold text-foreground">
                                                    {notif.actorName ? notif.actorName.charAt(0).toUpperCase() : (notif.title ? notif.title.charAt(0).toUpperCase() : "U")}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className={`text-[13px] leading-snug truncate ${notif.isRead ? "text-neutral-400 font-medium" : "text-white font-semibold"}`}>
                                            {notif.title}
                                        </p>
                                        <span className="text-[10px] text-neutral-500 shrink-0 font-medium whitespace-nowrap pt-0.5">
                                            {(() => {
                                                if (!notif.createdAt) return 'now';
                                                const date = notif.createdAt.toDate ? notif.createdAt.toDate() : new Date(notif.createdAt);
                                                const diffInSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
                                                if (diffInSeconds < 60) return "now";
                                                if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
                                                if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
                                                if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
                                                return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                                            })()}
                                        </span>
                                    </div>
                                    {notif.body && (
                                        <p className={`text-[12px] line-clamp-2 leading-relaxed ${notif.isRead ? "text-neutral-500" : "text-neutral-400"}`}>{notif.body}</p>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Context Menu - Portal to body to avoid clipping/positioning issues */}
                        {contextMenu && createPortal(
                            <div
                                className="fixed z-[99999] min-w-[210px] cc-radius-menu cc-glass-strong shadow-2xl border-2 border-secondary/30 p-1.5 animate-in fade-in zoom-in duration-100"
                                style={{ top: contextMenu.y, left: contextMenu.x }}
                                onClick={(e) => e.stopPropagation()}
                                onContextMenu={(e) => e.preventDefault()}
                            >
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleRead(contextMenu.notif.id, contextMenu.notif.isRead);
                                        setContextMenu(null);
                                    }}
                                    className="flex w-full items-center justify-between rounded-full px-4 py-2.5 text-sm text-foreground hover:bg-white/10 transition-colors"
                                >
                                    <span className="font-medium">{contextMenu.notif.isRead ? "Mark as Unread" : "Mark as Read"}</span>
                                </button>

                                <div className="h-px bg-secondary/10 my-1 mx-1.5" />

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(contextMenu.notif.id);
                                        setContextMenu(null);
                                    }}
                                    className="flex w-full items-center justify-between rounded-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                                >
                                    <span className="font-medium">Delete Notification</span>
                                    <TrashIcon className="h-4 w-4" />
                                </button>
                            </div>,
                            document.body
                        )}
                    </div>
                )}
            </div>
        </>
    );
}

function PostDetailsSidebarView({ data }: { data: Post | null }) {
    if (!data) {
        return <div className="text-neutral-500 text-sm">No post selected.</div>;
    }

    return (
        <div className="flex flex-col">
            {/* 1) Media section (hero) if available */}
            {(data.imageUrls && data.imageUrls.length > 0 || data.coordinates) && (
                <div className="px-1 mb-4">
                    <MediaHorizontalScroll
                        post={data}
                        noPadding
                        fullWidth
                    />
                </div>
            )}

            <div className="px-3">
                {/* 2) Post content block (Chat-style) */}
                <PostDetailMainInfo post={data} />

                {/* 3) Embedded Comments */}
                <div className="mt-4 pt-4 border-t border-secondary/15 -mx-2">
                    <CommentsView data={data} />
                </div>
            </div>
        </div>
    );
}

function AttendanceView({ data }: { data: any }) {
    const [attendance, setAttendance] = useState<{
        going: string[];
        maybe: string[];
        notGoing: string[];
    }>({ going: [], maybe: [], notGoing: [] });
    const [currentUser, setCurrentUser] = useState<any>(null);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setCurrentUser(u));
        return () => unsub();
    }, []);

    useEffect(() => {
        if (!data?.id) return;

        const docRef = doc(db, "posts", data.id);

        const unsubscribe = onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
                const d = snap.data();
                setAttendance({
                    going: d.goingUids || [],
                    maybe: d.maybeUids || [],
                    notGoing: d.notGoingUids || []
                });
            }
        }, (error) => {
            console.error("Error fetching attendance:", error);
        });

        return () => unsubscribe();
    }, [data?.id]);

    return (
        <div className="flex flex-col gap-6">
            {/* Going */}
            <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-green-400">
                    Going ({attendance.going.length})
                </h3>
                {attendance.going.length === 0 ? (
                    <p className="text-xs text-neutral-500">No one yet</p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {attendance.going.map(uid => (
                            <UserRow key={uid} uid={uid} />
                        ))}
                    </div>
                )}
            </div>

            {/* Maybe */}
            <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-orange-400">
                    Maybe ({attendance.maybe.length})
                </h3>
                {attendance.maybe.length === 0 ? (
                    <p className="text-xs text-neutral-500">No one yet</p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {attendance.maybe.map(uid => (
                            <UserRow key={uid} uid={uid} />
                        ))}
                    </div>
                )}
            </div>

            {/* Not Going */}
            <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-red-400">
                    Not Going ({attendance.notGoing.length})
                </h3>
                {attendance.notGoing.length === 0 ? (
                    <p className="text-xs text-neutral-500">No one yet</p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {attendance.notGoing.map(uid => (
                            <UserRow key={uid} uid={uid} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// Helper for UserRow to support "onlyAvatar" mode if needed, 
// but since I can't modify UserRow right now, I'll just use it as is.
// Wait, I should update UserRow to support `onlyAvatar` or just style it here.
// I'll just use the standard UserRow for now.

function ReportView({ data }: { data: any }) {
    const { close } = useRightSidebar();
    const [selectedReason, setSelectedReason] = useState<string | null>(null);
    const [details, setDetails] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const ui = {
        emptyState: "text-secondary text-sm py-10 text-center",
        form: "p-4 space-y-6",
        sectionLabel: "block text-sm font-semibold text-secondary mb-3",
        card: "rounded-2xl bg-surface-2/50 backdrop-blur-xl ring-1 ring-secondary/10",
        optionRow: "flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-colors bg-surface-2/50 hover:bg-secondary/10 ring-1 ring-secondary/10",
        optionRowActive: "bg-secondary/10 ring-1 ring-red-500/30",
        radio: "h-4 w-4 text-red-500 focus:ring-red-500 focus:ring-offset-background",
        textarea: "w-full resize-none rounded-2xl bg-surface-2/50 backdrop-blur-xl ring-1 ring-secondary/10 px-4 py-3 text-sm text-foreground placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-red-500/30",
        helperText: "text-xs text-secondary mt-1.5",
        errorBox: "rounded-2xl bg-surface-2/30 backdrop-blur-xl ring-1 ring-red-500/25 p-3",
        submitBtn: "w-full rounded-full bg-red-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-red-600 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed",
        footnote: "text-[11px] text-center text-secondary leading-relaxed",
        successWrap: "p-8 text-center flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300",
        successIconWrap: "inline-flex h-16 w-16 items-center justify-center rounded-full bg-surface-2/50 backdrop-blur-xl ring-1 ring-emerald-500/25 mb-4",
    };

    if (!data || !data.id) {
        return <div className={ui.emptyState}>No content selected.</div>;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedReason) {
            setError("Please select a reason");
            return;
        }

        const currentUser = auth.currentUser;
        if (!currentUser) {
            setError("You must be signed in to report posts");
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            // TESTING MODE: Using addDoc to allow multiple reports from same user
            const reportsRef = collection(db, "posts", data.id, "reports");

            await addDoc(reportsRef, {
                reporterUid: currentUser.uid,
                reason: selectedReason,
                details: details.trim().slice(0, 500),
                createdAt: serverTimestamp(),
            });

            setSuccess(true);

            // Close sidebar after brief delay
            setTimeout(() => {
                close();
                // Reset state
                setSelectedReason(null);
                setDetails("");
                setSuccess(false);
            }, 1500);

        } catch (err: any) {
            console.error("Error submitting report:", err);

            if (err.code === "permission-denied" || err.message?.includes("already exists")) {
                setError("You have already reported this post");
            } else {
                setError("Failed to submit report. Please try again.");
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (success) {
        return (
            <div className={ui.successWrap}>
                <div className={ui.successIconWrap}>
                    <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <p className="text-foreground font-medium">Report submitted</p>
                <p className="text-sm text-secondary mt-1">Thank you for helping keep our community safe</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className={ui.form}>
            {/* Reason Selection */}
            <div>
                <label className={ui.sectionLabel}>
                    Why are you reporting this post?
                </label>
                <div className="space-y-2">
                    {(Object.keys(REPORT_REASON_LABELS) as Array<keyof typeof REPORT_REASON_LABELS>).map((reason) => (
                        <label
                            key={reason}
                            className={`${ui.optionRow} ${selectedReason === reason ? ui.optionRowActive : ""}`}
                        >
                            <input
                                type="radio"
                                name="reason"
                                value={reason}
                                checked={selectedReason === reason}
                                onChange={(e) => setSelectedReason(e.target.value)}
                                className={ui.radio}
                            />
                            <span className="text-sm text-foreground">{REPORT_REASON_LABELS[reason]}</span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Optional Details */}
            <div>
                <label className={ui.sectionLabel}>
                    Additional details (optional)
                </label>
                <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder="Provide more context about this report..."
                    className={ui.textarea}
                />
                <p className={ui.helperText}>
                    {details.length}/500 characters
                </p>
            </div>

            {/* Error Message */}
            {error && (
                <div className={ui.errorBox}>
                    <p className="text-sm text-red-400">{error}</p>
                </div>
            )}

            {/* Submit Button */}
            <button
                type="submit"
                disabled={!selectedReason || submitting}
                className={ui.submitBtn}
            >
                {submitting ? "Submitting..." : "Submit Report"}
            </button>

            <p className={ui.footnote}>
                Reports are reviewed by our moderation team. False reports may result in action against your account.
            </p>
        </form>
    );
}

function LikesView({ data }: { data: any }) {
    const [likers, setLikers] = useState<string[]>([]);

    useEffect(() => {
        if (!data?.id) return;

        // Unified 'posts' collection for all items (events are posts)
        const docRef = doc(db, "posts", data.id);

        const unsubscribe = onSnapshot(docRef, (snap: any) => {
            if (snap.exists()) {
                const d = snap.data();
                // Use 'likes' array, fallback to 'likedByUids' for legacy
                setLikers(d.likes || d.likedByUids || []);
            }
        }, (error: any) => {
            console.error("Error fetching likes:", error);
        });

        return () => unsubscribe();
    }, [data?.id]);

    return (
        <div className="flex flex-col gap-6">
            <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    Liked by ({likers.length})
                </h3>
                {likers.length === 0 ? (
                    <p className="text-xs text-neutral-500">No likes yet</p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {likers.map(uid => (
                            <UserRow key={uid} uid={uid} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function ReportDetailsView({ data }: { data: any }) {
    if (!data) {
        return (
            <div className="p-4 text-center">
                <p className="text-neutral-500 text-sm">No report data available</p>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4">
            <div>
                <p className="text-xs text-neutral-500 mb-1">Reported by</p>
                <p className="text-sm text-white">@{data.username || "Unknown"}</p>
            </div>

            <div>
                <p className="text-xs text-neutral-500 mb-1">Reason</p>
                <p className="text-sm text-white">{data.reason || "No reason provided"}</p>
            </div>

            {data.details && (
                <div>
                    <p className="text-xs text-neutral-500 mb-1">Details</p>
                    <p className="text-sm text-neutral-300 whitespace-pre-wrap">{data.details}</p>
                </div>
            )}

            {data.createdAt && (
                <div>
                    <p className="text-xs text-neutral-500 mb-1">Submitted</p>
                    <p className="text-sm text-neutral-400">
                        {formatDistanceToNow(data.createdAt.toDate(), { addSuffix: true })}
                    </p>
                </div>
            )}
        </div>
    );
}

function PostHistoryView({ data }: { data: any }) {
    const [historyData, setHistoryData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!data?.postId) {
            setLoading(false);
            return;
        }

        const fetchHistory = async () => {
            try {
                const db = (await import("@/lib/firebase")).db;
                const { doc, getDoc, collection, getDocs } = await import("firebase/firestore");

                // Fetch post creation data
                const postDoc = await getDoc(doc(db, "posts", data.postId));
                const postData = postDoc.exists() ? postDoc.data() : null;

                // Fetch author username
                let authorUsername = "Unknown";
                if (postData?.authorId) {
                    try {
                        const authorDoc = await getDoc(doc(db, "users", postData.authorId));
                        if (authorDoc.exists()) {
                            authorUsername = authorDoc.data().username || "Unknown";
                        }
                    } catch {
                        console.error("Failed to fetch author");
                    }
                }

                // Fetch hiddenBy username if applicable
                let hiddenByUsername = "Unknown Admin";
                if (postData?.hiddenBy) {
                    try {
                        const adminDoc = await getDoc(doc(db, "users", postData.hiddenBy));
                        if (adminDoc.exists()) {
                            hiddenByUsername = adminDoc.data().username || "Unknown Admin";
                        }
                    } catch {
                        console.error("Failed to fetch admin info");
                    }
                }

                // Fetch all reports
                const reportsSnapshot = await getDocs(collection(db, `posts/${data.postId}/reports`));
                const reports = await Promise.all(
                    reportsSnapshot.docs.map(async (reportDoc) => {
                        const reportData = reportDoc.data();
                        // Fetch reporter username
                        try {
                            const userDoc = await getDoc(doc(db, "users", reportData.uid));
                            const username = userDoc.exists() ? userDoc.data().username : "Unknown";
                            return {
                                id: reportDoc.id,
                                username,
                                ...reportData,
                            };
                        } catch {
                            return {
                                id: reportDoc.id,
                                username: "Unknown",
                                ...reportData,
                            };
                        }
                    })
                );

                // Sort reports by createdAt (oldest first)
                reports.sort((a: any, b: any) => {
                    if (!a.createdAt || !b.createdAt) return 0;
                    return a.createdAt.toMillis() - b.createdAt.toMillis();
                });

                setHistoryData({
                    createdAt: postData?.createdAt,
                    authorId: postData?.authorId,
                    authorUsername,
                    visibility: postData?.visibility || "visible",
                    hiddenAt: postData?.hiddenAt,
                    hiddenBy: postData?.hiddenBy,
                    hiddenByUsername,
                    moderationReason: postData?.moderationReason || postData?.moderationNote,
                    reports,
                });
            } catch (error) {
                console.error("Error fetching post history:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [data?.postId]);

    if (loading) {
        return (
            <div className="p-4 text-center">
                <p className="text-neutral-500 text-sm">Loading history...</p>
            </div>
        );
    }

    if (!historyData) {
        return (
            <div className="p-4 text-center">
                <p className="text-neutral-500 text-sm">No history data available</p>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-6">
            {/* Creation Info */}
            <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white">Post Created</h3>
                {historyData.createdAt && (
                    <div className="text-sm text-neutral-300">
                        <p>
                            On <span className="font-medium">{new Date(historyData.createdAt.toDate()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span> at <span className="font-medium">{new Date(historyData.createdAt.toDate()).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                        </p>
                        <p className="mt-1">
                            By <span className="font-medium text-[#ffb200]">@{historyData.authorUsername}</span>
                        </p>
                    </div>
                )}
            </div>

            {/* Current Status */}
            <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white">Current Status</h3>
                <div>
                    {historyData.visibility === "under_review" && (
                        <p className="text-sm px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">
                            ⏳ Under Review - Awaiting moderation decision
                        </p>
                    )}
                    {historyData.visibility === "hidden" && (
                        <p className="text-sm px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                            🚫 Hidden - Post removed from public view
                        </p>
                    )}
                    {historyData.visibility === "visible" && (
                        <p className="text-sm px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400">
                            ✓ Visible - Post is publicly visible
                        </p>
                    )}

                    {/* Display moderation details if hidden */}
                    {historyData.visibility === "hidden" && (
                        <div className="mt-4 p-4 rounded-[20px] bg-red-500/5 backdrop-blur-xl border border-red-500/10 shadow-[0_8px_32px_rgba(239,68,68,0.05)] space-y-3">
                            <div className="text-sm text-neutral-200 flex flex-col gap-1">
                                <p className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]"></span>
                                    Hidden by <span className="font-semibold text-red-300">@{historyData.hiddenByUsername}</span>
                                </p>
                                {historyData.hiddenAt && (
                                    <p className="text-xs text-neutral-400 pl-3.5 border-l border-white/10 ml-[2.5px]">
                                        {new Date(historyData.hiddenAt.toDate()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} • {new Date(historyData.hiddenAt.toDate()).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                    </p>
                                )}
                            </div>
                            {historyData.moderationReason && (
                                <div className="cc-glass rounded-[14px] p-3 border border-white/5 backdrop-blur-sm">
                                    <p className="text-[10px] text-neutral-400 mb-1 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-red-400">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                        </svg>
                                        Reason
                                    </p>
                                    <p className="text-sm text-neutral-200 font-medium pl-0.5 leading-relaxed">
                                        {historyData.moderationReason}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Reports Section */}
            {historyData.reports && historyData.reports.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-white">
                        Reports ({historyData.reports.length})
                    </h3>
                    <div className="space-y-3">
                        {historyData.reports.map((report: any, idx: number) => (
                            <div
                                key={report.id || idx}
                                className="p-3 rounded-lg cc-glass border border-white/5 space-y-2"
                            >
                                <div className="text-sm text-neutral-300">
                                    <p>
                                        Reported by <span className="font-medium text-white">@{report.username}</span>
                                    </p>
                                    {report.createdAt && (
                                        <p className="text-xs text-neutral-500 mt-1">
                                            On {new Date(report.createdAt.toDate()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at {new Date(report.createdAt.toDate()).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <p className="text-xs text-neutral-500 mb-1">Reason</p>
                                    <p className="text-sm text-white">{report.reason || "No reason provided"}</p>
                                </div>
                                {report.details && (
                                    <div>
                                        <p className="text-xs text-neutral-500 mb-1">Details</p>
                                        <p className="text-sm text-neutral-300 whitespace-pre-wrap">
                                            {report.details}
                                        </p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {historyData.reports && historyData.reports.length === 0 && (
                <div className="text-center py-4">
                    <p className="text-sm text-neutral-500">No reports for this post</p>
                </div>
            )}
        </div>
    );
}

function ClubPrivacyInfoView() {
    return (
        <div className="p-4 space-y-6">
            <div className="space-y-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 shadow-lg shadow-primary/20 shadow-teal-500/20">
                    <LockClosedIcon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white">Private Clubs</h3>
                <p className="text-sm text-neutral-300 leading-relaxed">
                    Private clubs require users to request access before they can join.
                    Club admins must review and approve these requests.
                </p>
                <div className="rounded-xl cc-glass p-4 border border-white/5">
                    <ul className="space-y-2 text-sm text-neutral-400">
                        <li className="flex items-start gap-2">
                            <span className="mt-1 block h-1 w-1 rounded-full bg-teal-500" />
                            <span>Posts are visible to members only by default</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="mt-1 block h-1 w-1 rounded-full bg-teal-500" />
                            <span>Non-members cannot see the member list</span>
                        </li>
                    </ul>
                </div>
            </div>

            <div className="h-px bg-white/5" />

            <div className="space-y-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg shadow-primary/20 shadow-indigo-500/20">
                    <PaperAirplaneIcon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white">Post Visibility</h3>
                <p className="text-sm text-neutral-300 leading-relaxed">
                    Verified clubs can broadcast updates to the entire campus.
                </p>
                <div className="rounded-xl cc-glass p-4 border border-white/5">
                    <ul className="space-y-3 text-sm text-neutral-400">
                        <li className="flex gap-3">
                            <UserGroupIcon className="h-5 w-5 text-indigo-400 shrink-0" />
                            <div>
                                <p className="text-white font-medium mb-0.5">Members Only</p>
                                <p className="text-xs">Posts appear only in the club's feed and the user's "My Feed".</p>
                            </div>
                        </li>
                        <li className="flex gap-3">
                            <ExclamationTriangleIcon className="h-5 w-5 text-amber-400 shrink-0" />
                            <div>
                                <p className="text-white font-medium mb-0.5">Campus Wide</p>
                                <p className="text-xs">Posts appear in the main "Explore" feed for everyone.</p>
                                <p className="text-[10px] text-amber-500 mt-1 uppercase tracking-wider font-bold">Requires Verification</p>
                            </div>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

function SupportTicketInfoView({ data }: { data: any }) {
    const [status, setStatus] = useState(data?.status || "open");
    const [priority, setPriority] = useState(data?.priority || "3");
    const [category, setCategory] = useState(data?.category || "General Inquiry");
    const [updating, setUpdating] = useState(false);
    const [userName, setUserName] = useState(data?.name || "Unknown User");
    const [userEmail, setUserEmail] = useState(data?.email || "");
    const [userUsername, setUserUsername] = useState("");

    // Fetch user info by UID if available
    useEffect(() => {
        const fetchUserInfo = async () => {
            if (data?.uid) {
                try {
                    const userDoc = await getDoc(doc(db, "users", data.uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        setUserName(userData.name || userData.displayName || userData.username || "Unknown User");
                        setUserEmail(userData.email || "");
                        setUserUsername(userData.username || "");
                    } else {
                        setUserName("User not found");
                        setUserEmail("");
                        setUserUsername("");
                    }
                } catch (e) {
                    console.error("Failed to fetch user info:", e);
                    setUserName("Error loading");
                    setUserEmail("");
                }
            } else {
                // Fallback to ticket data for legacy tickets
                setUserName(data?.name || "Unknown User");
                setUserEmail(data?.email || "");
                setUserUsername("");
            }
        };
        fetchUserInfo();
    }, [data?.uid, data?.name, data?.email]);

    // Sync state when data changes
    useEffect(() => {
        if (data) {
            setStatus(data.status || "open");
            setPriority(data.priority || "3");
            setCategory(data.category || "General Inquiry");
        }
    }, [data]);

    if (!data) {
        return <div className="p-4 text-neutral-500 text-sm">No ticket selected.</div>;
    }

    const handleStatusChange = async (newStatus: string) => {
        if (newStatus === status || !data.id) return;
        setUpdating(true);
        try {
            await updateDoc(doc(db, "supportTickets", data.id), {
                status: newStatus,
                updatedAt: serverTimestamp()
            });
            setStatus(newStatus);
        } catch (err) {
            console.error("Failed to update status:", err);
        } finally {
            setUpdating(false);
        }
    };

    const handlePriorityChange = async (newPriority: string) => {
        if (newPriority === priority || !data.id) return;
        setUpdating(true);
        try {
            await updateDoc(doc(db, "supportTickets", data.id), {
                priority: newPriority,
                updatedAt: serverTimestamp()
            });
            setPriority(newPriority);
        } catch (err) {
            console.error("Failed to update priority:", err);
        } finally {
            setUpdating(false);
        }
    };

    const getStatusStyle = (s: string) => {
        switch (s) {
            case "open": return "bg-green-500/15 text-green-400 border-green-500/30";
            case "in_progress": return "bg-blue-500/15 text-blue-400 border-blue-500/30";
            case "resolved": return "bg-neutral-500/15 text-neutral-400 border-neutral-500/30";
            default: return "bg-neutral-500/15 text-neutral-400 border-neutral-500/30";
        }
    };

    const getPriorityStyle = (p: string) => {
        switch (p?.toLowerCase()) {
            case "high": return "text-red-400 bg-red-500/10 border-red-500/20";
            case "medium": return "text-orange-400 bg-orange-500/10 border-orange-500/20";
            case "low": return "text-blue-400 bg-blue-500/10 border-blue-500/20";
            default: return "text-neutral-400 bg-neutral-500/10 border-neutral-500/20";
        }
    };

    return (
        <div className="p-4 space-y-6">
            {/* User Info */}
            <div>
                <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-3">Contact</h3>
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-neutral-500">Name</span>
                        <span className="text-sm font-medium text-white">{userName}</span>
                    </div>
                    {userUsername && (
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-neutral-500">Username</span>
                            <span className="text-xs text-neutral-300">@{userUsername}</span>
                        </div>
                    )}
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-neutral-500">Email</span>
                        <span className="text-xs text-neutral-300">{userEmail || "No email"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-neutral-500">UID</span>
                        <span className="text-[10px] text-neutral-500 font-mono truncate max-w-[150px]">{data.uid || "N/A"}</span>
                    </div>
                </div>
            </div>

            <div className="h-px cc-glass" />

            {/* Ticket Details */}
            <div>
                <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-3">Details</h3>
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-neutral-500">Created</span>
                        <span className="text-xs text-neutral-300">
                            {data.createdAt?.toDate ? new Date(data.createdAt.toDate()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : "-"}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-neutral-500">Type</span>
                        <div className="relative">
                            <select
                                value={category}
                                onChange={async (e) => {
                                    const newCategory = e.target.value;
                                    if (newCategory === category || !data.id) return;
                                    setUpdating(true);
                                    try {
                                        await updateDoc(doc(db, "supportTickets", data.id), {
                                            category: newCategory,
                                            updatedAt: serverTimestamp()
                                        });
                                        setCategory(newCategory);
                                    } catch (err) {
                                        console.error("Failed to update category:", err);
                                    } finally {
                                        setUpdating(false);
                                    }
                                }}
                                disabled={updating}
                                className="text-xs px-3 py-1 rounded-full border appearance-none cursor-pointer outline-none transition-all pr-6 cc-glass border-white/10 text-neutral-300 hover:bg-white/[0.08] disabled:opacity-50"
                            >
                                <option value="General Inquiry" className="bg-[#1a1a1a]">General Inquiry</option>
                                <option value="Bug Report" className="bg-[#1a1a1a]">Bug Report</option>
                                <option value="Feature Request" className="bg-[#1a1a1a]">Feature Request</option>
                                <option value="Account Issue" className="bg-[#1a1a1a]">Account Issue</option>
                                <option value="Billing" className="bg-[#1a1a1a]">Billing</option>
                                <option value="Other" className="bg-[#1a1a1a]">Other</option>
                            </select>
                            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Status Dropdown */}
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-neutral-500">Status</span>
                        <div className="relative">
                            <select
                                value={status}
                                onChange={(e) => handleStatusChange(e.target.value)}
                                disabled={updating}
                                className={`text-xs px-3 py-1 rounded-full border appearance-none cursor-pointer outline-none transition-all pr-6 ${getStatusStyle(status)} disabled:opacity-50`}
                            >
                                <option value="open" className="bg-[#1a1a1a] text-green-400">Open</option>
                                <option value="in_progress" className="bg-[#1a1a1a] text-blue-400">In Progress</option>
                                <option value="resolved" className="bg-[#1a1a1a] text-neutral-400">Resolved</option>
                            </select>
                            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-current opacity-60">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Priority Segment Picker */}
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-neutral-500">Priority</span>
                        <div className="flex items-center gap-1.5 p-1 rounded-full bg-white/[0.03] border border-white/[0.05]">
                            {[
                                { value: "1", color: "bg-green-500", label: "Lowest" },
                                { value: "2", color: "bg-blue-500", label: "Low" },
                                { value: "3", color: "bg-yellow-500", label: "Medium" },
                                { value: "4", color: "bg-orange-500", label: "High" },
                                { value: "5", color: "bg-red-500", label: "Critical" }
                            ].map((p) => (
                                <button
                                    key={p.value}
                                    onClick={() => handlePriorityChange(p.value)}
                                    disabled={updating}
                                    title={p.label}
                                    className={`w-5 h-5 rounded-full transition-all ${p.color} ${priority === p.value
                                        ? "ring-2 ring-white ring-offset-1 ring-offset-black scale-110"
                                        : "opacity-40 hover:opacity-70"
                                        } disabled:cursor-not-allowed`}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="h-px bg-white/[0.06]" />

            {/* Response Info */}
            <div>
                <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-3">Activity</h3>
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-neutral-500">Last Response</span>
                        <span className="text-xs text-neutral-300">
                            {data.lastMessageAt?.toDate
                                ? formatDistanceToNow(data.lastMessageAt.toDate(), { addSuffix: true })
                                : data.createdAt?.toDate
                                    ? formatDistanceToNow(data.createdAt.toDate(), { addSuffix: true })
                                    : "-"
                            }
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-neutral-500">Last Responder</span>
                        <span className={`text-xs ${data.lastResponderIsStaff ? 'text-blue-400' : 'text-neutral-300'}`}>
                            {data.lastResponderIsStaff ? "Support Staff" : userName}
                        </span>
                    </div>
                </div>
            </div>

            {/* Device Info */}
            {data.deviceInfo && (
                <>
                    <div className="h-px bg-white/[0.06]" />
                    <div>
                        <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-3">Device</h3>
                        <div className="space-y-3">
                            {data.deviceInfo.platform && (
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-neutral-500">Platform</span>
                                    <span className="text-xs text-neutral-300">
                                        {data.deviceInfo.platform.includes("Mac") ? "macOS" :
                                            data.deviceInfo.platform.includes("Win") ? "Windows" :
                                                data.deviceInfo.platform.includes("Linux") ? "Linux" :
                                                    data.deviceInfo.platform.includes("iPhone") || data.deviceInfo.platform.includes("iPad") ? "iOS" :
                                                        data.deviceInfo.platform.includes("Android") ? "Android" : data.deviceInfo.platform}
                                    </span>
                                </div>
                            )}
                            {data.deviceInfo.userAgent && (
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-neutral-500">Browser</span>
                                    <span className="text-xs text-neutral-300">
                                        {data.deviceInfo.userAgent.includes("Chrome") ? "Chrome" :
                                            data.deviceInfo.userAgent.includes("Safari") ? "Safari" :
                                                data.deviceInfo.userAgent.includes("Firefox") ? "Firefox" :
                                                    data.deviceInfo.userAgent.includes("Edge") ? "Edge" : "Unknown"}
                                    </span>
                                </div>
                            )}
                            {data.deviceInfo.language && (
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-neutral-500">Language</span>
                                    <span className="text-xs text-neutral-300">{data.deviceInfo.language}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

function MapHelpView() {
    return (
        <div className="space-y-4 p-3">
            {/* Google Maps Section */}
            <div className="cc-section cc-glass p-4 space-y-2">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0C7.31 0 3.5 3.81 3.5 8.5c0 5.42 7.72 14.73 8.06 15.13.19.23.53.23.72 0 .34-.4 8.06-9.71 8.06-15.13C20.5 3.81 16.69 0 12 0zm0 12.5c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" />
                    </svg>
                    Google Maps
                </h4>
                <p className="text-sm text-secondary">
                    You can copy the URL from your browser's address bar, or use the "Share" button and click "Copy Link".
                </p>
                <code className="block rounded cc-glass p-2 text-xs text-secondary">
                    maps.app.goo.gl/... or google.com/maps/...
                </code>
            </div>

            {/* Apple Maps Section */}
            <div className="cc-section cc-glass p-4 space-y-2">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                    </svg>
                    Apple Maps
                </h4>
                <p className="text-sm text-secondary">
                    Select a location, click the "Share" button, and choose "Copy Link". It usually looks like:
                </p>
                <code className="block rounded cc-glass p-2 text-xs text-secondary">
                    maps.apple.com/?...&ll=lat,lng...
                </code>
            </div>
        </div>
    );
}
