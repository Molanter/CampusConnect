import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    DocumentData,
    Firestore,
    setDoc,
    updateDoc
} from 'firebase/firestore';
import { db } from './firebase'; // Assuming firebase export is here
import { Campus, Dorm } from './types/campus';

// Collection References
export const campusesCol = (firestore: Firestore = db) => collection(firestore, 'campuses');
export const universitiesCol = (firestore: Firestore = db) => collection(firestore, 'universities');

export const campusDoc = (id: string, firestore: Firestore = db) => doc(firestore, 'campuses', id);
export const universityDoc = (id: string, firestore: Firestore = db) => doc(firestore, 'universities', id);

export const campusDormsCol = (campusId: string, firestore: Firestore = db) =>
    collection(firestore, 'campuses', campusId, 'dorms');

export const universityDormsCol = (universityId: string, firestore: Firestore = db) =>
    collection(firestore, 'universities', universityId, 'dorms');


/**
 * STRATEGY: Dual-read, Single-write
 * 
 * Reads: Try 'campuses' first. If not found, try 'universities'.
 * Writes: Always write to 'campuses'.
 */

export async function getCampusOrLegacy(id: string): Promise<Campus | null> {
    // 1. Try generic campus path
    const cSnapshot = await getDoc(campusDoc(id));
    if (cSnapshot.exists()) {
        return { id: cSnapshot.id, ...cSnapshot.data() } as Campus;
    }

    // 2. Fallback to legacy university path
    const uSnapshot = await getDoc(universityDoc(id));
    if (uSnapshot.exists()) {
        const data = uSnapshot.data();
        // Legacy docs might not have isUniversity set, default to false or true? 
        // Prompt says: "universities/{id} -> campuses/{id} with isUniversity: true" during migration.
        // For raw reads, if it's in universities, it WAS a university.
        return {
            id: uSnapshot.id,
            ...data,
            isUniversity: data.isUniversity ?? true
        } as Campus;
    }

    return null;
}

export async function getDormsForCampus(campusId: string): Promise<Dorm[]> {
    // 1. Try new path
    const cSnapshot = await getDocs(campusDormsCol(campusId));
    if (!cSnapshot.empty) {
        return cSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Dorm));
    }

    // 2. Fallback to legacy path
    // Only checking if the campus doc itself didn't exist or had no dorms?
    // Strategy says: "fallback to universities/{id}/dorms if empty/not found"
    // Note: If a NEW campus has NO dorms, this might check legacy. 
    // But NEW campuses won't have legacy IDs hopefully. 
    // ID collision is unlikely but possible if not using auto-ids.

    const uSnapshot = await getDocs(universityDormsCol(campusId));
    if (!uSnapshot.empty) {
        return uSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Dorm));
    }

    return [];
}

export async function getAllCampusesAndUniversities(): Promise<Campus[]> {
    // Fetch both collections in parallel
    const [cSnap, uSnap] = await Promise.all([
        getDocs(campusesCol()),
        getDocs(universitiesCol())
    ]);

    const campuses = cSnap.docs.map(d => ({ id: d.id, ...d.data() } as Campus));
    const universities = uSnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        isUniversity: d.data().isUniversity ?? true
    } as Campus));

    // Merge: Campuses take precedence if ID conflicts (migrated)
    const campusIds = new Set(campuses.map(c => c.id));
    const merged = [...campuses];

    for (const u of universities) {
        if (!campusIds.has(u.id)) {
            merged.push(u);
        }
    }

    return merged;
}
