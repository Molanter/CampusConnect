"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot, collection, query, orderBy, addDoc, serverTimestamp, updateDoc, Timestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { format } from "date-fns";
import { ChevronLeftIcon, PaperAirplaneIcon } from "@heroicons/react/24/outline";
import Toast, { ToastData } from "@/components/Toast";

type Message = {
    id: string;
    text: string;
    senderUid: string;
    isStaff: boolean;
    createdAt: Timestamp;
};

type TicketData = {
    id: string;
    category: string;
    status: "open" | "in_progress" | "resolved" | "closed";
    message: string;
    createdAt: Timestamp;
    uid: string;
    attachments?: string[];
};

export default function UserTicketChatPage() {
    const { ticketId } = useParams();
    const router = useRouter();
    const [ticket, setTicket] = useState<TicketData | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [toast, setToast] = useState<ToastData | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);
    const [overlayImage, setOverlayImage] = useState<string | null>(null);
    const [overlayIndex, setOverlayIndex] = useState<number>(0);

    // Auth State
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user) => {
            if (user) setCurrentUserUid(user.uid);
            else router.push("/"); // Redirect if not logged in
        });
        return () => unsub();
    }, [router]);

    // Fetch Data
    useEffect(() => {
        if (!ticketId || typeof ticketId !== 'string') return;

        // Ticket Listener
        const ticketRef = doc(db, "supportTickets", ticketId);
        const unsubTicket = onSnapshot(ticketRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as TicketData;
                setTicket({ ...data, id: docSnap.id });

                // Security: If loaded but not owner, redirect (double check client side)
                if (auth.currentUser && data.uid !== auth.currentUser.uid) {
                    // router.push("/help-support/tickets");
                }
            } else {
                setToast({ type: "error", message: "Ticket not found" });
            }
        }, (error) => {
            console.error("Ticket read error", error);
            if (error.code === 'permission-denied') {
                router.push("/settings/help-support/tickets");
            }
        });

        // Messages Listener
        const messagesRef = collection(db, "supportTickets", ticketId, "messages");
        const q = query(messagesRef, orderBy("createdAt", "asc"));
        const unsubMessages = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Message));
            setMessages(msgs);
        }, (error) => {
            console.error("Messages read error", error);
        });

        return () => {
            unsubTicket();
            unsubMessages();
        };
    }, [ticketId, router]);

    // Scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Keyboard navigation for image overlay
    const currentAttachments = ticket?.attachments || [];
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
        if (!newMessage.trim() || !ticketId || typeof ticketId !== 'string' || !currentUserUid) return;

        setSending(true);
        try {
            // 1. Add Message
            await addDoc(collection(db, "supportTickets", ticketId, "messages"), {
                text: newMessage.trim(),
                senderUid: currentUserUid,
                isStaff: false,
                createdAt: serverTimestamp()
            });

            // 2. Update Ticket lastMessageAt
            await updateDoc(doc(db, "supportTickets", ticketId), {
                lastMessageAt: serverTimestamp(),
                lastResponderIsStaff: false,
                // If ticket was resolved, re-open it
                ...(ticket?.status === 'resolved' ? { status: 'in_progress', updatedAt: serverTimestamp() } : {})
            });

            setNewMessage("");
        } catch (error) {
            console.error(error);
            setToast({ type: "error", message: "Failed to send message" });
        } finally {
            setSending(false);
        }
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'open': return 'bg-green-500/15 text-green-400 border-green-500/30';
            case 'in_progress': return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
            case 'resolved': return 'bg-neutral-500/15 text-neutral-400 border-neutral-500/30';
            default: return 'bg-neutral-500/15 text-neutral-400 border-neutral-500/30';
        }
    };

    if (!ticket) return (
        <div className="flex h-screen items-center justify-center bg-black">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-[#ffb200]" />
        </div>
    );

    return (
        <>
            <div className="flex h-screen flex-col text-white">
                <Toast toast={toast} onClear={() => setToast(null)} />

                {/* Header */}
                <header className="flex items-center justify-between backdrop-blur-xl border-b border-white/[0.08] px-4 py-3 sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.back()} className="rounded-full p-2 hover:bg-white/10 transition-colors">
                            <ChevronLeftIcon className="h-5 w-5 text-neutral-400" />
                        </button>
                        <div className="flex items-center gap-3 bg-white/[0.05] rounded-full px-4 py-2 border border-white/[0.08]">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-sm font-semibold text-white">{ticket.category}</h1>
                                    <span className="text-xs text-neutral-500 font-mono">#{ticket.id.slice(0, 6)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-widest ${getStatusStyle(ticket.status)}`}>
                        {ticket.status.replace("_", " ")}
                    </span>
                </header>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                    {/* Original Ticket Message */}
                    <div className="flex items-end gap-3 flex-row-reverse">
                        <div className="flex-1 flex justify-end">
                            <div className="inline-block max-w-[85%] rounded-2xl rounded-br-md bg-[#ffb200]/20 backdrop-blur-sm border border-[#ffb200]/20 px-4 py-3">
                                <p className="whitespace-pre-wrap text-sm text-neutral-200 leading-relaxed">
                                    {ticket.message}
                                </p>
                                {/* Attachments */}
                                {ticket.attachments && ticket.attachments.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/[0.06]">
                                        {ticket.attachments.map((url, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => {
                                                    setOverlayIndex(idx);
                                                    setOverlayImage(url);
                                                }}
                                                className="relative group rounded-lg overflow-hidden border border-white/10 hover:border-white/30 transition-all"
                                            >
                                                <img
                                                    src={url}
                                                    alt={`Attachment ${idx + 1}`}
                                                    className="h-20 w-20 object-cover"
                                                />
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
                            {ticket.createdAt?.toDate ? format(ticket.createdAt.toDate(), "h:mm a") : ""}
                        </span>
                    </div>

                    {/* Messages */}
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex items-end gap-3 ${!msg.isStaff ? 'flex-row-reverse' : ''}`}>
                            <div className={`flex-1 ${!msg.isStaff ? 'flex justify-end' : ''}`}>
                                <div className={`inline-block max-w-[85%] rounded-2xl px-4 py-3 ${!msg.isStaff
                                    ? 'bg-[#ffb200]/20 backdrop-blur-sm border border-[#ffb200]/20 rounded-br-md'
                                    : 'bg-white/[0.06] backdrop-blur-sm border border-white/[0.08] rounded-bl-md'
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

                    {ticket.status === 'resolved' && (
                        <div className="flex justify-center py-4">
                            <span className="text-xs text-neutral-500 bg-white/5 px-4 py-2 rounded-full border border-white/[0.08]">
                                This ticket has been marked as resolved
                            </span>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="border-t border-white/[0.08] backdrop-blur-xl p-4 pb-8 md:pb-4">
                    <form onSubmit={handleSendMessage} className="relative max-w-4xl mx-auto">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder={ticket.status === 'resolved' ? "Reply to reopen ticket..." : "Type a message..."}
                            className="w-full rounded-full bg-white/[0.05] border border-white/[0.08] pl-5 pr-14 py-3.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-white/20 focus:bg-white/[0.08] transition-all"
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
