"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot, collection, query, orderBy, addDoc, serverTimestamp, updateDoc, Timestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { format } from "date-fns";
import { ChevronLeftIcon, PaperAirplaneIcon, CheckCircleIcon, ArrowPathIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import Toast, { ToastData } from "@/components/Toast";
import { useRightSidebar } from "@/components/right-sidebar-context";

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
    updatedAt?: Timestamp;
    lastMessageAt?: Timestamp;
    lastResponderIsStaff?: boolean;
    uid?: string;
    deviceInfo?: {
        platform?: string;
        language?: string;
        userAgent?: string;
    };
};

export default function AdminTicketChatPage() {
    const { ticketId } = useParams();
    const router = useRouter();
    const { openView, close, toggle, isVisible } = useRightSidebar();
    const [ticket, setTicket] = useState<TicketData | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [toast, setToast] = useState<ToastData | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!ticketId || typeof ticketId !== 'string') return;

        const ticketRef = doc(db, "supportTickets", ticketId);
        const unsubTicket = onSnapshot(ticketRef, (docSnap) => {
            if (docSnap.exists()) {
                const ticketData = { id: docSnap.id, ...docSnap.data() } as TicketData;
                setTicket(ticketData);
                // Update right sidebar with ticket info
                openView("support-ticket-info", ticketData);
            } else {
                setToast({ type: "error", message: "Ticket not found" });
            }
        });

        const messagesRef = collection(db, "supportTickets", ticketId, "messages");
        const q = query(messagesRef, orderBy("createdAt", "asc"));
        const unsubMessages = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Message));
            setMessages(msgs);
        });

        return () => {
            unsubTicket();
            unsubMessages();
            close(); // Close sidebar when leaving the page
        };
    }, [ticketId, openView, close]);

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

            await addDoc(collection(db, "supportTickets", ticketId, "messages"), {
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

    const getStatusStyle = (status: string) => {
        switch (status) {
            case "open": return "bg-green-500/15 text-green-400 border-green-500/30";
            case "in_progress": return "bg-blue-500/15 text-blue-400 border-blue-500/30";
            case "resolved": return "bg-neutral-500/15 text-neutral-400 border-neutral-500/30";
            default: return "bg-neutral-500/15 text-neutral-400 border-neutral-500/30";
        }
    };

    if (!ticket) return <div className="flex items-center justify-center h-screen text-neutral-400">Loading ticket...</div>;

    return (
        <div className="flex h-screen flex-col text-white">
            <Toast toast={toast} onClear={() => setToast(null)} />

            {/* Header - Two Capsules */}
            <header className="flex items-center justify-between px-6 py-4">
                {/* Left Capsule */}
                <div className="flex items-center gap-3 bg-white/[0.05] backdrop-blur-xl rounded-full px-2 py-1.5 border border-white/[0.08]">
                    <button onClick={() => router.back()} className="rounded-full p-2 hover:bg-white/10 transition-colors">
                        <ChevronLeftIcon className="h-5 w-5 text-neutral-400" />
                    </button>
                    <div className="pr-4">
                        <div className="flex items-center gap-2">
                            <h1 className="text-sm font-semibold text-white">{ticket.category}</h1>
                            <span className="text-xs text-neutral-500 font-mono">#{ticket.id.slice(0, 6)}</span>
                        </div>
                    </div>
                </div>

                {/* Right Section */}
                <div className="flex items-center gap-2">
                    {/* Right Capsule */}
                    <div className="flex items-center gap-3 bg-white/[0.05] backdrop-blur-xl rounded-full px-4 py-2 border border-white/[0.08]">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-widest ${getStatusStyle(ticket.status)}`}>
                            {ticket.status.replace("_", " ")}
                        </span>

                        {ticket.status !== 'resolved' ? (
                            <button
                                onClick={() => handleUpdateStatus('resolved')}
                                className="flex items-center gap-2 rounded-full bg-white/[0.08] hover:bg-white/[0.12] px-4 py-1.5 text-xs font-medium transition-colors"
                            >
                                <CheckCircleIcon className="h-4 w-4 text-green-400" />
                                <span>Resolve</span>
                            </button>
                        ) : (
                            <button
                                onClick={() => handleUpdateStatus('in_progress')}
                                className="flex items-center gap-2 rounded-full bg-white/[0.08] hover:bg-white/[0.12] px-4 py-1.5 text-xs font-medium transition-colors"
                            >
                                <ArrowPathIcon className="h-4 w-4 text-blue-400" />
                                <span>Reopen</span>
                            </button>
                        )}
                    </div>

                    {/* Info Toggle Button */}
                    <button
                        onClick={toggle}
                        className="flex items-center justify-center w-10 h-10 rounded-full border bg-white/[0.05] border-white/[0.08] hover:bg-white/[0.08] text-neutral-400 transition-colors"
                        title={isVisible ? "Hide ticket info" : "Show ticket info"}
                    >
                        <InformationCircleIcon className="h-5 w-5" />
                    </button>
                </div>
            </header>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    {/* Original Ticket Message */}
                    <div className="flex items-end gap-3">
                        <div className="flex-1">
                            <div className="inline-block max-w-[85%] rounded-2xl rounded-bl-md bg-white/[0.06] backdrop-blur-sm border border-white/[0.08] px-4 py-3">
                                <p className="whitespace-pre-wrap text-sm text-neutral-200 leading-relaxed">
                                    {ticket.message}
                                </p>
                            </div>
                        </div>
                        <span className="text-[10px] text-neutral-600 pb-1 flex-shrink-0">
                            {ticket.createdAt?.toDate ? format(ticket.createdAt.toDate(), "h:mm a") : ""}
                        </span>
                    </div>

                    {/* Messages Loop */}
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex items-end gap-3 ${msg.isStaff ? 'flex-row-reverse' : ''}`}>
                            <div className={`flex-1 ${msg.isStaff ? 'flex justify-end' : ''}`}>
                                <div className={`inline-block max-w-[85%] rounded-2xl px-4 py-3 ${msg.isStaff
                                    ? 'bg-blue-600/20 backdrop-blur-sm border border-blue-500/20 rounded-br-md'
                                    : 'bg-white/[0.06] backdrop-blur-sm border border-white/[0.08] rounded-bl-md'
                                    }`}>
                                    <p className={`whitespace-pre-wrap text-sm leading-relaxed ${msg.isStaff ? 'text-blue-100' : 'text-neutral-200'}`}>
                                        {msg.text}
                                    </p>
                                </div>
                            </div>
                            <span className="text-[10px] text-neutral-600 pb-1 flex-shrink-0">
                                {msg.createdAt?.toDate ? format(msg.createdAt.toDate(), "h:mm a") : "now"}
                            </span>
                        </div>
                    ))}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area - No Background */}
                <div className="px-6 py-4">
                    <form onSubmit={handleSendMessage} className="relative">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder={ticket.status === 'resolved' ? "Reopen ticket to reply..." : "Type a reply..."}
                            disabled={ticket.status === 'resolved'}
                            className="w-full rounded-2xl bg-white/[0.05] border border-white/[0.08] pl-5 pr-14 py-3.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-white/20 focus:bg-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        />
                        <button
                            type="submit"
                            disabled={!newMessage.trim() || sending || ticket.status === 'resolved'}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:bg-white/[0.05] disabled:text-neutral-600 transition-all"
                        >
                            <PaperAirplaneIcon className="h-4 w-4" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

