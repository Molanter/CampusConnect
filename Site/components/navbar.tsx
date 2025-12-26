"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, type SVGProps } from "react";
import type { Dispatch, SetStateAction } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { HomeIcon, UserIcon, Cog6ToothIcon, ChevronLeftIcon, MagnifyingGlassIcon, CalendarIcon, PlusIcon, UserGroupIcon, ShieldCheckIcon, BuildingLibraryIcon, ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";
import { UserRow } from "./user-row";
import { useAdminMode } from "./admin-mode-context";

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
  const { isGlobalAdminUser, adminModeOn, setAdminModeOn } = useAdminMode();

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

  // Constants for iPadOS style
  const navItemBase =
    "group flex items-center gap-3 rounded-full px-4 py-3.5 text-[17px] font-medium transition-all duration-200 ease-out";
  const navItemInactive =
    "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100 hover:scale-[1.02] active:scale-95";
  const navItemActive = "bg-[#ffb200] text-black shadow-md shadow-[#ffb200]/20 font-semibold";

  // Hide header (tab bar) if sidebar is open, regardless of screen size.
  // This satisfies: "on table when show sidebar button was pressed hide tabbar"
  const showHeader = !sidebarVisible;

  return (
    <>
      {/* Backdrop for mobile/tablet when sidebar is active */}
      {/* "when user clicked somewhere but not sidebar hide it. add light blur of main page when left sidebar is active" */}
      {sidebarVisible && width <= 1024 && (
        <div
          className="fixed inset-0 z-20 bg-black/10 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setSidebarVisible(false)}
        />
      )}
      {/* iPadOS-style sidebar (md and up) */}
      <aside
        className={`fixed z-30 flex-col rounded-[2rem] md:rounded-[1.8rem] border border-white/10 bg-[#111111] backdrop-blur-3xl px-5 py-6 transition-all duration-300 ${sidebarLayoutClasses} ${sidebarVisible ? "flex" : "hidden"
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
          {isGlobalAdminUser && adminModeOn ? (
            <>
              {/* Admin Mode Navigation */}
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

              {/* Reports / Moderation */}
              <Link
                href="/admin/moderation"
                onClick={handleSidebarLinkClick}
                className={`${navItemBase} ${pathname === "/admin/moderation" ? navItemActive : navItemInactive
                  }`}
              >
                <ShieldCheckIcon className="h-[22px] w-[22px]" strokeWidth={2} />
                <span>Reports</span>
              </Link>

              <Link
                href="/admin/universities"
                onClick={handleSidebarLinkClick}
                className={`${navItemBase} ${pathname.startsWith("/admin/universities") ? navItemActive : navItemInactive
                  }`}
              >
                <BuildingLibraryIcon className="h-[22px] w-[22px]" strokeWidth={2} />
                <span>Manage Universities</span>
              </Link>

              {/* Support */}
              <Link
                href="/admin/support"
                onClick={handleSidebarLinkClick}
                className={`${navItemBase} ${pathname.startsWith("/admin/support") ? navItemActive : navItemInactive
                  }`}
              >
                <ChatBubbleLeftRightIcon className="h-[22px] w-[22px]" strokeWidth={2} />
                <span>Support</span>
              </Link>
            </>
          ) : (
            <>
              {/* Regular Navigation */}
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
                href="/explore"
                onClick={handleSidebarLinkClick}
                className={`${navItemBase} ${pathname === "/explore" ? navItemActive : navItemInactive
                  }`}
              >
                <MagnifyingGlassIcon className="h-[22px] w-[22px]" strokeWidth={2} />
                <span>Explore</span>
              </Link>

              {/* Create Post */}
              <Link
                href="/posts/new"
                onClick={handleSidebarLinkClick}
                className={`${navItemBase} ${navItemInactive}`}
              >
                <PlusIcon className="h-[22px] w-[22px]" strokeWidth={2} />
                <span>Create Post</span>
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
            </>
          )}
        </nav>

        {/* Signed-in account - Capsule hover style */}
        <div className="mt-auto pt-4 space-y-2">
          {/* Admin View Toggle - Only for Global Admins (above account) */}
          {isGlobalAdminUser && (
            <button
              onClick={() => {
                setAdminModeOn(!adminModeOn);
              }}
              className="flex w-full items-center justify-between gap-3 rounded-full px-4 py-3 transition-all duration-200 hover:bg-white/[0.06]"
            >
              <div className="flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5 text-amber-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-[15px] font-medium text-white/80">Admin View</span>
              </div>
              {/* Toggle Switch */}
              <div className={`relative h-6 w-11 rounded-full transition-colors ${adminModeOn ? 'bg-amber-500' : 'bg-neutral-700'}`}>
                <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${adminModeOn ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
            </button>
          )}

          <Link
            href="/profile"
            onClick={handleSidebarLinkClick}
            className="flex items-center gap-3 rounded-full px-2 py-3 transition-all duration-200 hover:bg-white/[0.06] hover:scale-[1.02] active:scale-95 group"
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

              {/* Create Post tab */}
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

              {/* Profile tab */}
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
          </nav>
        </div>
      </header>
    </>
  );
}