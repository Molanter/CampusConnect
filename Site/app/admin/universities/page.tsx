"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";
import Toast, { ToastData } from "@/components/Toast";

// Global admin emails are loaded from Firestore:
// collection "config", doc "admin", field "globalAdminEmails": string[]
function isGlobalAdmin(email?: string | null, admins?: string[] | null) {
  if (!email || !admins) return false;
  return admins.includes(email.toLowerCase());
}

type LocationInput = { id: string; name: string };

type University = {
  id: string;
  name: string;
  shortName?: string | null;
  locations: LocationInput[];
  isActive: boolean;
  adminEmails?: string[];
  primaryColor?: string | null;
  secondaryColor?: string | null;
  themeColor?: string | null;
};

export default function UniversitiesListAdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [globalAdminEmails, setGlobalAdminEmails] = useState<string[] | null>(
    null
  );
  const [adminConfigLoading, setAdminConfigLoading] = useState(true);

  const [universities, setUniversities] = useState<University[]>([]);
  const [loadingUniversities, setLoadingUniversities] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);

  const [search, setSearch] = useState("");

  // ---- Auth guard ----
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // ---- Load global admin emails ----
  useEffect(() => {
    const loadAdminConfig = async () => {
      try {
        const ref = doc(db, "config", "admin");
        const snap = await getDoc(ref);
        const data = snap.data() as any;
        const emails: string[] = data?.globalAdminEmails ?? [];
        setGlobalAdminEmails(emails.map((e) => e.toLowerCase()));
      } catch (err) {
        console.error("Error loading admin config:", err);
        setGlobalAdminEmails([]);
      } finally {
        setAdminConfigLoading(false);
      }
    };
    void loadAdminConfig();
  }, []);

  const userIsGlobalAdmin = useMemo(
    () => isGlobalAdmin(user?.email, globalAdminEmails),
    [user?.email, globalAdminEmails]
  );

  // ---- Load universities ----
  const loadUniversities = async () => {
    setLoadingUniversities(true);
    setLoadError(null);
    try {
      const q = query(collection(db, "universities"), orderBy("name", "asc"));
      const snap = await getDocs(q);
      const items: University[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: data.name,
          shortName: data.shortName ?? null,
          locations: data.locations ?? [],
          isActive: data.isActive ?? true,
          adminEmails: data.adminEmails ?? [],
          primaryColor: data.primaryColor ?? data.themeColor ?? null,
          secondaryColor: data.secondaryColor ?? null,
          themeColor: data.themeColor ?? null,
        };
      });
      setUniversities(items);
    } catch (err) {
      console.error("Error loading universities:", err);
      setLoadError("Failed to load universities.");
    } finally {
      setLoadingUniversities(false);
    }
  };

  useEffect(() => {
    void loadUniversities();
  }, []);

  const filteredUniversities = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return universities;
    return universities.filter((u) => {
      const name = u.name?.toLowerCase() ?? "";
      const short = u.shortName?.toLowerCase() ?? "";
      return name.includes(term) || short.includes(term);
    });
  }, [universities, search]);

  // ---- Guards ----
  if (authLoading || adminConfigLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-neutral-400">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-neutral-200">
        <p>You must sign in to access the admin area.</p>
      </div>
    );
  }

  if (!userIsGlobalAdmin) {
    return (
      <div className="flex h-screen items-center justify-center text-red-300">
        You are not authorized to view this admin page.
      </div>
    );
  }

  // ---- UI ----
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-6 text-xs text-neutral-100">
      <Toast toast={toast} onClear={() => setToast(null)} />

      <header className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-400">
            Admin
          </p>
          <h1 className="mt-1 text-lg font-semibold tracking-tight text-neutral-50">
            Universities
          </h1>
          <p className="mt-1 text-[11px] text-neutral-400">
            Search and pick a university to edit.
          </p>
        </div>
        <div className="text-right text-[11px] text-neutral-400">
          <p className="truncate max-w-[200px]">{user.email}</p>
          <p className="mt-0.5 text-emerald-300">Global admin</p>
        </div>
      </header>

      {/* Search */}
      <div className="mt-4 flex flex-col gap-1">
        <label className="text-[11px] text-neutral-300">
          Search universities
        </label>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Type name or short name…"
          className="w-full rounded-xl border border-white/15 bg-transparent px-3 py-2 text-xs text-neutral-50 outline-none placeholder:text-neutral-500 focus:border-emerald-300"
        />
      </div>

      {/* List */}
      <section className="mt-4 rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
            Universities
          </h2>
          {loadingUniversities && (
            <span className="text-[10px] text-neutral-400">Loading…</span>
          )}
        </div>

        {loadError && (
          <p className="px-4 pb-3 pt-2 text-xs text-red-300">{loadError}</p>
        )}

        {!loadingUniversities &&
          filteredUniversities.length === 0 &&
          !loadError && (
            <p className="px-4 py-3 text-[11px] text-neutral-400">
              No universities match your search.
            </p>
          )}

        <div className="divide-y divide-white/10">
          {filteredUniversities.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between px-4 py-3 text-xs active:bg-white/10"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-neutral-50">
                  {u.name}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  {u.shortName && (
                    <span className="text-[10px] text-neutral-400">
                      {u.shortName}
                    </span>
                  )}
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-[10px] " +
                      (u.isActive
                        ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        : "border border-neutral-600/60 bg-neutral-800/60 text-neutral-200")
                    }
                  >
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>

              <Link
                href={`/admin/universities/${u.id}`}
                className="ml-3 shrink-0 rounded-full border border-neutral-500/60 px-3 py-1 text-[11px] font-medium text-neutral-100 hover:border-neutral-300 hover:bg-white/5"
              >
                Edit
              </Link>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}