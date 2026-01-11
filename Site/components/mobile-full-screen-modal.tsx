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
                    className="fixed inset-0 z-50 cc-glass-strong backdrop-blur-3xl flex flex-col"
                >
                    {/* Close Button at Top */}
                    <div className="absolute top-4 right-4 z-50">
                        <button
                            onClick={onClose}
                            className="flex h-10 w-10 items-center justify-center rounded-full cc-glass-strong border border-secondary/20 text-foreground hover:bg-secondary/10 transition-all active:scale-95 shadow-lg"
                        >
                            <XMarkIcon className="h-5 w-5" strokeWidth={2.5} />
                        </button>
                    </div>

                    {/* Title Bar - Positioned Lower */}
                    {title && (
                        <div className="pt-16 pb-4 px-5 shrink-0">
                            <div className="flex items-center rounded-full cc-glass-strong px-5 py-3 border cc-header-item-stroke w-fit">
                                <h2 className="text-sm font-bold text-foreground">{title}</h2>
                            </div>
                        </div>
                    )}

                    {/* Content - Scrollable */}
                    <div className={`flex-1 overflow-y-auto ${title ? '' : 'pt-16'}`}>
                        {children}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
