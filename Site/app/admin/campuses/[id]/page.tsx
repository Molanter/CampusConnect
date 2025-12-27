'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { getCampusOrLegacy, campusesCol, campusDormsCol, getDormsForCampus, campusDoc } from '@/lib/firestore-paths';
import { updateDoc, setDoc, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { Campus, Dorm, CampusLocation } from '@/lib/types/campus';

export default function EditCampusPage(props: { params: Promise<{ id: string }> }) {
    const params = use(props.params);
    const router = useRouter();
    const [campus, setCampus] = useState<Campus | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dorms, setDorms] = useState<Dorm[]>([]);

    // We load dorms separately
    useEffect(() => {
        async function load() {
            try {
                const data = await getCampusOrLegacy(params.id);
                if (!data) {
                    alert("Campus not found");
                    router.push('/admin/campuses');
                    return;
                }
                setCampus(data);

                // Load dorms if university
                if (data.isUniversity) {
                    const d = await getDormsForCampus(params.id);
                    setDorms(d);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [params.id, router]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!campus) return;
        setSaving(true);
        try {
            // ALWAYS write to 'campuses' collection (migration or update)
            const ref = campusDoc(campus.id);

            // We use setDoc with merge to ensure we write to the new collection even if valid in old
            // This effectively migrates it if it was legacy.
            await setDoc(ref, {
                ...campus,
                // Ensure strictly formatted if needed, for edit we assume state is updated correctly
            }, { merge: true });

            alert('Campus saved successfully!');
        } catch (err: any) {
            console.error(err);
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    const updateField = (field: keyof Campus, value: any) => {
        if (campus) setCampus({ ...campus, [field]: value });
    };

    const handleLocationChange = (index: number, val: string) => {
        if (!campus) return;
        const newLocs = [...campus.locations];
        newLocs[index].name = val;
        setCampus({ ...campus, locations: newLocs });
    };

    if (loading) return <div className="p-8">Loading...</div>;
    if (!campus) return null;

    return (
        <div className="p-8 max-w-2xl mx-auto">
            <div className="flex justify-between mb-6">
                <h1 className="text-2xl font-bold">Edit Campus</h1>
                <button onClick={() => router.push('/admin/campuses')} className="text-gray-500">Back</button>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium mb-1">Name</label>
                    <input
                        className="w-full p-2 border rounded"
                        value={campus.name}
                        onChange={e => updateField('name', e.target.value)}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Locations</label>
                    <div className="space-y-2">
                        {campus.locations.map((loc, i) => (
                            <div key={i} className="flex gap-2 items-center">
                                <span className="font-mono text-sm bg-gray-100 p-2 rounded">{loc.id}</span>
                                <input
                                    className="flex-1 p-2 border rounded"
                                    value={loc.name}
                                    onChange={e => handleLocationChange(i, e.target.value)}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-4 bg-gray-50 rounded">
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={campus.isUniversity}
                            onChange={e => updateField('isUniversity', e.target.checked)}
                        // Decide if we allow un-checking logic. For now, yes.
                        />
                        <span className="font-medium">Is University (Enable Dorms)</span>
                    </label>
                </div>

                {campus.isUniversity && (
                    <div>
                        <h3 className="font-semibold mb-2">Dorms ({dorms.length})</h3>
                        <ul className="list-disc pl-5">
                            {dorms.map(d => (
                                <li key={d.id}>{d.name}</li>
                            ))}
                        </ul>
                        <p className="text-xs text-gray-500 mt-2">Dorm editing is simplified here. Use the Create form for bulk add or direct Firestore for detailed management.</p>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={saving}
                    className="w-full bg-blue-600 text-white py-3 rounded font-bold"
                >
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </form>
        </div>
    );
}
