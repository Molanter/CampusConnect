"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, getFirestore } from "firebase/firestore";
// import { db } from "../lib/firebase"; // db from lib/firebase might be lite.
// Let's check lib/firebase.ts to see what 'db' is.
// Actually, profile/page.tsx uses getFirestore().
// Let's use getFirestore() to be safe and consistent with profile page real-time logic.


type UserRowProps = {
    uid?: string;
    userData?: {
        displayName?: string;
        username?: string;
        photoURL?: string;
    };
    subtitle?: string;
    onlyAvatar?: boolean;
    rightElement?: React.ReactNode;
};

export function UserRow({ uid, userData, subtitle, onlyAvatar = false, rightElement }: UserRowProps) {
    const [profile, setProfile] = useState<{
        displayName?: string;
        username?: string;
        photoURL?: string;
    } | null>(userData || null);
    const [loading, setLoading] = useState(!userData && !!uid);

    useEffect(() => {
        if (userData) {
            setProfile(userData);
            setLoading(false);
            return;
        }

        if (!uid) return;

        const db = getFirestore();
        const unsubscribe = onSnapshot(doc(db, "users", uid), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                // Map different possible field names
                setProfile({
                    displayName: data.name || data.fullName || data.preferredName || data.displayName,
                    username: data.username,
                    photoURL: data.photoURL || data.profilePicture || data.avatarUrl
                });
            }
            setLoading(false);
        }, (err: any) => {
            console.error("Error fetching user row", err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [uid, userData]);

    if (loading) {
        return (
            <div className="flex w-full items-center justify-between py-1">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 animate-pulse rounded-full bg-white/10" />
                    {!onlyAvatar && (
                        <div className="flex flex-col gap-1">
                            <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
                            <div className="h-2 w-16 animate-pulse rounded bg-white/10" />
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const displayName = profile?.displayName || "Unknown User";
    const username = profile?.username;
    const photoURL = profile?.photoURL;
    const initials = displayName.charAt(0).toUpperCase();

    return (
        <div className="flex w-full items-center justify-between py-1">
            <div className="flex items-center gap-3">
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-neutral-700 ring-1 ring-white/10">
                    {photoURL ? (
                        <img src={photoURL} alt={displayName} className="h-full w-full object-cover" />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-xs font-bold text-white">
                            {initials}
                        </div>
                    )}
                </div>
                {!onlyAvatar && (
                    <div className="flex flex-col leading-tight">
                        <span className="text-sm font-semibold text-white">{displayName}</span>
                        <span className="text-xs text-neutral-400">
                            {subtitle || (username ? `@${username}` : "")}
                        </span>
                    </div>
                )}
            </div>
            {rightElement}
        </div>
    );
}
