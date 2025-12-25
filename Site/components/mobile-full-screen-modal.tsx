"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface MobileFullScreenModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    title?: string;
}

export function MobileFullScreenModal({ isOpen, onClose, children, title }: MobileFullScreenModalProps) {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0, y: "100%" }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: "100%" }}
                    transition={{ type: "spring", damping: 30, stiffness: 300 }}
                    className="fixed inset-0 z-50 bg-[#121212] flex flex-col"
                >
                    {/* Header */}
                    {title && (
                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 shrink-0">
                            <h2 className="text-lg font-semibold text-white">{title}</h2>
                            <button
                                onClick={onClose}
                                className="rounded-full p-2 text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
                            >
                                <XMarkIcon className="h-6 w-6" />
                            </button>
                        </div>
                    )}

                    {/* Content - Scrollable */}
                    <div className="flex-1 overflow-y-auto">
                        {children}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
