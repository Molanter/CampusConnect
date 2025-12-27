import { db, auth } from "./firebase";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    query,
    where,
    orderBy,
    limit,
    Timestamp,
    serverTimestamp,
    arrayUnion,
    arrayRemove,
    setDoc
} from "firebase/firestore";

export type ClubRole = "owner" | "admin" | "member";
export type JoinStatus = "pending" | "approved" | "rejected";

export interface Club {
    id: string;
    name: string;
    description: string;
    coverImageUrl?: string;
    logoUrl?: string; // New: Club logo/avatar
    profileImageUrl?: string; // Alias for logoUrl often used in UI components
    isPrivate: boolean;
    memberCount: number;
    tags?: string[];
    category?: string;
    createdAt: any;
    createdBy: string;
    adminUids?: string[]; // Denormalized list of admin UIDs

    // Settings
    allowMemberPosts: boolean;
    postingPermission?: 'anyone' | 'admins'; // New: Who can post

    // Verification
    isVerified?: boolean; // New: Campus verified badge
    verificationStatus?: 'none' | 'pending' | 'approved' | 'rejected'; // New: Request flow

    // Computed/Client-side
    isMember?: boolean;
}

export interface ClubMember {
    uid: string;
    clubId: string;
    role: ClubRole;
    joinedAt: any;
    status: JoinStatus; // effective only for private clubs request flow

    // Fetched user data
    name?: string;
    displayName?: string;
    photoURL?: string;
    username?: string;
    _docId?: string;
}

export interface ClubPost {
    // Extend standard Post or re-use existing Post type with clubId field
    clubId: string;
    // ... usual post fields
}

// --- Helpers ---

// Update to support array-contains query
export async function createClub(
    userId: string,
    data: {
        name: string;
        description: string;
        coverImageUrl?: string;
        isPrivate: boolean;
    }
) {
    const clubRef = await addDoc(collection(db, "clubs"), {
        ...data,
        memberCount: 1,
        memberIds: [userId], // crucial for "My Clubs" query
        createdBy: userId,
        createdAt: serverTimestamp(),
        allowMemberPosts: false,
    });

    // Add creator as Owner in subcollection (for roles)
    // Use setDoc with userId as docId
    await setDoc(doc(db, "clubs", clubRef.id, "members", userId), {
        uid: userId,
        clubId: clubRef.id,
        role: "owner",
        status: "approved",
        joinedAt: serverTimestamp(),
    });

    return clubRef.id;
}

export async function getClub(clubId: string): Promise<Club | null> {
    const snap = await getDoc(doc(db, "clubs", clubId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Club;
}

export async function joinClub(clubId: string, userId: string, isPrivate: boolean) {
    const memberRef = collection(db, "clubs", clubId, "members");

    const q = query(memberRef, where("uid", "==", userId));
    const snap = await getDocs(q);
    if (!snap.empty) return;

    const status: JoinStatus = isPrivate ? "pending" : "approved";

    // Use setDoc with userId as docId
    await setDoc(doc(memberRef, userId), {
        uid: userId,
        clubId,
        role: "member",
        status,
        joinedAt: serverTimestamp(),
    });

    if (!isPrivate) {
        const clubRef = doc(db, "clubs", clubId);
        await updateDoc(clubRef, {
            memberIds: arrayUnion(userId) // Add to array for "My Clubs" query
        });
    }
}

export async function getClubMembers(clubId: string, status: JoinStatus = "approved"): Promise<ClubMember[]> {
    const membersRef = collection(db, "clubs", clubId, "members");
    const q = query(membersRef, where("status", "==", status), orderBy("joinedAt", "desc"));
    const snap = await getDocs(q);

    // We need to fetch user profiles for these members
    const members: ClubMember[] = [];

    for (const d of snap.docs) {
        const data = d.data();
        // Fetch user profile
        // Optimisation: In a real app we'd batch this or store denormalised data.
        const userSnap = await getDoc(doc(db, "users", data.uid));
        let userData = {};
        if (userSnap.exists()) {
            userData = userSnap.data();
        }

        members.push({
            uid: data.uid,
            clubId,
            role: data.role,
            status: data.status,
            joinedAt: data.joinedAt,
            ...userData
        });
    }


    return members;
}

export async function getPublicClubs(): Promise<Club[]> {
    const clubsRef = collection(db, "clubs");
    const q = query(clubsRef, where("isPrivate", "==", false), orderBy("memberCount", "desc"), limit(20));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Club));
}

export async function getAllClubs(): Promise<Club[]> {
    const clubsRef = collection(db, "clubs");
    // For admins, we want to see everything, ordered by size or creation
    const q = query(clubsRef, orderBy("memberCount", "desc"), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Club));
}

export async function getUserClubs(userId: string): Promise<Club[]> {
    const clubsRef = collection(db, "clubs");
    const q = query(clubsRef, where("memberIds", "array-contains", userId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Club));
}
