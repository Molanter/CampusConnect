'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addDoc, doc, setDoc } from 'firebase/firestore';
import { campusesCol, campusDormsCol } from '@/lib/firestore-paths';
import { Campus } from '@/lib/types/campus';

export default function CreateCampusPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [shortName, setShortName] = useState('');
    const [primaryColor, setPrimaryColor] = useState('#000000');
    const [secondaryColor, setSecondaryColor] = useState('#ffffff');
    const [adminEmails, setAdminEmails] = useState(''); // Text area

    // Locations
    const [locations, setLocations] = useState<{ id: string, name: string }[]>([{ id: '', name: '' }]);

    // Toggle & Dorms
    const [isUniversity, setIsUniversity] = useState(false);
    const [dormsText, setDormsText] = useState('');

    const handleAddLocation = () => {
        setLocations([...locations, { id: '', name: '' }]);
    };

    const handleLocationChange = (index: number, field: 'id' | 'name', value: string) => {
        const newLocs = [...locations];
        newLocs[index][field] = value;
        setLocations(newLocs);
    };

    const handleRemoveLocation = (index: number) => {
        setLocations(locations.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return alert('Name is required');
        if (locations.length === 0) return alert('At least one location is required');

        setLoading(true);

        try {
            // 1. Validation & Formatting
            const formattedEmails = adminEmails
                .split('\n')
                .map(e => e.trim().toLowerCase())
                .filter(Boolean);

            const formattedLocations = locations.map(loc => ({
                id: loc.id.trim().toLowerCase().replace(/[^a-z0-9-_]/g, ''), // Slugify
                name: loc.name.trim()
            })).filter(l => l.id && l.name);

            if (formattedLocations.length === 0) throw new Error("Invalid locations");

            // Check for unique location IDs
            const locIds = new Set(formattedLocations.map(l => l.id));
            if (locIds.size !== formattedLocations.length) throw new Error("Location IDs must be unique");

            // 2. Prepare Campus Doc
            const campusData: Omit<Campus, 'id'> = {
                name: name.trim(),
                shortName: shortName.trim() || null,
                locations: formattedLocations,
                isActive: true,
                adminEmails: formattedEmails,
                primaryColor,
                secondaryColor,
                themeColor: primaryColor, // Legacy compat
                isUniversity
            };

            // 3. Write to Firestore
            const docRef = await addDoc(campusesCol(), campusData);

            // 4. Handle Dorms (Only if University)
            if (isUniversity && dormsText.trim()) {
                const dormLines = dormsText.split('\n').map(l => l.trim()).filter(Boolean);
                const dormsRef = campusDormsCol(docRef.id);

                // Use first location as default for now (per prompt)
                const defaultLocationId = formattedLocations[0].id;

                const batchPromises = dormLines.map(dormName =>
                    addDoc(dormsRef, {
                        name: dormName,
                        locationId: defaultLocationId
                    })
                );
                await Promise.all(batchPromises);
            }

            router.push('/admin/campuses');
        } catch (err: any) {
            console.error(err);
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Create Campus</h1>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Campus Name</label>
                        <input
                            className="w-full p-2 border rounded"
                            value={name} onChange={e => setName(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Short Name</label>
                        <input
                            className="w-full p-2 border rounded"
                            value={shortName} onChange={e => setShortName(e.target.value)}
                        />
                    </div>
                </div>

                {/* Colors */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Primary Color</label>
                        <div className="flex gap-2">
                            <input
                                type="color"
                                value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                            />
                            <input
                                className="flex-1 p-2 border rounded"
                                value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Secondary Color</label>
                        <div className="flex gap-2">
                            <input
                                type="color"
                                value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)}
                            />
                            <input
                                className="flex-1 p-2 border rounded"
                                value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Locations */}
                <div>
                    <label className="block text-sm font-medium mb-2">Locations</label>
                    <div className="space-y-2">
                        {locations.map((loc, i) => (
                            <div key={i} className="flex gap-2">
                                <input
                                    placeholder="ID (e.g. north-campus)"
                                    className="w-1/3 p-2 border rounded font-mono text-sm"
                                    value={loc.id} onChange={e => handleLocationChange(i, 'id', e.target.value)}
                                    required
                                />
                                <input
                                    placeholder="Name (e.g. North Campus)"
                                    className="flex-1 p-2 border rounded"
                                    value={loc.name} onChange={e => handleLocationChange(i, 'name', e.target.value)}
                                    required
                                />
                                <button type="button" onClick={() => handleRemoveLocation(i)} className="text-red-500 px-2">
                                    &times;
                                </button>
                            </div>
                        ))}
                        <button type="button" onClick={handleAddLocation} className="text-sm text-blue-600 hover:underline">
                            + Add Location
                        </button>
                    </div>
                </div>

                {/* Admins */}
                <div>
                    <label className="block text-sm font-medium mb-1">Admin Emails (one per line)</label>
                    <textarea
                        className="w-full p-2 border rounded h-24"
                        value={adminEmails} onChange={e => setAdminEmails(e.target.value)}
                        placeholder="admin@example.edu"
                    />
                </div>

                {/* University Mode Toggle */}
                <div className="p-4 bg-gray-50 border rounded-lg">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={isUniversity}
                            onChange={e => setIsUniversity(e.target.checked)}
                            className="w-5 h-5"
                        />
                        <span className="font-medium">Mark as university (enables dorms)</span>
                    </label>

                    {isUniversity && (
                        <div className="mt-4 pl-8 border-l-2 border-blue-200">
                            <label className="block text-sm font-medium mb-1 text-blue-800">Dorms (one per line)</label>
                            <textarea
                                className="w-full p-2 border rounded h-32"
                                value={dormsText} onChange={e => setDormsText(e.target.value)}
                                placeholder="Dorm Name"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Duplicate names will be created as separate entries.
                            </p>
                        </div>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-3 rounded font-semibold disabled:opacity-50"
                >
                    {loading ? 'Creating...' : 'Create Campus'}
                </button>
            </form>
        </div>
    );
}
