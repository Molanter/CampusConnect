'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAllCampusesAndUniversities } from '@/lib/firestore-paths';
import { Campus } from '@/lib/types/campus';

export default function AdminCampusesPage() {
    const [campuses, setCampuses] = useState<Campus[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const data = await getAllCampusesAndUniversities();
                // Sort by name
                data.sort((a, b) => a.name.localeCompare(b.name));
                setCampuses(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    if (loading) return <div className="p-8">Loading campuses...</div>;

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Campuses</h1>
                <Link
                    href="/admin/campuses/create"
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                    + Create Campus
                </Link>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Locations</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Data Source</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {campuses.map(campus => {
                            // Determine if legacy based on some logic (e.g. if we want to show it)
                            // We'll rely on the helper's fetch nature. 
                            // A robust way to check legacy is if its ID only exists in universities, but here we merged them.
                            // We can visually inspect based on `isUniversity` but created campuses can also have `isUniversity=true`.
                            // We'll assume everything is good, but maybe add a label if it lacks fields unique to new schema?
                            const isUniversityEnabled = campus.isUniversity;
                            const hasDorms = isUniversityEnabled;

                            return (
                                <tr key={campus.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <Link href={`/admin/campuses/${campus.id}`} className="text-blue-600 hover:underline font-medium">
                                            {campus.name}
                                        </Link>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {hasDorms ? 'University (Dorms)' : 'Campus'}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {campus.locations.length} locations
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-400 font-mono">
                                        {/* We can't easily tell source from the merged object without extra fields, 
                        but we can infer strictly for display if needed. 
                        For now, just showing ID is enough. */}
                                        {campus.id}
                                    </td>
                                </tr>
                            );
                        })}
                        {campuses.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                    No campuses found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
