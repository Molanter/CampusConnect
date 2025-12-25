"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";
import { fetchGlobalAdminEmails, isGlobalAdmin } from "../lib/admin-utils";

interface AdminModeContextType {
    isGlobalAdminUser: boolean;
    adminModeOn: boolean;
    setAdminModeOn: (value: boolean) => void;
}

const AdminModeContext = createContext<AdminModeContextType>({
    isGlobalAdminUser: false,
    adminModeOn: false,
    setAdminModeOn: () => { },
});

export function AdminModeProvider({ children }: { children: ReactNode }) {
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [isGlobalAdminUser, setIsGlobalAdminUser] = useState(false);
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

    // Check if user is global admin
    useEffect(() => {
        if (!userEmail) {
            setIsGlobalAdminUser(false);
            return;
        }
        const checkAdmin = async () => {
            const globalAdmins = await fetchGlobalAdminEmails();
            if (isGlobalAdmin(userEmail, globalAdmins)) {
                setIsGlobalAdminUser(true);
            } else {
                setIsGlobalAdminUser(false);
            }
        };
        checkAdmin();
    }, [userEmail]);

    return (
        <AdminModeContext.Provider value={{ isGlobalAdminUser, adminModeOn, setAdminModeOn }}>
            {children}
        </AdminModeContext.Provider>
    );
}

export function useAdminMode() {
    return useContext(AdminModeContext);
}
