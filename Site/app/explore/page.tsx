"use client";

import { useState, useEffect } from "react";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { PlusIcon, UserGroupIcon, BookOpenIcon, QuestionMarkCircleIcon } from "@heroicons/react/24/solid";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Post } from "@/lib/posts";
import { Club } from "@/lib/clubs";
import { UserRow } from "@/components/user-row";
import { EventCard } from "@/components/explore/event-card";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Types
type FilterTab = "All" | "Events" | "Posts" | "Clubs" | "People";

interface SearchResult {
    id: string;
    type: "Event" | "Post" | "Club" | "User";
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
    const [loading, setLoading] = useState(true);

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
                        displayName: data.title || data.content?.slice(0, 30) || "",
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
                const clubsQ = query(clubsRef, orderBy("memberCount", "desc"), limit(20));
                const clubsSnap = await getDocs(clubsQ);
                clubsSnap.forEach(d => {
                    const data = d.data() as Club;
                    results.push({
                        id: d.id,
                        type: "Club",
                        displayName: data.name,
                        photoURL: data.coverImageUrl,
                        data
                    });
                });

                // 4. Fetch People
                const usersRef = collection(db, "users");
                const usersQ = query(usersRef, limit(20));
                const usersSnap = await getDocs(usersQ);
                usersSnap.forEach(d => {
                    const data = d.data();
                    results.push({
                        id: d.id,
                        type: "User",
                        displayName: data.displayName || data.username || "Unknown User",
                        photoURL: data.photoURL,
                        data
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

        let filtered = allResults.filter(item =>
            item.displayName.toLowerCase().includes(lowerQ)
        );

        if (activeTab === "Events") filtered = filtered.filter(i => i.type === "Event");
        if (activeTab === "Posts") filtered = filtered.filter(i => i.type === "Post");
        if (activeTab === "Clubs") filtered = filtered.filter(i => i.type === "Club");
        if (activeTab === "People") filtered = filtered.filter(i => i.type === "User");

        return filtered.sort((a, b) => a.displayName.localeCompare(b.displayName));
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

    return (
        <div className="min-h-screen px-4 py-8 md:px-8 max-w-2xl mx-auto">

            {/* Header */}
            <h1 className="text-3xl font-bold text-white mb-6">Explore</h1>

            {/* Search Bar */}
            {/* Search Section */}
            <div className="mb-6 z-30">
                {/* Search Input Wrapper */}
                <form
                    className="relative group"
                    onSubmit={(e) => e.preventDefault()}
                    role="search"
                >
                    <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center justify-center">
                        <MagnifyingGlassIcon className="h-[18px] w-[18px] text-zinc-500 transition-colors group-focus-within:text-white" />
                    </div>
                    <input
                        type="text"
                        name="q"
                        id="search-input"
                        placeholder="Search events, posts, clubs, people..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-[52px] w-full rounded-full border-none bg-[#1C1C1E] pl-12 pr-12 text-base text-white placeholder-zinc-500 shadow-sm ring-1 ring-white/10 transition-all hover:ring-white/20 focus:bg-[#202022] focus:ring-2 focus:ring-[#ffb200]/50 focus:outline-none"
                        autoFocus
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck="false"
                    />
                    {hasQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
                        >
                            <XMarkIcon className="h-[18px] w-[18px]" />
                        </button>
                    )}
                </form>

                {/* Filters Row */}
                {hasQuery && (
                    <div className="mt-4 flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                        {tabs.map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${activeTab === tab
                                    ? "bg-white text-black"
                                    : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Inactive State Content */}
            {!hasQuery && (
                <div className="space-y-10 animate-in fade-in duration-500">

                    {/* Helpful Resources */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Helpful Resources</h3>
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
                                    href: "/guidelines",
                                    icon: BookOpenIcon,
                                    color: "bg-orange-500"
                                },
                                {
                                    label: "Help Center",
                                    href: "/help-support",
                                    icon: QuestionMarkCircleIcon,
                                    color: "bg-green-600"
                                },
                            ].map(link => (
                                <Link
                                    key={link.label}
                                    href={link.href}
                                    className="flex flex-col items-start justify-center gap-2 rounded-[24px] border border-white/5 bg-[#1C1C1E] p-4 transition-all hover:bg-white/10 hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    <div className={`h-9 w-9 flex items-center justify-center rounded-full ${link.color} text-white`}>
                                        <link.icon className="h-5 w-5" />
                                    </div>
                                    <span className="font-bold text-sm text-white">{link.label}</span>
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Coming Soon - Horizontal Scroll */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Coming Soon</h3>
                        {events.length > 0 ? (
                            <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4 no-scrollbar">
                                {events.map(event => (
                                    <EventCard key={event.id} event={event} />
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-zinc-500">No upcoming events or posts yet.</p>
                        )}
                    </div>
                </div>
            )}

            {/* Active State Results */}
            {hasQuery && (
                <div className="space-y-0.5 pb-24 animate-in slide-in-from-bottom-2 duration-300">
                    {displayResults.length === 0 ? (
                        <div className="py-12 text-center">
                            <p className="text-zinc-500 text-lg">No results found.</p>
                            <p className="text-zinc-600 text-sm mt-1">Try a different search.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {displayResults.map(item => (
                                <div
                                    key={`${item.type}-${item.id}`}
                                    onClick={() => handleResultClick(item)}
                                    // Row Styling: simple full-width, subtle divider, hover padding increase + highlight
                                    className="group relative flex cursor-pointer items-center rounded-lg px-2 py-3 transition-all duration-200 hover:bg-white/5 hover:py-5 hover:shadow-lg hover:shadow-black/20 hover:z-10"
                                >
                                    <UserRow
                                        userData={{
                                            displayName: item.displayName,
                                            photoURL: item.photoURL,
                                            username: ""
                                        }}
                                        subtitle={item.type}
                                        onlyAvatar={false}
                                    // Pass right element explicitly if we want small labels/icons, 
                                    // but subtitle already does "Event", "Club" etc.
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
