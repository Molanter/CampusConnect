"use client";

import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  query,
  orderBy,
  updateDoc,
} from "firebase/firestore/lite";
import { auth, db } from "../../../../lib/firebase";
import Toast, { ToastData } from "@/components/Toast";

// Global admin emails are loaded from Firestore:
// collection "config", doc "admin", field "globalAdminEmails": string[]
function isGlobalAdmin(
  email?: string | null,
  admins?: string[] | null
) {
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
  // New color fields
  primaryColor?: string | null;
  secondaryColor?: string | null;
  // For backwards compatibility if themeColor already exists in data
  themeColor?: string | null;
};

export default function AdminUniversitiesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [globalAdminEmails, setGlobalAdminEmails] = useState<string[] | null>(null);
  const [adminConfigLoading, setAdminConfigLoading] = useState(true);

  // Form state
  const [universityName, setUniversityName] = useState("");
  const [shortName, setShortName] = useState("");
  const [locations, setLocations] = useState<LocationInput[]>([
    { id: "main", name: "Main Campus" },
  ]);
  const [dormsText, setDormsText] = useState(""); // one dorm per line
  const [adminEmailsText, setAdminEmailsText] = useState(""); // one email per line

  // Primary/secondary colors for a new university
  const [primaryColor, setPrimaryColor] = useState("#22D3EE");   // main app accent
  const [secondaryColor, setSecondaryColor] = useState("#38BDF8"); // slightly different by default

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);

  // Existing universities list
  const [universities, setUniversities] = useState<University[]>([]);
  const [loadingUniversities, setLoadingUniversities] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ---- Auth guard ----
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // ---- Load global admin emails from Firestore ----
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

  // ---- Load universities ----
  const loadUniversities = async () => {
    setLoadingUniversities(true);
    setLoadError(null);
    try {
      const q = query(collection(db, "universities"), orderBy("name", "asc"));
      const snap = await getDocs(q);
      const items: University[] = snap.docs.map((d) => {
        const data = d.data() as any;
        const primaryFromData: string | null =
          data.primaryColor ?? data.themeColor ?? null;
        return {
          id: d.id,
          name: data.name,
          shortName: data.shortName ?? null,
          locations: data.locations ?? [],
          isActive: data.isActive ?? true,
          adminEmails: data.adminEmails ?? [],
          primaryColor: primaryFromData,
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

  // ---- Form helpers ----
  const handleAddLocationRow = () => {
    setLocations((prev) => [...prev, { id: "", name: "" }]);
  };

  const handleLocationChange = (
    index: number,
    field: "id" | "name",
    value: string
  ) => {
    setLocations((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleUpdateColor = async (
    universityId: string,
    kind: "primaryColor" | "secondaryColor",
    color: string
  ) => {
    if (!user || !isGlobalAdmin(user.email, globalAdminEmails)) return;

    try {
      await updateDoc(doc(db, "universities", universityId), {
        [kind]: color,
        // keep themeColor in sync with primary for backwards-compat
        ...(kind === "primaryColor" ? { themeColor: color } : {}),
      });

      setUniversities((prev) =>
        prev.map((u) =>
          u.id === universityId ? { ...u, [kind]: color, ...(kind === "primaryColor" ? { themeColor: color } : {}) } : u
        )
      );
    } catch (err) {
      console.error("Error updating university color:", err);
      setToast({ type: "error", message: "Failed to update university colors." });
    }
  };

  // ---- Submit handler ----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isGlobalAdmin(user.email, globalAdminEmails)) return;

    setSaving(true);

    try {
      const cleanedLocations = locations
        .filter((l) => l.id.trim() && l.name.trim())
        .map((l) => ({
          id: l.id.trim(),
          name: l.name.trim(),
        }));

      const adminEmails = adminEmailsText
        .split("\n")
        .map((line) => line.trim().toLowerCase())
        .filter(Boolean);

      // 1) Create university document
      const uniRef = await addDoc(collection(db, "universities"), {
        name: universityName.trim(),
        shortName: shortName.trim() || null,
        locations: cleanedLocations,
        isActive: true,
        adminEmails,
        primaryColor: primaryColor || null,
        secondaryColor: secondaryColor || null,
        // also store themeColor as primary for backwards compatibility
        themeColor: primaryColor || null,
      });

      // 2) Create dorms under /universities/{id}/dorms
      const dormNames = dormsText
        .split("\n")
        .map((d) => d.trim())
        .filter(Boolean);

      const defaultLocationId =
        cleanedLocations.find((l) => l.id)?.id || "main";

      for (const dormName of dormNames) {
        await addDoc(
          collection(db, "universities", uniRef.id, "dorms"),
          {
            name: dormName,
            locationId: defaultLocationId,
          }
        );
      }

      // Reset form
      setUniversityName("");
      setShortName("");
      setLocations([{ id: "main", name: "Main Campus" }]);
      setDormsText("");
      setAdminEmailsText("");
      setPrimaryColor("#22D3EE");
      setSecondaryColor("#38BDF8");

      // Reload list
      await loadUniversities();

      setToast({ type: "success", message: "University and dorms saved." });
    } catch (err) {
      console.error("Error saving university:", err);
      setToast({ type: "error", message: "Failed to save university." });
    } finally {
      setSaving(false);
    }
  };

  // ---- Render guards ----
  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-neutral-300">
        Checking access…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-neutral-200">
        <p className="text-sm">You must sign in to access the admin area.</p>
      </div>
    );
  }

  if (adminConfigLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-neutral-300">
        Loading admin configuration…
      </div>
    );
  }

  if (!isGlobalAdmin(user.email, globalAdminEmails)) {
    return (
      <div className="flex h-screen items-center justify-center text-neutral-300">
        You are not authorized to view this admin page.
      </div>
    );
  }

  // ---- Main UI ----
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8">
      <Toast toast={toast} onClear={() => setToast(null)} />
      <header className="mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
          Admin
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
          Universities
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          Create and manage universities, locations, dorms, and admin emails
        </p>
      </header>

      {/* Create / edit form */}
      <section className="space-y-3">
        <h2 className="px-4 text-[13px] font-semibold uppercase tracking-wider text-neutral-500">
          Add New University
        </h2>

        <form
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-2xl bg-[#1C1C1E] p-5 space-y-5"
        >
          <div className="space-y-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-white">University Name</span>
              <input
                value={universityName}
                onChange={(e) => setUniversityName(e.target.value)}
                required
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-white/20 focus:bg-white/10 transition-colors"
                placeholder="University of Minnesota"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-white">Short Name <span className="text-neutral-500 font-normal">(optional)</span></span>
              <input
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-white/20 focus:bg-white/10 transition-colors"
                placeholder="UMN"
              />
            </label>

            {/* Locations */}
            <div>
              <p className="text-sm font-medium text-white">Locations</p>
              <p className="mt-1 text-xs text-neutral-400">
                Each location has an ID (used in data) and a display name
              </p>
              <div className="mt-3 space-y-2">
                {locations.map((loc, idx) => (
                  <div
                    key={idx}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={loc.id}
                      onChange={(e) =>
                        handleLocationChange(idx, "id", e.target.value)
                      }
                      className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-white/20 focus:bg-white/10 transition-colors"
                      placeholder="ID (e.g. mpls)"
                    />
                    <input
                      type="text"
                      value={loc.name}
                      onChange={(e) =>
                        handleLocationChange(idx, "name", e.target.value)
                      }
                      className="flex-[2] rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-white/20 focus:bg-white/10 transition-colors"
                      placeholder="Name (e.g. Minneapolis)"
                    />
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={handleAddLocationRow}
                className="mt-3 inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
              >
                + Add Location
              </button>
            </div>

            {/* Dorms */}
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-white">Dorms</span>
              <p className="text-xs text-neutral-400">
                One dorm per line. They will be attached to the first location by default
              </p>
              <textarea
                rows={5}
                value={dormsText}
                onChange={(e) => setDormsText(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-white/20 focus:bg-white/10 transition-colors resize-none"
                placeholder={"Pioneer Hall\nMiddlebrook Hall\nComstock Hall"}
              />
            </label>

            {/* Admin emails */}
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-white">Admin Emails</span>
              <p className="text-xs text-neutral-400">
                One email per line. These admins can manage this university
              </p>
              <textarea
                rows={4}
                value={adminEmailsText}
                onChange={(e) => setAdminEmailsText(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-white/20 focus:bg-white/10 transition-colors resize-none"
                placeholder={"admin1@school.edu\nadmin2@school.edu"}
              />
            </label>

            {/* Primary / Secondary colors */}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-white">Primary Color</span>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-12 w-12 cursor-pointer rounded-xl border border-white/20 bg-transparent"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-white/20 focus:bg-white/10 transition-colors font-mono"
                    placeholder="#22D3EE"
                  />
                </div>
                <p className="text-xs text-neutral-400">
                  Main accent used for this university
                </p>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-white">Secondary Color</span>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="h-12 w-12 cursor-pointer rounded-xl border border-white/20 bg-transparent"
                  />
                  <input
                    type="text"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-white/20 focus:bg-white/10 transition-colors font-mono"
                    placeholder="#38BDF8"
                  />
                </div>
                <p className="text-xs text-neutral-400">
                  Used for secondary accents and hover states
                </p>
              </label>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-amber-400 px-6 py-3.5 text-sm font-semibold text-black shadow-sm transition hover:bg-amber-300 disabled:opacity-60"
              >
                {saving ? "Creating University..." : "Create University"}
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* Existing universities list */}
      <section className="space-y-3 pb-8">
        <div className="flex items-center justify-between px-4">
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-neutral-500">
            Existing Universities
          </h2>
          {loadingUniversities && (
            <span className="text-xs text-neutral-500">
              Loading…
            </span>
          )}
        </div>
        {loadError && (
          <p className="px-4 text-sm text-red-400">{loadError}</p>
        )}
        {!loadingUniversities && universities.length === 0 && !loadError && (
          <p className="px-4 text-sm text-neutral-500">
            No universities created yet
          </p>
        )}
        <div className="overflow-hidden rounded-2xl bg-[#1C1C1E] divide-y divide-white/5">
          {universities.map((u) => (
            <div
              key={u.id}
              className="px-5 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-[15px] font-semibold text-white">
                    {u.name}
                    {u.shortName && (
                      <span className="ml-2 text-sm text-neutral-500">
                        ({u.shortName})
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500 font-mono">
                    {u.id}
                  </p>
                </div>
                <span
                  className={
                    "rounded-full px-3 py-1 text-xs font-medium " +
                    (u.isActive
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-neutral-700/80 text-neutral-400")
                  }
                >
                  {u.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              {/* Color swatches */}
              {(u.primaryColor || u.secondaryColor) && (
                <div className="mt-3 flex items-center gap-3">
                  {u.primaryColor && (
                    <div className="flex items-center gap-2">
                      <div
                        className="h-6 w-6 rounded-lg border border-white/20"
                        style={{ backgroundColor: u.primaryColor }}
                      />
                      <span className="text-xs text-neutral-400">Primary</span>
                    </div>
                  )}
                  {u.secondaryColor && (
                    <div className="flex items-center gap-2">
                      <div
                        className="h-6 w-6 rounded-lg border border-white/20"
                        style={{ backgroundColor: u.secondaryColor }}
                      />
                      <span className="text-xs text-neutral-400">Secondary</span>
                    </div>
                  )}
                </div>
              )}

              {/* Inline color editors */}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2">
                  <span className="text-xs text-neutral-400">Primary</span>
                  <input
                    type="color"
                    value={u.primaryColor ?? "#22D3EE"}
                    onChange={(e) =>
                      handleUpdateColor(u.id, "primaryColor", e.target.value)
                    }
                    className="h-8 w-8 cursor-pointer rounded-lg border border-white/20 bg-transparent"
                  />
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-xs text-neutral-400">Secondary</span>
                  <input
                    type="color"
                    value={u.secondaryColor ?? "#38BDF8"}
                    onChange={(e) =>
                      handleUpdateColor(u.id, "secondaryColor", e.target.value)
                    }
                    className="h-8 w-8 cursor-pointer rounded-lg border border-white/20 bg-transparent"
                  />
                </label>
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <p className="text-neutral-300">
                  <span className="font-medium text-white">Locations:</span>{" "}
                  {u.locations?.length
                    ? u.locations.map((l) => l.name).join(", ")
                    : "None"}
                </p>
                <p className="text-neutral-300">
                  <span className="font-medium text-white">Admins:</span>{" "}
                  {u.adminEmails && u.adminEmails.length
                    ? u.adminEmails.join(", ")
                    : "None"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}