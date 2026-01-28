"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, type SVGProps, Fragment } from "react";
import type { Dispatch, SetStateAction } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
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
  ArrowRightOnRectangleIcon,
  UserGroupIcon,
  WrenchScrewdriverIcon
} from "@heroicons/react/24/outline";
import { UserRow } from "./user-row";
import { useAdminMode } from "./admin-mode-context";
import { Menu, Transition } from "@headlessui/react";

import { motion, AnimatePresence } from "framer-motion";

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
  isTabPage?: boolean;
};

export function Navbar({
  viewportWidth,
  isTabPage = true,
}: NavbarProps) {
  const [uid, setUid] = useState<string | null>(null);
  const { isGlobalAdminUser, isCampusAdminUser, adminModeOn, setAdminModeOn } = useAdminMode();
  const router = useRouter();
  const pathname = usePathname();
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setMenuVisible(true);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
    setMenuVisible(false);
  };

  useEffect(() => {
    const handleClickOutside = () => setMenuVisible(false);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

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
  const sidebarClasses = "fixed z-30 flex flex-col items-center w-[72px] rounded-full overflow-hidden cc-glass cc-shadow-floating py-3 transition-all duration-300 left-4 top-1/2 -translate-y-1/2 h-fit";

  // Nav item styling
  const navItemBase = isDesktop
    ? "group flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200 relative"
    : "group flex items-center gap-3 rounded-full px-4 py-3.5 text-[17px] font-medium transition-all duration-200 ease-out";

  const navItemInactive = isDesktop
    ? "text-secondary hover:text-foreground hover:bg-secondary/20"
    : "text-secondary hover:bg-secondary/20 hover:text-foreground hover:scale-[1.02] active:scale-95";

  // Active State: Just color change (no background) for regular items
  const navItemActive = isDesktop
    ? "bg-brand text-brand-foreground shadow-md shadow-brand/20"
    : "bg-brand text-brand-foreground shadow-md shadow-brand/20 font-semibold";

  // Header is always shown on mobile if it's a tabbed page
  const showHeader = isMobile && isTabPage;

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
        <span className="absolute left-full ml-3 px-2 py-1 rounded-md bg-foreground border border-secondary/30 text-xs font-medium text-background opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
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
                {isGlobalAdminUser && (
                  <NavItem href="/admin/support" icon={ChatBubbleLeftRightIcon} label="Support" isActive={pathname.startsWith("/admin/support")} />
                )}
                {isGlobalAdminUser && (
                  <NavItem href="/admin/config" icon={WrenchScrewdriverIcon} label="Config" isActive={pathname.startsWith("/admin/config")} />
                )}
              </>
            ) : (
              <>
                <Link
                  href="/"
                  className={`${navItemBase} ${pathname === "/" ? navItemActive : navItemInactive}`}
                  title="Feed"
                >
                  <svg
                    viewBox="0 0 100 100"
                    fill="currentColor"
                    stroke="none"
                    className={`${isDesktop ? "h-[26px] w-[26px]" : "h-[22px] w-[22px]"} ${pathname === "/" ? "text-current" : "text-secondary"}`}
                  >
                    <path d="M0 0 C5.05728571 0.12041156 7.88360483 1.93684147 11.453125 5.27734375 C15.95250776 10.28802001 16.35248815 15.63463668 16.49609375 22.05859375 C15.24269438 29.49016642 10.95823599 34.68868348 5.6875 39.8125 C5.14416016 40.37130859 4.60082031 40.93011719 4.04101562 41.50585938 C-1.0205628 46.51963068 -6.09226334 49.42658583 -13.4375 49.4375 C-18.73449827 49.25609595 -22.79726622 48.31263514 -27 45 C-32.58501842 38.93940141 -34.4086537 34.05287686 -34.2578125 25.83203125 C-33.38668867 16.26286799 -25.77348485 10.09053844 -19 4 C-18.67 4 -18.34 4 -18 4 C-16.92551732 13.27807263 -16.92551732 13.27807263 -19.5234375 17.44140625 C-21.27815782 19.38592285 -23.10869791 21.19033685 -25 23 C-26.74920472 26.49840944 -25.83072833 30.27782189 -25 34 C-23.18992689 37.03833701 -21.74623728 38.5439661 -18.75 40.375 C-14.91113683 41.2474689 -11.70288185 41.27543708 -8 40 C-1.97890501 36.02423881 4.75043202 29.49913595 8 23 C8.39201042 18.92309166 8.25344947 16.51703691 6.4375 12.8125 C3.52013512 9.44630975 0.96091436 7.98045718 -3 6 C-1.125 1.125 -1.125 1.125 0 0 Z " transform="translate(49,36)" />
                    <path d="M0 0 C5.19039543 2.97967145 8.81220493 7.87411478 10.6875 13.5 C11.39515137 20.68092125 11.14028672 26.64899523 6.6875 32.5 C3.17818482 36.34694608 -0.44020768 40.01813715 -4.3125 43.5 C-4.6425 43.5 -4.9725 43.5 -5.3125 43.5 C-6.40171425 34.09472138 -6.40171425 34.09472138 -3.7890625 30.26953125 C-2.51888542 28.97083999 -1.23895358 27.6816142 0.05078125 26.40234375 C2.85865203 23.13878033 2.82488888 20.75905519 2.6875 16.5 C1.20578057 12.36678265 -0.33643329 9.48803335 -4.3125 7.5 C-8.69936034 6.34468182 -12.05156438 5.93660323 -16.25 7.8125 C-17.71951953 8.96275181 -17.71951953 8.96275181 -19.3125 10.5 C-20.14394531 11.27730469 -20.97539063 12.05460937 -21.83203125 12.85546875 C-28.8001789 19.25012924 -28.8001789 19.25012924 -31.6875 27.875 C-31.23115772 32.28630873 -30.20908599 34.15778539 -27.3125 37.5 C-25.04026683 39.0715874 -22.79581265 40.25834368 -20.3125 41.5 C-21 43.9375 -21 43.9375 -22.3125 46.5 C-24.5625 47.5625 -24.5625 47.5625 -27.3125 47.5 C-33.43608071 44.25075309 -37.08371614 40.01490668 -39.3125 33.5 C-39.6484375 30.88671875 -39.6484375 30.88671875 -39.6875 28.1875 C-39.71585938 27.30449219 -39.74421875 26.42148437 -39.7734375 25.51171875 C-38.62908206 18.03461666 -34.28070021 12.82100299 -29 7.6875 C-28.45666016 7.12869141 -27.91332031 6.56988281 -27.35351562 5.99414062 C-19.88510277 -1.40373232 -10.04157448 -4.32826486 0 0 Z " transform="translate(74.3125,16.5)" />
                  </svg>
                  {isDesktop && (
                    <span className="absolute left-full ml-3 px-2 py-1 rounded-md bg-foreground border border-secondary/30 text-xs font-medium text-background opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                      Feed
                    </span>
                  )}
                </Link>
                <NavItem href="/explore" icon={MagnifyingGlassIcon} label="Explore" isActive={pathname === "/explore"} />
                <NavItem href="/posts/new" icon={PlusIcon} label="Create Post" isActive={pathname === "/posts/new"} />
              </>
            )}

            {/* Desktop User Menu (Profile Link) */}
            <Link
              href="/profile"
              onContextMenu={handleContextMenu}
              className={`relative flex h-10 w-10 items-center justify-center rounded-full overflow-hidden transition-all hover:scale-105 ${pathname === "/profile" ? "ring-2 ring-brand" : "hover:ring-2 hover:ring-secondary/30"
                }`}
            >
              <div className="h-full w-full">
                <UserRow uid={uid || undefined} onlyAvatar={true} />
              </div>
            </Link>
          </nav>


        </aside>
      )}

      {/* Bottom navbar / tab bar (MOBILE ONLY) */}
      <header
        className={`fixed bottom-0 left-0 right-0 z-20 flex justify-center py-3 text-sm text-foreground pointer-events-none ${showHeader ? "block" : "hidden"
          }`}
      >
        <div className="w-full max-w-6xl flex items-center justify-center gap-3 px-4 pointer-events-auto">
          {/* Centered capsule tab bar */}
          <nav className="flex items-center justify-center">
            {isAdmin && adminModeOn ? (
              <div className="inline-flex items-center gap-0 p-1 text-[12px] cc-glass-strong rounded-full overflow-hidden">
                <Link
                  href="/settings"
                  className={`inline-flex items-center rounded-full px-3 py-1.5 ${pathname === "/settings"
                    ? "bg-[#ffb200] text-black shadow-sm"
                    : "text-secondary hover:text-foreground hover:bg-secondary/10"
                    }`}
                  title="Settings"
                >
                  <Cog6ToothIcon className="h-5 w-5" />
                </Link>

                <Link
                  href="/admin/moderation"
                  className={`inline-flex items-center rounded-full px-3 py-1.5 ${pathname === "/admin/moderation"
                    ? "bg-[#ffb200] text-black shadow-sm"
                    : "text-secondary hover:text-foreground hover:bg-secondary/10"
                    }`}
                  title="Moderation"
                >
                  <ShieldCheckIcon className="h-5 w-5" />
                </Link>

                <Link
                  href={isGlobalAdminUser ? "/admin/campuses" : "/admin/campuses/manage-my"}
                  className={`inline-flex items-center rounded-full px-3 py-1.5 ${pathname.startsWith("/admin/campuses")
                    ? "bg-[#ffb200] text-black shadow-sm"
                    : "text-secondary hover:text-foreground hover:bg-secondary/10"
                    }`}
                  title="Campuses"
                >
                  <BuildingLibraryIcon className="h-5 w-5" />
                </Link>

                {isGlobalAdminUser && (
                  <Link
                    href="/admin/support"
                    className={`inline-flex items-center rounded-full px-3 py-1.5 ${pathname.startsWith("/admin/support")
                      ? "bg-[#ffb200] text-black shadow-sm"
                      : "text-secondary hover:text-foreground hover:bg-secondary/10"
                      }`}
                    title="Support"
                  >
                    <ChatBubbleLeftRightIcon className="h-5 w-5" />
                  </Link>
                )}

                {isGlobalAdminUser && (
                  <Link
                    href="/admin/config"
                    className={`inline-flex items-center rounded-full px-3 py-1.5 ${pathname.startsWith("/admin/config")
                      ? "bg-[#ffb200] text-black shadow-sm"
                      : "text-secondary hover:text-foreground hover:bg-secondary/10"
                      }`}
                    title="Config"
                  >
                    <WrenchScrewdriverIcon className="h-5 w-5" />
                  </Link>
                )}
              </div>
            ) : (
              <div className="inline-flex items-center gap-0 p-1 text-[12px] cc-glass-strong rounded-full overflow-hidden">
                {/* REMOVED Sidebar toggle icon */}

                <Link
                  href="/"
                  className={`inline-flex items-center rounded-full px-3 py-1.5 text-[13px] ${pathname === "/"
                    ? "bg-[#ffb200] text-black shadow-sm font-medium"
                    : "text-secondary hover:text-foreground hover:bg-secondary/10"
                    }`}
                >
                  <svg
                    viewBox="0 0 100 100"
                    fill="currentColor"
                    stroke="none"
                    className="mr-1 h-5 w-5"
                  >
                    <path d="M0 0 C5.05728571 0.12041156 7.88360483 1.93684147 11.453125 5.27734375 C15.95250776 10.28802001 16.35248815 15.63463668 16.49609375 22.05859375 C15.24269438 29.49016642 10.95823599 34.68868348 5.6875 39.8125 C5.14416016 40.37130859 4.60082031 40.93011719 4.04101562 41.50585938 C-1.0205628 46.51963068 -6.09226334 49.42658583 -13.4375 49.4375 C-18.73449827 49.25609595 -22.79726622 48.31263514 -27 45 C-32.58501842 38.93940141 -34.4086537 34.05287686 -34.2578125 25.83203125 C-33.38668867 16.26286799 -25.77348485 10.09053844 -19 4 C-18.67 4 -18.34 4 -18 4 C-16.92551732 13.27807263 -16.92551732 13.27807263 -19.5234375 17.44140625 C-21.27815782 19.38592285 -23.10869791 21.19033685 -25 23 C-26.74920472 26.49840944 -25.83072833 30.27782189 -25 34 C-23.18992689 37.03833701 -21.74623728 38.5439661 -18.75 40.375 C-14.91113683 41.2474689 -11.70288185 41.27543708 -8 40 C-1.97890501 36.02423881 4.75043202 29.49913595 8 23 C8.39201042 18.92309166 8.25344947 16.51703691 6.4375 12.8125 C3.52013512 9.44630975 0.96091436 7.98045718 -3 6 C-1.125 1.125 -1.125 1.125 0 0 Z " transform="translate(49,36)" />
                    <path d="M0 0 C5.19039543 2.97967145 8.81220493 7.87411478 10.6875 13.5 C11.39515137 20.68092125 11.14028672 26.64899523 6.6875 32.5 C3.17818482 36.34694608 -0.44020768 40.01813715 -4.3125 43.5 C-4.6425 43.5 -4.9725 43.5 -5.3125 43.5 C-6.40171425 34.09472138 -6.40171425 34.09472138 -3.7890625 30.26953125 C-2.51888542 28.97083999 -1.23895358 27.6816142 0.05078125 26.40234375 C2.85865203 23.13878033 2.82488888 20.75905519 2.6875 16.5 C1.20578057 12.36678265 -0.33643329 9.48803335 -4.3125 7.5 C-8.69936034 6.34468182 -12.05156438 5.93660323 -16.25 7.8125 C-17.71951953 8.96275181 -17.71951953 8.96275181 -19.3125 10.5 C-20.14394531 11.27730469 -20.97539063 12.05460937 -21.83203125 12.85546875 C-28.8001789 19.25012924 -28.8001789 19.25012924 -31.6875 27.875 C-31.23115772 32.28630873 -30.20908599 34.15778539 -27.3125 37.5 C-25.04026683 39.0715874 -22.79581265 40.25834368 -20.3125 41.5 C-21 43.9375 -21 43.9375 -22.3125 46.5 C-24.5625 47.5625 -24.5625 47.5625 -27.3125 47.5 C-33.43608071 44.25075309 -37.08371614 40.01490668 -39.3125 33.5 C-39.6484375 30.88671875 -39.6484375 30.88671875 -39.6875 28.1875 C-39.71585938 27.30449219 -39.74421875 26.42148437 -39.7734375 25.51171875 C-38.62908206 18.03461666 -34.28070021 12.82100299 -29 7.6875 C-28.45666016 7.12869141 -27.91332031 6.56988281 -27.35351562 5.99414062 C-19.88510277 -1.40373232 -10.04157448 -4.32826486 0 0 Z " transform="translate(74.3125,16.5)" />
                  </svg>
                  Feed
                </Link>

                <Link
                  href="/explore"
                  className={`inline-flex items-center rounded-full px-3 py-1.5 text-[13px] ${pathname === "/explore"
                    ? "bg-[#ffb200] text-black shadow-sm font-medium"
                    : "text-secondary hover:text-foreground hover:bg-secondary/10"
                    }`}
                >
                  <MagnifyingGlassIcon className="mr-1 h-4 w-4" />
                  Explore
                </Link>

                <Link
                  href="/posts/new"
                  className={`inline-flex items-center rounded-full px-3 py-1.5 text-[13px] ${pathname === "/posts/new"
                    ? "bg-[#ffb200] text-black shadow-sm font-medium"
                    : "text-secondary hover:text-foreground hover:bg-secondary/10"
                    }`}
                >
                  <PlusIcon className="mr-1 h-4 w-4" />
                  Create
                </Link>

                <Link
                  href="/profile"
                  onContextMenu={handleContextMenu}
                  className={`inline-flex items-center rounded-full px-3 py-1.5 text-[13px] ${pathname === "/profile"
                    ? "bg-[#ffb200] text-black shadow-sm font-medium"
                    : "text-secondary hover:text-foreground hover:bg-secondary/10"
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

      {/* Profile Context Menu */}
      <AnimatePresence>
        {menuVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed z-[100] min-w-[180px] overflow-hidden rounded-[24px] cc-glass-strong border border-white/10 shadow-2xl p-1.5"
            style={{
              left: Math.min(menuPosition.x, typeof window !== 'undefined' ? window.innerWidth - 190 : 0),
              top: Math.min(menuPosition.y, typeof window !== 'undefined' ? window.innerHeight - 150 : 0)
            }}
          >
            <div className="flex flex-col gap-1 p-1">
              <Link
                href="/profile"
                onClick={() => setMenuVisible(false)}
                className="flex items-center gap-3 px-4 py-2.5 rounded-full text-foreground hover:bg-white/15 hover:cc-glass-highlight transition-all duration-200"
              >
                <UserIcon className="h-5 w-5 text-secondary" />
                <span className="text-sm font-medium">Profile</span>
              </Link>
              <Link
                href="/settings"
                onClick={() => setMenuVisible(false)}
                className="flex items-center gap-3 px-4 py-2.5 rounded-full text-foreground hover:bg-white/15 hover:cc-glass-highlight transition-all duration-200"
              >
                <Cog6ToothIcon className="h-5 w-5 text-secondary" />
                <span className="text-sm font-medium">Settings</span>
              </Link>
              <div className="h-px bg-white/5 my-0.5 mx-3" />
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-2.5 rounded-full text-red-500 hover:bg-red-500/15 transition-all duration-200 w-full text-left"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
                <span className="text-sm font-medium">Log Out</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}