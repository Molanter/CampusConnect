export type Mood = "Chill" | "Social" | "Date night" | "Party" | "Outdoors" | "Food";
export type BudgetFilter = "Any" | "Free" | "$" | "$$" | "$$$";
export type TimeFilter = "Any" | "Now" | "Next 2h" | "Tonight";
export type DistanceFilter = "Any" | "Walkable" | "Short ride";

export type PostType = "post" | "event" | "announcement";
export type PostOwnerType = "personal" | "club" | "campus";

/**
 * Event logistics - nested object for event-specific fields
 * Matches iOS PostEventLogistics struct
 */
export type PostEventLogistics = {
    startsAt?: Date | any; // Timestamp
    locationLabel?: string;
    locationUrl?: string;
    lat?: number;
    lng?: number;
    // Attendance (event-only)
    goingUids?: string[];
    maybeUids?: string[];
    notGoingUids?: string[];
};

/**
 * Post Document Model
 * Matches iOS PostDoc struct
 */
export type Post = {
    // Identity
    id: string;

    // Scope / Ownership
    ownerType: PostOwnerType;
    campusId: string;
    clubId?: string;

    // Main Content
    description: string;
    authorId: string;
    type: PostType;
    imageUrls: string[];

    // ✅ Denormalized display fields (snapshots)
    ownerName?: string;
    ownerPhotoURL?: string;
    authorUsername?: string;
    authorDisplayName?: string;
    authorPhotoURL?: string;

    // Timestamps / Edits
    createdAt?: Date | any; // Timestamp
    editedAt?: Date | any; // Timestamp
    editCount?: number;

    // Counters
    commentsCount?: number;
    repliesCommentsCount?: number;
    seenCount?: number;

    // Arrays
    likedBy?: string[];

    // Event-only (nested object)
    event?: PostEventLogistics;

    // ===== LEGACY FIELDS (for backward compatibility) =====
    // These should be deprecated in favor of the structured fields above

    // Legacy author fields (use authorDisplayName, authorPhotoURL instead)
    authorName?: string;
    authorAvatarUrl?: string | null;

    // Legacy club fields (use ownerName, ownerPhotoURL instead)
    clubName?: string;
    clubAvatarUrl?: string;
    isVerified?: boolean;

    // Legacy campus fields (use ownerName, ownerPhotoURL instead)
    campusName?: string;
    campusAvatarUrl?: string;

    // Legacy content fields (use description instead)
    content?: string;
    title?: string;

    // Legacy likes (use likedBy instead)
    likes?: string[];

    // Legacy event fields (use event.* instead)
    isEvent?: boolean; // Deprecated, use type === 'event'
    venue?: string; // Use event.locationLabel
    locationLabel?: string; // Use event.locationLabel
    locationUrl?: string; // Use event.locationUrl
    coordinates?: { lat: number; lng: number }; // Use event.lat, event.lng
    lat?: number; // Use event.lat
    lng?: number; // Use event.lng
    startsAt?: any; // Use event.startsAt
    date?: string; // yyyy-mm-dd (deprecated)
    startTime?: string; // hh:mm (deprecated)
    endTime?: string; // hh:mm (deprecated)
    distanceMinutesWalk?: number; // Deprecated
    mood?: Mood[]; // Deprecated
    priceLevel?: "Free" | "$" | "$$" | "$$$"; // Deprecated

    // Legacy attendance (use event.goingUids, etc. instead)
    goingUids?: string[];
    maybeUids?: string[];
    notGoingUids?: string[];

    // Moderation fields
    visibility?: "visible" | "under_review" | "hidden";
    reportCount?: number;
    reportedAt?: any; // Timestamp
    hiddenAt?: any; // Timestamp
    hiddenBy?: string; // admin uid
    moderationNote?: string;
    ownerUid?: string; // For clarity, same as authorId
};

export const moodFilters: Mood[] = [
    "Chill",
    "Social",
    "Date night",
    "Party",
    "Outdoors",
    "Food",
];
