"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../../../../lib/firebase";
import { createClub } from "../../../../lib/clubs";
import { ChevronLeftIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import Toast, { ToastData } from "@/components/Toast";

function isGlobalAdmin(email?: string | null, admins?: string[] | null) {
  if (!email || !admins) return false;
  return admins.includes(email.toLowerCase());
}

export default function CreateUniversityPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [globalAdminEmails, setGlobalAdminEmails] = useState<string[]>([]);
  const [adminConfigLoading, setAdminConfigLoading] = useState(true);

  const [universityName, setUniversityName] = useState("");
  const [shortName, setShortName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#3b82f6");
  const [secondaryColor, setSecondaryColor] = useState("#1d4ed8");
  const [locations, setLocations] = useState([{ id: "main", name: "Main Campus" }]);
  const [dormsText, setDormsText] = useState("");
  const [adminEmailsText, setAdminEmailsText] = useState("");

  const [saving, setSaving] = useState(false);
  const [universities, setUniversities] = useState<any[]>([]);
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
      } finally {
        setAdminConfigLoading(false);
      }
    };
    void loadAdminConfig();
  }, []);

  useEffect(() => {
    async function fetchUniversities() {
      try {
        const q = query(collection(db, "universities"), orderBy("name"));
        const snap = await getDocs(q);
        setUniversities(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error fetching universities:", err);
      }
    }
    fetchUniversities();
  }, []);

  const userIsGlobalAdmin = useMemo(
    () => isGlobalAdmin(user?.email, globalAdminEmails),
    [user?.email, globalAdminEmails]
  );

  const handleAddLocation = () => {
    setLocations([...locations, { id: "", name: "" }]);
  };

  const handleRemoveLocation = (index: number) => {
    setLocations(locations.filter((_, i) => i !== index));
  };

  const handleLocationChange = (index: number, field: "id" | "name", value: string) => {
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
    if (!user || !userIsGlobalAdmin) return;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userIsGlobalAdmin) return;

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
        themeColor: primaryColor || null,
      });

      // 2) Create dorms (Clubs) and link them
      const dormNames = dormsText
        .split("\n")
        .map((d) => d.trim())
        .filter(Boolean);

      const createdDormIds: string[] = [];

      for (const dormName of dormNames) {
        const clubId = await createClub(user.uid, {
          name: dormName,
          description: `Official residence hall group for ${dormName}`,
          isPrivate: false,
          postingPermission: 'anyone',
        });

        await updateDoc(doc(db, "clubs", clubId), {
          campusId: uniRef.id,
          category: "dorm",
          type: "dorm",
          isOfficial: true,
        });

        createdDormIds.push(clubId);

        await addDoc(
          collection(db, "universities", uniRef.id, "dorms"),
          {
            name: dormName,
            clubId,
            createdAt: new Date(),
          }
        );
      }

      setToast({ type: "success", message: "University and dorms created!" });
      setUniversityName("");
      setShortName("");
      setDormsText("");
      setAdminEmailsText("");
      setLocations([{ id: "main", name: "Main Campus" }]);
    } catch (err) {
      console.error("Error creating university:", err);
      setToast({ type: "error", message: "Failed to create university." });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || adminConfigLoading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!user || !userIsGlobalAdmin) {
    return <div className="p-8">Access Denied</div>;
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      <Toast toast={toast} onClear={() => setToast(null)} />

      <div className="mb-8 flex items-center gap-4">
        <Link
          href="/admin"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/10 text-secondary transition-all hover:bg-secondary/20"
        >
          <ChevronLeftIcon className="h-6 w-6" />
        </Link>
        <h1 className="text-3xl font-bold">Manage Universities</h1>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section className="cc-section cc-radius-24 p-6">
          <h2 className="mb-4 text-xl font-bold">Add New University</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary">University Name</label>
              <input
                required
                type="text"
                value={universityName}
                onChange={(e) => setUniversityName(e.target.value)}
                className="cc-input mt-1 w-full"
                placeholder="e.g. Stanford University"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary">Short Name / ID</label>
              <input
                type="text"
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                className="cc-input mt-1 w-full"
                placeholder="e.g. stanford"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-secondary">Primary Color</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-9 w-9 cursor-pointer overflow-hidden rounded border-none bg-transparent"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="cc-input flex-1 text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary">Secondary Color</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="h-9 w-9 cursor-pointer overflow-hidden rounded border-none bg-transparent"
                  />
                  <input
                    type="text"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="cc-input flex-1 text-xs"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary">Locations / Campuses</label>
              <div className="mt-2 space-y-2">
                {locations.map((loc, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      required
                      placeholder="ID"
                      value={loc.id}
                      onChange={(e) => handleLocationChange(idx, "id", e.target.value)}
                      className="cc-input w-24"
                    />
                    <input
                      required
                      placeholder="Name"
                      value={loc.name}
                      onChange={(e) => handleLocationChange(idx, "name", e.target.value)}
                      className="cc-input flex-1"
                    />
                    {locations.length > 1 && (
                      <button type="button" onClick={() => handleRemoveLocation(idx)} className="text-red-500">
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={handleAddLocation} className="text-brand hover:underline">
                  + Add Location
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary">Dorm Names</label>
              <textarea
                rows={4}
                value={dormsText}
                onChange={(e) => setDormsText(e.target.value)}
                className="cc-input mt-1 w-full"
                placeholder="e.g. Wilbur Hall"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary">Campus Admin Emails</label>
              <textarea
                rows={3}
                value={adminEmailsText}
                onChange={(e) => setAdminEmailsText(e.target.value)}
                className="cc-input mt-1 w-full"
                placeholder="admin@university.edu"
              />
            </div>

            <button disabled={saving} type="submit" className="cc-btn-primary w-full py-3">
              {saving ? "Creating..." : "Create University"}
            </button>
          </form>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold">Existing Universities</h2>
          <div className="cc-section cc-radius-24 overflow-hidden shadow-sm">
            {universities.length === 0 ? (
              <p className="p-6 text-center text-secondary">No universities found.</p>
            ) : (
              <div className="divide-y divide-secondary/10">
                {universities.map((uni) => (
                  <div key={uni.id} className="p-4 transition-colors hover:bg-secondary/5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold">{uni.name}</h3>
                        <p className="text-[10px] text-secondary">{uni.isActive ? "Active" : "Inactive"}</p>
                      </div>
                      <div className="flex gap-2">
                        <input type="color" value={uni.primaryColor || "#000"} readOnly className="h-4 w-4 rounded-full" />
                        <Link href={`/admin/universities/${uni.id}`} className="text-brand hover:underline">Edit</Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}