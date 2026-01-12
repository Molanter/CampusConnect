"use client";

import { useAppConfig } from "@/components/app-config-context";

export function SettingsFooter() {
    const { config } = useAppConfig();

    return (
        <div className="text-center px-6 pt-8 pb-4 space-y-2">
            <p className="text-[13px] text-secondary/70">
                © {new Date().getFullYear()} CampusConnect. All rights reserved.
            </p>
            <p className="text-[12px] text-secondary/50 font-mono">
                Version {config.version}
            </p>
        </div>
    );
}
