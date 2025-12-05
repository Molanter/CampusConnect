import Link from "next/link";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { ReactNode } from "react";

// Helper for conditional classes
const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(" ");

interface SettingsSectionProps {
    title: string;
    children: ReactNode;
    className?: string;
}

export function SettingsSection({ title, children, className }: SettingsSectionProps) {
    return (
        <section className={cn("space-y-3", className)}>
            <h2 className="px-4 text-[13px] font-semibold uppercase tracking-wider text-neutral-500">
                {title}
            </h2>
            {children}
        </section>
    );
}

interface SettingsCardProps {
    children: ReactNode;
    className?: string;
}

export function SettingsCard({ children, className }: SettingsCardProps) {
    return (
        <div className={cn("overflow-hidden rounded-3xl bg-[#101016] shadow-md shadow-black/40", className)}>
            {children}
        </div>
    );
}

interface SettingsRowProps {
    icon?: ReactNode;
    iconColor?: string; // e.g. "bg-blue-500" or gradient classes
    label: string;
    value?: string; // Right side text
    href?: string;
    onClick?: () => void;
    isDestructive?: boolean;
    showChevron?: boolean;
    className?: string;
}

export function SettingsRow({
    icon,
    iconColor = "bg-neutral-700",
    label,
    value,
    href,
    onClick,
    isDestructive = false,
    showChevron = true,
    className,
}: SettingsRowProps) {
    const content = (
        <>
            {icon && (
                <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg text-white", iconColor)}>
                    {icon}
                </div>
            )}
            <div className="flex-1 text-left">
                <p className={cn("text-[15px] font-normal", isDestructive ? "text-red-400" : "text-white")}>
                    {label}
                </p>
            </div>
            {value && <div className="text-sm text-neutral-500 mr-2">{value}</div>}
            {showChevron && <ChevronRightIcon className="h-4 w-4 text-neutral-600" />}
        </>
    );

    const baseClasses = cn(
        "flex w-full items-center gap-3 px-4 py-3.5 transition-all duration-150 ease-out hover:bg-white/5 active:scale-[0.99]",
        className
    );

    if (href) {
        return (
            <Link href={href} className={baseClasses}>
                {content}
            </Link>
        );
    }

    return (
        <button onClick={onClick} className={baseClasses} type="button">
            {content}
        </button>
    );
}
