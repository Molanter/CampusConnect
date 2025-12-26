"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot, collection, query, orderBy, addDoc, serverTimestamp, updateDoc, Timestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { formatDistanceToNow } from "date-fns";
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
                setTicket({ id: docSnap.id, ...data });

                // Security: If loaded but not owner, redirect (double check client side)
                // (Rules protect actual data read, but good UX to redirect)
                if (auth.currentUser && data.uid !== auth.currentUser.uid) {
                    // router.push("/help-support/tickets");
                }
            } else {
                setToast({ type: "error", message: "Ticket not found" });
            }
        }, (error) => {
            console.error("Ticket read error", error);
            if (error.code === 'permission-denied') {
                router.push("/help-support/tickets");
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
                // If ticket was resolved, maybe re-open it?
                // Let's re-open if resolved so admin sees it back in 'in_progress' or 'open'
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

    if (!ticket) return <div className="p-8 text-center text-neutral-500">Loading...</div>;

    return (
        <div className="flex h-screen flex-col bg-black text-white">
            <Toast toast={toast} onClear={() => setToast(null)} />

            {/* Header */}
            <header className="flex items-center justify-between border-b border-white/10 bg-[#121212] px-4 py-3 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.back()} className="rounded-full p-2 hover:bg-white/10">
                        <ChevronLeftIcon className="h-5 w-5 text-neutral-400" />
                    </button>
                    <div>
                        <h1 className="font-bold text-white leading-tight">{ticket.category}</h1>
                        <p className="text-xs text-neutral-400">#{ticket.id.slice(0, 6)}</p>
                    </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border uppercase tracking-wide
                    ${ticket.status === 'open' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                        ticket.status === 'in_progress' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                            'bg-neutral-500/10 text-neutral-400 border-neutral-500/20'}`}>
                    {ticket.status.replace("_", " ")}
                </span>
            </header>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Original Ticket */}
                <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-tr-none bg-[#1C1C1E] border border-white/10 p-4">
                        <div className="mb-1 text-xs text-neutral-400">
                            You • {ticket.createdAt?.toDate ? formatDistanceToNow(ticket.createdAt.toDate(), { addSuffix: true }) : ""}
                        </div>
                        <p className="text-sm text-neutral-200 whitespace-pre-wrap">{ticket.message}</p>
                    </div>
                </div>

                {/* Messages */}
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${!msg.isStaff ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl p-3.5 ${!msg.isStaff
                            ? 'bg-blue-600 rounded-tr-none text-white'
                            : 'bg-[#2C2C2E] rounded-tl-none text-neutral-200'}`}>

                            <div className="mb-1 flex items-center justify-between gap-4 text-[10px] opacity-70">
                                <span className="font-bold">{msg.isStaff ? "Support Team" : "You"}</span>
                                <span>{msg.createdAt?.toDate ? formatDistanceToNow(msg.createdAt.toDate(), { addSuffix: true }) : "just now"}</span>
                            </div>
                            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{msg.text}</p>
                        </div>
                    </div>
                ))}

                {ticket.status === 'resolved' && (
                    <div className="flex justify-center py-4">
                        <span className="text-xs text-neutral-500 bg-white/5 px-3 py-1 rounded-full">
                            This ticket has been marked as resolved
                        </span>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-white/10 bg-[#121212] p-3 pb-8 md:pb-3">
                <form onSubmit={handleSendMessage} className="relative flex items-center gap-2 max-w-4xl mx-auto">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={ticket.status === 'resolved' ? "Reply to reopen ticket..." : "Type a message..."}
                        className="flex-1 rounded-full bg-[#1C1C1E] border border-white/10 px-5 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-white/20 text-sm"
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim() || sending}
                        className="p-3 rounded-full bg-blue-600 text-white hover:bg-blue-500 disabled:bg-[#1C1C1E] disabled:text-neutral-500 disabled:cursor-not-allowed transition-colors"
                    >
                        <PaperAirplaneIcon className="h-5 w-5" />
                    </button>
                </form>
            </div>
        </div>
    );
}
