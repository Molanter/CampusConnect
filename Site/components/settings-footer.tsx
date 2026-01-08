"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function SettingsFooter() {
    const [version, setVersion] = useState<string>("1.0.0");

    // Fetch version from Firebase
    useEffect(() => {
        async function fetchVersion() {
            try {
                const appInfoDoc = await getDoc(doc(db, "config", "app_info"));
                if (appInfoDoc.exists()) {
                    const data = appInfoDoc.data();
                    if (data?.version) {
                        setVersion(data.version);
                    }
                }
            } catch (error) {
                console.error("Error fetching version:", error);
            }
        }
        fetchVersion();
    }, []);

    return (
        <div className="text-center px-6 pt-8 pb-4 space-y-2">
            <p className="text-[13px] text-secondary/70">
                © {new Date().getFullYear()} CampusConnect. All rights reserved.
            </p>
            <p className="text-[12px] text-secondary/50 font-mono">
                Version {version}
            </p>
        </div>
    );
}
