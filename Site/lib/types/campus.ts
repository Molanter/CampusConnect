import { Timestamp } from 'firebase/firestore';

export interface CampusLocation {
    id: string;
    name: string;
}

export interface Campus {
    id: string; // Document ID
    name: string;
    shortName: string | null;
    locations: CampusLocation[];
    isActive: boolean;
    adminEmails: string[];
    primaryColor: string | null;
    secondaryColor: string | null;
    themeColor: string | null; // Keep for legacy compatibility
    isUniversity: boolean; // NEW: Determines if dorms are enabled
    createdAt?: Timestamp;
    createdBy?: string;
}

export interface Dorm {
    id?: string;
    name: string;
    locationId: string;
}

// Backward compatibility alias
export type University = Campus;
export type UniversityLocation = CampusLocation;
