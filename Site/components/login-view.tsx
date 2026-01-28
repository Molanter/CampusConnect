"use client";

import React, { useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, provider } from "@/lib/firebase";
import { requestNotificationPermissionAndRegister } from "@/lib/fcm";
import Image from "next/image";

export function LoginView() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGoogleSignIn = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await signInWithPopup(auth, provider);
            if (result.user) {
                // Register for notifications on successful login
                await requestNotificationPermissionAndRegister(result.user.uid);
            }
        } catch (err: any) {
            console.error("Sign-in error", err);
            setError(err.message || "An error occurred during sign-in.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black">
            {/* Background elements */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full" />
                <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full" />
                <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-amber-500/10 blur-[100px] rounded-full" />
            </div>

            <div className="relative w-full max-w-sm px-6">
                <div className="flex flex-col items-center text-center space-y-8 py-12 px-8 rounded-[32px] bg-white/5 backdrop-blur-2xl border border-white/10 shadow-2xl">
                    <div className="relative w-24 h-24 rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/20 p-0.5 bg-gradient-to-br from-white/20 to-transparent">
                        <div className="w-full h-full rounded-[22px] overflow-hidden bg-neutral-900 border border-white/10">
                            <Image
                                src="https://firebasestorage.googleapis.com/v0/b/campus-vibes-e34f0.firebasestorage.app/o/config%2Fapp%2Fmac1024.png?alt=media&token=fcdcb54c-3962-4ae9-a596-f567dcdc3a47"
                                alt="Campus Connect Logo"
                                width={100}
                                height={100}
                                className="object-cover"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold tracking-tight text-white font-outfit">
                            Campus Connect
                        </h1>
                        <p className="text-neutral-400 text-sm">
                            The heartbeat of your university.
                        </p>
                    </div>

                    <div className="w-full pt-4">
                        <button
                            onClick={handleGoogleSignIn}
                            disabled={loading}
                            className="group relative w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-white text-black font-semibold text-base transition-all active:scale-[0.98] hover:bg-neutral-100 disabled:opacity-50 disabled:active:scale-100"
                        >
                            {loading ? (
                                <div className="h-5 w-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                            ) : (
                                <>
                                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                                        <path
                                            fill="currentColor"
                                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                        />
                                        <path
                                            fill="#34A853"
                                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                        />
                                        <path
                                            fill="#FBBC05"
                                            d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
                                        />
                                        <path
                                            fill="#EA4335"
                                            d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                                        />
                                    </svg>
                                    Continue with Google
                                </>
                            )}
                        </button>
                    </div>

                    {error && (
                        <p className="text-red-400 text-xs text-center animate-shake">
                            {error}
                        </p>
                    )}

                    <div className="pt-4 text-center">
                        <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-medium">
                            By continuing you agree to our terms
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
