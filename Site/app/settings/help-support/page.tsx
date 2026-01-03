"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronDownIcon, ChevronUpIcon, ChevronLeftIcon, XMarkIcon, PaperClipIcon } from "@heroicons/react/24/outline";
import Toast, { ToastData } from "@/components/Toast";
import { serverTimestamp, collection, addDoc, doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, auth, storage } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";

// --- Types ---

type FAQItem = {
    question: string;
    answer: string;
};

type Priority = "Low" | "Medium" | "High";

const FAQS: FAQItem[] = [
    {
        question: "How do I change my campus?",
        answer: "You can change your campus in your Profile settings. Go to Profile > Edit Profile and select a new campus from the dropdown."
    },
    {
        question: "Is my data private?",
        answer: "Yes, we take privacy seriously. Your personal contact information is never shared with other users without your explicit consent."
    },
    {
        question: "How do I report a bug?",
        answer: "You can use the form below to report any bugs or technical issues. Please include as much detail as possible, including screenshots if available."
    },
    {
        question: "Can I create my own events?",
        answer: "Absolutely! Navigate to the 'My Events' tab in your profile or use the create button to start hosting your own events."
    },
];

const PRIORITIES: Priority[] = ["Low", "Medium", "High"];

// --- Components ---

function Accordion({ item }: { item: FAQItem }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="border-b border-white/5 last:border-0">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex w-full items-center justify-between px-4 py-4 text-left transition-colors hover:bg-white/5"
            >
                <span className="text-[15px] font-medium text-white">{item.question}</span>
                {isOpen ? (
                    <ChevronUpIcon className="h-4 w-4 text-neutral-500" />
                ) : (
                    <ChevronDownIcon className="h-4 w-4 text-neutral-500" />
                )}
            </button>
            <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
                    }`}
            >
                <div className="px-4 pb-4 text-sm text-neutral-400">
                    {item.answer}
                </div>
            </div>
        </div>
    );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            style={{
                backgroundColor: checked ? '#ffb200' : '#525252'
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-900`}
        >
            <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'
                    }`}
            />
        </button>
    );
}

// --- Main Page ---

export default function HelpSupportPage() {
    const [user, setUser] = useState<User | null>(null);

    // Monitor auth state
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (currentUser?.displayName) {
                // Optional: pre-fill name if available
                setName(currentUser.displayName);
            }
            if (currentUser?.email) {
                // Optional: pre-fill email if available
                setEmail(currentUser.email);
            }
        });
        return () => unsubscribe();
    }, []);

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [category, setCategory] = useState("General Inquiry");
    const [priority, setPriority] = useState<Priority>("Low");
    const [message, setMessage] = useState("");
    const [attachDeviceInfo, setAttachDeviceInfo] = useState(false);

    // File Upload State
    const [screenshots, setScreenshots] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [toast, setToast] = useState<ToastData | null>(null);
    const [sending, setSending] = useState(false);

    // Cleanup previews
    useEffect(() => {
        return () => {
            previewUrls.forEach(url => URL.revokeObjectURL(url));
        };
    }, [previewUrls]);

    // Simple validation
    const isValid = name.trim() !== "" && email.trim() !== "" && message.trim() !== "";

    const handleSendClick = () => {
        if (isValid) {
            setIsModalOpen(true);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            const combined = [...screenshots, ...newFiles];

            // Limit to 3 files
            if (combined.length > 3) {
                setScreenshots(combined.slice(0, 3));
                setToast({ type: "error", message: "Maximum 3 screenshots allowed." });

                // Update previews for the sliced files
                const sliced = combined.slice(0, 3);
                const newPreviews = sliced.map(f => URL.createObjectURL(f));
                setPreviewUrls(prev => {
                    // revoke old ones not in new set? Simpler to just revoke all old and set new.
                    prev.forEach(u => URL.revokeObjectURL(u));
                    return newPreviews;
                });

            } else {
                setScreenshots(combined);
                const newPreviews = newFiles.map(f => URL.createObjectURL(f));
                setPreviewUrls(prev => [...prev, ...newPreviews]);
            }
        }
        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const removeFile = (index: number) => {
        URL.revokeObjectURL(previewUrls[index]);
        setScreenshots(screenshots.filter((_, i) => i !== index));
        setPreviewUrls(previewUrls.filter((_, i) => i !== index));
    };

    const handleConfirmSend = async () => {
        setSending(true);

        try {
            // Create the ticket first to get the ID
            const ticketRef = await addDoc(collection(db, "supportTickets"), {
                uid: user?.uid || null,
                category,
                priority,
                message,
                status: "open",
                deviceInfo: attachDeviceInfo ? {
                    userAgent: navigator.userAgent,
                    platform: navigator.platform,
                    language: navigator.language,
                } : null,
                attachments: [], // Will be updated after upload
                createdAt: serverTimestamp(),
            });

            const ticketId = ticketRef.id;

            // Upload images to Firebase Storage if any
            const attachmentUrls: string[] = [];
            if (screenshots.length > 0) {
                for (let i = 0; i < screenshots.length; i++) {
                    const file = screenshots[i];
                    const fileExt = file.name.split('.').pop() || 'jpg';
                    const fileName = `${Date.now()}_${i}.${fileExt}`;
                    const storageRef = ref(storage, `supportTickets/${ticketId}/attachments/${fileName}`);

                    await uploadBytes(storageRef, file);
                    const downloadUrl = await getDownloadURL(storageRef);
                    attachmentUrls.push(downloadUrl);
                }

                // Update the ticket with attachment URLs
                await updateDoc(doc(db, "supportTickets", ticketId), {
                    attachments: attachmentUrls
                });
            }

            console.log("Saved support ticket:", ticketId, "with", attachmentUrls.length, "attachments");
            setToast({ type: "success", message: "Your support request has been sent." });
        } catch (error) {
            console.error("Error creating ticket:", error);
            setToast({ type: "error", message: "Failed to send request. Please try again." });
        } finally {
            setSending(false);
            setIsModalOpen(false);
        }

        // Reset form slightly after to improve UX
        setTimeout(() => {
            setName("");
            setEmail("");
            setMessage("");
            setScreenshots([]);
            setPreviewUrls([]);
            setPriority("Low");
            setCategory("General Inquiry");
        }, 500);
    };

    return (
        <div className="mx-auto min-h-screen w-full max-w-3xl px-4 py-8 md:py-4 pb-32">
            {/* Toast */}
            <Toast toast={toast} onClear={() => setToast(null)} />

            {/* Header */}
            <div className="mb-8">
                <Link
                    href="/settings"
                    className="mb-6 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                >
                    <ChevronLeftIcon className="h-5 w-5" />
                </Link>
                <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Help & Support</h1>
                <p className="text-neutral-400">Tell us what's going on and we'll help.</p>
            </div>

            {/* FAQ Section */}
            <section className="mb-10 space-y-3">
                <h2 className="px-2 text-[13px] font-semibold uppercase tracking-wider text-neutral-500">
                    Frequently Asked Questions
                </h2>
                <div className="overflow-hidden rounded-[28px] bg-[#1C1C1E]">
                    {FAQS.map((faq, idx) => (
                        <Accordion key={idx} item={faq} />
                    ))}
                </div>
            </section>

            {/* Support Form Section */}
            <section className="space-y-6">
                <h2 className="px-2 text-[13px] font-semibold uppercase tracking-wider text-neutral-500">
                    Contact Support
                </h2>

                <div className="rounded-[28px] border border-white/10 bg-[#1C1C1E] overflow-hidden">
                    {/* Name */}
                    <div className="px-5 py-4 border-b border-white/10">
                        <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2 block">Name <span className="text-red-400">*</span></label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your name"
                            className="w-full bg-transparent text-white placeholder-neutral-600 focus:outline-none"
                        />
                    </div>

                    {/* Email */}
                    <div className="px-5 py-4 border-b border-white/10">
                        <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2 block">Email <span className="text-red-400">*</span></label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            className="w-full bg-transparent text-white placeholder-neutral-600 focus:outline-none"
                        />
                    </div>

                    {/* Category */}
                    <div className="px-5 py-4 border-b border-white/10">
                        <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2 block">Topic / Category</label>
                        <div className="relative">
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full bg-transparent text-white focus:outline-none appearance-none pr-8"
                            >
                                <option value="General Inquiry" className="bg-[#1C1C1E]">General Inquiry</option>
                                <option value="Bug Report" className="bg-[#1C1C1E]">Bug Report</option>
                                <option value="Account Issue" className="bg-[#1C1C1E]">Account Issue</option>
                                <option value="Feature Request" className="bg-[#1C1C1E]">Feature Request</option>
                                <option value="Other" className="bg-[#1C1C1E]">Other</option>
                            </select>
                            <div className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-neutral-500">
                                <ChevronDownIcon className="h-4 w-4" />
                            </div>
                        </div>
                    </div>

                    {/* Priority */}
                    <div className="px-5 py-4 border-b border-white/10">
                        <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-3 block">Priority</label>
                        <div className="relative flex w-full items-center justify-center rounded-full border border-white/10 bg-[#111] p-1">
                            {PRIORITIES.map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setPriority(p)}
                                    className={`relative z-10 flex-1 rounded-full py-1.5 text-sm font-medium transition-colors ${priority === p ? "text-black" : "text-neutral-400 hover:text-neutral-200"
                                        }`}
                                >
                                    {p}
                                </button>
                            ))}
                            {/* Sliding indicator */}
                            <div
                                className="absolute left-1 top-1 bottom-1 w-[calc((100%-8px)/3)] rounded-full bg-[#ffb200] transition-all duration-300 ease-out"
                                style={{
                                    transform: `translateX(${PRIORITIES.indexOf(priority) * 100}%)`,
                                }}
                            />
                        </div>
                    </div>

                    {/* Message */}
                    <div className="px-5 py-4">
                        <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2 block">Message <span className="text-red-400">*</span></label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={5}
                            placeholder="How can we help you?"
                            className="w-full bg-transparent text-white placeholder-neutral-600 focus:outline-none resize-none"
                        />
                    </div>
                </div>

                {/* Additional Options */}
                <div className="rounded-[28px] border border-white/10 bg-[#1C1C1E] overflow-hidden">
                    {/* Toggle */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 main-toggle">
                        <div className="flex-1 pr-4">
                            <p className="text-[15px] font-medium text-white">Attach anonymous device info</p>
                            <p className="text-xs text-neutral-500 mt-1">Includes app version and OS only. No personal files or passwords.</p>
                        </div>
                        <Toggle checked={attachDeviceInfo} onChange={setAttachDeviceInfo} />
                    </div>

                    {/* Attachments */}
                    <div className="px-5 py-4">
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider block">Attach screenshots</label>
                            <span className="text-[10px] text-neutral-500">Max 3 images</span>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-3">
                            {screenshots.map((file, idx) => (
                                <div key={idx} className="relative group overflow-hidden rounded-lg border border-white/10">
                                    <img
                                        src={previewUrls[idx]}
                                        alt="Preview"
                                        className="h-16 w-16 object-cover"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeFile(idx)}
                                        className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                                    >
                                        <XMarkIcon className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <input
                            type="file"
                            ref={fileInputRef}
                            accept="image/png, image/jpeg"
                            multiple
                            onChange={handleFileChange}
                            className="hidden"
                        />

                        {screenshots.length < 3 && (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-xs font-medium text-neutral-200 hover:bg-white/10 transition-colors"
                            >
                                <PaperClipIcon className="h-4 w-4" />
                                Attach files
                            </button>
                        )}
                        <p className="text-[11px] text-neutral-500 mt-2">Optional. Do not attach sensitive information.</p>
                    </div>
                </div>

                {/* Submit Button */}
                <button
                    type="button"
                    onClick={handleSendClick}
                    disabled={!isValid}
                    className="w-full rounded-full py-4 font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ backgroundColor: '#ffb200' }}
                >
                    Send to Support
                </button>
            </section>

            {/* Modal */}
            {isModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center p-4 transition-all"
                    onClick={() => !sending && setIsModalOpen(false)}
                >
                    <div
                        className="w-full max-w-lg overflow-hidden rounded-3xl bg-[#1C1C1E] border border-white/10 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6">
                            <h2 className="text-xl font-bold text-white mb-2">Confirm Data to Save</h2>
                            <p className="text-sm text-neutral-400 mb-6">Here is the information that will be stored in Firestore.</p>

                            <div className="space-y-4 mb-6">
                                <div className="flex justify-between border-b border-white/5 pb-2">
                                    <span className="text-neutral-400 text-sm">Name</span>
                                    <span className="text-white text-sm font-medium">{name}</span>
                                </div>
                                <div className="flex justify-between border-b border-white/5 pb-2">
                                    <span className="text-neutral-400 text-sm">Email</span>
                                    <span className="text-white text-sm font-medium">{email}</span>
                                </div>
                                <div className="flex justify-between border-b border-white/5 pb-2">
                                    <span className="text-neutral-400 text-sm">Topic</span>
                                    <span className="text-white text-sm font-medium">{category}</span>
                                </div>
                                <div className="flex justify-between border-b border-white/5 pb-2">
                                    <span className="text-neutral-400 text-sm">Priority</span>
                                    <span className="text-white text-sm font-medium">{priority}</span>
                                </div>
                                <div className="border-b border-white/5 pb-2">
                                    <span className="text-neutral-400 text-sm block mb-1">Message</span>
                                    <span className="text-white text-sm block line-clamp-3">{message}</span>
                                </div>
                                <div className="flex justify-between border-b border-white/5 pb-2">
                                    <span className="text-neutral-400 text-sm">Device Info</span>
                                    <span className="text-white text-sm font-medium">
                                        {attachDeviceInfo ? "Yes (v1.0.0, iOS/Web)" : "No"}
                                    </span>
                                </div>
                                {screenshots.length > 0 && (
                                    <div className="border-b border-white/5 pb-2">
                                        <span className="text-neutral-400 text-sm block mb-1">Screenshot attachments (file names only)</span>
                                        {screenshots.map((f, i) => (
                                            <span key={i} className="text-blue-400 text-sm block truncate">{f.name}</span>
                                        ))}
                                    </div>
                                )}
                                <p className="text-xs text-neutral-500 italic mt-4">We never store passwords or payment information here.</p>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    disabled={sending}
                                    className="flex-1 rounded-full border border-white/10 py-3 font-semibold text-white hover:bg-white/5 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmSend}
                                    disabled={sending}
                                    className="flex-1 rounded-full bg-[#ffb200] py-3 font-semibold text-black hover:opacity-90 disabled:opacity-50"
                                >
                                    {sending ? "Confirm & Send" : "Confirm & Send"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
