"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  orderBy,
  updateDoc,
  deleteDoc,
  addDoc,
} from "firebase/firestore";
import { auth, db } from "../../../../lib/firebase";
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
};

type Dorm = {
  id: string;
  name: string;
  locationId?: string;
};

export default function ManageMyUniversityPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [globalAdminEmails, setGlobalAdminEmails] = useState<string[] | null>(
    null
  );
  const [adminConfigLoading, setAdminConfigLoading] = useState(true);

  const [universities, setUniversities] = useState<University[]>([]);
  const [loadingUniversities, setLoadingUniversities] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedUniversityId, setSelectedUniversityId] = useState<string>("");

  // editable fields
  const [universityName, setUniversityName] = useState("");
  const [shortName, setShortName] = useState("");
  const [locations, setLocations] = useState<LocationInput[]>([]);
  const [adminEmailsText, setAdminEmailsText] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [dorms, setDorms] = useState<Dorm[]>([]);
  const [dormsText, setDormsText] = useState("");

  const [saving, setSaving] = useState(false);
  const [loadingSelected, setLoadingSelected] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);

  // ---- Auth ----
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

  const userEmailLower = useMemo(
    () => user?.email?.toLowerCase() ?? "",
    [user?.email]
  );

  // ---- Load universities and filter to "mine" ----
  useEffect(() => {
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
          };
        });

        // If global admin, they can see all; otherwise only those where they are an admin
        const allowed = userIsGlobalAdmin
          ? items
          : items.filter((u) =>
            (u.adminEmails ?? []).includes(userEmailLower)
          );

        setUniversities(allowed);

        if (!selectedUniversityId && allowed.length > 0) {
          setSelectedUniversityId(allowed[0].id);
        }
      } catch (err) {
        console.error("Error loading universities:", err);
        setLoadError("Failed to load universities.");
      } finally {
        setLoadingUniversities(false);
      }
    };

    if (user && !authLoading && !adminConfigLoading) {
      void loadUniversities();
    }
  }, [
    user,
    authLoading,
    adminConfigLoading,
    userIsGlobalAdmin,
    userEmailLower,
    selectedUniversityId,
  ]);

  // ---- Load selected university + dorms ----
  useEffect(() => {
    const loadSelected = async () => {
      if (!selectedUniversityId) return;
      setLoadingSelected(true);
      try {
        const uniRef = doc(db, "universities", selectedUniversityId);
        const uniSnap = await getDoc(uniRef);
        const data = uniSnap.data() as any;
        if (!data) return;

        setUniversityName(data.name ?? "");
        setShortName(data.shortName ?? "");
        const locs: LocationInput[] = data.locations ?? [];
        setLocations(locs.length ? locs : [{ id: "main", name: "Main campus" }]);
        setIsActive(data.isActive ?? true);
        const adminEmailsArr: string[] = data.adminEmails ?? [];
        setAdminEmailsText(adminEmailsArr.join("\n"));

        // dorms
        const dormSnap = await getDocs(
          collection(db, "universities", selectedUniversityId, "dorms")
        );
        const dormItems: Dorm[] = dormSnap.docs.map((d) => {
          const dd = d.data() as any;
          return {
            id: d.id,
            name: dd.name,
            locationId: dd.locationId,
          };
        });
        setDorms(dormItems);
        setDormsText(dormItems.map((d) => d.name).join("\n"));
      } catch (err) {
        console.error("Error loading selected university:", err);
      } finally {
        setLoadingSelected(false);
      }
    };

    void loadSelected();
  }, [selectedUniversityId]);


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
    if (!user || !selectedUniversityId) return;

    // University-level admins can only edit universities they belong to
    const canEdit =
      userIsGlobalAdmin ||
      universities.some(
        (u) =>
          u.id === selectedUniversityId &&
          (u.adminEmails ?? []).includes(userEmailLower)
      );

    if (!canEdit) return;

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

      const uniRef = doc(db, "universities", selectedUniversityId);

      await updateDoc(uniRef, {
        name: universityName.trim(),
        shortName: shortName.trim() || null,
        locations: cleanedLocations,
        isActive, // you can remove this line if non-global admins shouldn't toggle it
        adminEmails,
      });

      // Replace dorms with new list
      const dormsCol = collection(db, "universities", selectedUniversityId, "dorms");
      const existingDormSnap = await getDocs(dormsCol);
      for (const d of existingDormSnap.docs) {
        await deleteDoc(doc(db, "universities", selectedUniversityId, "dorms", d.id));
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
  if (authLoading || adminConfigLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-300">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-slate-200">
        <p>You must sign in to access this page.</p>
      </div>
    );
  }

  if (!loadingUniversities && universities.length === 0 && !userIsGlobalAdmin) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-slate-200">
        <p className="text-sm">
          Your email is not listed as an admin for any university.
        </p>
      </div>
    );
  }

  // ---- UI ----
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-8 text-slate-100">
      <Toast toast={toast} onClear={() => setToast(null)} />
      <header className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
            Admin
          </p>
          <h1 className="mt-1 text-lg font-semibold tracking-tight">
            Edit my university
          </h1>
          <p className="mt-1 text-[11px] text-slate-400">
            Update locations, dorms, and admin emails for the university you
            administer.
          </p>
        </div>
        <div className="text-right text-[11px] text-slate-400">
          <p>{user.email}</p>
          {userIsGlobalAdmin && (
            <p className="text-emerald-300">Global admin</p>
          )}
        </div>
      </header>

      {/* Selector if multiple universities */}
      {universities.length > 1 && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">University:</span>
          <select
            value={selectedUniversityId}
            onChange={(e) => setSelectedUniversityId(e.target.value)}
            className="rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-xs outline-none focus:border-emerald-300"
          >
            {universities.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
                {u.shortName ? ` (${u.shortName})` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {!selectedUniversityId ? (
        <p className="text-xs text-slate-400">
          No university found for your admin email.
        </p>
      ) : (
        <form onSubmit={handleSave} className="mt-2 grid gap-4 md:grid-cols-3">
          {loadingSelected && (
            <p className="md:col-span-3 text-[11px] text-slate-400">
              Loading university details…
            </p>
          )}

          <label className="flex flex-col gap-1 text-xs md:col-span-2">
            <span>University name</span>
            <input
              value={universityName}
              onChange={(e) => setUniversityName(e.target.value)}
              required
              className="rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-xs outline-none placeholder:text-slate-500 focus:border-emerald-300"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <span>Short name</span>
            <input
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              className="rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-xs outline-none placeholder:text-slate-500 focus:border-emerald-300"
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
                    className="flex-1 rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-xs outline-none placeholder:text-slate-500 focus:border-emerald-300"
                    placeholder="ID (e.g. mpls)"
                  />
                  <input
                    type="text"
                    value={loc.name}
                    onChange={(e) =>
                      handleLocationChange(idx, "name", e.target.value)
                    }
                    className="flex-[2] rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-xs outline-none placeholder:text-slate-500 focus:border-emerald-300"
                    placeholder="Name (e.g. Minneapolis)"
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleAddLocationRow}
              className="mt-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] text-slate-100 hover:border-white/40 hover:bg-white/10 transition"
            >
              + Add location
            </button>
          </div>

          {/* Dorms */}
          <label className="flex flex-col gap-1 text-xs md:col-span-2">
            <span>Dorms</span>
            <p className="text-[11px] text-slate-400">
              One dorm per line. They will be attached to the first location by
              default.
            </p>
            <textarea
              rows={6}
              value={dormsText}
              onChange={(e) => setDormsText(e.target.value)}
              className="mt-1 rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-xs outline-none placeholder:text-slate-500 focus:border-emerald-300"
            />
          </label>

          {/* Admin emails */}
          <label className="flex flex-col gap-1 text-xs md:col-span-1">
            <span>Admin emails for this university</span>
            <p className="text-[11px] text-slate-400">
              One email per line.
            </p>
            <textarea
              rows={6}
              value={adminEmailsText}
              onChange={(e) => setAdminEmailsText(e.target.value)}
              className="mt-1 rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-xs outline-none placeholder:text-slate-500 focus:border-emerald-300"
            />
          </label>

          <div className="mt-2 flex items-center justify-between md:col-span-3">
            <label className="flex items-center gap-2 text-[11px]">
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
              className="rounded-full bg-emerald-400 px-4 py-1.5 text-[11px] font-medium text-slate-950 shadow hover:bg-emerald-300 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}