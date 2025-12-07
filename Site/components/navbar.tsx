"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, type SVGProps } from "react";
import type { Dispatch, SetStateAction } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore/lite";
import { auth, db } from "../lib/firebase";
import { HomeIcon, UserIcon, Cog6ToothIcon, ChevronLeftIcon, MagnifyingGlassIcon, CalendarIcon, PlusIcon } from "@heroicons/react/24/outline";
import { UserRow } from "./user-row";

function RadarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Outer circle */}
      <circle cx="12" cy="12" r="8.5" />

      {/* Mid circle */}
      <circle cx="12" cy="12" r="5.5" opacity={0.7} />

      {/* Center dot */}
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />

      {/* Sweep line (like Find My scan) */}
      <path d="M12 12 L18 9" />

      {/* Small ping dot near edge */}
      <circle cx="18" cy="9" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

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
  sidebarVisible: boolean;
  setSidebarVisible: Dispatch<SetStateAction<boolean>>;
  viewportWidth: number | null;
};

export function Navbar({
  sidebarVisible,
  setSidebarVisible,
  viewportWidth,
}: NavbarProps) {
  const [uid, setUid] = useState<string | null>(null);

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

  // Helper to close sidebar on small screens when clicking a link
  const handleSidebarLinkClick = () => {
    const width = viewportWidth ?? 1024;
    if (width <= 768) {
      setSidebarVisible(false);
    }
  };

  const width = viewportWidth ?? 1024;

  // Layout variants:
  // - width < 500: sidebar is full-screen overlay
  // - 500 <= width <= 768: sidebar overlays main content but not full-screen
  // - width > 768: sidebar is primary fixed panel
  let sidebarLayoutClasses = "";

  if (width < 500) {
    // Full-screen overlay on very small screens
    sidebarLayoutClasses = "inset-0 w-full";
  } else if (width <= 768) {
    // Overlay panel, narrower and anchored to the left (not full width)
    sidebarLayoutClasses = "inset-y-3 left-3 w-72";
  } else {
    // Desktop: primary sidebar panel
    sidebarLayoutClasses = "inset-y-3 left-3 w-72";
  }

  const showHeader = width <= 1024 || !sidebarVisible;

  // Constants for iPadOS style
  const navItemBase =
    "group flex items-center gap-3 rounded-full px-4 py-3.5 text-[17px] font-medium transition-all duration-200 ease-out";
  const navItemInactive =
    "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100 hover:scale-[1.02] active:scale-95";
  const navItemActive = "bg-[#ffb200] text-black shadow-md shadow-[#ffb200]/20 font-semibold";

  return (
    <>
      {/* iPadOS-style sidebar (md and up) */}
      <aside
        className={`fixed z-30 flex-col rounded-none md:rounded-[1.8rem] border border-white/5 bg-gradient-to-b from-[#111111] to-[#151515] px-5 py-6 shadow-[0_30px_80px_rgba(0,0,0,0.5)] transition-all duration-300 ${sidebarLayoutClasses} ${sidebarVisible ? "flex" : "hidden"
          }`}
      >
        {/* App name + sidebar toggle */}
        <div className="mb-8 flex items-center justify-between px-2">
          <span className="font-display text-[21px] font-semibold tracking-tight text-white/90">
            Campus Connect
          </span>
          <button
            onClick={() => setSidebarVisible(false)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-zinc-100 transition-colors"
          >
            <SidebarIcon className="h-6 w-6 rotate-180" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex flex-1 flex-col gap-2">
          {/* Feed */}
          <Link
            href="/"
            onClick={handleSidebarLinkClick}
            className={`${navItemBase} ${pathname === "/" ? navItemActive : navItemInactive
              }`}
          >
            <HomeIcon className="h-[22px] w-[22px]" strokeWidth={2} />
            <span>Feed</span>
          </Link>

          {/* Explore */}
          <Link
            href="/events"
            onClick={handleSidebarLinkClick}
            className={`${navItemBase} ${pathname === "/events" ? navItemActive : navItemInactive
              }`}
          >
            <RadarIcon className="h-[22px] w-[22px]" strokeWidth={2} />
            <span>Explore</span>
          </Link>

          {/* Profile */}
          <Link
            href="/profile"
            onClick={handleSidebarLinkClick}
            className={`${navItemBase} ${pathname === "/profile" ? navItemActive : navItemInactive
              }`}
          >
            <UserIcon className="h-[22px] w-[22px]" strokeWidth={2} />
            <span>Profile</span>
          </Link>

          {/* Settings */}
          <Link
            href="/settings"
            onClick={handleSidebarLinkClick}
            className={`${navItemBase} ${pathname === "/settings" ? navItemActive : navItemInactive
              }`}
          >
            <Cog6ToothIcon className="h-[22px] w-[22px]" strokeWidth={2} />
            <span>Settings</span>
          </Link>

          {/* Create Post Button (Sidebar Only) */}
          <Link
            href="/posts/new"
            onClick={handleSidebarLinkClick}
            className={`${navItemBase} ${navItemInactive}`}
          >
            <PlusIcon className="h-[22px] w-[22px]" strokeWidth={2} />
            <span>Create Post</span>
          </Link>
        </nav>

        {/* Signed-in account - Natural list row style */}
        <div className="mt-auto pt-4">
          <Link
            href="/profile"
            onClick={handleSidebarLinkClick}
            className={`flex items-center gap-3 rounded-xl px-2 py-3 transition-all duration-200 hover:bg-white/[0.06] hover:scale-[1.02] active:scale-95 group ${pathname === "/profile" ? "bg-white/[0.04]" : ""
              }`}
          >
            <UserRow uid={uid || undefined} />
          </Link>
        </div>
      </aside>

      {/* Top navbar / tab bar */}
      <header
        className={`fixed top-0 left-0 right-0 z-20 flex justify-center py-3 text-sm text-slate-100 pointer-events-none ${showHeader ? "block" : "hidden"
          }`}
      >
        <div className="w-full max-w-6xl flex items-center justify-center gap-3 px-4 pointer-events-auto">
          {/* Centered capsule tab bar */}
          <nav className="flex items-center justify-center">
            <div className="inline-flex items-center gap-0 rounded-full border border-white/10 bg-black/60 backdrop-blur-xl p-1 text-[12px] text-slate-200 shadow-lg ring-1 ring-white/5">
              {/* Sidebar toggle icon */}
              <button
                onClick={() => setSidebarVisible(true)}
                className="inline-flex items-center justify-center rounded-full px-2 py-1.5 hover:bg-white/10"
                aria-label="Show sidebar"
              >
                <SidebarIcon className="h-4 w-4" />
              </button>

              {/* Feed tab */}
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

              {/* Explore tab */}
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

              {/* Profile tab (always visible) */}
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

              {/* Settings tab (hidden on very small screens) */}
              <Link
                href="/settings"
                className={`hidden sm:inline-flex items-center rounded-full px-3 py-1.5 text-[13px] ${pathname === "/settings"
                  ? "bg-[#ffb200] text-black shadow-sm font-medium"
                  : "text-slate-200 hover:bg-white/10"
                  }`}
              >
                <Cog6ToothIcon className="mr-1 h-4 w-4" />
                Settings
              </Link>
            </div>
          </nav>
        </div>
      </header>
    </>
  );
}