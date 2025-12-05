"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, type SVGProps } from "react";
import type { Dispatch, SetStateAction } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore/lite";
import { auth, db } from "../lib/firebase";
import { HomeIcon, UserIcon, Cog6ToothIcon, ChevronLeftIcon } from "@heroicons/react/24/outline";

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
  const [accountName, setAccountName] = useState<string | null>(null);
  const [accountUsername, setAccountUsername] = useState<string | null>(null);
  const [accountPhotoUrl, setAccountPhotoUrl] = useState<string | null>(null);

  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAccountName(null);
        setAccountUsername(null);
        setAccountPhotoUrl(null);
        return;
      }

      // Basic name from auth
      setAccountName(user.displayName || user.email || "");
      setAccountPhotoUrl(user.photoURL || null);

      // Try to load username from Firestore profile and save Google photo if not already saved
      try {
        const userDocRef = doc(db, "users", user.uid);
        const snap = await getDoc(userDocRef);

        if (snap.exists()) {
          const data = snap.data() as any;

          // Load username
          if (data && typeof data.username === "string") {
            setAccountUsername(data.username);
          } else {
            setAccountUsername(null);
          }

          // Save Google profile photo if user doesn't have one stored
          if (user.photoURL && !data.photoURL) {
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
          setAccountUsername(null);

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
        setAccountUsername(null);
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
    sidebarLayoutClasses = "inset-y-3 left-3 w-64";
  } else {
    // Desktop: primary sidebar panel
    sidebarLayoutClasses = "inset-y-3 left-3 w-64";
  }

  const showHeader = width <= 1024 || !sidebarVisible;

  const initials = (accountName || accountUsername || "U")
    .toString()
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      {/* iPadOS-style sidebar (md and up) */}
      <aside
        className={`fixed z-30 flex-col rounded-none md:rounded-[1.8rem] border border-white/8 bg-[#121212] px-4 py-4 text-[14px] text-slate-200 shadow-[0_30px_80px_rgba(0,0,0,0.9)] backdrop-blur-2xl transition-all duration-300 ${sidebarLayoutClasses} ${sidebarVisible ? "flex" : "hidden"
          }`}
      >
        {/* App name + sidebar toggle */}
        <div className="mb-3 flex items-center justify-between px-1">
          <span className="font-display text-[18px] font-semibold tracking-tight text-slate-50">
            Campus Connect
          </span>
          <button
            onClick={() => setSidebarVisible(false)}
            className="flex h-11 w-11 items-center justify-center text-[24px] font-semibold text-gray-300"
          >
            <SidebarIcon className="h-6 w-6 rotate-180" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex flex-1 flex-col gap-1">
          {/* Feed */}
          <Link
            href="/"
            onClick={handleSidebarLinkClick}
            className="flex items-center gap-2 rounded-2xl px-3 py-3 text-[14px] text-slate-100 hover:bg-white/5"
          >
            <HomeIcon className="h-7 w-7 text-slate-200" />
            <div className="flex flex-1 items-center justify-between">
              <span className="text-[16px]">Feed</span>
            </div>
          </Link>

          {/* Explore */}
          <Link
            href="/events"
            onClick={handleSidebarLinkClick}
            className="flex items-center gap-2 rounded-2xl px-3 py-3 text-[14px] text-slate-100 hover:bg-white/5"
          >
            <RadarIcon className="h-7 w-7 text-slate-200" />
            <div className="flex flex-1 items-center justify-between">
              <span className="text-[16px]">Explore</span>
            </div>
          </Link>

          {/* Profile */}
          <Link
            href="/profile"
            onClick={handleSidebarLinkClick}
            className="flex items-center gap-2 rounded-2xl px-3 py-3 text-[14px] text-slate-200 hover:bg-white/5"
          >
            <UserIcon className="h-7 w-7 text-slate-200" />
            <div className="flex flex-1 items-center justify-between">
              <span className="text-[16px]">Profile</span>
            </div>
          </Link>

          {/* Settings */}
          <Link
            href="/settings"
            onClick={handleSidebarLinkClick}
            className="flex items-center gap-2 rounded-2xl px-3 py-3 text-[14px] text-slate-200 hover:bg-white/5"
          >
            <Cog6ToothIcon className="h-7 w-7 text-slate-200" />
            <div className="flex flex-1 items-center justify-between">
              <span className="text-[16px]">Settings</span>
            </div>
          </Link>
        </nav>

        {/* Signed-in account (clickable to open profile) */}
        <Link
          href="/profile"
          onClick={handleSidebarLinkClick}
          className="mt-4 block"
        >
          <div className="flex items-center gap-4 rounded-3xl border border-white/10 bg-gray-800/70 px-3.5 py-3 shadow-[0_0_20px_rgba(0,0,0,0.35)] backdrop-blur transition hover:bg-gray-700/70 hover:border-white/20">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-gray-800 text-[14px] font-semibold text-slate-50">
              {accountPhotoUrl ? (
                <img
                  src={accountPhotoUrl}
                  alt={accountName || "Profile"}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <div className="flex flex-col text-[14px]">
              <span className="font-medium text-[16px] text-slate-200">
                {accountName || "Student Name"}
              </span>
              <span className="text-[13px] text-slate-400">
                {accountUsername ? `@${accountUsername}` : ""}
              </span>
            </div>
          </div>
        </Link>
      </aside>

      {/* Top navbar / tab bar */}
      <header
        className={`fixed top-0 left-0 right-0 z-20 flex justify-center py-3 text-sm text-slate-100 pointer-events-none ${showHeader ? "block" : "hidden"}`}
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
                className={`inline-flex items-center rounded-full px-3 py-1.5 text-[13px] ${pathname === "/" ? "bg-slate-50 text-slate-900 shadow-sm" : "text-slate-200 hover:bg-white/10"
                  }`}
              >
                <HomeIcon className="mr-1 h-4 w-4" />
                Home
              </Link>

              {/* Explore tab */}
              <Link
                href="/events"
                className={`inline-flex items-center rounded-full px-3 py-1.5 text-[13px] ${pathname === "/events"
                  ? "bg-slate-50 text-slate-900 shadow-sm"
                  : "text-slate-200 hover:bg-white/10"
                  }`}
              >
                <RadarIcon className="mr-1 h-4 w-4" />
                Explore
              </Link>

              {/* Profile tab (always visible) */}
              <Link
                href="/profile"
                className={`inline-flex items-center rounded-full px-3 py-1.5 text-[13px] ${pathname === "/profile"
                  ? "bg-slate-50 text-slate-900 shadow-sm"
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
                  ? "bg-slate-50 text-slate-900 shadow-sm"
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