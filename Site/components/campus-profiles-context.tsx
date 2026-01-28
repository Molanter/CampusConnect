"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface CampusProfile {
    id: string;
    name: string;
    logoUrl?: string | null;
    shortName?: string | null;
}

interface CampusProfilesContextType {
    campusProfiles: Record<string, CampusProfile>;
    fetchCampusProfile: (campusId: string) => Promise<void>;
}

const CampusProfilesContext = createContext<CampusProfilesContextType | undefined>(undefined);

export function CampusProfilesProvider({ children }: { children: ReactNode }) {
    const [campusProfiles, setCampusProfiles] = useState<Record<string, CampusProfile>>({});
    const inflightRequests = useRef<Record<string, Promise<void> | undefined>>({});
    const loadedCampusIds = useRef<Set<string>>(new Set());

    const fetchCampusProfile = useCallback(async (campusId: string) => {
        if (!campusId || loadedCampusIds.current.has(campusId) || inflightRequests.current[campusId]) return;

        const request = (async () => {
            try {
                console.log(`[CampusProfilesProvider] Fetching campus ${campusId}...`);
                const campusDoc = await getDoc(doc(db, "campuses", campusId));
                console.log(`[CampusProfilesProvider] Campus ${campusId} exists: ${campusDoc.exists()}`);
                if (campusDoc.exists()) {
                    const data = campusDoc.data();
                    console.log(`[CampusProfilesProvider] Campus ${campusId} data:`, data);
                    const profile: CampusProfile = {
                        id: campusId,
                        name: data.name || "Campus",
                        logoUrl: data.logoUrl || null,
                        shortName: data.shortName || null,
                    };
                    setCampusProfiles((prev) => ({ ...prev, [campusId]: profile }));
                    loadedCampusIds.current.add(campusId);
                } else {
                    const fallback: CampusProfile = {
                        id: campusId,
                        name: "Campus",
                        logoUrl: null,
                        shortName: null,
                    };
                    setCampusProfiles((prev) => ({ ...prev, [campusId]: fallback }));
                    loadedCampusIds.current.add(campusId);
                }
            } catch (error) {
                console.error(`Error fetching campus profile for ${campusId}:`, error);
            } finally {
                delete inflightRequests.current[campusId];
            }
        })();

        inflightRequests.current[campusId] = request;
        return request;
    }, []);

    return (
        <CampusProfilesContext.Provider value={{ campusProfiles, fetchCampusProfile }}>
            {children}
        </CampusProfilesContext.Provider>
    );
}

export function useCampusProfiles() {
    const context = useContext(CampusProfilesContext);
    if (context === undefined) {
        throw new Error("useCampusProfiles must be used within a CampusProfilesProvider");
    }
    return context;
}

/**
 * Hook to get a single campus's profile with automatic fetching and caching.
 */
export function useCampusProfile(campusId?: string) {
    const { campusProfiles, fetchCampusProfile } = useCampusProfiles();
    const profile = campusId ? campusProfiles[campusId] : null;

    useEffect(() => {
        if (campusId && !campusProfiles[campusId]) {
            fetchCampusProfile(campusId);
        }
    }, [campusId, fetchCampusProfile, campusProfiles]);

    return profile;
}
