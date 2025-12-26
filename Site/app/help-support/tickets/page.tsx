"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, query, orderBy, onSnapshot, where, Timestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ChevronLeftIcon, PlusIcon } from "@heroicons/react/24/outline";
import { formatDistanceToNow } from "date-fns";

type SupportTicket = {
    id: string;
    category: string;
    status: "open" | "in_progress" | "resolved" | "closed";
    message: string;
    createdAt: Timestamp;
    lastMessageAt?: Timestamp;
};

export default function UserTicketsPage() {
    const router = useRouter();
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (!currentUser) {
                setLoading(false); // No user, stop loading (could redirect)
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

    const getStatusColor = (status: string) => {
        switch (status) {
            case "open": return "bg-green-500/10 text-green-500 border-green-500/20";
            case "in_progress": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
            case "resolved": return "bg-neutral-500/10 text-neutral-400 border-neutral-500/20";
            default: return "bg-neutral-500/10 text-neutral-500";
        }
    };

    return (
        <div className="min-h-screen bg-black text-white p-4 pb-20 md:pb-4">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <header className="flex items-center justify-between mb-8 pt-4">
                    <div className="flex items-center gap-4">
                        <Link href="/settings" className="rounded-full p-2 hover:bg-white/10 transition-colors">
                            <ChevronLeftIcon className="h-6 w-6 text-white" />
                        </Link>
                        <h1 className="text-2xl font-bold">My Support Tickets</h1>
                    </div>
                    <Link
                        href="/help-support"
                        className="flex items-center gap-2 bg-[#ffb200] text-black px-4 py-2 rounded-full font-semibold hover:bg-[#ffb200]/90 transition-colors"
                    >
                        <PlusIcon className="h-5 w-5" />
                        <span className="hidden sm:inline">New Ticket</span>
                    </Link>
                </header>

                {/* List */}
                <div className="space-y-4">
                    {loading ? (
                        <div className="text-center py-12 text-neutral-500">Loading your tickets...</div>
                    ) : !user ? (
                        <div className="text-center py-12 text-neutral-500">Please log in to view your tickets.</div>
                    ) : tickets.length === 0 ? (
                        <div className="text-center py-12 bg-[#1C1C1E] rounded-2xl border border-white/10">
                            <p className="text-neutral-400 mb-4">You haven't created any support tickets yet.</p>
                            <Link
                                href="/help-support"
                                className="text-[#ffb200] hover:underline"
                            >
                                Contact Support
                            </Link>
                        </div>
                    ) : (
                        tickets.map((ticket) => (
                            <Link
                                key={ticket.id}
                                href={`/help-support/tickets/${ticket.id}`}
                                className="block bg-[#1C1C1E] border border-white/10 rounded-2xl p-5 hover:bg-white/5 transition-all group"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-lg group-hover:text-blue-400 transition-colors">
                                        {ticket.category}
                                    </h3>
                                    <span className={`px-2 py-0.5 rounded text-[11px] font-medium border uppercase tracking-wide ${getStatusColor(ticket.status)}`}>
                                        {ticket.status.replace("_", " ")}
                                    </span>
                                </div>
                                <p className="text-neutral-400 text-sm line-clamp-2 mb-3">
                                    {ticket.message}
                                </p>
                                <div className="flex items-center justify-between text-xs text-neutral-500">
                                    <span>
                                        Created {ticket.createdAt ? formatDistanceToNow(ticket.createdAt.toDate(), { addSuffix: true }) : 'just now'}
                                    </span>
                                    {ticket.lastMessageAt && (
                                        <span className="text-neutral-400">
                                            Last activity {formatDistanceToNow(ticket.lastMessageAt.toDate(), { addSuffix: true })}
                                        </span>
                                    )}
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
