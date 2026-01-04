"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
    ChevronLeftIcon,
    ChevronDownIcon,
    PlusIcon,
    XMarkIcon,
    InformationCircleIcon,
    DevicePhoneMobileIcon,
    PaperClipIcon
} from "@heroicons/react/24/outline";
import { auth, db, storage } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import Toast, { ToastData } from "@/components/Toast";

// Simple accordion item component
function FAQItem({ question, answer }: { question: string; answer: string }) {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="border-b border-border-subtle last:border-0">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-secondary/5 transition-colors"
            >
                <span className="text-foreground font-semibold text-[15px]">{question}</span>
                <ChevronDownIcon
                    className={`h-4 w-4 text-secondary transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                />
            </button>
            {isOpen && (
                <div className="px-6 pb-5 pt-1">
                    <p className="text-secondary text-[14px] leading-relaxed pl-4 border-l-2 border-brand/30">{answer}</p>
                </div>
            )}
        </div>
    );
}

export default function HelpSupportPage() {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<ToastData | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        category: "general",
        priority: "medium",
        message: "",
    });
    const [includeDeviceInfo, setIncludeDeviceInfo] = useState(true);
    const [attachments, setAttachments] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

    // Ensure and maintain scroll at top
    useEffect(() => {
        window.scrollTo(0, 0);
        const t1 = setTimeout(() => window.scrollTo(0, 0), 50);
        const t2 = setTimeout(() => window.scrollTo(0, 0), 150);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, [pathname]);

    // Auth Effects
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
            if (u) {
                setFormData(prev => ({
                    ...prev,
                    name: prev.name || u.displayName || "",
                    email: prev.email || u.email || "",
                }));
            }
        });
        return () => unsub();
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (attachments.length + files.length > 3) {
            setToast({ type: "error", message: "Max 3 screenshots allowed" });
            return;
        }

        const newAttachments = [...attachments, ...files];
        setAttachments(newAttachments);

        const newPreviews = files.map(file => URL.createObjectURL(file));
        setPreviews(prev => [...prev, ...newPreviews]);
        e.target.value = ""; // Reset input
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
        URL.revokeObjectURL(previews[index]);
        setPreviews(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!formData.name || !formData.email || !formData.message) {
            setToast({ type: "error", message: "Please fill in all required fields" });
            return;
        }

        setLoading(true);
        setIsConfirmModalOpen(false);

        try {
            // 1. Upload Attachments
            const attachmentUrls = [];
            for (const file of attachments) {
                const fileRef = ref(storage, `support/${Date.now()}_${file.name}`);
                const snapshot = await uploadBytes(fileRef, file);
                const url = await getDownloadURL(snapshot.ref);
                attachmentUrls.push(url);
            }

            // 2. Prepare Device Info
            const deviceInfo = includeDeviceInfo ? {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                screen: `${window.screen.width}x${window.screen.height}`,
                language: navigator.language,
            } : null;

            // 3. Save to Firestore
            await addDoc(collection(db, "supportTickets"), {
                uid: user?.uid || "anonymous",
                name: formData.name,
                email: formData.email,
                category: formData.category,
                priority: formData.priority,
                message: formData.message,
                attachments: attachmentUrls,
                deviceInfo: deviceInfo,
                status: "open",
                createdAt: serverTimestamp(),
                lastMessageAt: serverTimestamp(),
            });

            setToast({ type: "success", message: "Ticket submitted successfully!" });
            setTimeout(() => router.push("/settings"), 2000);
        } catch (error: any) {
            console.error("Support submission error:", error);
            setToast({ type: "error", message: error.message || "Failed to submit ticket" });
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background pb-20">
            <Toast toast={toast} onClear={() => setToast(null)} />

            {/* Floating Header - Guidelines Style */}
            <header className="fixed top-0 left-0 right-0 z-40 pt-4 pointer-events-none">
                <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 pointer-events-auto">
                    <Link
                        href="/settings"
                        className="flex h-10 w-10 items-center justify-center rounded-full cc-header-btn active:scale-95"
                    >
                        <ChevronLeftIcon className="h-5 w-5 text-foreground" />
                    </Link>
                    <div className="flex items-center rounded-full cc-glass-strong px-6 py-2.5 shadow-sm">
                        <h1 className="text-sm font-bold text-foreground">Help & Support</h1>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="mx-auto max-w-2xl px-4 pt-24 pb-8">
                <div className="space-y-8">

                    {/* FAQs Section */}
                    <section className="space-y-4">
                        <h2 className="px-4 text-[13px] font-bold uppercase tracking-wider text-secondary">Frequently Asked Questions</h2>
                        <div className="cc-section overflow-hidden rounded-3xl">
                            <FAQItem
                                question="How do I change my campus?"
                                answer="You can change your campus by going to your Profile settings. Note that some changes might require re-verification or closure of existing club leadership roles."
                            />
                            <FAQItem
                                question="Is my data secure?"
                                answer="Yes, all your data is encrypted and handled according to our privacy policy. We never share your personal information with third parties without your explicit consent."
                            />
                            <FAQItem
                                question="How can I report a problem?"
                                answer="Use the form below to submit a ticket. Our support team usually responds within 24-48 hours during business days."
                            />
                        </div>
                    </section>

                    {/* Support Form Section */}
                    <section className="space-y-4">
                        <h2 className="px-4 text-[13px] font-bold uppercase tracking-wider text-secondary">Submit a Ticket</h2>
                        <div className="cc-section overflow-hidden rounded-3xl">
                            {/* Identity Group */}
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-secondary/15">
                                <div className="space-y-1.5">
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Your name"
                                        className="w-full bg-secondary/5 rounded-full px-5 py-3.5 text-foreground placeholder:text-secondary/50 focus:outline-none focus:ring-2 focus:ring-brand/30 transition-all font-medium"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[12px] font-bold uppercase tracking-wider text-secondary px-4">
                                        Email Address <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="name@example.com"
                                        className="w-full bg-secondary/5 rounded-full px-5 py-3.5 text-foreground placeholder:text-secondary/50 focus:outline-none focus:ring-2 focus:ring-brand/30 transition-all font-medium"
                                    />
                                </div>
                            </div>

                            {/* Category & Priority */}
                            <div className="p-6 space-y-6 border-b border-secondary/15">
                                <div className="space-y-1.5">
                                    <label className="text-[12px] font-bold uppercase tracking-wider text-secondary px-4">Inquiry Category</label>
                                    <div className="relative">
                                        <select
                                            value={formData.category}
                                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                            className="w-full appearance-none bg-secondary/5 rounded-full px-5 py-3.5 text-foreground focus:outline-none focus:ring-2 focus:ring-brand/30 transition-all pr-12 cursor-pointer font-medium"
                                        >
                                            <option value="general">General Inquiry</option>
                                            <option value="bug">Bug Report</option>
                                            <option value="feature">Feature Request</option>
                                            <option value="account">Account Issue</option>
                                            <option value="safety">Safety or Harassment</option>
                                        </select>
                                        <ChevronDownIcon className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary pointer-events-none" />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[12px] font-bold uppercase tracking-wider text-secondary px-4">Priority Level</label>
                                    <div className="bg-secondary/5 p-1 rounded-full flex items-center">
                                        {['low', 'medium', 'high', 'critical'].map((p) => (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, priority: p })}
                                                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-full transition-all ${formData.priority === p
                                                    ? "bg-brand text-brand-foreground shadow-sm"
                                                    : "text-secondary hover:text-foreground"
                                                    }`}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Message */}
                            <div className="p-6 space-y-4 pb-4">
                                <div className="space-y-1.5">
                                    <label className="text-[12px] font-bold uppercase tracking-wider text-secondary px-1">
                                        Message Details <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        value={formData.message}
                                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                        placeholder="Describe your issue or feedback in detail..."
                                        rows={6}
                                        className="w-full bg-secondary/5 rounded-2xl px-4 py-3.5 text-foreground placeholder:text-secondary/50 focus:outline-none focus:ring-2 focus:ring-brand/30 transition-all resize-none"
                                    />
                                </div>

                                {/* Toggle */}
                                <div className="flex items-center justify-between py-2 px-1">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 rounded-2xl bg-secondary/10">
                                            <DevicePhoneMobileIcon className="h-5 w-5 text-secondary" />
                                        </div>
                                        <div>
                                            <h4 className="text-[14px] font-bold text-foreground">Attach Device Info</h4>
                                            <p className="text-[11px] text-secondary">Helps us debug platform-specific issues</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIncludeDeviceInfo(!includeDeviceInfo)}
                                        className={`relative h-6 w-11 rounded-full transition-colors duration-200 outline-none focus:ring-2 focus:ring-brand/30 ${includeDeviceInfo ? "bg-brand" : "bg-secondary/20"
                                            }`}
                                    >
                                        <div className={`absolute top-1 left-1 h-4 w-4 bg-white rounded-full transition-transform duration-200 ${includeDeviceInfo ? "translate-x-5" : "translate-x-0"}`} />
                                    </button>
                                </div>

                                {/* Attachments */}
                                <div className="space-y-4">
                                    <div className="flex flex-wrap gap-3 mt-2">
                                        {previews.map((url, i) => (
                                            <div key={i} className="relative group w-20 h-20 rounded-2xl overflow-hidden border border-secondary/15 shadow-sm">
                                                <img src={url} alt="" className="w-full h-full object-cover" />
                                                <button
                                                    onClick={() => removeAttachment(i)}
                                                    className="absolute inset-0 bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                                                >
                                                    <XMarkIcon className="h-6 w-6" />
                                                </button>
                                            </div>
                                        ))}
                                        {attachments.length < 3 && (
                                            <label className="w-20 h-20 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-secondary/20 text-secondary hover:border-brand hover:text-brand cursor-pointer transition-all bg-secondary/5 active:scale-95">
                                                <PlusIcon className="h-6 w-6" />
                                                <span className="text-[10px] font-black mt-1">ADD</span>
                                                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                                            </label>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-secondary flex items-center gap-1.5 px-1 font-medium">
                                        <InformationCircleIcon className="h-4 w-4" />
                                        Max 3 screenshots (optional)
                                    </p>
                                </div>
                            </div>

                            {/* Action Button */}
                            <div className="p-5 bg-secondary/5 text-center">
                                <button
                                    onClick={() => setIsConfirmModalOpen(true)}
                                    disabled={!formData.message || loading}
                                    className="w-full bg-brand text-brand-foreground py-3.5 rounded-full font-bold text-[17px] shadow-lg shadow-brand/20 hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 transition-all"
                                >
                                    {loading ? "Sending..." : "Submit Support Ticket"}
                                </button>
                            </div>
                        </div>
                    </section>
                </div>
            </main>

            {/* Confirmation Modal */}
            {isConfirmModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-md animate-in fade-in duration-300"
                        onClick={() => setIsConfirmModalOpen(false)}
                    />
                    <div className="relative w-full max-w-sm bg-background border border-secondary/15 rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-8">
                            <h3 className="text-xl font-black text-foreground mb-2">Send Ticket?</h3>
                            <p className="text-secondary text-sm mb-6 leading-relaxed">
                                We'll create a support ticket with the following information:
                            </p>

                            <div className="space-y-4 mb-8 bg-secondary/5 rounded-2xl p-5">
                                <div className="flex items-center gap-3 text-sm">
                                    <div className="h-2 w-2 rounded-full bg-brand" />
                                    <span className="text-secondary font-medium">Category:</span>
                                    <span className="text-foreground font-bold capitalize">{formData.category}</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                    <div className="h-2 w-2 rounded-full bg-brand" />
                                    <span className="text-secondary font-medium">Priority:</span>
                                    <span className="text-foreground font-bold capitalize">{formData.priority}</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                    <div className="h-2 w-2 rounded-full bg-brand" />
                                    <span className="text-secondary font-medium">Attachments:</span>
                                    <span className={`font-bold ${attachments.length > 0 ? "text-brand" : "text-foreground"}`}>
                                        {attachments.length} file(s)
                                    </span>
                                </div>
                                {includeDeviceInfo && (
                                    <div className="flex items-center gap-3 text-sm">
                                        <div className="h-2 w-2 rounded-full bg-brand" />
                                        <span className="text-secondary font-medium">Device Info:</span>
                                        <span className="text-foreground font-bold italic">Included</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsConfirmModalOpen(false)}
                                    className="flex-1 bg-secondary/10 hover:bg-secondary/20 text-foreground font-bold py-4 rounded-full transition-all text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    className="flex-1 bg-brand hover:scale-105 active:scale-95 text-brand-foreground font-bold py-4 rounded-full shadow-lg shadow-brand/20 transition-all text-sm"
                                >
                                    Send
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
