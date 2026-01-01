"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { CheckBadgeIcon } from "@heroicons/react/24/solid";


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
    isVerified?: boolean;
    type?: "User" | "Club" | "Event" | "Post" | "Dorm";
};
import { HomeIcon } from "@heroicons/react/24/solid";

export function UserRow({ uid, userData, subtitle, onlyAvatar = false, rightElement, isVerified = false, type }: UserRowProps) {
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
                    <div className="h-8 w-8 animate-pulse rounded-full bg-secondary/10" />
                    {!onlyAvatar && (
                        <div className="flex flex-col gap-1">
                            <div className="h-3 w-24 animate-pulse rounded bg-secondary/10" />
                            <div className="h-2 w-16 animate-pulse rounded bg-secondary/10" />
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

    // Allow overriding the default size (h-8 w-8)
    const avatarClass = onlyAvatar ? "h-full w-full" : "h-8 w-8";

    return (
        <div className={`flex w-full items-center ${onlyAvatar ? 'justify-center h-full' : 'justify-between py-1'}`}>
            <div className={`flex items-center ${onlyAvatar ? 'justify-center w-full h-full' : 'gap-3'}`}>
                <div className={`${avatarClass} shrink-0 overflow-hidden rounded-full cc-avatar ring-1 ring-secondary/20 bg-secondary/10 flex items-center justify-center`}>
                    {photoURL ? (
                        <img src={photoURL} alt={displayName} className="!h-full !w-full object-cover object-center" />
                    ) : type === "Dorm" || subtitle === "Dorm" ? (
                        <div className="flex h-full w-full items-center justify-center bg-secondary/10 text-secondary">
                            <HomeIcon className="h-1/2 w-1/2" />
                        </div>
                    ) : (
                        <div className="flex h-full w-full items-center justify-center bg-brand text-xs font-bold text-brand-foreground">
                            {initials}
                        </div>
                    )}
                </div>
                {!onlyAvatar && (
                    <div className="flex flex-col leading-tight">
                        <span className="text-sm font-semibold text-foreground flex items-center gap-1">
                            {displayName}
                            {isVerified && <CheckBadgeIcon className="h-3.5 w-3.5 text-brand" />}
                        </span>
                        {type === "User" || !type ? (
                            username && (
                                <span className="text-[11px] cc-muted font-medium">
                                    @{username}
                                </span>
                            )
                        ) : null}
                        {subtitle && subtitle !== `@${username}` && (
                            <span className="text-[11px] leading-none text-secondary mt-0.5">
                                {subtitle}
                            </span>
                        )}
                    </div>
                )}
            </div>
            {rightElement}
        </div>
    );
}
