"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../../lib/firebase";
import {
  ChevronRightIcon,
  UserCircleIcon,
  UserIcon,
  BellIcon,
  SwatchIcon,
  LanguageIcon,
  ShieldCheckIcon,
  LockClosedIcon,
  ServerIcon,
  BuildingLibraryIcon,
  PencilSquareIcon,
  QuestionMarkCircleIcon,
  DocumentTextIcon,
  InformationCircleIcon,
  ArrowRightOnRectangleIcon,
  UserGroupIcon,
  PlusIcon,
  ChatBubbleLeftRightIcon,
  CommandLineIcon,
  ChartBarIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";
import { useAdminMode } from "../../components/admin-mode-context";
import { SettingsFooter } from "../../components/settings-footer";

// Shared UI class definitions
const ui = {
  page: "mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 pb-8",
  headerKicker: "text-[11px] font-semibold uppercase tracking-[0.2em] cc-muted",
  headerTitle: "text-sm font-bold text-foreground",
  section: "space-y-3",
  sectionLabel: "pl-[60px] pr-4 text-[13px] font-semibold uppercase tracking-wider cc-muted",
  card: "cc-section overflow-hidden shadow-sm",
  capsuleCard: "cc-section overflow-hidden shadow-sm !rounded-full",
  row: "flex items-center gap-3 px-4 py-3 hover:bg-secondary/10 transition-colors",
  rowBorder: "border-b border-secondary/15",
  iconBox: "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
  chevron: "h-5 w-5 text-secondary",
  toggleTrack: (isOn: boolean) => `relative h-7 w-12 rounded-full transition-colors cursor-pointer ${isOn ? 'bg-brand' : 'bg-secondary/40'}`,
  toggleThumb: (isOn: boolean) => `absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${isOn ? 'translate-x-5' : 'translate-x-0.5'}`,
};

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const { isGlobalAdminUser, isCampusAdminUser, adminModeOn, setAdminModeOn } = useAdminMode();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-neutral-300">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-neutral-200">
        <p>You must sign in to access settings.</p>
      </div>
    );
  }

  const showAdminModeToggle = isGlobalAdminUser || isCampusAdminUser;

  return (
    <div className={ui.page}>
      {/* Header */}
      <div className="sticky top-0 z-40 -mx-4 px-4 md:-mx-8 md:px-8 pt-4 pb-12 pointer-events-none transition-all duration-300">
        {/* Background Blur Layer */}
        <div className="absolute inset-0 backdrop-blur-3xl bg-background/90 [mask-image:linear-gradient(to_bottom,black_0%,black_20%,transparent_100%)]" />

        <div className="relative flex items-center pointer-events-auto">
          <div className="flex items-center rounded-full cc-glass-strong ml-0 pl-4 pr-6 py-2.5 border cc-header-item-stroke">
            <h1 className={ui.headerTitle}>Settings</h1>
          </div>
        </div>
      </div>

      {/* Admin Mode Toggle */}
      {showAdminModeToggle && (
        <section className={ui.section}>
          <div className={ui.capsuleCard}>
            <div className={`${ui.row} !rounded-full`} onClick={() => setAdminModeOn(!adminModeOn)}>
              <div className={`${ui.iconBox} bg-gradient-to-br from-gray-500 to-gray-600`}>
                <CommandLineIcon className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-normal text-foreground">Admin Mode</p>
                <p className="text-[11px] cc-muted">Enable advanced features</p>
              </div>
              <div className={ui.toggleTrack(adminModeOn)}>
                <div className={ui.toggleThumb(adminModeOn)} />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Account Section */}
      <section className={ui.section}>
        <h2 className={ui.sectionLabel}>Account</h2>
        <div className={ui.card}>
          <Link
            href="/profile"
            className={`${ui.row} ${ui.rowBorder}`}
          >
            <div className={`${ui.iconBox} bg-gradient-to-br from-blue-500 to-blue-600`}>
              <UserCircleIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-normal text-foreground">Profile</p>
            </div>
            <ChevronRightIcon className={ui.chevron} />
          </Link>
          <Link
            href="/profile/setup"
            className={`${ui.row} ${ui.rowBorder}`}
          >
            <div className={`${ui.iconBox} bg-gradient-to-br from-purple-500 to-purple-600`}>
              <UserIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-normal text-foreground">Complete Profile</p>
            </div>
            <ChevronRightIcon className={ui.chevron} />
          </Link>

        </div>
      </section>

      {/* Clubs Section */}
      <section className={ui.section}>
        <h2 className={ui.sectionLabel}>Clubs</h2>
        <div className={ui.card}>
          <Link
            href="/clubs"
            className={`${ui.row} ${ui.rowBorder}`}
          >
            <div className={`${ui.iconBox} bg-gradient-to-br from-violet-500 to-violet-600`}>
              <UserGroupIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-normal text-foreground">Browse Clubs</p>
            </div>
            <ChevronRightIcon className={ui.chevron} />
          </Link>
          <Link
            href="/clubs/create"
            className={ui.row}
          >
            <div className={`${ui.iconBox} bg-gradient-to-br from-fuchsia-500 to-fuchsia-600`}>
              <PlusIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-normal text-foreground">Create Club</p>
            </div>
            <ChevronRightIcon className={ui.chevron} />
          </Link>
        </div>
      </section>

      {/* Admin Tools Section */}
      {showAdminModeToggle && (
        <section className={ui.section}>
          <h2 className={ui.sectionLabel}>Admin Tools</h2>
          <div className={ui.card}>
            <Link
              href="/admin/campuses/create"
              className={`${ui.row} ${ui.rowBorder}`}
            >
              <div className={`${ui.iconBox} bg-gradient-to-br from-green-500 to-green-600`}>
                <BuildingLibraryIcon className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-normal text-foreground">Create Campus</p>
              </div>
              <ChevronRightIcon className={ui.chevron} />
            </Link>
            {user?.email === "YOUR_APP_ADMIN_EMAIL" && (
              <Link
                href="/admin/campuses"
                className={`${ui.row} ${ui.rowBorder}`}
              >
                <div className={`${ui.iconBox} bg-gradient-to-br from-rose-500 to-rose-600`}>
                  <BuildingLibraryIcon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-[15px] font-normal text-foreground">Edit All Campuses</p>
                </div>
                <ChevronRightIcon className={ui.chevron} />
              </Link>
            )}
            {user?.email && (
              <Link
                href="/admin/campuses/manage-my"
                className={`${ui.row} ${ui.rowBorder}`}
              >
                <div className={`${ui.iconBox} bg-gradient-to-br from-amber-500 to-amber-600`}>
                  <PencilSquareIcon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-[15px] font-normal text-foreground">Edit My Campus</p>
                </div>
                <ChevronRightIcon className={ui.chevron} />
              </Link>
            )}
            <Link
              href="/admin/stats"
              className={ui.row}
            >
              <div className={`${ui.iconBox} bg-gradient-to-br from-blue-500 to-blue-600`}>
                <ChartBarIcon className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-normal text-foreground">Campus Stats</p>
              </div>
              <ChevronRightIcon className={ui.chevron} />
            </Link>
          </div>
        </section>
      )}

      {/* Preferences Section */}
      <section className={ui.section}>
        <h2 className={ui.sectionLabel}>Preferences</h2>
        <div className={ui.card}>
          <Link
            href="/settings/notifications"
            className={`${ui.row} ${ui.rowBorder}`}
          >
            <div className={`${ui.iconBox} bg-gradient-to-br from-red-500 to-red-600`}>
              <BellIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-normal text-foreground">Notifications</p>
            </div>
            <ChevronRightIcon className={ui.chevron} />
          </Link>
          <Link
            href="/settings/display"
            className={`${ui.row} ${ui.rowBorder}`}
          >
            <div className={`${ui.iconBox} bg-gradient-to-br from-pink-500 to-pink-600`}>
              <SwatchIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-normal text-foreground">Display</p>
            </div>
            <ChevronRightIcon className={ui.chevron} />
          </Link>
          <div className={ui.row}>
            <div className={`${ui.iconBox} bg-gradient-to-br from-indigo-500 to-indigo-600`}>
              <LanguageIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-normal text-foreground">Language</p>
            </div>
            <div className="text-sm cc-muted">English</div>
          </div>
        </div>
      </section>

      {/* Privacy & Security Section */}
      <section className={ui.section}>
        <h2 className={ui.sectionLabel}>Privacy & Security</h2>
        <div className={ui.card}>
          <div className={`${ui.row} ${ui.rowBorder}`}>
            <div className={`${ui.iconBox} bg-gradient-to-br from-orange-500 to-orange-600`}>
              <ShieldCheckIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-normal text-foreground">Blocked Users</p>
            </div>
            <ChevronRightIcon className={ui.chevron} />
          </div>
          <div className={`${ui.row} ${ui.rowBorder}`}>
            <div className={`${ui.iconBox} bg-gradient-to-br from-teal-500 to-teal-600`}>
              <LockClosedIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-normal text-foreground">Privacy Settings</p>
            </div>
            <div className="text-sm cc-muted">Coming soon</div>
          </div>
          <div className={ui.row}>
            <div className={`${ui.iconBox} bg-gradient-to-br from-cyan-500 to-cyan-600`}>
              <ServerIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-normal text-foreground">Data & Storage</p>
            </div>
            <div className="text-sm cc-muted">Coming soon</div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className={ui.section}>
        <h2 className={ui.sectionLabel}>About</h2>
        <div className={ui.card}>
          <Link
            href="/settings/help-support"
            className={`${ui.row} ${ui.rowBorder}`}
          >
            <div className={`${ui.iconBox} bg-gradient-to-br from-emerald-500 to-emerald-600`}>
              <QuestionMarkCircleIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-normal text-foreground">Help & Support</p>
            </div>
            <ChevronRightIcon className={ui.chevron} />
          </Link>
          <Link
            href="/settings/help-support/tickets"
            className={`${ui.row} ${ui.rowBorder}`}
          >
            <div className={`${ui.iconBox} bg-gradient-to-br from-blue-500 to-blue-600`}>
              <ChatBubbleLeftRightIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-normal text-foreground">My Support Tickets</p>
            </div>
            <ChevronRightIcon className={ui.chevron} />
          </Link>
          <button
            onClick={() => {
              window.scrollTo(0, 0);
              document.documentElement.scrollTop = 0;
              document.body.scrollTop = 0;
              window.location.href = '/settings/guidelines';
            }}
            className={`${ui.row} ${ui.rowBorder} w-full text-left cursor-pointer`}
          >
            <div className={`${ui.iconBox} bg-gradient-to-br from-indigo-500 to-indigo-600`}>
              <ShieldCheckIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-normal text-foreground">Community Guidelines</p>
            </div>
            <ChevronRightIcon className={ui.chevron} />
          </button>
          <Link
            href="/settings/terms-policies"
            className={`${ui.row} ${ui.rowBorder}`}
          >
            <div className={`${ui.iconBox} bg-gradient-to-br from-lime-500 to-lime-600`}>
              <DocumentTextIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-normal text-foreground">Terms & Policies</p>
            </div>
            <ChevronRightIcon className={ui.chevron} />
          </Link>
          <div className={ui.row}>
            <div className={`${ui.iconBox} bg-gradient-to-br from-sky-500 to-sky-600`}>
              <InformationCircleIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-normal text-foreground">Version</p>
            </div>
            <div className="text-sm cc-muted">1.0.0</div>
          </div>
        </div>
      </section>

      {/* Danger Zone Section */}
      <section className={ui.section}>
        <h2 className={ui.sectionLabel}>Danger Zone</h2>
        <div className={ui.card}>
          <button
            onClick={() => auth.signOut()}
            className={`${ui.row} ${ui.rowBorder} w-full`}
          >
            <div className={`${ui.iconBox} bg-gradient-to-br from-red-500 to-red-600`}>
              <ArrowRightOnRectangleIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-[15px] font-normal text-red-400">Sign Out</p>
            </div>
          </button>
          <Link
            href="/settings/delete-account"
            className={`${ui.row} w-full`}
          >
            <div className={`${ui.iconBox} bg-gradient-to-br from-red-600 to-red-700`}>
              <XMarkIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-normal text-red-500">Delete Account</p>
            </div>
            <ChevronRightIcon className={ui.chevron} />
          </Link>
        </div>
      </section>

      <div className="pb-8" />

      {/* Footer */}
      <SettingsFooter />
    </div>
  );
}