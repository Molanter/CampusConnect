'use client';

import { useState } from 'react';
import Toast, { ToastData } from '@/components/Toast';

export default function TestPage() {
    const [toast, setToast] = useState<ToastData | null>(null);

    const showSuccess = () => {
        setToast({ type: 'success', message: 'Campus changes saved successfully!' });
    };

    const showError = () => {
        setToast({ type: 'error', message: 'Something went wrong while saving.' });
    };

    const clearToast = () => setToast(null);

    return (
        <div className="relative flex h-screen w-full flex-col items-center justify-center gap-6 bg-background overflow-hidden">
            {/* Background Decorations to see blur - added pointer-events-none */}
            <div className="pointer-events-none absolute top-1/4 left-1/4 h-64 w-64 rounded-full bg-brand/20 blur-[80px] animate-pulse" />
            <div className="pointer-events-none absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-green-500/20 blur-[100px] animate-pulse delay-700" />
            <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-48 w-48 rounded-full bg-red-500/10 blur-[60px]" />

            <Toast toast={toast} onClear={clearToast} />

            <div className="relative z-10 flex flex-col items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">Toast Test Bench</h1>
                <p className="text-secondary text-sm">Click the buttons below to trigger different toast states.</p>
            </div>

            <div className="relative z-10 flex gap-4">
                <button
                    onClick={showSuccess}
                    className="rounded-full bg-green-500 px-6 py-2.5 text-sm font-bold text-white transition-all hover:scale-105 active:scale-95 shadow-lg shadow-green-500/20"
                >
                    Trigger Success
                </button>
                <button
                    onClick={showError}
                    className="rounded-full bg-red-500 px-6 py-2.5 text-sm font-bold text-white transition-all hover:scale-105 active:scale-95 shadow-lg shadow-red-500/20"
                >
                    Trigger Error
                </button>
            </div>

            <div className="relative z-10 mt-8 rounded-2xl border border-secondary/15 bg-secondary/5 p-6 max-w-md w-full">
                <h2 className="text-sm font-bold uppercase tracking-widest text-secondary mb-3">Debug Info</h2>
                <pre className="text-xs font-mono text-secondary/70 bg-black/5 p-3 rounded-lg">
                    {JSON.stringify(toast, null, 2) || '// No active toast'}
                </pre>
            </div>
        </div>
    );
}
