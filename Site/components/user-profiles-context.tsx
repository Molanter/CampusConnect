"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface UserProfile {
    uid: string;
    displayName: string;
    username?: string | null;
    photoURL?: string | null;
}

interface UserProfilesContextType {
    profiles: Record<string, UserProfile>;
    fetchProfile: (uid: string) => Promise<void>;
}

const UserProfilesContext = createContext<UserProfilesContextType | undefined>(undefined);

export function UserProfilesProvider({ children }: { children: ReactNode }) {
    const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
    const inflightRequests = useRef<Record<string, Promise<void> | undefined>>({});
    const loadedUids = useRef<Set<string>>(new Set());

    const fetchProfile = useCallback(async (uid: string) => {
        if (!uid || loadedUids.current.has(uid) || inflightRequests.current[uid]) return;

        const request = (async () => {
            try {
                const userDoc = await getDoc(doc(db, "users", uid));
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    const profile: UserProfile = {
                        uid,
                        displayName: data.displayName || data.name || data.preferredName || "User",
                        username: data.username || null,
                        photoURL: data.photoURL || null,
                    };
                    setProfiles((prev) => ({ ...prev, [uid]: profile }));
                    loadedUids.current.add(uid);
                } else {
                    const fallback: UserProfile = {
                        uid,
                        displayName: "User",
                        username: null,
                        photoURL: null,
                    };
                    setProfiles((prev) => ({ ...prev, [uid]: fallback }));
                    loadedUids.current.add(uid);
                }
            } catch (error) {
                console.error(`Error fetching profile for ${uid}:`, error);
            } finally {
                delete inflightRequests.current[uid];
            }
        })();

        inflightRequests.current[uid] = request;
        return request;
    }, []);

    return (
        <UserProfilesContext.Provider value={{ profiles, fetchProfile }}>
            {children}
        </UserProfilesContext.Provider>
    );
}

export function useUserProfiles() {
    const context = useContext(UserProfilesContext);
    if (context === undefined) {
        throw new Error("useUserProfiles must be used within a UserProfilesProvider");
    }
    return context;
}

/**
 * Hook to get a single user's profile with automatic fetching and caching.
 */
export function useUserProfile(uid?: string) {
    const { profiles, fetchProfile } = useUserProfiles();
    const profile = uid ? profiles[uid] : null;

    useEffect(() => {
        if (uid && !profiles[uid]) {
            fetchProfile(uid);
        }
    }, [uid, fetchProfile, profiles]);

    return profile;
}
