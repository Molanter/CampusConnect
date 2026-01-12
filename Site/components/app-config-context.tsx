"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface AppConfig {
    version: string;
    // Add other config fields as needed
}

interface AppConfigContextType {
    config: AppConfig;
    loading: boolean;
    refetch: () => Promise<void>;
}

const defaultConfig: AppConfig = {
    version: "1.0.0",
};

const AppConfigContext = createContext<AppConfigContextType | undefined>(undefined);

export function AppConfigProvider({ children }: { children: ReactNode }) {
    const [config, setConfig] = useState<AppConfig>(defaultConfig);
    const [loading, setLoading] = useState(true);

    const fetchConfig = async () => {
        try {
            const appInfoDoc = await getDoc(doc(db, "config", "app_info"));
            if (appInfoDoc.exists()) {
                const data = appInfoDoc.data();
                setConfig({
                    version: data?.version || defaultConfig.version,
                    // Add other config fields as needed
                });
            }
        } catch (error) {
            console.error("Error fetching app config:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConfig();
    }, []);

    return (
        <AppConfigContext.Provider value={{ config, loading, refetch: fetchConfig }}>
            {children}
        </AppConfigContext.Provider>
    );
}

export function useAppConfig() {
    const context = useContext(AppConfigContext);
    if (context === undefined) {
        throw new Error("useAppConfig must be used within an AppConfigProvider");
    }
    return context;
}
