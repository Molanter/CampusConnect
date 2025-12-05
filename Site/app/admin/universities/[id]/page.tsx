"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  addDoc,
} from "firebase/firestore/lite";
import { auth, db } from "../../../../lib/firebase";
import Toast, { ToastData } from "@/components/Toast";

function isGlobalAdmin(email?: string | null, admins?: string[] | null) {
  if (!email || !admins) return false;
  return admins.includes(email.toLowerCase());
}

type LocationInput = { id: string; name: string };

type Dorm = {
  id: string;
  name: string;
  locationId?: string;
};

export default function EditUniversityAdminPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const universityId = params?.id;

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [globalAdminEmails, setGlobalAdminEmails] = useState<string[] | null>(
    null
  );
  const [adminConfigLoading, setAdminConfigLoading] = useState(true);

  const [universityName, setUniversityName] = useState("");
  const [shortName, setShortName] = useState("");
  const [locations, setLocations] = useState<LocationInput[]>([]);
  const [adminEmailsText, setAdminEmailsText] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [primaryColor, setPrimaryColor] = useState("#22D3EE");
  const [secondaryColor, setSecondaryColor] = useState("#38BDF8");

  const [dormsText, setDormsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingSelected, setLoadingSelected] = useState(true);
  const [toast, setToast] = useState<ToastData | null>(null);

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

  // ---- Load selected university + dorms ----
  useEffect(() => {
    const loadSelected = async () => {
      if (!universityId) return;
      setLoadingSelected(true);
      try {
        const uniRef = doc(db, "universities", universityId);
        const uniSnap = await getDoc(uniRef);
        const data = uniSnap.data() as any;
        if (!data) {
          setToast({ type: "error", message: "University not found." });
          return;
        }

        setUniversityName(data.name ?? "");
        setShortName(data.shortName ?? "");
        const locs: LocationInput[] = data.locations ?? [];
        setLocations(locs.length ? locs : [{ id: "main", name: "Main campus" }]);
        setIsActive(data.isActive ?? true);
        const adminEmailsArr: string[] = data.adminEmails ?? [];
        setAdminEmailsText(adminEmailsArr.join("\n"));

        // colors
        const primaryFromData: string =
          data.primaryColor ?? data.themeColor ?? "#22D3EE";
        const secondaryFromData: string = data.secondaryColor ?? "#38BDF8";
        setPrimaryColor(primaryFromData);
        setSecondaryColor(secondaryFromData);

        // dorms
        const dormSnap = await getDocs(
          collection(db, "universities", universityId, "dorms")
        );
        const dormItems = dormSnap.docs.map((d) => {
          const dd = d.data() as any;
          return dd.name as string;
        });
        setDormsText(dormItems.join("\n"));
      } catch (err) {
        console.error("Error loading university:", err);
        setToast({ type: "error", message: "Failed to load university." });
      } finally {
        setLoadingSelected(false);
      }
    };

    void loadSelected();
  }, [universityId]);

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

  // ---- Save changes ----
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userIsGlobalAdmin || !universityId) return;

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

      const uniRef = doc(db, "universities", universityId);

      await updateDoc(uniRef, {
        name: universityName.trim(),
        shortName: shortName.trim() || null,
        locations: cleanedLocations,
        isActive,
        adminEmails,
        primaryColor: primaryColor || null,
        secondaryColor: secondaryColor || null,
        themeColor: primaryColor || null,
      });

      // Replace dorms
      const dormsCol = collection(db, "universities", universityId, "dorms");
      const existingDormSnap = await getDocs(dormsCol);
      for (const d of existingDormSnap.docs) {
        await deleteDoc(doc(db, "universities", universityId, "dorms", d.id));
      }

      const dormNames = dormsText
        .split("\n")
        .map((d) => d.trim())
        .filter(Boolean);

      const defaultLocationId =
        cleanedLocations.find((l) => l.id)?.id || "main";

      for (const name of dormNames) {
        await addDoc(dormsCol, {
          name,
          locationId: defaultLocationId,
        });
      }

      setToast({ type: "success", message: "University updated." });
    } catch (err) {
      console.error("Error updating university:", err);
      setToast({ type: "error", message: "Failed to update university." });
    } finally {
      setSaving(false);
    }
  };

  // ---- Guards ----
  if (authLoading || adminConfigLoading || !universityId) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-300">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-slate-200">
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
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-8 text-slate-100 text-xs">
      <Toast toast={toast} onClear={() => setToast(null)} />

      <header className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
            Admin
          </p>
          <h1 className="mt-1 text-lg font-semibold tracking-tight">
            Edit university
          </h1>
          <p className="mt-1 text-[11px] text-slate-400">
            Update names, locations, colors, dorms, and admin emails.
          </p>
        </div>
        <div className="text-right text-[11px] text-slate-400">
          <p className="truncate max-w-[200px]">{user.email}</p>
          <p className="mt-0.5 text-primary">Global admin</p>
          <button
            type="button"
            onClick={() => router.push("/admin/universities")}
            className="mt-2 inline-flex items-center justify-center rounded-full border border-white/20 px-3 py-1 text-[11px] text-slate-100 hover:bg-white/5"
          >
            Back to list
          </button>
        </div>
      </header>

      <form
        onSubmit={handleSave}
        className="mt-2 grid gap-4 md:grid-cols-3 rounded-2xl border border-white/10 p-5"
      >
        {loadingSelected && (
          <p className="md:col-span-3 text-[11px] text-slate-400">
            Loading university details…
          </p>
        )}

        <label className="flex flex-col gap-1 text-xs md:col-span-2">
          <span className="text-[11px] text-slate-200">University name</span>
          <input
            value={universityName}
            onChange={(e) => setUniversityName(e.target.value)}
            required
            className="rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-xs text-slate-50 outline-none placeholder:text-slate-500 focus:border-primary"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="text-[11px] text-slate-200">Short name</span>
          <input
            value={shortName}
            onChange={(e) => setShortName(e.target.value)}
            className="rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-xs text-slate-50 outline-none placeholder:text-slate-500 focus:border-primary"
          />
        </label>

        {/* Locations */}
        <div className="md:col-span-3">
          <p className="text-xs font-medium text-slate-100">Locations</p>
          <p className="mt-1 text-[11px] text-slate-400">
            Each location has an ID (used in data) and a display name.
          </p>
          <div className="mt-2 space-y-2">
            {locations.map((loc, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  type="text"
                  value={loc.id}
                  onChange={(e) =>
                    handleLocationChange(idx, "id", e.target.value)
                  }
                  className="flex-1 rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-xs text-slate-50 outline-none placeholder:text-slate-500 focus:border-primary"
                  placeholder="ID (e.g. mpls)"
                />
                <input
                  type="text"
                  value={loc.name}
                  onChange={(e) =>
                    handleLocationChange(idx, "name", e.target.value)
                  }
                  className="flex-[2] rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-xs text-slate-50 outline-none placeholder:text-slate-500 focus:border-primary"
                  placeholder="Name (e.g. Minneapolis)"
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleAddLocationRow}
            className="mt-2 inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] text-slate-100 transition hover:border-white/40 hover:bg-white/10"
          >
            + Add location
          </button>
        </div>

        {/* Dorms */}
        <label className="flex flex-col gap-1 text-xs md:col-span-2">
          <span className="text-[11px] text-slate-200">Dorms</span>
          <p className="text-[11px] text-slate-400">
            One dorm per line. They will be attached to the first location by
            default.
          </p>
          <textarea
            rows={6}
            value={dormsText}
            onChange={(e) => setDormsText(e.target.value)}
            className="mt-1 rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-xs text-slate-50 outline-none placeholder:text-slate-500 focus:border-primary"
          />
        </label>

        {/* Admin emails */}
        <label className="flex flex-col gap-1 text-xs md:col-span-1">
          <span className="text-[11px] text-slate-200">
            Admin emails for this university
          </span>
          <p className="text-[11px] text-slate-400">One email per line.</p>
          <textarea
            rows={6}
            value={adminEmailsText}
            onChange={(e) => setAdminEmailsText(e.target.value)}
            className="mt-1 rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-xs text-slate-50 outline-none placeholder:text-slate-500 focus:border-primary"
          />
        </label>

        {/* Primary / Secondary colors */}
        <div className="md:col-span-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-[11px] text-slate-200">Primary color</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-7 w-7 cursor-pointer rounded-md border border-white/20 bg-transparent p-0"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="flex-1 rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-xs text-slate-50 outline-none placeholder:text-slate-500 focus:border-primary"
                placeholder="#22D3EE"
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Main accent used for this university.
            </p>
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <span className="text-[11px] text-slate-200">Secondary color</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="h-7 w-7 cursor-pointer rounded-md border border-white/20 bg-transparent p-0"
              />
              <input
                type="text"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="flex-1 rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-xs text-slate-50 outline-none placeholder:text-slate-500 focus:border-primary"
                placeholder="#38BDF8"
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Used for secondary accents, hover states, etc.
            </p>
          </label>
        </div>

        {/* Active toggle + Save */}
        <div className="mt-2 flex items-center justify-between md:col-span-3">
          <label className="flex items-center gap-2 text-[11px] text-slate-200">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <span>University is active</span>
          </label>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-1.5 text-[11px] font-medium text-black shadow hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}