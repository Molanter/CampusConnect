export type Mood = "Chill" | "Social" | "Date night" | "Party" | "Outdoors" | "Food";
export type BudgetFilter = "Any" | "Free" | "$" | "$$" | "$$$";
export type TimeFilter = "Any" | "Now" | "Next 2h" | "Tonight";
export type DistanceFilter = "Any" | "Walkable" | "Short ride";

export type PostType = "post" | "event" | "announcement";

export type Post = {
    id: string; // Changed to string to match Firestore ID
    // Core Post fields
    authorId: string;
    authorName: string;
    authorUsername?: string;
    authorAvatarUrl?: string | null;

    // Club Branding
    clubId?: string;
    clubName?: string;
    clubAvatarUrl?: string;
    isVerified?: boolean; // Club verification status

    // Post Type
    type: PostType;
    ownerType?: "personal" | "club" | "campus";

    content?: string;
    description?: string;
    title?: string;
    imageUrls?: string[];
    likes?: string[]; // Array of user IDs
    seenCount?: number; // Number of users who have seen this post
    createdAt?: any; // Timestamp

    // Event specific fields (optional)
    isEvent?: boolean; // Deprecated, use type === 'event'
    venue?: string; // or locationLabel
    locationLabel?: string;
    locationUrl?: string; // Link to map
    coordinates?: { lat: number; lng: number };

    date?: string; // yyyy-mm-dd
    startTime?: string; // hh:mm
    endTime?: string; // hh:mm

    distanceMinutesWalk?: number; // legacy? maybe keep for now
    mood?: Mood[];
    priceLevel?: "Free" | "$" | "$$" | "$$$";

    // Attendance
    goingUids?: string[];
    maybeUids?: string[];
    notGoingUids?: string[];

    editCount?: number;
    commentsCount?: number;
    repliesCommentsCount?: number;
    campusName?: string;
    campusAvatarUrl?: string;

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
