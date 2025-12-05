"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Map" },
  { href: "/profile", label: "Profile" },
  { href: "/settings", label: "Settings" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-20 border-t border-white/5 bg-background/95 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-2">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-1 flex-col items-center gap-0.5 text-xs"
            >
              <div
                className={`rounded-full px-3 py-1 text-[11px] ${
                  active
                    ? "bg-brand text-white shadow-soft"
                    : "bg-white/5 text-gray-300"
                }`}
              >
                {item.label}
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}