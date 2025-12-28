"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, type SVGProps, Fragment } from "react";
import type { Dispatch, SetStateAction } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import {
  HomeIcon,
  UserIcon,
  Cog6ToothIcon,
  ShieldCheckIcon,
  BuildingLibraryIcon,
  ChatBubbleLeftRightIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  PowerIcon,
  UserGroupIcon
} from "@heroicons/react/24/outline";
import { UserRow } from "./user-row";
import { useAdminMode } from "./admin-mode-context";
import { Menu, Transition } from "@headlessui/react";

function SidebarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="3.5" y="5" width="17" height="14" rx="3" />
      <path d="M9.5 5v14" />
      <path d="M13.5 10h4.5" />
      <path d="M13.5 14h3" />
    </svg>
  );
}

type NavbarProps = {
  viewportWidth: number | null;
};

export function Navbar({
  viewportWidth,
}: NavbarProps) {
  const [uid, setUid] = useState<string | null>(null);
  const { isGlobalAdminUser, isCampusAdminUser, adminModeOn, setAdminModeOn } = useAdminMode();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUid(null);
        return;
      }

      setUid(user.uid);

      // Try to load username and profile photo from Firestore
      try {
        const userDocRef = doc(db, "users", user.uid);
        const snap = await getDoc(userDocRef);

        if (snap.exists()) {
          const data = snap.data() as any;

          // Save Google profile photo if user doesn't have one stored
          if (user.photoURL && !data.photoURL && !data.profilePhotoURL) {
            try {
              const { setDoc } = await import("firebase/firestore");
              await setDoc(userDocRef, {
                photoURL: user.photoURL
              }, { merge: true });
              console.log("Saved Google profile photo to Firestore");
            } catch (err) {
              console.error("Error saving Google profile photo:", err);
            }
          }
        } else {
          // Create user document with Google photo if this is first login
          if (user.photoURL) {
            try {
              const { setDoc } = await import("firebase/firestore");
              await setDoc(userDocRef, {
                photoURL: user.photoURL,
                displayName: user.displayName || "",
                email: user.email || "",
              }, { merge: true });
              console.log("Created user document with Google profile photo");
            } catch (err) {
              console.error("Error creating user document:", err);
            }
          }
        }
      } catch (err) {
        console.error("Error loading navbar user profile", err);
      }
    });

    return () => unsubscribe();
  }, []);

  const width = viewportWidth ?? 1024;
  const isDesktop = width > 768; // Desktop includes tablet for this design
  const isMobile = width <= 768;

  // Sidebar styling - Only used for Desktop now
  const sidebarClasses = "fixed z-30 flex flex-col items-center w-[72px] rounded-[2rem] border border-white/10 bg-[#111111]/95 backdrop-blur-2xl py-3 transition-all duration-300 left-4 top-1/2 -translate-y-1/2 shadow-2xl shadow-black/50 h-fit";

  // Nav item styling
  const navItemBase = isDesktop
    ? "group flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200 relative"
    : "group flex items-center gap-3 rounded-full px-4 py-3.5 text-[17px] font-medium transition-all duration-200 ease-out";

  const navItemInactive = isDesktop
    ? "text-zinc-500 hover:text-zinc-100 hover:bg-white/10"
    : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100 hover:scale-[1.02] active:scale-95";

  // Active State: Just color change (no background) for regular items
  const navItemActive = isDesktop
    ? "text-[#ffb200]"
    : "bg-[#ffb200] text-black shadow-md shadow-[#ffb200]/20 font-semibold";

  // Header is always shown on mobile
  const showHeader = isMobile;

  const NavItem = ({ href, icon: Icon, label, isActive, onClick }: { href: string, icon: any, label: string, isActive: boolean, onClick?: () => void }) => (
    <Link
      href={href}
      onClick={onClick}
      className={`${navItemBase} ${isActive ? navItemActive : navItemInactive}`}
      title={isDesktop ? label : undefined}
    >
      <Icon className={isDesktop ? "h-[26px] w-[26px]" : "h-[22px] w-[22px]"} strokeWidth={isDesktop ? 1.8 : 2} />
      {!isDesktop && <span>{label}</span>}
      {/* Helper tooltip on hover for desktop */}
      {isDesktop && (
        <span className="absolute left-full ml-3 px-2 py-1 rounded-md bg-zinc-800 border border-white/10 text-xs font-medium text-white opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
          {label}
        </span>
      )}
    </Link>
  );

  const isAdmin = isGlobalAdminUser || isCampusAdminUser;

  return (
    <>
      {/* Sidebar - Desktop Only */}
      {isDesktop && (
        <aside className={sidebarClasses}>
          {/* No Logo on Desktop as requested */}

          {/* Navigation list */}
          <nav className={`flex flex-1 flex-col gap-4 items-center justify-center w-full`}>
            {isAdmin && adminModeOn ? (
              <>
                <NavItem href="/settings" icon={Cog6ToothIcon} label="Settings" isActive={pathname === "/settings"} />
                <NavItem href="/admin/moderation" icon={ShieldCheckIcon} label="Moderation" isActive={pathname === "/admin/moderation"} />
                <NavItem href={isGlobalAdminUser ? "/admin/campuses" : "/admin/campuses/manage-my"} icon={BuildingLibraryIcon} label="Manage Campuses" isActive={pathname.startsWith("/admin/campuses")} />
                <NavItem href="/admin/support" icon={ChatBubbleLeftRightIcon} label="Support" isActive={pathname.startsWith("/admin/support")} />
              </>
            ) : (
              <>
                <NavItem href="/" icon={HomeIcon} label="Feed" isActive={pathname === "/"} />
                <NavItem href="/explore" icon={MagnifyingGlassIcon} label="Explore" isActive={pathname === "/explore"} />
                <NavItem href="/posts/new" icon={PlusIcon} label="Create Post" isActive={pathname === "/posts/new"} />
              </>
            )}

            {/* Desktop User Menu (Profile Link) */}
            <Link
              href="/profile"
              className={`relative flex h-10 w-10 items-center justify-center rounded-full overflow-hidden transition-all hover:scale-105 ${pathname === "/profile" ? "ring-2 ring-[#ffb200]" : "hover:ring-2 hover:ring-white/20"
                }`}
            >
              <div className="h-full w-full">
                <UserRow uid={uid || undefined} onlyAvatar={true} />
              </div>
            </Link>
          </nav>
        </aside>
      )}

      {/* Top navbar / tab bar (MOBILE ONLY) */}
      <header
        className={`fixed top-0 left-0 right-0 z-20 flex justify-center py-3 text-sm text-slate-100 pointer-events-none ${showHeader ? "block" : "hidden"
          }`}
      >
        <div className="w-full max-w-6xl flex items-center justify-center gap-3 px-4 pointer-events-auto">
          {/* Centered capsule tab bar */}
          <nav className="flex items-center justify-center">
            {isAdmin && adminModeOn ? (
              <div className="inline-flex items-center gap-0 rounded-full border border-white/10 bg-black/60 backdrop-blur-xl p-1 text-[12px] text-slate-200 shadow-lg ring-1 ring-white/5">
                <Link
                  href="/settings"
                  className={`inline-flex items-center rounded-full px-3 py-1.5 text-[13px] ${pathname === "/settings"
                    ? "bg-[#ffb200] text-black shadow-sm font-medium"
                    : "text-slate-200 hover:bg-white/10"
                    }`}
                >
                  <Cog6ToothIcon className="mr-1 h-4 w-4" />
                  Settings
                </Link>

                <Link
                  href="/admin/moderation"
                  className={`inline-flex items-center rounded-full px-3 py-1.5 text-[13px] ${pathname === "/admin/moderation"
                    ? "bg-[#ffb200] text-black shadow-sm font-medium"
                    : "text-slate-200 hover:bg-white/10"
                    }`}
                >
                  <ShieldCheckIcon className="mr-1 h-4 w-4" />
                  Mod
                </Link>

                <Link
                  href={isGlobalAdminUser ? "/admin/campuses" : "/admin/campuses/manage-my"}
                  className={`inline-flex items-center rounded-full px-3 py-1.5 text-[13px] ${pathname.startsWith("/admin/campuses")
                    ? "bg-[#ffb200] text-black shadow-sm font-medium"
                    : "text-slate-200 hover:bg-white/10"
                    }`}
                >
                  <BuildingLibraryIcon className="mr-1 h-4 w-4" />
                  Uni
                </Link>

                <Link
                  href="/admin/support"
                  className={`inline-flex items-center rounded-full px-3 py-1.5 text-[13px] ${pathname.startsWith("/admin/support")
                    ? "bg-[#ffb200] text-black shadow-sm font-medium"
                    : "text-slate-200 hover:bg-white/10"
                    }`}
                >
                  <ChatBubbleLeftRightIcon className="mr-1 h-4 w-4" />
                  Support
                </Link>
              </div>
            ) : (
              <div className="inline-flex items-center gap-0 rounded-full border border-white/10 bg-black/60 backdrop-blur-xl p-1 text-[12px] text-slate-200 shadow-lg ring-1 ring-white/5">
                {/* REMOVED Sidebar toggle icon */}

                <Link
                  href="/"
                  className={`inline-flex items-center rounded-full px-3 py-1.5 text-[13px] ${pathname === "/"
                    ? "bg-[#ffb200] text-black shadow-sm font-medium"
                    : "text-slate-200 hover:bg-white/10"
                    }`}
                >
                  <HomeIcon className="mr-1 h-4 w-4" />
                  Home
                </Link>

                <Link
                  href="/explore"
                  className={`inline-flex items-center rounded-full px-3 py-1.5 text-[13px] ${pathname === "/explore"
                    ? "bg-[#ffb200] text-black shadow-sm font-medium"
                    : "text-slate-200 hover:bg-white/10"
                    }`}
                >
                  <MagnifyingGlassIcon className="mr-1 h-4 w-4" />
                  Explore
                </Link>

                <Link
                  href="/posts/new"
                  className={`inline-flex items-center rounded-full px-3 py-1.5 text-[13px] ${pathname === "/posts/new"
                    ? "bg-[#ffb200] text-black shadow-sm font-medium"
                    : "text-slate-200 hover:bg-white/10"
                    }`}
                >
                  <PlusIcon className="mr-1 h-4 w-4" />
                  Create
                </Link>

                <Link
                  href="/profile"
                  className={`inline-flex items-center rounded-full px-3 py-1.5 text-[13px] ${pathname === "/profile"
                    ? "bg-[#ffb200] text-black shadow-sm font-medium"
                    : "text-slate-200 hover:bg-white/10"
                    }`}
                >
                  <UserIcon className="mr-1 h-4 w-4" />
                  Profile
                </Link>
              </div>
            )}
          </nav>
        </div>
      </header>
    </>
  );
}