"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface ClubProfile {
    id: string;
    name: string;
    avatarUrl?: string | null;
    handle?: string | null;
}

interface ClubProfilesContextType {
    clubProfiles: Record<string, ClubProfile>;
    fetchClubProfile: (clubId: string) => Promise<void>;
}

const ClubProfilesContext = createContext<ClubProfilesContextType | undefined>(undefined);

export function ClubProfilesProvider({ children }: { children: ReactNode }) {
    const [clubProfiles, setClubProfiles] = useState<Record<string, ClubProfile>>({});
    const inflightRequests = useRef<Record<string, Promise<void> | undefined>>({});
    const loadedClubIds = useRef<Set<string>>(new Set());

    const fetchClubProfile = useCallback(async (clubId: string) => {
        if (!clubId || loadedClubIds.current.has(clubId) || inflightRequests.current[clubId]) return;

        const request = (async () => {
            try {
                console.log(`[ClubProfilesProvider] Fetching club ${clubId}...`);
                const clubDoc = await getDoc(doc(db, "clubs", clubId));
                console.log(`[ClubProfilesProvider] Club ${clubId} exists: ${clubDoc.exists()}`);
                if (clubDoc.exists()) {
                    const data = clubDoc.data();
                    console.log(`[ClubProfilesProvider] Club ${clubId} data:`, data);
                    const profile: ClubProfile = {
                        id: clubId,
                        name: data.name || "Club",
                        avatarUrl: data.logoUrl || data.avatarUrl || data.photoURL || null,
                        handle: data.handle || null,
                    };
                    setClubProfiles((prev) => ({ ...prev, [clubId]: profile }));
                    loadedClubIds.current.add(clubId);
                } else {
                    const fallback: ClubProfile = {
                        id: clubId,
                        name: "Club",
                        avatarUrl: null,
                        handle: null,
                    };
                    setClubProfiles((prev) => ({ ...prev, [clubId]: fallback }));
                    loadedClubIds.current.add(clubId);
                }
            } catch (error) {
                console.error(`Error fetching club profile for ${clubId}:`, error);
            } finally {
                delete inflightRequests.current[clubId];
            }
        })();

        inflightRequests.current[clubId] = request;
        return request;
    }, []);

    return (
        <ClubProfilesContext.Provider value={{ clubProfiles, fetchClubProfile }}>
            {children}
        </ClubProfilesContext.Provider>
    );
}

export function useClubProfiles() {
    const context = useContext(ClubProfilesContext);
    if (context === undefined) {
        throw new Error("useClubProfiles must be used within a ClubProfilesProvider");
    }
    return context;
}

/**
 * Hook to get a single club's profile with automatic fetching and caching.
 */
export function useClubProfile(clubId?: string) {
    const { clubProfiles, fetchClubProfile } = useClubProfiles();
    const profile = clubId ? clubProfiles[clubId] : null;

    useEffect(() => {
        if (clubId && !clubProfiles[clubId]) {
            fetchClubProfile(clubId);
        }
    }, [clubId, fetchClubProfile, clubProfiles]);

    return profile;
}
