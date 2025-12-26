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
  PlusIcon
} from "@heroicons/react/24/outline";

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

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

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
          Settings
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
          Settings
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          Manage your account, preferences, and more
        </p>
      </header>

      {/* Account Section */}
      <section className="space-y-3">
        <h2 className="px-4 text-[13px] font-semibold uppercase tracking-wider text-neutral-500">Account</h2>
        <div className="overflow-hidden rounded-2xl bg-[#1C1C1E]">
          <Link
            href="/profile"
            className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600">
              <UserCircleIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-normal text-white">Profile</p>
            </div>
            <ChevronRightIcon className="h-5 w-5 text-neutral-600" />
          </Link>
          <Link
            href="/profile/setup"
            className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-purple-600">
              <UserIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-normal text-white">Complete Profile</p>
            </div>
            <ChevronRightIcon className="h-5 w-5 text-neutral-600" />
          </Link>
        </div>
      </section>

      {/* Clubs Section */}
      <section className="space-y-3">
        <h2 className="px-4 text-[13px] font-semibold uppercase tracking-wider text-neutral-500">Clubs</h2>
        <div className="overflow-hidden rounded-2xl bg-[#1C1C1E]">
          <Link
            href="/clubs"
            className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-violet-600">
              <UserGroupIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-normal text-white">Browse Clubs</p>
            </div>
            <ChevronRightIcon className="h-5 w-5 text-neutral-600" />
          </Link>
          <Link
            href="/clubs/create"
            className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-fuchsia-600">
              <PlusIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-normal text-white">Create Club</p>
            </div>
            <ChevronRightIcon className="h-5 w-5 text-neutral-600" />
          </Link>
        </div>
      </section>

      {/* Preferences Section */}
      <section className="space-y-3">
        <h2 className="px-4 text-[13px] font-semibold uppercase tracking-wider text-neutral-500">Preferences</h2>
        <div className="overflow-hidden rounded-2xl bg-[#1C1C1E]">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-red-600">
              <BellIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-normal text-white">Notifications</p>
            </div>
            <div className="text-sm text-neutral-500">Coming soon</div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-pink-600">
              <SwatchIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-normal text-white">Display</p>
            </div>
            <div className="text-sm text-neutral-500">Coming soon</div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600">
              <LanguageIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-normal text-white">Language</p>
            </div>
            <div className="text-sm text-neutral-500">English</div>
          </div>
        </div>
      </section>

      {/* Privacy & Security Section */}
      <section className="space-y-3">
        <h2 className="px-4 text-[13px] font-semibold uppercase tracking-wider text-neutral-500">Privacy & Security</h2>
        <div className="overflow-hidden rounded-2xl bg-[#1C1C1E]">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-orange-600">
              <ShieldCheckIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-normal text-white">Blocked Users</p>
            </div>
            <ChevronRightIcon className="h-5 w-5 text-neutral-600" />
          </div>
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-teal-600">
              <LockClosedIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-normal text-white">Privacy Settings</p>
            </div>
            <div className="text-sm text-neutral-500">Coming soon</div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600">
              <ServerIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-normal text-white">Data & Storage</p>
            </div>
            <div className="text-sm text-neutral-500">Coming soon</div>
          </div>
        </div>
      </section>

      {/* Admin Tools Section */}
      <section className="space-y-3">
        <h2 className="px-4 text-[13px] font-semibold uppercase tracking-wider text-neutral-500">Admin Tools</h2>
        <div className="overflow-hidden rounded-2xl bg-[#1C1C1E]">
          <Link
            href="/admin/universities/create"
            className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-green-600">
              <BuildingLibraryIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-normal text-white">Create University</p>
            </div>
            <ChevronRightIcon className="h-5 w-5 text-neutral-600" />
          </Link>
          <Link
            href="/admin/universities"
            className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-yellow-500 to-yellow-600">
              <PencilSquareIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-normal text-white">Edit Universities</p>
            </div>
            <ChevronRightIcon className="h-5 w-5 text-neutral-600" />
          </Link>
          {user?.email === "YOUR_APP_ADMIN_EMAIL" && (
            <Link
              href="/admin/universities/edit-all"
              className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-rose-600">
                <BuildingLibraryIcon className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-normal text-white">Edit All Universities</p>
              </div>
              <ChevronRightIcon className="h-5 w-5 text-neutral-600" />
            </Link>
          )}
          {user?.email && (
            <Link
              href="/admin/universities/manage-my"
              className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-amber-600">
                <PencilSquareIcon className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-normal text-white">Edit My University</p>
              </div>
              <ChevronRightIcon className="h-5 w-5 text-neutral-600" />
            </Link>
          )}
        </div>
      </section>

      {/* About Section */}
      <section className="space-y-3">
        <h2 className="px-4 text-[13px] font-semibold uppercase tracking-wider text-neutral-500">About</h2>
        <div className="overflow-hidden rounded-2xl bg-[#1C1C1E]">
          <Link
            href="/help-support"
            className="flex items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600">
              <QuestionMarkCircleIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-normal text-white">Help & Support</p>
            </div>
            <ChevronRightIcon className="h-5 w-5 text-neutral-600" />
          </Link>
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-lime-500 to-lime-600">
              <DocumentTextIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-normal text-white">Terms & Policies</p>
            </div>
            <ChevronRightIcon className="h-5 w-5 text-neutral-600" />
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-sky-600">
              <InformationCircleIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-normal text-white">Version</p>
            </div>
            <div className="text-sm text-neutral-500">1.0.0</div>
          </div>
        </div>
      </section>

      {/* Sign Out Button */}
      <div className="pb-8">
        <div className="overflow-hidden rounded-2xl bg-[#1C1C1E]">
          <button
            onClick={() => auth.signOut()}
            className="flex w-full items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-red-600">
              <ArrowRightOnRectangleIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-[15px] font-normal text-red-400">Sign Out</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}