"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { fetchGlobalAdminEmails, isGlobalAdmin } from "../lib/admin-utils";
import { collection, query, where, getDocs, limit } from "firebase/firestore";

interface AdminModeContextType {
    isGlobalAdminUser: boolean;
    isCampusAdminUser: boolean;
    adminModeOn: boolean;
    setAdminModeOn: (value: boolean) => void;
}

const AdminModeContext = createContext<AdminModeContextType>({
    isGlobalAdminUser: false,
    isCampusAdminUser: false,
    adminModeOn: false,
    setAdminModeOn: () => { },
});

export function AdminModeProvider({ children }: { children: ReactNode }) {
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [isGlobalAdminUser, setIsGlobalAdminUser] = useState(false);
    const [isCampusAdminUser, setIsCampusAdminUser] = useState(false);
    const [adminModeOn, setAdminModeOnState] = useState(false);

    // Load from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem("adminModeOn");
        if (stored === "true") {
            setAdminModeOnState(true);
        }
    }, []);

    // Wrapper to persist to localStorage
    const setAdminModeOn = (value: boolean) => {
        setAdminModeOnState(value);
        localStorage.setItem("adminModeOn", value ? "true" : "false");
    };

    // Listen for auth state
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user) => {
            setUserEmail(user?.email || null);
        });
        return () => unsub();
    }, []);

    // Check if user is global admin or campus admin
    useEffect(() => {
        if (!userEmail) {
            setIsGlobalAdminUser(false);
            setIsCampusAdminUser(false);
            return;
        }
        const checkAdmin = async () => {
            // Check Global Admin
            const globalAdmins = await fetchGlobalAdminEmails();
            const isGlobal = isGlobalAdmin(userEmail, globalAdmins);
            setIsGlobalAdminUser(isGlobal);

            // Check Campus Admin (if not already global)
            // Even if global, we check for consistency or just set it based on global
            if (isGlobal) {
                setIsCampusAdminUser(true);
            } else {
                try {
                    const emailLower = userEmail.toLowerCase();
                    // Check campuses
                    const cQuery = query(
                        collection(db, 'campuses'),
                        where('adminEmails', 'array-contains', emailLower),
                        limit(1)
                    );
                    const cSnap = await getDocs(cQuery);

                    if (!cSnap.empty) {
                        setIsCampusAdminUser(true);
                    } else {
                        // Check universities (legacy fallback)
                        const uQuery = query(
                            collection(db, 'universities'),
                            where('adminEmails', 'array-contains', emailLower),
                            limit(1)
                        );
                        const uSnap = await getDocs(uQuery);
                        setIsCampusAdminUser(!uSnap.empty);
                    }
                } catch (err) {
                    console.error("Error checking campus admin status:", err);
                    setIsCampusAdminUser(false);
                }
            }
        };
        checkAdmin();
    }, [userEmail]);

    return (
        <AdminModeContext.Provider value={{ isGlobalAdminUser, isCampusAdminUser, adminModeOn, setAdminModeOn }}>
            {children}
        </AdminModeContext.Provider>
    );
}

export function useAdminMode() {
    return useContext(AdminModeContext);
}
