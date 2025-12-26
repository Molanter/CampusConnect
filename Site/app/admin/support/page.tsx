"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { MagnifyingGlassIcon, FunnelIcon, ChartBarIcon, ClockIcon, CheckCircleIcon, InboxIcon, ArrowUpRightIcon } from "@heroicons/react/24/outline";
import { format } from "date-fns";

type SupportTicket = {
    id: string;
    name: string;
    email: string;
    category: string;
    priority: "Low" | "Medium" | "High";
    status: "open" | "in_progress" | "resolved" | "closed";
    message: string;
    createdAt: any;
    uid?: string;
};

export default function AdminSupportPage() {
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState<"overview" | "tickets" | "stats">("overview");

    // Real-time listener
    useEffect(() => {
        const q = query(
            collection(db, "supportTickets"),
            orderBy("createdAt", "desc")
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as SupportTicket));
            setTickets(fetched);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Derived Stats
    const stats = {
        total: tickets.length,
        open: tickets.filter(t => t.status === 'open').length,
        resolved: tickets.filter(t => t.status === 'resolved').length,
        highPriority: tickets.filter(t => t.priority === 'High' && t.status !== 'resolved').length
    };

    // Filter logic
    const filteredTickets = tickets.filter(ticket => {
        const matchesStatus = filterStatus === "all" ? true : ticket.status === filterStatus;
        const matchesSearch =
            ticket.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ticket.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ticket.message.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesStatus && matchesSearch;
    });

    // Sub-components for clarity
    const StatCardsRow = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
                title="All Tickets"
                value={stats.total}
                icon={<InboxIcon className="h-6 w-6 text-white/80" />}
            />
            <StatCard
                title="Open Tickets"
                value={stats.open}
                icon={<ClockIcon className="h-6 w-6 text-blue-400" />}
            />
            <StatCard
                title="Resolved"
                value={stats.resolved}
                icon={<CheckCircleIcon className="h-6 w-6 text-green-400" />}
            />
            <StatCard
                title="High Priority"
                value={stats.highPriority}
                icon={<ChartBarIcon className="h-6 w-6 text-red-400" />}
            />
        </div>
    );



    const ChartsSection = () => (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Activity Chart */}
            <div className="lg:col-span-2 backdrop-blur-2xl bg-white/[0.02] rounded-[40px] p-8 md:p-12 border border-white/[0.08]">
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-medium text-white">Ticket Activity</h3>
                    <select className="bg-white/[0.03] border border-white/5 rounded-full px-4 py-2 text-sm text-neutral-400 outline-none">
                        <option>Last 14 Days</option>
                        <option>Last Month</option>
                    </select>
                </div>
                <div className="flex items-end justify-between gap-3 h-64 w-full">
                    {[45, 60, 35, 78, 52, 65, 48, 55, 67, 80, 50, 45, 62, 75].map((h, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-3">
                            <div className="w-full bg-white/[0.05] rounded-t-lg hover:bg-blue-500/50 transition-colors h-full relative overflow-hidden group">
                                <div
                                    className="absolute bottom-0 w-full bg-blue-500 rounded-t-lg transition-all duration-500 group-hover:bg-blue-400"
                                    style={{ height: `${h}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex justify-between mt-4 text-xs text-neutral-600 font-medium px-1 uppercase tracking-wider">
                    <span>Nov 1</span>
                    <span>Nov 14</span>
                </div>
            </div>

            {/* Doughnut Chart */}
            <div className="backdrop-blur-2xl bg-white/[0.02] rounded-[40px] p-8 md:p-12 border border-white/[0.08] flex flex-col items-center justify-center">
                <h3 className="text-xl font-medium text-white mb-8 w-full text-left">Priority Split</h3>
                <div className="relative h-56 w-56">
                    <svg viewBox="0 0 36 36" className="w-full h-full rotate-[-90deg]">
                        <path className="text-neutral-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2" />
                        <path className="text-blue-500" strokeDasharray="40, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <path className="text-orange-500" strokeDasharray="25, 100" strokeDashoffset="-45" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <path className="text-red-500" strokeDasharray="15, 100" strokeDashoffset="-75" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-4xl font-light text-white">{stats.total}</span>
                        <span className="text-xs text-neutral-500 uppercase tracking-widest mt-1">Total</span>
                    </div>
                </div>
                <div className="flex gap-6 mt-10">
                    <div className="flex items-center gap-2 text-xs text-neutral-400 font-medium tracking-wide">
                        <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" /> HIGH
                    </div>
                    <div className="flex items-center gap-2 text-xs text-neutral-400 font-medium tracking-wide">
                        <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]" /> MED
                    </div>
                    <div className="flex items-center gap-2 text-xs text-neutral-400 font-medium tracking-wide">
                        <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" /> LOW
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="text-white p-6 md:p-10 font-sans">
            <div className="max-w-7xl mx-auto space-y-10">

                {/* Global Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b border-white/[0.05]">
                    <div>
                        <h1 className="text-4xl font-semibold text-white tracking-tight">Support</h1>
                    </div>

                    {/* Tabs */}
                    <div className="flex bg-white/[0.05] p-1 rounded-full">
                        {(['overview', 'tickets', 'stats'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-6 py-2 rounded-full text-[14px] font-medium transition-all ${activeTab === tab
                                    ? "bg-[#636366] text-white shadow-lg shadow-black/20"
                                    : "text-neutral-400 hover:text-white"
                                    } capitalize`}
                            >
                                {tab}
                            </button>
                        ))}
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
                            />
                        </>
                    )}

                    {activeTab === 'tickets' && (
                        <TicketList
                            title="All Support Tickets"
                            showViewAll={false}
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            filterStatus={filterStatus}
                            setFilterStatus={setFilterStatus}
                            loading={loading}
                            filteredTickets={filteredTickets}
                            setActiveTab={setActiveTab}
                        />
                    )}

                    {activeTab === 'stats' && (
                        <>
                            <StatCardsRow />
                            <ChartsSection />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// Helpers
const getIndicatorColor = (ticket: SupportTicket) => {
    if (ticket.status === 'resolved') return 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]';
    switch (ticket.priority) {
        case 'High': return 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]';
        case 'Medium': return 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.3)]';
        case 'Low': return 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]';
        default: return 'bg-neutral-500';
    }
};

