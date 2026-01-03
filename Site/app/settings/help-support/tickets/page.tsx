"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, query, orderBy, onSnapshot, where, Timestamp, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ChevronLeftIcon, PlusIcon, PaperAirplaneIcon, ChatBubbleLeftRightIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { formatDistanceToNow, format } from "date-fns";
import Toast, { ToastData } from "@/components/Toast";

type SupportTicket = {
    id: string;
    category: string;
    status: "open" | "in_progress" | "resolved" | "closed";
    message: string;
    createdAt: Timestamp;
    lastMessageAt?: Timestamp;
    attachments?: string[];
};

type Message = {
    id: string;
    text: string;
    senderUid: string;
    isStaff: boolean;
    createdAt: Timestamp;
};

export default function UserTicketsPage() {
    const router = useRouter();
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [toast, setToast] = useState<ToastData | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [overlayImage, setOverlayImage] = useState<string | null>(null);
    const [overlayIndex, setOverlayIndex] = useState<number>(0);
    const [searchQuery, setSearchQuery] = useState("");

    // Auth & Tickets
    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (!currentUser) {
                setLoading(false);
                return;
            }

            // Fetch user's tickets
            const q = query(
                collection(db, "supportTickets"),
                where("uid", "==", currentUser.uid),
                orderBy("createdAt", "desc")
            );

            const unsubscribeTickets = onSnapshot(q, (snapshot) => {
                const fetchedTickets = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as SupportTicket));
                setTickets(fetchedTickets);
                setLoading(false);
            });

            return () => unsubscribeTickets();
        });

        return () => unsubscribeAuth();
    }, []);

    // Messages for selected ticket
    useEffect(() => {
        if (!selectedTicketId) {
            setMessages([]);
            return;
        }

        const messagesRef = collection(db, "supportTickets", selectedTicketId, "messages");
        const q = query(messagesRef, orderBy("createdAt", "asc"));
        const unsub = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Message));
            setMessages(msgs);
        });

        return () => unsub();
    }, [selectedTicketId]);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Keyboard nav for overlay
    const selectedTicket = tickets.find(t => t.id === selectedTicketId) || null;
    const currentAttachments = selectedTicket?.attachments || [];

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
        if (!newMessage.trim() || !selectedTicketId || !user) return;

        setSending(true);
        try {
            await addDoc(collection(db, "supportTickets", selectedTicketId, "messages"), {
                text: newMessage.trim(),
                senderUid: user.uid,
                isStaff: false,
                createdAt: serverTimestamp()
            });

            await updateDoc(doc(db, "supportTickets", selectedTicketId), {
                lastMessageAt: serverTimestamp(),
                lastResponderIsStaff: false,
                ...(selectedTicket?.status === 'resolved' ? { status: 'in_progress', updatedAt: serverTimestamp() } : {})
            });

            setNewMessage("");
        } catch (error) {
            console.error(error);
            setToast({ type: "error", message: "Failed to send message" });
        } finally {
            setSending(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "open": return "bg-green-500/15 text-green-400 border-green-500/30";
            case "in_progress": return "bg-blue-500/15 text-blue-400 border-blue-500/30";
            case "resolved": return "bg-neutral-500/15 text-neutral-400 border-neutral-500/30";
            default: return "bg-neutral-500/15 text-neutral-500 border-neutral-500/30";
        }
    };

    const getPriorityDot = (status: string) => {
        switch (status) {
            case "open": return "bg-green-500";
            case "in_progress": return "bg-blue-500";
            case "resolved": return "bg-neutral-500";
            default: return "bg-neutral-500";
        }
    };

    return (
        <>
            <div className="text-white p-4 md:p-6 font-sans min-h-screen">
                <Toast toast={toast} onClear={() => setToast(null)} />

                <div className="max-w-6xl mx-auto">
                    {/* Header */}
                    <header className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <Link href="/settings" className="hidden md:flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.05] border border-white/[0.08] hover:bg-white/10 transition-colors">
                                <ChevronLeftIcon className="h-4 w-4 text-neutral-400" />
                            </Link>
                            <h1 className="text-xl font-bold">My Support Tickets</h1>
                        </div>
                        <Link
                            href="/settings/help-support"
                            className="flex items-center gap-2 bg-[#ffb200] text-black px-4 py-2.5 rounded-full font-semibold hover:bg-[#e6a000] transition-colors text-sm"
                        >
                            <PlusIcon className="h-4 w-4" />
                            <span className="hidden sm:inline">New Ticket</span>
                        </Link>
                    </header>

                    {/* Split Panel Layout */}
                    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)]">
                        {/* Left Sidebar - Ticket List */}
                        <div className={`w-full lg:w-80 flex-shrink-0 flex flex-col bg-white/[0.02] border border-white/[0.05] rounded-[1.5rem] overflow-hidden ${selectedTicketId ? 'hidden lg:flex' : 'flex'}`}>
                            {/* Search */}
                            <div className="p-3 border-b border-white/[0.05]">
                                <div className="relative">
                                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search tickets..."
                                        className="w-full pl-9 pr-4 py-2.5 rounded-full bg-white/5 border border-white/10 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-white/20 transition-colors"
                                    />
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
                                {loading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-700 border-t-[#ffb200]" />
                                    </div>
                                ) : !user ? (
                                    <div className="text-center py-12 text-neutral-500 text-sm">Please log in</div>
                                ) : tickets.length === 0 ? (
                                    <div className="text-center py-12 px-4">
                                        <p className="text-neutral-500 text-sm mb-3">No tickets yet</p>
                                        <Link href="/settings/help-support" className="text-[#ffb200] text-sm hover:underline">
                                            Create one
                                        </Link>
                                    </div>
                                ) : (
                                    tickets
                                        .filter(t =>
                                            t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            t.message.toLowerCase().includes(searchQuery.toLowerCase())
                                        )
                                        .map((ticket) => (
                                            <button
                                                key={ticket.id}
                                                onClick={() => setSelectedTicketId(ticket.id)}
                                                className={`w-full text-left px-3 py-3 rounded-[1rem] transition-all ${selectedTicketId === ticket.id
                                                    ? "bg-white/10 shadow-sm"
                                                    : "hover:bg-white/5"
                                                    }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${getPriorityDot(ticket.status)}`} />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <p className={`text-sm font-medium truncate ${selectedTicketId === ticket.id ? "text-white" : "text-neutral-300"}`}>
                                                                {ticket.category}
                                                            </p>
                                                            <span className="text-[10px] text-neutral-600 flex-shrink-0">
                                                                {ticket.lastMessageAt?.toDate
                                                                    ? formatDistanceToNow(ticket.lastMessageAt.toDate(), { addSuffix: false }).replace("about ", "")
                                                                    : ticket.createdAt?.toDate
                                                                        ? formatDistanceToNow(ticket.createdAt.toDate(), { addSuffix: false }).replace("about ", "")
                                                                        : ""}
                                                            </span>
                                                        </div>
                                                        <p className="text-[11px] text-neutral-600 line-clamp-1 mt-1">
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
                        <div className={`flex-1 flex flex-col min-w-0 overflow-hidden ${!selectedTicketId ? 'hidden lg:flex' : 'flex'}`}>
                            {selectedTicket ? (
                                <>
                                    {/* Chat Header */}
                                    <div className="flex items-center justify-between py-4 pl-1">
                                        {/* Left Capsule */}
                                        <div className="flex items-center gap-3 bg-white/[0.05] border border-white/[0.08] rounded-full pl-2 pr-5 py-1.5">
                                            {/* Back button for mobile */}
                                            <button
                                                onClick={() => setSelectedTicketId(null)}
                                                className="lg:hidden p-1.5 rounded-full hover:bg-white/10 text-neutral-400"
                                            >
                                                <ChevronLeftIcon className="h-4 w-4" />
                                            </button>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h2 className="text-sm font-semibold text-white">{selectedTicket.category}</h2>
                                                    <span className="text-[10px] text-neutral-500 font-mono">#{selectedTicket.id.slice(0, 6)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        {/* Right Status Capsule */}
                                        <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold border uppercase tracking-widest ${getStatusColor(selectedTicket.status)}`}>
                                            {selectedTicket.status.replace("_", " ")}
                                        </span>
                                    </div>

                                    {/* Messages Area */}
                                    <div className="flex-1 overflow-y-auto px-2 space-y-4 custom-scrollbar">
                                        {/* Original Ticket Message */}
                                        <div className="flex items-end gap-3 flex-row-reverse">
                                            <div className="flex-1 flex justify-end">
                                                <div className="inline-block max-w-[85%] rounded-2xl rounded-br-md bg-[#ffb200]/20 border border-[#ffb200]/20 px-4 py-3">
                                                    <p className="whitespace-pre-wrap text-sm text-neutral-200 leading-relaxed">
                                                        {selectedTicket.message}
                                                    </p>
                                                    {/* Attachments */}
                                                    {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                                                        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/[0.06]">
                                                            {selectedTicket.attachments.map((url, idx) => (
                                                                <button
                                                                    key={idx}
                                                                    onClick={() => {
                                                                        setOverlayIndex(idx);
                                                                        setOverlayImage(url);
                                                                    }}
                                                                    className="relative group rounded-lg overflow-hidden border border-white/10 hover:border-white/30 transition-all"
                                                                >
                                                                    <img src={url} alt={`Attachment ${idx + 1}`} className="h-20 w-20 object-cover" />
                                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                        <span className="text-white text-xs">View</span>
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="text-[10px] text-neutral-600 pb-1 flex-shrink-0">
                                                {selectedTicket.createdAt?.toDate ? format(selectedTicket.createdAt.toDate(), "h:mm a") : ""}
                                            </span>
                                        </div>

                                        {/* Messages */}
                                        {messages.map((msg) => (
                                            <div key={msg.id} className={`flex items-end gap-3 ${!msg.isStaff ? 'flex-row-reverse' : ''}`}>
                                                <div className={`flex-1 ${!msg.isStaff ? 'flex justify-end' : ''}`}>
                                                    <div className={`inline-block max-w-[85%] rounded-2xl px-4 py-3 ${!msg.isStaff
                                                        ? 'bg-[#ffb200]/20 border border-[#ffb200]/20 rounded-br-md'
                                                        : 'bg-white/[0.06] border border-white/[0.08] rounded-bl-md'
                                                        }`}>
                                                        <p className={`whitespace-pre-wrap text-sm leading-relaxed ${!msg.isStaff ? 'text-neutral-100' : 'text-neutral-200'}`}>
                                                            {msg.text}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] text-neutral-600 pb-1 flex-shrink-0">
                                                    {msg.createdAt?.toDate ? format(msg.createdAt.toDate(), "h:mm a") : "now"}
                                                </span>
                                            </div>
                                        ))}

                                        {selectedTicket.status === 'resolved' && (
                                            <div className="flex justify-center py-4">
                                                <span className="text-xs text-neutral-500 bg-white/5 px-4 py-2 rounded-full border border-white/[0.08]">
                                                    This ticket has been resolved
                                                </span>
                                            </div>
                                        )}

                                        <div ref={messagesEndRef} />
                                    </div>

                                    {/* Input Area */}
                                    <div className="pt-4">
                                        <form onSubmit={handleSendMessage} className="relative">
                                            <input
                                                type="text"
                                                value={newMessage}
                                                onChange={(e) => setNewMessage(e.target.value)}
                                                placeholder={selectedTicket.status === 'resolved' ? "Reply to reopen ticket..." : "Type a message..."}
                                                className="w-full rounded-full bg-white/[0.05] border border-white/[0.08] pl-5 pr-14 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-white/20 transition-all"
                                            />
                                            <button
                                                type="submit"
                                                disabled={!newMessage.trim() || sending}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-[#ffb200] text-black hover:bg-[#e6a000] disabled:bg-white/[0.05] disabled:text-neutral-600 transition-all"
                                            >
                                                <PaperAirplaneIcon className="h-4 w-4" />
                                            </button>
                                        </form>
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-neutral-500">
                                    <ChatBubbleLeftRightIcon className="h-16 w-16 mb-4 opacity-20" />
                                    <p className="text-lg font-medium">Select a ticket to view</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Image Overlay Modal */}
            {overlayImage && (
                <div
                    className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
                    onClick={() => setOverlayImage(null)}
                >
                    <button
                        onClick={() => setOverlayImage(null)}
                        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
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
