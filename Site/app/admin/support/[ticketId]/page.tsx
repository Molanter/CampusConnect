"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot, collection, query, orderBy, addDoc, serverTimestamp, updateDoc, Timestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase"; // Ensure auth is imported for senderUid
import { formatDistanceToNow } from "date-fns";
import { ChevronLeftIcon, PaperAirplaneIcon, CheckCircleIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
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
    name: string;
    email: string;
    category: string;
    priority: string;
    status: "open" | "in_progress" | "resolved" | "closed";
    message: string;
    createdAt: Timestamp;
    uid?: string;
    deviceInfo?: any;
};

export default function AdminTicketChatPage() {
    const { ticketId } = useParams();
    const router = useRouter();
    const [ticket, setTicket] = useState<TicketData | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [toast, setToast] = useState<ToastData | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auth for sender identity
    // We can assume if they are on this page (protected by layout/middleware), they are admin?
    // But for the message `senderUid`, we need current auth.
    // Let's use standard auth listener for consistency or just auth.currentUser?
    // Since this is a client component, auth.currentUser might be null on first render.
    // For simplicity, I'll use auth.currentUser when sending.

    // 1. Fetch Ticket & Messages
    useEffect(() => {
        if (!ticketId || typeof ticketId !== 'string') return;

        // Ticket Listener
        const ticketRef = doc(db, "supportTickets", ticketId);
        const unsubTicket = onSnapshot(ticketRef, (docSnap) => {
            if (docSnap.exists()) {
                setTicket({ id: docSnap.id, ...docSnap.data() } as TicketData);
            } else {
                // Handle 404
                setToast({ type: "error", message: "Ticket not found" });
            }
        });

        // Messages Listener
        const messagesRef = collection(db, "supportTickets", ticketId, "messages");
        const q = query(messagesRef, orderBy("createdAt", "asc"));
        const unsubMessages = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Message));
            setMessages(msgs);
        });

        return () => {
            unsubTicket();
            unsubMessages();
        };
    }, [ticketId]);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!newMessage.trim() || !ticketId || typeof ticketId !== 'string') return;

        setSending(true);
        try {
            const user = auth.currentUser;
            if (!user) throw new Error("Not authenticated");

            // 1. Add Message
            await addDoc(collection(db, "supportTickets", ticketId, "messages"), {
                text: newMessage.trim(),
                senderUid: user.uid,
                isStaff: true, // Always true for admin page
                createdAt: serverTimestamp()
            });

            // 2. Update Ticket (status -> in_progress if open, updatedAt)
            const updatePayload: any = {
                updatedAt: serverTimestamp(),
                lastMessageAt: serverTimestamp()
            };
            if (ticket?.status === 'open') {
                updatePayload.status = 'in_progress';
            }

            await updateDoc(doc(db, "supportTickets", ticketId), updatePayload);

            setNewMessage("");
        } catch (error) {
            console.error(error);
            setToast({ type: "error", message: "Failed to send message" });
        } finally {
            setSending(false);
        }
    };

    const handleUpdateStatus = async (newStatus: "resolved" | "in_progress" | "open") => {
        if (!ticketId || typeof ticketId !== 'string') return;
        try {
            await updateDoc(doc(db, "supportTickets", ticketId), {
                status: newStatus,
                updatedAt: serverTimestamp()
            });
            setToast({ type: "success", message: `Ticket marked as ${newStatus}` });
        } catch (error) {
            setToast({ type: "error", message: "Failed to update status" });
        }
    };

    if (!ticket) return <div className="p-8 text-white">Loading ticket...</div>;

    return (
        <div className="flex h-screen flex-col bg-black text-white">
            <Toast toast={toast} onClear={() => setToast(null)} />

            {/* Header */}
            <header className="flex items-center justify-between border-b border-white/10 bg-[#121212] px-6 py-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="rounded-full p-2 hover:bg-white/10">
                        <ChevronLeftIcon className="h-5 w-5 text-neutral-400" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-bold">{ticket.category}</h1>
                            <span className="text-sm text-neutral-500">#{ticket.id.slice(0, 6)}</span>
                        </div>
                        <p className="text-xs text-neutral-400">
                            by <span className="text-white font-medium">{ticket.name}</span> • {ticket.email}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border uppercase tracking-wide
                        ${ticket.status === 'open' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                            ticket.status === 'in_progress' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                'bg-neutral-500/10 text-neutral-400 border-neutral-500/20'}`}>
                        {ticket.status.replace("_", " ")}
                    </span>

                    {ticket.status !== 'resolved' ? (
                        <button
                            onClick={() => handleUpdateStatus('resolved')}
                            className="flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-xs font-medium hover:bg-white/10"
                        >
                            <CheckCircleIcon className="h-4 w-4" />
                            Mark Resolved
                        </button>
                    ) : (
                        <button
                            onClick={() => handleUpdateStatus('in_progress')}
                            className="flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-xs font-medium hover:bg-white/10"
                        >
                            <ArrowPathIcon className="h-4 w-4" />
                            Reopen Ticket
                        </button>
                    )}
                </div>
            </header>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Original Ticket Message */}
                <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-2xl rounded-tl-none bg-[#1C1C1E] border border-white/10 p-5">
                        <div className="mb-2 flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{ticket.name}</span>
                            <span className="text-xs text-neutral-500">
                                {ticket.createdAt?.toDate ? formatDistanceToNow(ticket.createdAt.toDate(), { addSuffix: true }) : ""}
                            </span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-neutral-200 leading-relaxed">
                            {ticket.message}
                        </p>
                        {ticket.deviceInfo && (
                            <div className="mt-4 border-t border-white/5 pt-3">
                                <p className="text-[10px] text-neutral-500 font-mono">
                                    Device: {JSON.stringify(ticket.deviceInfo)}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Messages Loop */}
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.isStaff ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl p-4 ${msg.isStaff
                            ? 'bg-blue-600/20 border border-blue-500/20 text-blue-100 rounded-tr-none'
                            : 'bg-[#1C1C1E] border border-white/10 text-neutral-200 rounded-tl-none'}`}>
                            <div className="mb-1 flex items-center gap-2 justify-between">
                                <span className={`text-xs font-bold ${msg.isStaff ? 'text-blue-400' : 'text-neutral-400'}`}>
                                    {msg.isStaff ? 'Support Staff' : ticket.name}
                                </span>
                                <span className="text-[10px] text-white/40">
                                    {msg.createdAt?.toDate ? formatDistanceToNow(msg.createdAt.toDate(), { addSuffix: true }) : "just now"}
                                </span>
                            </div>
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.text}</p>
                        </div>
                    </div>
                ))}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-white/10 bg-[#121212] p-4 pb-8">
                <form onSubmit={handleSendMessage} className="mx-auto max-w-4xl relative">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a reply..."
                        disabled={ticket.status === 'resolved'}
                        className="w-full rounded-full bg-[#1C1C1E] border border-white/10 pl-5 pr-12 py-3.5 text-white placeholder-neutral-500 focus:outline-none focus:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim() || sending || ticket.status === 'resolved'}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-blue-600 text-white hover:bg-blue-500 disabled:bg-transparent disabled:text-neutral-600 transition-colors"
                    >
                        <PaperAirplaneIcon className="h-5 w-5" />
                    </button>
                </form>
            </div>
        </div>
    );
}