const getStatusStyle = (status: string) => {
    switch (status) {
        case "open": return "bg-blue-500/10 text-blue-400";
        case "in_progress": return "bg-orange-500/10 text-orange-400";
        case "resolved": return "bg-green-500/10 text-green-400";
        case "closed": return "bg-neutral-500/10 text-neutral-400";
        default: return "bg-neutral-500/10 text-neutral-400";
    }
};

function StatCard({ title, value, icon }: { title: string, value: number, icon: React.ReactNode }) {
    return (
        <div className="backdrop-blur-2xl bg-white/[0.02] p-7 rounded-[36px] border border-white/[0.08] flex items-center justify-between hover:bg-white/[0.04] transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/20 group">
            <div>
                <p className="text-neutral-500 text-[13px] font-bold tracking-widest uppercase mb-2 group-hover:text-neutral-400 transition-colors">{title}</p>
                <div className="text-[40px] font-light text-white tracking-tighter leading-none">{value.toLocaleString()}</div>
            </div>
            <div className="p-4 bg-white/[0.03] rounded-[20px] group-hover:bg-white/[0.08] transition-colors text-white/50 group-hover:text-white">
                {icon}
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
    setActiveTab
}: TicketListProps) => (
    <>
        {/* List Header (Separated) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6 px-2">
            <div>
                <h2 className="text-2xl font-medium text-white tracking-tight">{title}</h2>
                <p className="text-neutral-500 text-sm mt-1 font-light">Manage and track your support request queue</p>
            </div>

            <div className="flex items-center gap-3">
                <div className="relative group">
                    <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 group-focus-within:text-white transition-colors" />
                    <input
                        type="text"
                        placeholder="Search tickets..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="bg-white/[0.05] hover:bg-white/[0.08] focus:bg-white/[0.1] border border-transparent focus:border-white/10 rounded-full pl-10 pr-5 py-2.5 text-sm text-white focus:ring-0 transition-all w-56 focus:w-72 outline-none placeholder:text-neutral-600 font-light"
                    />
                </div>
                <div className="relative">
                    <FunnelIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 pointer-events-none" />
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="bg-white/[0.05] hover:bg-white/[0.08] border border-transparent focus:border-white/10 rounded-full pl-10 pr-5 py-2.5 text-sm text-white focus:ring-0 cursor-pointer appearance-none outline-none transition-all font-medium"
                    >
                        <option value="all" className="bg-[#1C1C1E]">All Status</option>
                        <option value="open" className="bg-[#1C1C1E]">Open</option>
                        <option value="in_progress" className="bg-[#1C1C1E]">In Progress</option>
                        <option value="resolved" className="bg-[#1C1C1E]">Resolved</option>
                    </select>
                </div>
            </div>
        </div>

        {/* List Items Container (Glass) */}
        <div className="backdrop-blur-3xl bg-white/[0.02] rounded-[40px] p-6 md:p-8 border border-white/[0.08] shadow-2xl shadow-black/40">
            <div className="space-y-1.5">
                {loading && <div className="text-center py-20 text-neutral-500 font-light text-lg">Loading tickets...</div>}
                {!loading && filteredTickets.length === 0 && <div className="text-center py-20 text-neutral-500 font-light text-lg">No tickets found</div>}

                {filteredTickets.map((ticket) => (
                    <Link
                        href={`/admin/support/${ticket.id}`}
                        key={ticket.id}
                        className="group flex items-center gap-3 p-2.5 rounded-[20px] hover:bg-white/[0.04] transition-all duration-300 border border-transparent hover:border-white/[0.03]"
                    >
                        {/* Date */}
                        <div className="w-28 flex-shrink-0 text-[12px] font-medium text-neutral-500 group-hover:text-neutral-400 transition-colors">
                            {ticket.createdAt?.toDate ? format(ticket.createdAt.toDate(), "MMM dd, yyyy") : "Date"}
                            <div className="text-[10px] text-neutral-600 mt-0.5 font-light">{ticket.createdAt?.toDate ? format(ticket.createdAt.toDate(), "h:mm a") : ""}</div>
                        </div>

                        {/* Indicator */}
                        <div className={`w-1 h-6 md:h-8 rounded-full ${getIndicatorColor(ticket)} opacity-60 group-hover:opacity-100 transition-opacity`} />

                        {/* Content */}
                        <div className="flex-1 min-w-0 py-0.5">
                            <h3 className="text-[15px] font-medium text-white mb-0.5 truncate group-hover:text-blue-400 transition-colors tracking-tight">
                                {ticket.category}
                            </h3>
                            <div className="flex items-center gap-2 text-[13px] text-neutral-400 truncate">
                                <span className="text-neutral-200 font-normal">{ticket.name}</span>
                                <span className="w-0.5 h-0.5 rounded-full bg-neutral-700" />
                                <span className="truncate opacity-60 font-light">{ticket.message}</span>
                            </div>
                        </div>

                        {/* Badge */}
                        <div className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest ${getStatusStyle(ticket.status)} border border-white/5 shadow-sm`}>
                            {ticket.status.replace("_", " ")}
                        </div>

                        {/* Arrow */}
                        <div className="hidden md:flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.03] opacity-0 group-hover:opacity-100 group-hover:scale-100 scale-75 transition-all duration-300 text-white ml-1">
                            <ArrowUpRightIcon className="h-4 w-4" />
                        </div>
                    </Link>
                ))}
            </div>

            {/* Footer */}
            {showViewAll && filteredTickets.length > 5 && (
                <div className="mt-8 pt-6 border-t border-white/[0.05] flex justify-center">
                    <button onClick={() => setActiveTab("tickets")} className="text-[13px] font-medium text-neutral-500 hover:text-white transition-colors flex items-center gap-2 px-6 py-2 rounded-full hover:bg-white/[0.05]">
                        View all tickets <ArrowUpRightIcon className="h-3 w-3" />
                    </button>
                </div>
            )}
        </div>
    </>
);
