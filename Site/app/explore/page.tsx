"use client";

import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { motion, useSpring, AnimatePresence } from "framer-motion";
import { MagnifyingGlassIcon, XMarkIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { PlusIcon, UserGroupIcon, BookOpenIcon, QuestionMarkCircleIcon } from "@heroicons/react/24/solid";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Post } from "@/lib/posts";
import { Club } from "@/lib/clubs";
import { UserRow } from "@/components/user-row";
import { EventCard } from "@/components/explore/event-card";
import { ClubCard } from "@/components/explore/club-card";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClubRow } from "@/components/explore/club-row";
import { PostRow } from "@/components/explore/post-row";

// Types
type FilterTab = "All" | "Events" | "Posts" | "Clubs" | "People";

interface SearchResult {
    id: string;
    type: "Event" | "Post" | "Club" | "User" | "Dorm";
    displayName: string;
    photoURL?: string;
    data?: any;
}

export default function ExplorePage() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState<FilterTab>("All");

    const [allResults, setAllResults] = useState<SearchResult[]>([]);
    const [events, setEvents] = useState<Post[]>([]); // Separately store events for "Coming Soon"
    const [clubs, setClubs] = useState<Club[]>([]); // Separately store clubs for "All Clubs"
    const [loading, setLoading] = useState(true);
    const pickerRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const buttonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
    const [shouldStretch, setShouldStretch] = useState(true);
    const [isHydrated, setIsHydrated] = useState(false);
    const hasMeasured = useRef(false);

    // Springs for the indicator
    const springX = useSpring(0, { stiffness: 700, damping: 35 });
    const springWidth = useSpring(0, { stiffness: 700, damping: 35 });

    // Function to calculate and update indicator position
    const updateIndicator = () => {
        const button = buttonRefs.current[activeTab];
        const container = containerRef.current;
        if (button && container) {
            const containerRect = container.getBoundingClientRect();
            const buttonRect = button.getBoundingClientRect();
            const left = (buttonRect.left - containerRect.left) + container.scrollLeft;
            const width = buttonRect.width;

            springX.set(left);
            springWidth.set(width);

            if (!hasMeasured.current) {
                // Snap springs on first measure
                springX.jump(left);
                springWidth.jump(width);
                hasMeasured.current = true;
                setIsHydrated(true);
            }
        }
    };

    useLayoutEffect(() => {
        updateIndicator();
        // Give it another pass after standard effect just in case of layout shifts
        const timeout = setTimeout(updateIndicator, 100);
        return () => clearTimeout(timeout);
    }, [activeTab, shouldStretch, loading]);

    useEffect(() => {
        const checkStretch = () => {
            if (pickerRef.current) {
                // Always stretch in explore where we have more room, 
                // but keep the logic for future flexibility
                setShouldStretch(true);
            }
        };

        checkStretch();
        window.addEventListener('resize', checkStretch);

        const observer = new ResizeObserver(() => {
            checkStretch();
            updateIndicator();
        });
        if (pickerRef.current) observer.observe(pickerRef.current);

        return () => {
            window.removeEventListener('resize', checkStretch);
            observer.disconnect();
        };
    }, []);

    useEffect(() => {
        const fetchAll = async () => {
            setLoading(true);
            try {
                const results: SearchResult[] = [];
                const postsRef = collection(db, "posts");

                // 1. Fetch All Events & Posts (for Coming Soon & Search)
                // Removing orderBy temporarily to ensure we catch legacy events without 'createdAt'
                const allQ = query(postsRef, limit(50));
                const allSnap = await getDocs(allQ);
                const fetchedAll: Post[] = [];

                allSnap.forEach(d => {
                    const data = d.data() as Post;
                    const finalData = { ...data, id: d.id };
                    fetchedAll.push(finalData);

                    // Add to Search Results
                    const isEvent = data.isEvent === true;
                    results.push({
                        id: d.id,
                        type: isEvent ? "Event" : "Post",
                        displayName: data.title || (data.description || data.content)?.slice(0, 30) || "",
                        photoURL: data.imageUrls?.[0],
                        data: finalData
                    });
                });
                const now = new Date();
                const upcomingEvents = fetchedAll.filter(post => {
                    if (!post.isEvent) return false;
                    if (!post.date) return false;

                    // Calculate end time or default to 2h after start
                    const timeStr = post.startTime || "00:00";
                    const start = new Date(`${post.date}T${timeStr}`);

                    let end;
                    if (post.endTime) {
                        end = new Date(`${post.date}T${post.endTime}`);
                        // Handle overnight events if needed? Assuming same day for now or user inputs correct date
                        if (end < start) {
                            // If end time is before start time, assume next day? 
                            // Basic logic: just trust the date. If end < start it's weird data, but let's stick to date+endTime.
                        }
                    } else {
                        end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
                    }

                    return end > now;
                });

                // Sort by date ascending (soonest first)
                upcomingEvents.sort((a, b) => {
                    const dateA = new Date(`${a.date}T${a.startTime || "00:00"}`).getTime();
                    const dateB = new Date(`${b.date}T${b.startTime || "00:00"}`).getTime();
                    return dateA - dateB;
                });

                setEvents(upcomingEvents);

                // 2. Removed separate posts fetch (merged above)

                // 3. Fetch Clubs
                const clubsRef = collection(db, "clubs");
                // Ordering by name for alphabetical grouping
                const clubsQ = query(clubsRef, orderBy("name", "asc"), limit(100)); // Increased limit
                const clubsSnap = await getDocs(clubsQ);
                const fetchedClubs: Club[] = [];

                clubsSnap.forEach(d => {
                    const data = d.data() as Club;
                    if (data.status === 'hidden') return;

                    fetchedClubs.push({ ...data, id: d.id });

                    const isDorm = data.category === 'dorm' || (data as any).type === 'dorm' || (data as any).isDorm || data.name?.toLowerCase().includes('dorm');

                    results.push({
                        id: d.id,
                        type: isDorm ? "Dorm" : "Club",
                        displayName: data.name,
                        photoURL: data.logoUrl || data.profileImageUrl || data.coverImageUrl || "",
                        data: {
                            ...data,
                            isDorm
                        }
                    });
                });
                setClubs(fetchedClubs);

                // Optional: We might also want to filter out results that are clubs and are hidden (above handles fetchedClubs and first pass of results)
                // However, results also contains Posts/Events which might belong to a hidden club. 
                // The prompt was "do not display clubs", so I'll focus on filtering the club entities themselves.

                // 4. Fetch People (Larger batch for search)
                const usersRef = collection(db, "users");
                const usersQ = query(usersRef, limit(100)); // Increased for better discovery
                const usersSnap = await getDocs(usersQ);
                usersSnap.forEach(d => {
                    const data = d.data();
                    const dName = data.name || data.fullName || data.preferredName || data.displayName || data.username || "Unknown User";
                    results.push({
                        id: d.id,
                        type: "User",
                        displayName: dName,
                        photoURL: data.photoURL || data.profilePicture || data.avatarUrl,
                        data: {
                            ...data,
                            displayName: dName,
                            photoURL: data.photoURL || data.profilePicture || data.avatarUrl
                        }
                    });
                });

                setAllResults(results);

            } catch (err) {
                console.error("Error fetching explore data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchAll();
    }, []);

    const getFilteredResults = () => {
        if (!searchQuery.trim()) return [];
        const lowerQ = searchQuery.toLowerCase();

        let filtered = allResults.filter(item => {
            const matchesName = item.displayName.toLowerCase().includes(lowerQ);
            const matchesUsername = item.data?.username?.toLowerCase().includes(lowerQ);
            return matchesName || matchesUsername;
        });

        if (activeTab === "Events") filtered = filtered.filter(i => i.type === "Event");
        if (activeTab === "Posts") filtered = filtered.filter(i => i.type === "Post");
        if (activeTab === "Clubs") filtered = filtered.filter(i => i.type === "Club");
        if (activeTab === "People") filtered = filtered.filter(i => i.type === "User");

        return filtered.sort((a, b) => a.displayName.localeCompare(b.displayName));
    };

    // Live Search for People if filtered results are sparse
    useEffect(() => {
        if (!searchQuery.trim() || searchQuery.length < 2) return;

        const delayDebounce = setTimeout(async () => {
            const lowerQ = searchQuery.toLowerCase();
            const usersRef = collection(db, "users");

            // Search by username prefix
            const qUsername = query(
                usersRef,
                where("username", ">=", lowerQ),
                where("username", "<=", lowerQ + "\uf8ff"),
                limit(10)
            );

            // Note: Firestore doesn't support case-insensitive contains or prefix on multiple fields easily
            // But we can at least try the username prefix which is common

            try {
                const snap = await getDocs(qUsername);
                const newResults: SearchResult[] = [];
                snap.forEach(d => {
                    if (allResults.some(r => r.id === d.id)) return;
                    const data = d.data();
                    const dName = data.name || data.fullName || data.preferredName || data.displayName || data.username || "Unknown User";
                    newResults.push({
                        id: d.id,
                        type: "User",
                        displayName: dName,
                        photoURL: data.photoURL || data.profilePicture || data.avatarUrl,
                        data: {
                            ...data,
                            displayName: dName,
                            photoURL: data.photoURL || data.profilePicture || data.avatarUrl
                        }
                    });
                });

                if (newResults.length > 0) {
                    setAllResults(current => [...current, ...newResults]);
                }
            } catch (err) {
                console.error("Live search error:", err);
            }
        }, 500);

        return () => clearTimeout(delayDebounce);
    }, [searchQuery]);

    const [isSearchExpanded, setIsSearchExpanded] = useState(true);

    const handleSearchToggle = () => {
        if (!isSearchExpanded) {
            setActiveTab("All");
        }
        setIsSearchExpanded(!isSearchExpanded);
        if (isSearchExpanded) {
            setSearchQuery("");
        }
    };

    const displayResults = getFilteredResults();
    const hasQuery = searchQuery.trim().length > 0;
    const tabs: FilterTab[] = ["All", "Events", "Posts", "Clubs", "People"];



    const handleResultClick = (item: SearchResult) => {
        switch (item.type) {
            case "User":
                router.push(`/user/${item.id}`);
                break;
            case "Club":
                router.push(`/clubs/${item.id}`);
                break;
            case "Event":
                router.push(`/events/${item.id}`);
                break;
            case "Post":
                router.push(`/posts/${item.id}`);
                break;
        }
    };

    const getGroupedClubs = () => {
        const groups: { [key: string]: Club[] } = {};

        clubs.forEach(club => {
            const name = club.name || "Unknown Club";
            const char = name.charAt(0).toUpperCase();
            let groupKey = "#";

            if (/[A-Z]/.test(char)) {
                groupKey = char;
            } else if (/[0-9]/.test(char)) {
                groupKey = char;
            }

            if (!groups[groupKey]) groups[groupKey] = [];
            groups[groupKey].push(club);
        });

        // Sort keys: Letters first, then Numbers, then #
        const sortedKeys = Object.keys(groups).sort((a, b) => {
            const isALetter = /[A-Z]/.test(a);
            const isBLetter = /[A-Z]/.test(b);
            const isANumber = /[0-9]/.test(a);
            const isBNumber = /[0-9]/.test(b);

            if (isALetter && isBLetter) return a.localeCompare(b);
            if (isANumber && isBNumber) return a.localeCompare(b);

            if (isALetter) return -1; // Letters before everything
            if (isBLetter) return 1;

            if (isANumber) return -1; // Numbers before symbols
            if (isBNumber) return 1;

            return 0; // Everything else (should just be # vs #)
        });

        return sortedKeys.map(key => ({
            key,
            clubs: groups[key]
        }));
    };

    const clubGroups = getGroupedClubs();

    return (
        <div className="cc-page w-full">
            <div className="mx-auto max-w-2xl px-4 md:px-8 py-8 md:py-4">

                {/* Sticky Header & Filter Section */}
                <div className="sticky top-0 z-30 -mt-2 -mx-4 px-4 md:-mx-8 md:px-8 pt-4 pb-12 pointer-events-none transition-all duration-300">
                    {/* Background Blur Layer */}
                    <div className="absolute inset-0 backdrop-blur-3xl bg-background/90 [mask-image:linear-gradient(to_bottom,black_0%,black_20%,transparent_100%)]" />
                    {/* Header Row - Telegram iOS Style */}
                    <div className="relative flex items-center gap-3 mb-4">
                        {/* Explore Title Capsule - fades out with scale */}
                        <div className={`relative transition-all duration-500 ease-out ${isSearchExpanded ? 'absolute scale-95 pointer-events-none' : 'scale-100'
                            }`} style={{
                                transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                                opacity: isSearchExpanded ? 0 : 1
                            }}>
                            <div className="cc-glass-strong px-5 py-3 rounded-full border cc-header-item-stroke">
                                <span className="text-foreground font-semibold text-base whitespace-nowrap">
                                    Explore
                                </span>
                            </div>
                        </div>

                        {/* Spacer - pushes button to right when search is collapsed */}
                        <div className={`transition-all duration-500 ease-out ${isSearchExpanded ? 'w-0' : 'flex-1'
                            }`} style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }} />

                        {/* Search Input Container - liquid glass expansion */}
                        <div className={`absolute transition-all duration-500 ease-out ${isSearchExpanded
                            ? 'left-0 right-14 scale-100 pointer-events-auto z-20 opacity-100'
                            : 'left-auto right-0 w-12 scale-95 pointer-events-none z-0 opacity-0'
                            }`} style={{
                                transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                                transformOrigin: 'right center',
                            }}>
                            <div className="cc-glass-strong rounded-full border cc-header-item-stroke">
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
                                        placeholder="Search events, clubs, posts..."
                                        className="flex-1 bg-transparent outline-none text-foreground placeholder-secondary text-base"
                                        autoFocus={isSearchExpanded}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Search/Close button - always on right with icon transition */}
                        <button
                            onClick={handleSearchToggle}
                            className="relative flex-shrink-0 w-12 h-12 rounded-full transition-all duration-300 active:scale-95 z-10 ml-auto pointer-events-auto"
                            style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                        >
                            <div className="cc-glass-strong rounded-full transition-all duration-500 absolute inset-0 border cc-header-item-stroke"
                                style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                            </div>

                            <div className="relative flex items-center justify-center h-full">
                                <div className={`absolute transition-all duration-300 ${isSearchExpanded ? 'opacity-0 scale-50 rotate-90' : 'opacity-100 scale-100 rotate-0'
                                    }`} style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                                    <MagnifyingGlassIcon className="w-5 h-5 text-foreground" strokeWidth={2.5} />
                                </div>
                                <div className={`absolute transition-all duration-300 ${isSearchExpanded ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 rotate-90'
                                    }`} style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                                    <XMarkIcon className="w-5 h-5 text-secondary" strokeWidth={2.5} />
                                </div>
                            </div>
                        </button>
                    </div>

                    {/* Telegram iOS Filter Picker Container */}
                    <AnimatePresence initial={false}>
                        {isSearchExpanded && (
                            <motion.div
                                initial={{ opacity: 0, height: 0, marginBottom: 0, scale: 0.9, x: 10 }}
                                animate={{ opacity: 1, height: 'auto', marginBottom: 16, scale: 1, x: 0 }}
                                exit={{ opacity: 0, height: 0, marginBottom: 0, scale: 0.9, x: 10 }}
                                transition={{
                                    duration: 0.5,
                                    ease: [0.34, 1.56, 0.64, 1],
                                    height: { duration: 0.4 },
                                    marginBottom: { duration: 0.4 }
                                }}
                                style={{ transformOrigin: 'right top' }}
                                className="relative w-full"
                            >
                                {/* Fixed background pill */}
                                <div className="absolute inset-0 cc-glass-strong rounded-full pointer-events-none border cc-header-item-stroke cc-shadow-premium" />

                                {/* Scrollable content */}
                                <div ref={pickerRef} className="relative overflow-hidden rounded-full">
                                    <div className="p-1 overflow-x-auto scrollbar-hide">
                                        <div ref={containerRef} className={`relative flex items-center gap-1 ${shouldStretch ? 'w-full' : 'w-max min-w-full'}`}>
                                            {/* Animated sliding capsule */}
                                            {isHydrated && (
                                                <motion.div
                                                    className="absolute bg-foreground/10 rounded-full pointer-events-none shadow-sm"
                                                    style={{
                                                        x: springX,
                                                        width: springWidth,
                                                        height: 'calc(100% - 2px)',
                                                        top: '1px',
                                                    }}
                                                >
                                                    <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/5 to-transparent" />
                                                </motion.div>
                                            )}
                                            {tabs.map((tab) => (
                                                <button
                                                    key={tab}
                                                    ref={(el) => { buttonRefs.current[tab] = el; }}
                                                    onClick={() => setActiveTab(tab)}
                                                    className={`relative z-10 flex-1 py-1.5 px-3 rounded-full text-sm font-medium transition-all duration-300 pointer-events-auto active:scale-95 outline-none`}
                                                    style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}
                                                >
                                                    <span className={`relative flex items-center justify-center whitespace-nowrap transition-all duration-400 ${activeTab === tab ? "text-foreground font-bold" : "text-secondary hover:text-foreground"}`}
                                                        style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
                                                        {tab}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Inactive State Content */}
                {!hasQuery && (
                    <div className="space-y-10 animate-in fade-in duration-500">

                        {/* Helpful Resources */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-secondary mb-2 px-1">Helpful Resources</h3>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    {
                                        label: "Create Event",
                                        href: "/posts/new",
                                        icon: PlusIcon,
                                        color: "bg-blue-500"
                                    },
                                    {
                                        label: "Start a Club",
                                        href: "/clubs/create",
                                        icon: UserGroupIcon,
                                        color: "bg-purple-500" // Closer to the 'Popular' red/orange in the image, but kept distinctive
                                    },
                                    {
                                        label: "Guidelines",
                                        href: "/settings/guidelines",
                                        icon: BookOpenIcon,
                                        color: "bg-orange-500"
                                    },
                                    {
                                        label: "Help Center",
                                        href: "/settings/help-support",
                                        icon: QuestionMarkCircleIcon,
                                        color: "bg-green-600"
                                    },
                                ].map(link => (
                                    <Link
                                        key={link.label}
                                        href={link.href}
                                        className="cc-section cc-radius-24 flex flex-col items-start justify-center gap-2 p-4 transition-all duration-150 hover:cc-shadow-soft active:scale-[0.98]"
                                    >
                                        <div className={`h-9 w-9 flex items-center justify-center rounded-[10px] ${link.color} text-white shadow-sm ring-1 ring-white/10`}>
                                            <link.icon className="h-5 w-5" />
                                        </div>
                                        <span className="font-bold text-sm text-foreground">{link.label}</span>
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* Coming Soon - Horizontal Scroll */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-secondary mb-2 px-1">Coming Soon</h3>
                            {events.length > 0 ? (
                                <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4 no-scrollbar">
                                    {events.map(event => (
                                        <EventCard key={event.id} event={event} />
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-secondary px-1">No upcoming events or posts yet.</p>
                            )}
                        </div>

                        {/* All Clubs - Grouped List */}
                        <div className="space-y-6">
                            {/* <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">All Clubs</h3> */}
                            {clubGroups.length > 0 ? (
                                clubGroups.map(group => (
                                    <div key={group.key} className="space-y-2">
                                        <h4 className="text-sm font-bold text-secondary px-1">{group.key}</h4>
                                        <div className="cc-section cc-radius-24 overflow-hidden">
                                            <div>
                                                {group.clubs.map(club => (
                                                    <ClubRow key={club.id} club={club} showChevron={true} />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="space-y-3">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-secondary mb-2 px-1">All Clubs</h3>
                                    <p className="text-sm text-secondary px-1">No clubs found.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Active State Results */}
                {hasQuery && (
                    <div className="space-y-0.5 pb-24 animate-in slide-in-from-bottom-2 duration-300">
                        {displayResults.length === 0 ? (
                            <div className="py-12 text-center cc-section cc-radius-24">
                                <p className="text-foreground text-lg font-medium">No results found.</p>
                                <p className="text-secondary text-sm mt-1">Try a different search.</p>
                            </div>
                        ) : (
                            <div className="cc-section cc-radius-24 overflow-hidden">
                                {displayResults.map(item => (
                                    <div
                                        key={`${item.type}-${item.id}`}
                                        onClick={() => handleResultClick(item)}
                                        className="group relative flex cursor-pointer items-center mx-1.5 px-0.5 rounded-2xl transition-all hover:bg-secondary/10"
                                    >
                                        <div className="flex-1 min-w-0">
                                            {item.type === "Post" || item.type === "Event" ? (
                                                <PostRow post={item.data} />
                                            ) : (item.type === "Club" || item.type === "Dorm") ? (
                                                <ClubRow club={item.data} />
                                            ) : (
                                                <div className="pl-3.5 pr-3 py-2.5 w-full">
                                                    <UserRow
                                                        userData={{
                                                            displayName: item.displayName,
                                                            photoURL: item.photoURL,
                                                            username: item.data?.username || ""
                                                        }}
                                                        subtitle={item.type !== "User" ? (item.type === "Dorm" ? "Dorm Club" : item.type) : undefined}
                                                        onlyAvatar={false}
                                                        isVerified={item.data?.isVerified}
                                                        type={item.type as any}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        <div className="group/icon p-1 rounded-full hover:bg-secondary/16 transition-colors pr-3">
                                            <ChevronRightIcon className="h-5 w-5 text-secondary transition-colors group-hover/icon:text-foreground" />
                                        </div>

                                        {/* Inset Divider */}
                                        <div className="absolute bottom-0 left-0 right-0 h-px bg-secondary/15 group-last/row:hidden" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
