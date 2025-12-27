'use client';

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
    collection,
    getDocs,
    doc,
    getDoc,
    query,
    updateDoc,
    deleteDoc,
    addDoc,
    setDoc,
    where
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import Toast, { ToastData } from "@/components/Toast";
import { Campus, Dorm, CampusLocation } from "@/lib/types/campus";

export default function ManageMyCampusPage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [myCampuses, setMyCampuses] = useState<Campus[]>([]);
    const [selectedCampusId, setSelectedCampusId] = useState<string>("");

    // Edit State
    const [campus, setCampus] = useState<Campus | null>(null);
    const [dorms, setDorms] = useState<Dorm[]>([]);
    const [dormsText, setDormsText] = useState("");
    const [adminEmailsText, setAdminEmailsText] = useState("");
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<ToastData | null>(null);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            if (u && u.email) {
                await loadMyCampuses(u.email);
            } else {
                setLoading(false);
            }
        });
        return () => unsub();
    }, []);

    const loadMyCampuses = async (email: string) => {
        try {
            // 1. Fetch Key Global Config to see if they are super admin (optional, logic from old page)
            // For now, let's just filter by email for "Manage My". 
            // The old page had global admin logic. Let's keep it simple: filter all by email.
            // EFFICIENT QUERY: "adminEmails" array-contains email.
            // We must query both collections.

            const emailLower = email.toLowerCase();

            const cQuery = query(collection(db, 'campuses'), where('adminEmails', 'array-contains', emailLower));
            const uQuery = query(collection(db, 'universities'), where('adminEmails', 'array-contains', emailLower));

            const [cSnap, uSnap] = await Promise.all([getDocs(cQuery), getDocs(uQuery)]);

            const cData = cSnap.docs.map(d => ({ id: d.id, ...d.data() } as Campus));
            const uData = uSnap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                isUniversity: d.data().isUniversity ?? true
            } as Campus));

            // Merge (campuses override universities if same ID - migration case)
            const cIds = new Set(cData.map(c => c.id));
            const merged = [...cData];
            for (const u of uData) {
                if (!cIds.has(u.id)) merged.push(u);
            }

            setMyCampuses(merged);
            if (merged.length > 0) {
                setSelectedCampusId(merged[0].id);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Load selected detail
    useEffect(() => {
        if (!selectedCampusId || myCampuses.length === 0) return;
        const found = myCampuses.find(c => c.id === selectedCampusId);
        if (found) {
            setCampus(found);
            setAdminEmailsText(found.adminEmails?.join('\n') || "");
            loadDorms(found.id, found.isUniversity);
        }
    }, [selectedCampusId, myCampuses]);

    const loadDorms = async (id: string, isUni: boolean) => {
        if (!isUni) {
            setDorms([]);
            setDormsText("");
            return;
        }

        // Try new path first, then old
        // Actually for 'manage-my', we likely want to edit. 
        // Reuse the helper logic or manual.
        // Let's use the helper.
        const { getDormsForCampus } = await import("@/lib/firestore-paths");
        const ds = await getDormsForCampus(id);
        setDorms(ds);
        setDormsText(ds.map(d => d.name).join('\n'));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!campus) return;
        setSaving(true);
        try {
            // Logic: Writes go to `campuses`.
            const formattedEmails = adminEmailsText.split('\n').map(e => e.trim().toLowerCase()).filter(Boolean);

            const updateData = {
                name: campus.name,
                shortName: campus.shortName || null,
                locations: campus.locations,
                isActive: campus.isActive,
                adminEmails: formattedEmails,
                isUniversity: campus.isUniversity // Persist the toggle state
            };

            // WRITE TO CAMPUSES (Merge/Migrate)
            await setDoc(doc(db, 'campuses', campus.id), updateData, { merge: true });

            // Handle dorms logic
            // If we are saving, we should probably rewrite the dorms to the new location too?
            // "All new writes must go to campuses/*"
            // Replacing dorms: delete old ref is hard if we don't know where they came from (legacy vs new).
            // Strategy: 
            // 1. Delete all from `campuses/{id}/dorms`
            // 2. Delete all from `universities/{id}/dorms` (if we want to clean up, or just leave them as orphaned legacy?)
            //    Safe/Clean approach: Try to delete from both to avoid duplicates appearing in read fallback.

            const cDormsRef = collection(db, 'campuses', campus.id, 'dorms');
            const uDormsRef = collection(db, 'universities', campus.id, 'dorms');

            const [cSn, uSn] = await Promise.all([getDocs(cDormsRef), getDocs(uDormsRef)]);

            const delPromises = [
                ...cSn.docs.map(d => deleteDoc(doc(cDormsRef, d.id))),
                ...uSn.docs.map(d => deleteDoc(doc(uDormsRef, d.id)))
            ];
            await Promise.all(delPromises);

            // Add new dorms to CAMPUSES only
            if (campus.isUniversity && dormsText.trim()) {
                const lines = dormsText.split('\n').map(l => l.trim()).filter(Boolean);
                const defaultLoc = campus.locations[0]?.id || "main";
                await Promise.all(lines.map(name => addDoc(cDormsRef, { name, locationId: defaultLoc })));
            }

            setToast({ type: 'success', message: 'Campus updated successfully' });
            // Reload needed to refresh state properly
            if (user?.email) loadMyCampuses(user.email);

        } catch (err: any) {
            console.error(err);
            setToast({ type: 'error', message: err.message });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-white">Loading...</div>;
    if (!user) return <div className="p-8 text-white">Please sign in.</div>;
    if (myCampuses.length === 0) return <div className="p-8 text-white">You are not an admin of any campus.</div>;

    return (
        <div className="max-w-4xl mx-auto p-8 text-white">
            <Toast toast={toast} onClear={() => setToast(null)} />
            <h1 className="text-2xl font-bold mb-6">Manage My Campus</h1>

            {myCampuses.length > 1 && (
                <select
                    className="mb-6 p-2 rounded bg-gray-800 border border-gray-700"
                    value={selectedCampusId}
                    onChange={e => setSelectedCampusId(e.target.value)}
                >
                    {myCampuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            )}

            {campus && (
                <form onSubmit={handleSave} className="space-y-6 bg-white/5 p-6 rounded-2xl border border-white/10">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm mb-1 text-gray-400">Name</label>
                            <input
                                className="w-full bg-black/50 border border-white/20 rounded p-2"
                                value={campus.name}
                                onChange={e => setCampus({ ...campus, name: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm mb-1 text-gray-400">Short Name</label>
                            <input
                                className="w-full bg-black/50 border border-white/20 rounded p-2"
                                value={campus.shortName || ''}
                                onChange={e => setCampus({ ...campus, shortName: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm mb-1 text-gray-400">Locations (JSON style edit)</label>
                        {campus.locations.map((loc, i) => (
                            <div key={i} className="flex gap-2 mb-2">
                                <input className="bg-black/50 border border-white/20 rounded p-2 w-24" value={loc.id} disabled />
                                <input
                                    className="bg-black/50 border border-white/20 rounded p-2 flex-1"
                                    value={loc.name}
                                    onChange={e => {
                                        const newLocs = [...campus.locations];
                                        newLocs[i].name = e.target.value;
                                        setCampus({ ...campus, locations: newLocs });
                                    }}
                                />
                            </div>
                        ))}
                    </div>

                    <div>
                        <label className="block text-sm mb-1 text-gray-400">Admin Emails</label>
                        <textarea
                            className="w-full bg-black/50 border border-white/20 rounded p-2 h-24"
                            value={adminEmailsText}
                            onChange={e => setAdminEmailsText(e.target.value)}
                        />
                    </div>

                    {campus.isUniversity && (
                        <div>
                            <label className="block text-sm mb-1 text-gray-400">Dorms (one per line)</label>
                            <textarea
                                className="w-full bg-black/50 border border-white/20 rounded p-2 h-32"
                                value={dormsText}
                                onChange={e => setDormsText(e.target.value)}
                            />
                        </div>
                    )}

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={saving}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-full font-semibold transition"
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}
