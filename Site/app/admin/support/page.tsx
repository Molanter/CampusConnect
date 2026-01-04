"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, Timestamp, getDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { MagnifyingGlassIcon, FunnelIcon, ChartBarIcon, ClockIcon, CheckCircleIcon, InboxIcon, ArrowUpRightIcon, PaperAirplaneIcon, ArrowPathIcon, InformationCircleIcon, ChatBubbleLeftRightIcon, ChevronLeftIcon, Squares2X2Icon, TicketIcon } from "@heroicons/react/24/outline";
import { format, formatDistanceToNow } from "date-fns";
import Toast, { ToastData } from "@/components/Toast";
import { useRightSidebar } from "@/components/right-sidebar-context";

type SupportTicket = {
    id: string;
    name?: string;
    email?: string;
    category: string;
    priority: string;
    status: "open" | "in_progress" | "resolved" | "closed";
    message: string;
    createdAt: any;
    lastMessageAt?: any;
    lastResponderIsStaff?: boolean;
    uid?: string;
    attachments?: string[];
    deviceInfo?: {
        platform?: string;
        language?: string;
        userAgent?: string;
    };
};

type UserInfo = {
    name: string;
    email: string;
};

type Message = {
    id: string;
    text: string;
    senderUid: string;
    isStaff: boolean;
    createdAt: Timestamp;
};

export default function AdminSupportPage() {
    const { openView, toggle, isVisible } = useRightSidebar();
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState<"overview" | "tickets" | "stats">("overview");

    // Chat state for tickets tab
    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [toast, setToast] = useState<ToastData | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [userCache, setUserCache] = useState<Record<string, UserInfo>>({});
    const [overlayImage, setOverlayImage] = useState<string | null>(null);
    const [overlayIndex, setOverlayIndex] = useState<number>(0);

    // Real-time listener for tickets
    useEffect(() => {
        const q = query(
            collection(db, "supportTickets"),
            orderBy("createdAt", "desc")
        );
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const fetched = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as SupportTicket));
            setTickets(fetched);
            setLoading(false);

            // Fetch user info for UIDs not in cache
            const uidsToFetch = fetched
                .filter(t => t.uid && !userCache[t.uid])
                .map(t => t.uid!)
                .filter((uid, idx, arr) => arr.indexOf(uid) === idx); // unique

            if (uidsToFetch.length > 0) {
                const newUsers: Record<string, UserInfo> = {};
                await Promise.all(uidsToFetch.map(async (uid) => {
                    try {
                        const userDoc = await getDoc(doc(db, "users", uid));
                        if (userDoc.exists()) {
                            const data = userDoc.data();
                            newUsers[uid] = {
                                name: data.name || data.displayName || "Unknown",
                                email: data.email || ""
                            };
                        }
                    } catch (e) {
                        console.error("Failed to fetch user:", uid, e);
                    }
                }));
                if (Object.keys(newUsers).length > 0) {
                    setUserCache(prev => ({ ...prev, ...newUsers }));
                }
            }

            // Auto-select first ticket if none selected and on tickets tab
            if (!selectedTicketId && fetched.length > 0 && activeTab === 'tickets') {
                setSelectedTicketId(fetched[0].id);
            }
        });
        return () => unsubscribe();
    }, [activeTab]);

    // Fetch messages for selected ticket
    useEffect(() => {
        if (!selectedTicketId) {
            setMessages([]);
            return;
        }

        const messagesRef = collection(db, "supportTickets", selectedTicketId, "messages");
        const q = query(messagesRef, orderBy("createdAt", "asc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Message));
            setMessages(msgs);
        });

        return () => unsubscribe();
    }, [selectedTicketId]);

    // Update right sidebar when ticket changes
    useEffect(() => {
        if (selectedTicketId && activeTab === 'tickets') {
            const ticket = tickets.find(t => t.id === selectedTicketId);
            // Only auto-open on desktop
            if (ticket && window.innerWidth >= 1024) {
                openView("support-ticket-info", ticket);
            }
        }
    }, [selectedTicketId, tickets, openView, activeTab]);

    // Scroll to bottom of messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);


    // Derived Stats
    const stats = {
        total: tickets.length,
        open: tickets.filter(t => t.status === 'open').length,
        resolved: tickets.filter(t => t.status === 'resolved').length,
        highPriority: tickets.filter(t => t.priority === 'High' && t.status !== 'resolved').length
    };

    // Helper to get user name from cache or ticket
    const getUserName = (ticket: SupportTicket) => {
        if (ticket.uid && userCache[ticket.uid]) {
            return userCache[ticket.uid].name;
        }
        return ticket.name || "Unknown User";
    };

    const getUserEmail = (ticket: SupportTicket) => {
        if (ticket.uid && userCache[ticket.uid]) {
            return userCache[ticket.uid].email;
        }
        return ticket.email || "";
    };

    // Filter logic
    const filteredTickets = useMemo(() => tickets.filter(ticket => {
        const matchesStatus = filterStatus === "all" ? true : ticket.status === filterStatus;
        const userName = getUserName(ticket);
        const userEmail = getUserEmail(ticket);
        const matchesSearch =
            userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ticket.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ticket.category.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesStatus && matchesSearch;
    }), [tickets, filterStatus, searchQuery, userCache]);

    const selectedTicket = useMemo(() =>
        selectedTicketId ? tickets.find(t => t.id === selectedTicketId) : null
        , [tickets, selectedTicketId]);

    // Current attachments for navigation
    const currentAttachments = selectedTicket?.attachments || [];

    // Keyboard navigation for image overlay
    useEffect(() => {
        if (!overlayImage) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setOverlayImage(null);
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                if (currentAttachments.length > 1) {
                    const nextIndex = (overlayIndex + 1) % currentAttachments.length;
                    setOverlayIndex(nextIndex);
                    setOverlayImage(currentAttachments[nextIndex]);
                }
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                if (currentAttachments.length > 1) {
                    const prevIndex = overlayIndex === 0 ? currentAttachments.length - 1 : overlayIndex - 1;
                    setOverlayIndex(prevIndex);
                    setOverlayImage(currentAttachments[prevIndex]);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [overlayImage, overlayIndex, currentAttachments]);

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!newMessage.trim() || !selectedTicketId) return;

        setSending(true);
        try {
            const user = auth.currentUser;
            if (!user) throw new Error("Not authenticated");

            await addDoc(collection(db, "supportTickets", selectedTicketId, "messages"), {
                text: newMessage.trim(),
                senderUid: user.uid,
                isStaff: true,
                createdAt: serverTimestamp()
            });

            const updatePayload: any = {
                updatedAt: serverTimestamp(),
                lastMessageAt: serverTimestamp(),
                lastResponderIsStaff: true
            };
            if (selectedTicket?.status === 'open') {
                updatePayload.status = 'in_progress';
            }

            await updateDoc(doc(db, "supportTickets", selectedTicketId), updatePayload);
            setNewMessage("");
        } catch (error) {
            console.error(error);
            setToast({ type: "error", message: "Failed to send message" });
        } finally {
            setSending(false);
        }
    };

    const handleUpdateStatus = async (newStatus: "resolved" | "in_progress" | "open") => {
        if (!selectedTicketId) return;
        try {
            await updateDoc(doc(db, "supportTickets", selectedTicketId), {
                status: newStatus,
                updatedAt: serverTimestamp()
            });
            setToast({ type: "success", message: `Ticket marked as ${newStatus}` });
        } catch (error) {
            setToast({ type: "error", message: "Failed to update status" });
        }
    };

    const getChatStatusStyle = (status: string) => {
        switch (status) {
            case "open": return "bg-green-500/15 text-green-400 border-green-500/30";
            case "in_progress": return "bg-blue-500/15 text-blue-400 border-blue-500/30";
            case "resolved": return "bg-secondary/25 text-secondary border-secondary/30";
            default: return "bg-secondary/25 text-secondary border-secondary/30";
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "open": return "bg-green-500";
            case "in_progress": return "bg-blue-500";
            case "resolved": return "bg-secondary";
            default: return "bg-secondary";
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case "1": return "bg-green-500";
            case "2": return "bg-blue-500";
            case "3": return "bg-yellow-500";
            case "4": return "bg-orange-500";
            case "5": return "bg-red-500";
            // Legacy values
            case "Low": return "bg-blue-500";
            case "Medium": return "bg-orange-500";
            case "High": return "bg-red-500";
            default: return "bg-secondary";
        }
    };

    // Sub-components for clarity
    const StatCardsRow = () => (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
                title="All Tickets"
                value={stats.total}
                icon={<InboxIcon className="h-5 w-5" />}
                color="bg-secondary"
            />
            <StatCard
                title="Open Tickets"
                value={stats.open}
                icon={<ClockIcon className="h-5 w-5" />}
                color="bg-blue-500"
            />
            <StatCard
                title="Resolved"
                value={stats.resolved}
                icon={<CheckCircleIcon className="h-5 w-5" />}
                color="bg-green-500"
            />
            <StatCard
                title="High Priority"
                value={stats.highPriority}
                icon={<ChartBarIcon className="h-5 w-5" />}
                color="bg-red-500"
            />
        </div>
    );

    const ChartsSection = () => (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Activity Chart */}
            <div className="lg:col-span-2 cc-glass cc-section rounded-[40px] p-8 md:p-12">
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-medium text-foreground">Ticket Activity</h3>
                    <select className="bg-secondary/5 border border-secondary/10 rounded-full px-4 py-2 text-sm text-secondary outline-none">
                        <option>Last 14 Days</option>
                        <option>Last Month</option>
                    </select>
                </div>
                <div className="flex items-end justify-between gap-3 h-64 w-full">
                    {[45, 60, 35, 78, 52, 65, 48, 55, 67, 80, 50, 45, 62, 75].map((h, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-3">
                            <div className="w-full bg-secondary/5 rounded-t-lg hover:bg-blue-500/50 transition-colors h-full relative overflow-hidden group">
                                <div
                                    className="absolute bottom-0 w-full bg-blue-500 rounded-t-lg transition-all duration-500 group-hover:bg-blue-400"
                                    style={{ height: `${h}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex justify-between mt-4 text-xs text-secondary font-medium px-1 uppercase tracking-wider">
                    <span>Nov 1</span>
                    <span>Nov 14</span>
                </div>
            </div>

            {/* Doughnut Chart */}
            <div className="cc-glass cc-section rounded-[40px] p-8 md:p-12 flex flex-col items-center justify-center">
                <h3 className="text-xl font-medium text-foreground mb-8 w-full text-left">Priority Split</h3>
                <div className="relative h-56 w-56">
                    <svg viewBox="0 0 36 36" className="w-full h-full rotate-[-90deg]">
                        <path className="te xt-secondary/20" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2" />
                        <path className="text-blue-500" strokeDasharray="40, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <path className="text-orange-500" strokeDasharray="25, 100" strokeDashoffset="-45" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <path className="text-red-500" strokeDasharray="15, 100" strokeDashoffset="-75" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-4xl font-light text-foreground">{stats.total}</span>
                        <span className="text-xs text-secondary uppercase tracking-widest mt-1">Total</span>
                    </div>
                </div>
                <div className="flex gap-6 mt-10">
                    <div className="flex items-center gap-2 text-xs text-secondary font-medium tracking-wide">
                        <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" /> HIGH
                    </div>
                    <div className="flex items-center gap-2 text-xs text-secondary font-medium tracking-wide">
                        <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]" /> MED
                    </div>
                    <div className="flex items-center gap-2 text-xs text-secondary font-medium tracking-wide">
                        <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" /> LOW
                    </div>
                </div>
            </div>
        </div>
    );

    // Tickets tab with left sidebar and embedded chat
    const TicketsChatView = () => (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-200px)]">
            {/* Left Sidebar - Ticket List */}
            <div className={`w-full lg:w-80 pt-4 px-3 cc-glass border border-secondary/10 rounded-[1.8rem] flex-shrink-0 flex flex-col ${selectedTicketId ? 'hidden lg:flex' : 'flex'}`}>
                {/* Search */}
                <div className="px-2 mb-4">
                    <div className="relative">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search tickets..."
                            className="w-full pl-9 pr-4 py-2.5 rounded-full bg-secondary/15 border border-secondary/20 text-sm text-foreground placeholder-secondary focus:outline-none focus:border-secondary/30 transition-colors"
                        />
                    </div>
                </div>

                {/* Status Filter Tabs */}
                <div className="flex gap-1 px-2 mb-4 flex-wrap">
                    {(["all", "open", "in_progress", "resolved"] as const).map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${filterStatus === status
                                ? "bg-secondary/20 text-foreground"
                                : "text-secondary hover:text-foreground hover:bg-secondary/10"
                                }`}
                        >
                            {status === "all" ? "All" : status === "in_progress" ? "Active" : status.charAt(0).toUpperCase() + status.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Ticket List */}
                <div className="flex-1 overflow-y-auto space-y-1 pb-4 custom-scrollbar">
                    {loading ? (
                        <div className="px-4 py-8 text-center">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-secondary border-t-brand mx-auto" />
                        </div>
                    ) : filteredTickets.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-secondary">
                            No tickets found
                        </div>
                    ) : (
                        filteredTickets.map(ticket => (
                            <button
                                key={ticket.id}
                                onClick={() => setSelectedTicketId(ticket.id)}
                                className={`w-full text-left px-3 py-3 rounded-[1.2rem] transition-all ${selectedTicketId === ticket.id
                                    ? "bg-secondary/20 shadow-sm"
                                    : "hover:bg-secondary/10"
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${getPriorityColor(ticket.priority)}`} />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                <p className={`text-sm font-medium truncate ${selectedTicketId === ticket.id ? "text-foreground" : "text-foreground/80"}`}>
                                                    {getUserName(ticket)}
                                                </p>
                                                <span className="text-[10px] text-secondary flex-shrink-0">
                                                    {ticket.category}
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-secondary flex-shrink-0">
                                                {(ticket.lastMessageAt?.toDate || ticket.createdAt?.toDate)
                                                    ? formatDistanceToNow(
                                                        ticket.lastMessageAt?.toDate?.() || ticket.createdAt.toDate(),
                                                        { addSuffix: false }
                                                    ).replace("about ", "")
                                                    : ""}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-secondary line-clamp-1 mt-1">
                                            {ticket.message}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Right Content - Chat Area */}
            <div className={`flex-1 flex flex-col min-w-0 ${!selectedTicketId ? 'hidden lg:flex' : 'flex'}`}>
                {selectedTicket ? (
                    <>
                        {/* Chat Header */}
                        <div className="flex items-center justify-between mb-4">
                            {/* Left Info */}
                            <div className="flex items-center gap-3 cc-glass backdrop-blur-xl rounded-full px-4 py-2 border border-secondary/10">
                                <button
                                    onClick={() => setSelectedTicketId(null)}
                                    className="lg:hidden p-1 -ml-2 mr-1 rounded-full hover:bg-secondary/10 text-secondary"
                                >
                                    <ChevronLeftIcon className="h-4 w-4" />
                                </button>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-sm font-semibold text-foreground">{selectedTicket.category}</h2>
                                        <span className="text-xs text-secondary font-mono">#{selectedTicket.id.slice(0, 6)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Right Actions */}
                            <div className="flex items-center gap-2">
                                <span className={`hidden lg:block px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-widest ${getChatStatusStyle(selectedTicket.status)}`}>
                                    {selectedTicket.status.replace("_", " ")}
                                </span>

                                {selectedTicket.status !== 'resolved' ? (
                                    <button
                                        onClick={() => handleUpdateStatus('resolved')}
                                        className="hidden lg:flex items-center gap-2 rounded-full bg-secondary/10 hover:bg-secondary/15 px-4 py-1.5 text-xs font-medium transition-colors"
                                    >
                                        <CheckCircleIcon className="h-4 w-4 text-green-400" />
                                        <span>Resolve</span>
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleUpdateStatus('in_progress')}
                                        className="hidden lg:flex items-center gap-2 rounded-full bg-secondary/10 hover:bg-secondary/15 px-4 py-1.5 text-xs font-medium transition-colors"
                                    >
                                        <ArrowPathIcon className="h-4 w-4 text-blue-400" />
                                        <span>Reopen</span>
                                    </button>
                                )}

                                {/* Info Toggle Button */}
                                <button
                                    onClick={() => {
                                        if (isVisible) {
                                            toggle();
                                        } else {
                                            openView("support-ticket-info", selectedTicket);
                                        }
                                    }}
                                    className={`flex items-center justify-center w-10 h-10 rounded-full border transition-colors ${isVisible
                                        ? "bg-foreground text-background border-foreground"
                                        : "bg-secondary/10 border-secondary/10 hover:bg-secondary/15 text-secondary"
                                        }`}
                                    title={isVisible ? "Hide ticket info" : "Show ticket info"}
                                >
                                    <InformationCircleIcon className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                            {/* Original Ticket Message */}
                            <div className="flex items-end gap-3">
                                <div className="flex-1">
                                    <div className="inline-block max-w-[85%] rounded-2xl rounded-bl-md cc-glass backdrop-blur-sm border border-secondary/10 px-4 py-3">
                                        <p className="whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed">
                                            {selectedTicket.message}
                                        </p>
                                        {/* Attachments */}
                                        {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-secondary/10">
                                                {selectedTicket.attachments.map((url, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => {
                                                            setOverlayIndex(idx);
                                                            setOverlayImage(url);
                                                        }}
                                                        className="relative group rounded-lg overflow-hidden border border-secondary/20 hover:border-secondary/40 transition-all"
                                                    >
                                                        <img
                                                            src={url}
                                                            alt={`Attachment ${idx + 1}`}
                                                            className="h-20 w-20 object-cover"
                                                        />
                                                        <div className="absolute inset-0 bg-background/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <span className="text-foreground text-xs">View</span>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <span className="text-[10px] text-secondary pb-1 flex-shrink-0">
                                    {selectedTicket.createdAt?.toDate ? format(selectedTicket.createdAt.toDate(), "h:mm a") : ""}
                                </span>
                            </div>

                            {/* Messages Loop */}
                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex items-end gap-3 ${msg.isStaff ? 'flex-row-reverse' : ''}`}>
                                    <div className={`flex-1 ${msg.isStaff ? 'flex justify-end' : ''}`}>
                                        <div className={`inline-block max-w-[85%] rounded-2xl px-4 py-3 ${msg.isStaff
                                            ? 'bg-blue-600/20 backdrop-blur-sm border border-blue-500/20 rounded-br-md'
                                            : 'cc-glass backdrop-blur-sm border border-secondary/10 rounded-bl-md'
                                            }`}>
                                            <p className={`whitespace-pre-wrap text-sm leading-relaxed ${msg.isStaff ? 'text-blue-100' : 'text-foreground/90'}`}>
                                                {msg.text}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-[10px] text-secondary pb-1 flex-shrink-0">
                                        {msg.createdAt?.toDate ? format(msg.createdAt.toDate(), "h:mm a") : "now"}
                                    </span>
                                </div>
                            ))}

                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="pt-4">
                            <form onSubmit={handleSendMessage} className="relative">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder={selectedTicket.status === 'resolved' ? "Reopen ticket to reply..." : "Type a reply..."}
                                    disabled={selectedTicket.status === 'resolved'}
                                    className="w-full rounded-full cc-glass border border-secondary/10 pl-5 pr-14 py-3.5 text-sm text-foreground placeholder-secondary focus:outline-none focus:border-secondary/20 focus:bg-secondary/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                />
                                <button
                                    type="submit"
                                    disabled={!newMessage.trim() || sending || selectedTicket.status === 'resolved'}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-brand text-brand-foreground hover:bg-brand/90 disabled:bg-secondary/10 disabled:text-secondary transition-all"
                                >
                                    <PaperAirplaneIcon className="h-4 w-4" />
                                </button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-secondary">
                        <ChatBubbleLeftRightIcon className="h-16 w-16 mb-4 opacity-20" />
                        <p className="text-lg font-medium">Select a ticket to view conversation</p>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <>
            <div className="text-foreground p-3 md:p-10 font-sans">
                <Toast toast={toast} onClear={() => setToast(null)} />
                <div className="max-w-7xl mx-auto space-y-6 md:space-y-10">

                    {/* Global Header */}
                    <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 pb-3 md:pb-4 border-b border-secondary/10">
                        <div className="w-full lg:w-auto">
                            <h1 className="text-4xl font-semibold text-foreground tracking-tight">Support</h1>
                        </div>

                        {/* Tabs */}
                        <div className="w-full lg:w-auto grid grid-cols-3 lg:flex cc-glass p-1 rounded-full text-center">
                            {(['overview', 'tickets', 'stats'] as const).map((tab) => {
                                const icons = {
                                    overview: Squares2X2Icon,
                                    tickets: TicketIcon,
                                    stats: ChartBarIcon
                                };
                                const Icon = icons[tab];
                                return (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`px-6 py-2.5 rounded-full transition-all flex items-center justify-center ${activeTab === tab
                                            ? "bg-brand text-brand-foreground shadow-lg shadow-brand/20"
                                            : "text-secondary hover:text-foreground hover:bg-secondary/5"
                                            }`}
                                        title={tab.charAt(0).toUpperCase() + tab.slice(1)}
                                    >
                                        <Icon className="h-5 w-5" />
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* View Content */}
                    <div className="space-y-8 min-h-[600px] animate-in fade-in duration-500">
                        {activeTab === 'overview' && (
                            <>
                                <StatCardsRow />
                                <TicketList
                                    searchQuery={searchQuery}
                                    setSearchQuery={setSearchQuery}
                                    filterStatus={filterStatus}
                                    setFilterStatus={setFilterStatus}
                                    loading={loading}
                                    filteredTickets={filteredTickets}
                                    setActiveTab={setActiveTab}
                                    onTicketClick={(ticketId) => {
                                        setSelectedTicketId(ticketId);
                                        setActiveTab("tickets");
                                    }}
                                    getUserName={getUserName}
                                />
                            </>
                        )}

                        {activeTab === 'tickets' && <TicketsChatView />}

                        {activeTab === 'stats' && (
                            <>
                                <StatCardsRow />
                                <ChartsSection />
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Image Overlay Modal */}
            {overlayImage && (
                <div
                    className="fixed inset-0 z-[100] bg-background/90 flex items-center justify-center p-4"
                    onClick={() => setOverlayImage(null)}
                >
                    <button
                        onClick={() => setOverlayImage(null)}
                        className="absolute top-4 right-4 p-2 rounded-full bg-secondary/20 hover:bg-secondary/30 text-foreground transition-colors z-10"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <img
                        src={overlayImage}
                        alt="Full size attachment"
                        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </>
    );
}

// Helpers
const getIndicatorColor = (ticket: SupportTicket) => {
    if (ticket.status === 'resolved') return 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]';
    switch (ticket.priority) {
        case 'High': return 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]';
        case 'Medium': return 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.3)]';
        case 'Low': return 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]';
        default: return 'bg-secondary';
    }
};

const getStatusStyle = (status: string) => {
    switch (status) {
        case "open": return "bg-blue-500/10 text-blue-400";
        case "in_progress": return "bg-orange-500/10 text-orange-400";
        case "resolved": return "bg-green-500/10 text-green-400";
        case "closed": return "bg-secondary/20 text-secondary";
        default: return "bg-secondary/20 text-secondary";
    }
};

function StatCard({ title, value, icon, color }: { title: string, value: number, icon: React.ReactNode, color: string }) {
    return (
        <div className="flex flex-col items-start justify-between gap-4 h-full rounded-[24px] border border-secondary/10 cc-glass p-4 transition-all hover:bg-secondary/5 hover:scale-[1.02] active:scale-[0.98] group cursor-default">
            <div className={`h-9 w-9 flex items-center justify-center rounded-full ${color} text-white shadow-lg shadow-black/20`}>
                {icon}
            </div>
            <div className="w-full flex items-end justify-between gap-2">
                <p className="text-secondary text-[11px] font-bold tracking-widest uppercase group-hover:text-secondary/80 transition-colors">{title}</p>
                <div className="text-2xl font-light text-foreground tracking-tight leading-none">{value.toLocaleString()}</div>
            </div>
        </div>
    );
}

type TicketListProps = {
    title?: string;
    showViewAll?: boolean;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    filterStatus: string;
    setFilterStatus: (status: string) => void;
    loading: boolean;
    filteredTickets: SupportTicket[];
    setActiveTab: (tab: "overview" | "tickets" | "stats") => void;
    onTicketClick?: (ticketId: string) => void;
    getUserName: (ticket: SupportTicket) => string;
};

const TicketList = ({
    title = "Recent Tickets",
    showViewAll = true,
    searchQuery,
    setSearchQuery,
    filterStatus,
    setFilterStatus,
    loading,
    filteredTickets,
    setActiveTab,
    onTicketClick,
    getUserName
}: TicketListProps) => (
    <>
        {/* List Header (Separated) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6 px-2">
            <div>
                <h2 className="text-2xl font-medium text-foreground tracking-tight">{title}</h2>
                <p className="text-secondary text-sm mt-1 font-light">Manage and track your support request queue</p>
            </div>

            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full md:w-auto">
                <div className="relative group">
                    <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary group-focus-within:text-foreground transition-colors" />
                    <input
                        type="text"
                        placeholder="Search tickets..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="bg-secondary/15 hover:bg-secondary/20 focus:bg-secondary/25 border border-secondary/20 focus:border-secondary/30 rounded-full pl-10 pr-5 py-2.5 text-sm text-foreground focus:ring-0 transition-all w-full md:w-56 md:focus:w-72 outline-none placeholder:text-secondary font-light"
                    />
                </div>
                <div className="relative">
                    <FunnelIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary pointer-events-none" />
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="bg-secondary/15 hover:bg-secondary/20 border border-secondary/20 focus:border-secondary/30 rounded-full pl-10 pr-5 py-2.5 text-sm text-foreground focus:ring-0 cursor-pointer appearance-none outline-none transition-all font-medium w-full md:w-auto"
                    >
                        <option value="all" className="bg-surface-2">All Status</option>
                        <option value="open" className="bg-surface-2">Open</option>
                        <option value="in_progress" className="bg-surface-2">In Progress</option>
                        <option value="resolved" className="bg-surface-2">Resolved</option>
                    </select>
                </div>
            </div>
        </div>

        {/* List Items Container */}
        <div className="cc-glass border border-secondary/10 rounded-[24px] overflow-hidden shadow-xl">
            <div className="divide-y divide-secondary/10">
                {loading && <div className="text-center py-20 text-secondary font-light text-lg">Loading tickets...</div>}
                {!loading && filteredTickets.length === 0 && <div className="text-center py-20 text-secondary font-light text-lg">No tickets found</div>}

                {filteredTickets.map((ticket) => (
                    <button
                        onClick={() => onTicketClick?.(ticket.id)}
                        key={ticket.id}
                        className="group flex items-center gap-2 md:gap-4 px-2 py-3 md:px-6 md:py-4 w-full text-left hover:bg-secondary/5 transition-colors"
                    >
                        {/* Date (Desktop) */}
                        <div className="hidden md:block w-24 flex-shrink-0 text-right pr-2">
                            <div className="text-[13px] font-medium text-secondary/80 group-hover:text-secondary transition-colors">
                                {ticket.createdAt?.toDate ? format(ticket.createdAt.toDate(), "MMM dd") : "Date"}
                            </div>
                            <div className="text-[11px] text-secondary font-medium">
                                {ticket.createdAt?.toDate ? format(ticket.createdAt.toDate(), "h:mm a") : ""}
                            </div>
                        </div>

                        {/* Indicator Line (Desktop) */}
                        <div className={`hidden md:block w-1 h-10 rounded-full ${getIndicatorColor(ticket)} opacity-40 group-hover:opacity-100 transition-all`} />

                        {/* Content */}
                        <div className="flex-1 min-w-0 px-1 md:px-2">
                            <div className="flex items-center gap-2 mb-0.5">
                                {/* Mobile Urgency Dot */}
                                <div className={`md:hidden w-1.5 h-1.5 rounded-full ${getIndicatorColor(ticket)} flex-shrink-0`} />

                                <h3 className="text-[13px] md:text-[15px] font-medium text-foreground truncate group-hover:text-brand transition-colors tracking-tight">
                                    {ticket.category}
                                </h3>

                                {/* Mobile Message Preview (Row 1) */}
                                <span className="md:hidden truncate text-[12px] text-secondary font-normal flex-1 ml-1">
                                    {ticket.message}
                                </span>
                            </div>

                            <div className="flex items-center gap-1.5 md:gap-2 text-[12px] md:text-[13px] text-secondary flex-wrap">
                                <span className="text-foreground/80 font-medium text-[11px] md:text-[13px]">{getUserName(ticket)}</span>
                                <span className="w-0.5 h-0.5 rounded-full bg-secondary/50" />

                                {/* Desktop Message (Row 2) */}
                                <span className="hidden md:block truncate max-w-[300px] opacity-60 font-light">{ticket.message}</span>

                                {/* Mobile Time (Row 2) */}
                                <span className="md:hidden text-[10px] text-secondary">
                                    {ticket.lastMessageAt?.toDate
                                        ? formatDistanceToNow(ticket.lastMessageAt.toDate(), { addSuffix: true })
                                        : (ticket.createdAt?.toDate ? formatDistanceToNow(ticket.createdAt.toDate(), { addSuffix: true }) : "")}
                                </span>
                            </div>
                        </div>

                        {/* Badge (Desktop) */}
                        <div className="hidden md:block flex-shrink-0">
                            <div className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${getStatusStyle(ticket.status)} border border-secondary/10`}>
                                {ticket.status.replace("_", " ")}
                            </div>
                        </div>

                        {/* Arrow (Desktop) */}
                        <div className="hidden md:flex items-center justify-center w-8 h-8 rounded-full border border-secondary/10 text-secondary bg-secondary/5 opacity-0 group-hover:opacity-100 group-hover:scale-100 scale-90 transition-all duration-300 group-hover:bg-secondary/15 group-hover:text-foreground ml-2">
                            <ArrowUpRightIcon className="h-4 w-4" />
                        </div>
                    </button>
                ))}
            </div>

            {/* Footer */}
            {showViewAll && filteredTickets.length > 5 && (
                <div className="mt-8 pt-6 border-t border-secondary/10 flex justify-center">
                    <button onClick={() => setActiveTab("tickets")} className="text-[13px] font-medium text-secondary hover:text-foreground transition-colors flex items-center gap-2 px-6 py-2 rounded-full hover:bg-secondary/10">
                        View all tickets <ArrowUpRightIcon className="h-3 w-3" />
                    </button>
                </div>
            )}
        </div>
    </>
);
