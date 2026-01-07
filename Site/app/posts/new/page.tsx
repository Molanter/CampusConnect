"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import {
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";
import { Club, ClubMember } from "../../../lib/clubs";
import Toast, { ToastData } from "@/components/Toast";
import { PostCard } from "@/components/post-card";
import { useRightSidebar } from "@/components/right-sidebar-context";
import { useMainLayoutMetrics } from "@/components/main-layout-metrics-context";
import { CalendarIcon, ClockIcon, QuestionMarkCircleIcon, MegaphoneIcon, ChatBubbleBottomCenterTextIcon, BuildingLibraryIcon } from "@heroicons/react/24/outline";
import { CheckBadgeIcon } from "@heroicons/react/24/solid";
import { PostType } from "../../../lib/posts";

type UserProfile = {
  preferredName?: string;
  username?: string;
  campus?: string;
  campusId?: string;
  campusLocation?: string;
  campusLocationId?: string;
  role?: "student" | "staff";
  photoURL?: string;
};

type Campus = {
  id: string;
  name: string;
  shortName?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  themeColor?: string | null;
};

const hexToRgba = (hex: string, alpha: number) => {
  const sanitized = hex.replace("#", "");
  if (sanitized.length !== 6) return hex;
  const r = parseInt(sanitized.slice(0, 2), 16);
  const g = parseInt(sanitized.slice(2, 4), 16);
  const b = parseInt(sanitized.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return hex;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};



export default function CreateEventPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialClubId = searchParams.get("clubId");
  const { isMainNarrow, mainWidth } = useMainLayoutMetrics();

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [campusesLoading, setCampusesLoading] = useState(false);

  const [toast, setToast] = useState<ToastData | null>(null);
  const [isCampusAdmin, setIsCampusAdmin] = useState(false);

  // Event form fields
  const [type, setType] = useState<PostType>("post");
  const isEvent = type === "event";

  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [eventDate, setEventDate] = useState(""); // yyyy-mm-dd
  const [startTime, setStartTime] = useState(""); // hh:mm
  const [endTime, setEndTime] = useState(""); // hh:mm

  // Location fields
  const [locationUrl, setLocationUrl] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);

  const [dressCode, setDressCode] = useState("");
  const [extraNotes, setExtraNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false); // New state for LocationPicker
  const [showMapPreview, setShowMapPreview] = useState(true); // Toggle for map preview

  // Club posting state
  const [userClubs, setUserClubs] = useState<{
    id: string;
    name: string;
    role: string;
    allowMemberPosts?: boolean;
    imageUrl?: string;
    status?: string;
    type?: string;
    isVerified?: boolean;
    category?: string;
  }[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(initialClubId);
  const [loadingClubs, setLoadingClubs] = useState(false);
  const [selectedClubName, setSelectedClubName] = useState<string | null>(null);
  const [isPostAsMenuOpen, setIsPostAsMenuOpen] = useState(false);
  const [campusImageUrl, setCampusImageUrl] = useState<string | null>(null);

  // Active section state for visual feedback
  const [activeSection, setActiveSection] = useState<
    "postAs" | "details" | "type" | "eventDetails" | "extraInfo" | null
  >(null);

  // Right sidebar
  const { openView } = useRightSidebar();

  // ---- Auth ----
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Helper to parse coordinates from Google/Apple Maps URL
  const parseCoordinatesFromUrl = async (url: string) => {
    if (!url) return null;
    let targetUrl = url;

    // Expand shortened URLs (Google and Apple Maps)
    const needsExpansion = url.includes("goo.gl") ||
      url.includes("maps.app.goo.gl") ||
      url.includes("maps.apple.com/p/") ||
      url.includes("maps.apple/p/") ||
      (url.includes("apple") && url.includes("/p/"));

    if (needsExpansion) {
      try {
        console.log("Expanding shortened URL:", url);
        const res = await fetch(`/api/expand-map-url?url=${encodeURIComponent(url)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.expandedUrl) {
            targetUrl = data.expandedUrl;
            console.log("Expanded to:", targetUrl);
          } else {
            console.log("API response did not contain expandedUrl:", data);
          }
        } else {
          console.log("API returned error status:", res.status, await res.text());
        }
      } catch (err) {
        console.error("Failed to expand URL:", err);
      }
    }

    // Helper to extract label from URL
    const extractLabel = (urlStr: string) => {
      try {
        const u = new URL(urlStr);
        // Apple Maps name param
        const nameParam = u.searchParams.get("name");
        if (nameParam) return decodeURIComponent(nameParam.replace(/\+/g, " "));

        // Google/Apple query param (if it's not JUST coordinates)
        const qParam = u.searchParams.get("q");
        if (qParam && !qParam.match(/^-?\d+\.\d+,-?\d+\.\d+$/)) {
          return decodeURIComponent(qParam.replace(/\+/g, " "));
        }

        // Google Maps place path
        const placeMatch = urlStr.match(/\/place\/([^/@?]+)/);
        if (placeMatch && placeMatch[1]) {
          return decodeURIComponent(placeMatch[1].replace(/\+/g, " "));
        }
      } catch (e) {
        // Not a full URL or other error
      }
      return null;
    };

    const foundLabel = extractLabel(targetUrl) || extractLabel(url);

    // Priority 1: Google Maps !3d and !4d params (most specific)
    const data3dRegex = /!3d(-?\d+\.\d+)/;
    const data4dRegex = /!4d(-?\d+\.\d+)/;
    const match3d = targetUrl.match(data3dRegex);
    const match4d = targetUrl.match(data4dRegex);
    if (match3d && match4d) {
      console.log("Found Google Maps !3d/!4d coordinates");
      return {
        lat: parseFloat(match3d[1]),
        lng: parseFloat(match4d[1]),
        label: foundLabel
      };
    }

    // Priority 2: Google Maps @ format
    const googleRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
    const googleMatch = targetUrl.match(googleRegex);
    if (googleMatch) {
      console.log("Found Google Maps @ coordinates");
      return {
        lat: parseFloat(googleMatch[1]),
        lng: parseFloat(googleMatch[2]),
        label: foundLabel
      };
    }

    // Priority 3: Apple Maps coordinate= format (full place URLs)
    const appleCoordinateRegex = /coordinate=(-?\d+\.?\d*),(-?\d+\.?\d*)/;
    const appleCoordinateMatch = targetUrl.match(appleCoordinateRegex);
    if (appleCoordinateMatch) {
      console.log("Found Apple Maps coordinate= parameter");
      return {
        lat: parseFloat(appleCoordinateMatch[1]),
        lng: parseFloat(appleCoordinateMatch[2]),
        label: foundLabel
      };
    }

    // Priority 4: Apple Maps ll= format (share URLs)
    const appleRegex = /ll=(-?\d+\.\d+),(-?\d+\.\d+)/;
    const appleMatch = targetUrl.match(appleRegex);
    if (appleMatch) {
      console.log("Found Apple Maps ll= coordinates");
      return {
        lat: parseFloat(appleMatch[1]),
        lng: parseFloat(appleMatch[2]),
        label: foundLabel
      };
    }

    // Priority 5: Google Maps ?q= format
    const googleQueryRegex = /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/;
    const googleQueryMatch = targetUrl.match(googleQueryRegex);
    if (googleQueryMatch) {
      console.log("Found Google Maps ?q= coordinates");
      return {
        lat: parseFloat(googleQueryMatch[1]),
        lng: parseFloat(googleQueryMatch[2]),
        label: foundLabel
      };
    }

    console.log("No coordinate patterns matched in URL:", targetUrl);
    return null;
  };

  // Auto-parse coordinates when URL changes
  useEffect(() => {
    const parse = async () => {
      if (!locationUrl) {
        setCoordinates(null);
        return;
      }

      const result = await parseCoordinatesFromUrl(locationUrl);
      if (result) {
        console.log("Parsed result:", result);
        setCoordinates({ lat: result.lat, lng: result.lng });
        if (result.label && !locationLabel) {
          setLocationLabel(result.label);
        }
      } else {
        console.log("Could not parse coordinates from URL:", locationUrl);
        // Don't clear coordinates if parsing fails - keep existing ones
      }
    };
    parse();
  }, [locationUrl]);

  // ---- Load current user's profile ----
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      setProfileLoading(true);
      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          setProfile(data);
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error("Error loading profile for event creation", err);
        setAuthError("Could not load your profile for event creation.");
      } finally {
        setProfileLoading(false);
      }
    };

    void loadProfile();
  }, [user]);

  // ---- Load campuses for colors ----
  useEffect(() => {
    const loadCampuses = async () => {
      try {
        setCampusesLoading(true);
        const { getAllCampusesAndUniversities } = await import("@/lib/firestore-paths");
        const items = await getAllCampusesAndUniversities();

        // Map to local Campus type (if needed, but structure matches closely)
        const mapped: Campus[] = items.map(d => ({
          id: d.id,
          name: d.name,
          shortName: d.shortName,
          primaryColor: d.primaryColor ?? d.themeColor,
          secondaryColor: d.secondaryColor,
          themeColor: d.themeColor
        }));

        setCampuses(mapped);
      } catch (err) {
        console.error("Error loading campuses for event page", err);
      } finally {
        setCampusesLoading(false);
      }
    };

    void loadCampuses();
  }, []);

  // ---- Check if User is Campus Admin ----
  useEffect(() => {
    const checkCampusAdmin = async () => {
      if (!user || !profile?.campusId) {
        setIsCampusAdmin(false);
        return;
      }

      try {
        // Fetch the campus/university document
        const campusRef = doc(db, "universities", profile.campusId);
        const campusSnap = await getDoc(campusRef);

        if (campusSnap.exists()) {
          const campusData = campusSnap.data();
          const adminEmails = campusData.adminEmails || [];
          const userEmail = user.email?.toLowerCase();

          // Store campus image URL
          setCampusImageUrl(campusData.logoUrl || campusData.imageUrl || null);

          // Check if user's email is in the campus adminEmails array
          if (userEmail && adminEmails.map((e: string) => e.toLowerCase()).includes(userEmail)) {
            setIsCampusAdmin(true);
          } else {
            setIsCampusAdmin(false);
          }
        } else {
          setIsCampusAdmin(false);
        }
      } catch (err) {
        console.error("Error checking campus admin status:", err);
        setIsCampusAdmin(false);
      }
    };

    void checkCampusAdmin();
  }, [user, profile?.campusId]);

  // ---- Load User's Clubs ----
  useEffect(() => {
    const loadUserClubs = async () => {
      if (!user) return;
      setLoadingClubs(true);
      try {
        const { getUserClubs } = await import("../../../lib/clubs");
        const userClubsList = await getUserClubs(user.uid);
        const availableClubs: {
          id: string;
          name: string;
          role: string;
          allowMemberPosts?: boolean;
          imageUrl?: string;
          status?: string;
          type?: string;
          isVerified?: boolean;
          category?: string;
        }[] = [];

        for (const club of userClubsList) {
          // Check membership for role and club settings
          const memberSnap = await getDocs(
            query(collection(db, "clubs", club.id, "members"), where("uid", "==", user.uid))
          );

          if (!memberSnap.empty) {
            const memberData = memberSnap.docs[0].data() as ClubMember;
            const canPost =
              memberData.role === "owner" ||
              memberData.role === "admin" ||
              club.allowMemberPosts === true;

            if (canPost && memberData.status === "approved") {
              const clubData = club as any;
              availableClubs.push({
                id: club.id,
                name: club.name,
                role: memberData.role,
                allowMemberPosts: club.allowMemberPosts,
                imageUrl: clubData.logoUrl || clubData.coverImageUrl,
                status: memberData.status,
                type: clubData.type, // To differentiate dorms from clubs
                isVerified: clubData.isVerified, // For verification badge
                category: clubData.category, // For dorm detection
              });
            }
          }
        }
        setUserClubs(availableClubs);

        // Update selected club name if we have an initial ID
        if (initialClubId) {
          const found = availableClubs.find(c => c.id === initialClubId);
          if (found) setSelectedClubName(found.name);
        }
      } catch (err) {
        console.error("Error loading user clubs", err);
      } finally {
        setLoadingClubs(false);
      }
    };

    if (user) void loadUserClubs();
  }, [user, initialClubId]);

  // Update selected club name when ID changes
  useEffect(() => {
    if (selectedClubId) {
      const found = userClubs.find(c => c.id === selectedClubId);
      if (found) setSelectedClubName(found.name);
      else setSelectedClubName(null);
    } else {
      setSelectedClubName(null);
    }
  }, [selectedClubId, userClubs]);

  // Reset announcement type if user switches to context where announcements aren't allowed
  useEffect(() => {
    if (type !== "announcement") return;

    let canPostAnnouncement = false;

    // Announcements are ONLY for campus or club posts, NOT personal
    if (selectedClubId === "campus") {
      // Posting as campus - campus admins can post announcements
      canPostAnnouncement = isCampusAdmin;
    } else if (selectedClubId) {
      // Posting as a club - check if user is owner/admin
      const selectedClub = userClubs.find(c => c.id === selectedClubId);
      if (selectedClub) {
        canPostAnnouncement =
          (selectedClub.role === "owner" || selectedClub.role === "admin") &&
          selectedClub.allowMemberPosts !== true;
      }
    }
    // If posting as personal (!selectedClubId), canPostAnnouncement stays false

    // If announcements not allowed and currently selected, reset to "post"
    if (!canPostAnnouncement) {
      setType("post");
    }
  }, [selectedClubId, userClubs, isCampusAdmin, type]);

  // Helper function to determine if a club is a dorm
  const isDorm = (club: { type?: string; category?: string; name: string }) => {
    return club.type === "dorm" ||
      club.category?.toLowerCase() === "dorm" ||
      club.name.toLowerCase().includes("dorm");
  };

  // Determine university colors for this user (if any)
  const trimmedCampusName = (profile?.campus || "").trim();
  const selectedById =
    profile?.campusId && campuses.length
      ? campuses.find((u) => u.id === profile.campusId) || null
      : null;

  const selectedByName =
    !selectedById && trimmedCampusName && campuses.length
      ? campuses.find((u) => {
        const name = (u.name || "").trim().toLowerCase();
        const short = (u.shortName || "").trim().toLowerCase();
        const target = trimmedCampusName.toLowerCase();
        return name === target || (!!short && short === target);
      }) || null
      : null;

  const selectedUniversity = selectedById || selectedByName || null;

  const universityPrimary =
    (selectedUniversity?.primaryColor || selectedUniversity?.themeColor || "")
      .trim() || null;
  const universitySecondary =
    (selectedUniversity?.secondaryColor || "").trim() || null;

  const accentColor = universityPrimary || "#ffb200";
  const accentSoft = hexToRgba(accentColor, 0.16);

  // ---- Image Upload (Deferred) ----
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  // Clean up object URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []); // Only run on unmount

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...newFiles]);

      const newUrls = newFiles.map((file) => URL.createObjectURL(file));
      setPreviewUrls((prev) => [...prev, ...newUrls]);
    }
  };

  const removeImage = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => {
      const urlToRemove = prev[index];
      URL.revokeObjectURL(urlToRemove);
      return prev.filter((_, i) => i !== index);
    });
  };

  // ---- Form submit ----
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!user) {
      setFormError("You must be signed in to create events.");
      return;
    }


    if (isEvent) {
      if (!eventDate || !startTime || !endTime) {
        setFormError("Please set date, start time, and end time.");
        return;
      }
      if (!locationLabel.trim()) {
        setFormError("Please add a location label (e.g. Student Center).");
        return;
      }
    }

    // Ensure description is not empty OR there are images
    if ((!description || !description.trim()) && selectedFiles.length === 0) {
      setFormError("Please enter a description or add an image.");
      return;
    }

    try {
      setSaving(true);
      setUploading(true);

      // 1. Upload images if any
      const imageUrls: string[] = [];
      if (selectedFiles.length > 0) {
        const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
        const { storage } = await import("../../../lib/firebase");

        for (const file of selectedFiles) {
          const storageRef = ref(storage, `posts/${Date.now()}_${file.name}`);
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);
          imageUrls.push(url);
        }
      }

      // 2. Create post document in \"events\" collection (keeping collection name for data continuity)
      // 2. Create post document in "posts" collection
      const baseData: any = {
        description: description.trim(),
        authorId: user.uid,
        // authorName removed
        // authorUsername removed
        // authorAvatarUrl removed
        createdAt: serverTimestamp(),
        likes: [],
        seenCount: 0,
        type,
        isEvent: isEvent,
        // Moderation fields
        visibility: "visible",
        reportCount: 0,
      };

      if (imageUrls.length > 0) {
        baseData.imageUrls = imageUrls;
      }

      if (selectedClubId) {
        if (selectedClubId === "campus") {
          // Posting as campus
          baseData.ownerType = "campus";
          baseData.campusId = profile?.campusId;
          baseData.campusName = profile?.campus;
          if (campusImageUrl) baseData.campusAvatarUrl = campusImageUrl;
        } else {
          // Posting as club
          baseData.ownerType = "club";
          baseData.clubId = selectedClubId;
        }
      } else {
        baseData.ownerType = "personal";
      }

      if (isEvent) {
        Object.assign(baseData, {
          date: eventDate.trim(), // yyyy-mm-dd
          startTime: startTime.trim(), // hh:mm
          endTime: endTime.trim(), // hh:mm
          locationLabel: locationLabel.trim(),
          locationUrl: locationUrl.trim(),
          coordinates: coordinates,
          dressCode: dressCode.trim(),
          extraNotes: extraNotes.trim(),
          goingUids: [],
          maybeUids: [],
          notGoingUids: [],
        });
      }

      await addDoc(collection(db, "posts"), baseData);

      // 3. Redirect back
      if (selectedClubId && selectedClubId !== "campus") {
        router.push(`/clubs/${selectedClubId}`);
      } else {
        router.push("/");
      }
      setToast({ type: "success", message: "Post created." });
      // Reset form

      setDescription("");
      setSelectedFiles([]);
      setPreviewUrls([]);
      if (isEvent) {
        setEventDate("");
        setStartTime("");
        setEndTime("");
        setLocationUrl("");
        setLocationLabel("");
      }


    } catch (err) {
      console.error("Error creating event", err);
      setFormError("Could not create event. Please try again.");
      setToast({ type: "error", message: "Could not create event." });
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  // ---- Guards ----
  if (authLoading || profileLoading || campusesLoading) {
    return (
      <div className="flex h-screen items-center justify-center cc-page text-secondary">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 cc-page text-secondary">
        <p>You must sign in to create events.</p>
        <button
          onClick={() => router.push("/login")}
          className="rounded-full bg-brand px-6 py-2 text-sm font-medium text-brand-foreground hover:opacity-90"
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <>
      <Toast toast={toast} onClear={() => setToast(null)} />

      {/* Main Content using Layout Grid */}
      <div className="cc-page">
        <div className="mx-auto w-full max-w-7xl px-4 lg:px-8 py-6 lg:py-8">
          <div className={clsx(
            "grid gap-8 items-start",
            mainWidth < 1024 ? "grid-cols-1" : "grid-cols-12 gap-12"
          )}>

            {/* Left Column: Form */}
            <div className={clsx("space-y-6", mainWidth < 1024 ? "" : "col-span-7")}>
              {/* Header */}
              <header className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Create Post</h1>
                <p className="text-secondary text-sm">Share what's happening on campus.</p>
              </header>

              <form
                onSubmit={handleCreateEvent}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
                    e.preventDefault();
                  }
                }}
                className="space-y-6"
              >

                {/* Post As */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-secondary ml-1">Post As</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsPostAsMenuOpen(!isPostAsMenuOpen)}
                      className={clsx(
                        "w-full cc-section rounded-full transition-shadow flex items-center gap-3 px-4 py-3.5",
                        activeSection === "postAs" && "cc-shadow-soft"
                      )}
                    >
                      {/* Display selected option */}
                      {!selectedClubId && (
                        <>
                          <div className="h-10 w-10 rounded-full bg-secondary/20 ring-1 ring-secondary/30 shadow-sm overflow-hidden flex-shrink-0">
                            {profile?.photoURL || user?.photoURL ? (
                              <img src={profile?.photoURL || user?.photoURL || ""} alt="Your avatar" className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-secondary">
                                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </div>
                          <span className="flex-1 text-left text-sm text-foreground">Personal (Your Account)</span>
                        </>
                      )}
                      {selectedClubId === "campus" && (
                        <>
                          <div className="h-10 w-10 flex items-center justify-center flex-shrink-0">
                            {campusImageUrl ? (
                              <img src={campusImageUrl} alt="Campus logo" className="h-10 w-10 object-contain" />
                            ) : (
                              <BuildingLibraryIcon className="h-8 w-8 text-secondary" />
                            )}
                          </div>
                          <span className="flex-1 text-left text-sm text-foreground">Campus: {profile?.campus}</span>
                        </>
                      )}
                      {selectedClubId && selectedClubId !== "campus" && (() => {
                        const selectedClub = userClubs.find(c => c.id === selectedClubId);
                        return selectedClub ? (
                          <>
                            <div className="h-10 w-10 rounded-lg bg-secondary/20 ring-1 ring-secondary/30 shadow-sm overflow-hidden flex-shrink-0">
                              {selectedClub.imageUrl ? (
                                <img src={selectedClub.imageUrl} alt={selectedClub.name} className="h-full w-full object-cover" />
                              ) : isDorm(selectedClub) ? (
                                <div className="h-full w-full flex items-center justify-center text-secondary">
                                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                                  </svg>
                                </div>
                              ) : (
                                <div className="h-full w-full flex items-center justify-center text-secondary">
                                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 text-left">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-foreground">{selectedClub.name}</span>
                                {selectedClub.isVerified && (
                                  <CheckBadgeIcon className="h-4 w-4 text-brand" />
                                )}
                              </div>
                              <span className="text-xs text-secondary capitalize">{selectedClub.role}</span>
                            </div>
                          </>
                        ) : null;
                      })()}
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={clsx("w-4 h-4 text-secondary transition-transform", isPostAsMenuOpen && "rotate-180")}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>

                    {/* Dropdown menu */}
                    {isPostAsMenuOpen && (
                      <div className="absolute top-full left-0 right-0 mt-2 cc-section rounded-3xl overflow-hidden z-50 max-h-96 overflow-y-auto">
                        {/* Personal account */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedClubId(null);
                            setIsPostAsMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/5 transition-colors"
                        >
                          <div className="h-10 w-10 rounded-full bg-secondary/20 ring-1 ring-secondary/30 shadow-sm overflow-hidden flex-shrink-0">
                            {profile?.photoURL || user?.photoURL ? (
                              <img src={profile?.photoURL || user?.photoURL || ""} alt="Your avatar" className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-secondary">
                                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </div>
                          <span className="flex-1 text-left text-sm text-foreground">Personal (Your Account)</span>
                        </button>

                        {/* Campus option */}
                        {isCampusAdmin && profile?.campus && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedClubId("campus");
                              setIsPostAsMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/5 transition-colors border-t border-secondary/10"
                          >
                            <div className="h-10 w-10 flex items-center justify-center flex-shrink-0">
                              {campusImageUrl ? (
                                <img src={campusImageUrl} alt="Campus logo" className="h-10 w-10 object-contain" />
                              ) : (
                                <BuildingLibraryIcon className="h-8 w-8 text-secondary" />
                              )}
                            </div>
                            <span className="flex-1 text-left text-sm text-foreground">Campus: {profile.campus}</span>
                          </button>
                        )}

                        {/* Clubs */}
                        {userClubs.map((club) => (
                          <button
                            key={club.id}
                            type="button"
                            onClick={() => {
                              setSelectedClubId(club.id);
                              setIsPostAsMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/5 transition-colors border-t border-secondary/10"
                          >
                            <div className="h-10 w-10 rounded-lg bg-secondary/20 ring-1 ring-secondary/30 shadow-sm overflow-hidden flex-shrink-0">
                              {club.imageUrl ? (
                                <img src={club.imageUrl} alt={club.name} className="h-full w-full object-cover" />
                              ) : isDorm(club) ? (
                                <div className="h-full w-full flex items-center justify-center text-secondary">
                                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                                  </svg>
                                </div>
                              ) : (
                                <div className="h-full w-full flex items-center justify-center text-secondary">
                                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 text-left">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-foreground">{club.name}</span>
                                {club.isVerified && (
                                  <CheckBadgeIcon className="h-4 w-4 text-brand" />
                                )}
                              </div>
                              <span className="text-xs text-secondary capitalize">{club.role}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {loadingClubs && <p className="text-xs text-secondary animate-pulse ml-1">Loading clubs...</p>}
                </div>

                {/* Main Input Details */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-secondary ml-1">Details</label>
                  <div
                    className={clsx(
                      "cc-section cc-radius-24 overflow-hidden divide-y divide-secondary/10 transition-shadow",
                      activeSection === "details" && "cc-shadow-soft"
                    )}
                    onFocusCapture={() => setActiveSection("details")}
                    onClick={() => setActiveSection("details")}
                  >
                    {/* Description */}
                    <textarea
                      rows={4}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full resize-none bg-transparent px-4 py-3.5 text-sm text-foreground placeholder:text-secondary focus:outline-none transition-colors"
                      placeholder="What's going on?"
                    />

                    {/* Image Upload */}
                    <div className="flex flex-col gap-3 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-secondary">
                          {selectedFiles.length > 0 ? `${selectedFiles.length} photo(s)` : "Photos"}
                        </span>
                        <label className="cursor-pointer rounded-full bg-secondary/15 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/25 transition-colors cc-hover-shadow">
                          Add Photos
                          <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
                        </label>
                      </div>
                      {previewUrls.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                          {previewUrls.map((url, idx) => (
                            <div key={url} className="relative h-20 w-20 flex-shrink-0 overflow-hidden cc-radius-24 ring-2 ring-inset ring-secondary/25 bg-secondary/10 group">
                              <img src={url} alt="Preview" className="h-full w-full object-cover" />
                              <button type="button" onClick={() => removeImage(idx)} className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-foreground/10 cc-glass-strong text-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80 hover:text-white">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Post Type Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-secondary ml-1">Post Type</label>
                  <div
                    className={clsx(
                      "cc-section cc-radius-24 p-1.5 flex transition-shadow",
                      activeSection === "type" && "cc-shadow-soft"
                    )}
                    onClick={() => setActiveSection("type")}
                  >
                    {(() => {
                      // Determine if announcements should be available
                      let canPostAnnouncement = false;

                      // Announcements are ONLY for campus or club posts, NOT personal
                      if (selectedClubId === "campus") {
                        // Posting as campus - campus admins can post announcements
                        canPostAnnouncement = isCampusAdmin;
                      } else if (selectedClubId) {
                        // Posting as a club - check if user is owner/admin
                        const selectedClub = userClubs.find(c => c.id === selectedClubId);
                        if (selectedClub) {
                          // Only allow announcements if user is owner/admin
                          // AND club doesn't allow all members to post (indicating official club posts)
                          canPostAnnouncement =
                            (selectedClub.role === "owner" || selectedClub.role === "admin") &&
                            selectedClub.allowMemberPosts !== true;
                        }
                      }
                      // If posting as personal (!selectedClubId), canPostAnnouncement stays false

                      const postTypes = [
                        { id: "post", label: "Post", icon: ChatBubbleBottomCenterTextIcon },
                        { id: "event", label: "Event", icon: CalendarIcon },
                      ];

                      // Only add announcement if user can post announcements
                      if (canPostAnnouncement) {
                        postTypes.push({ id: "announcement", label: "Announcement", icon: MegaphoneIcon });
                      }

                      return postTypes.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setType(t.id as PostType)}
                          className={clsx(
                            "flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-full transition-all",
                            type === t.id
                              ? "bg-brand text-brand-foreground shadow-sm"
                              : "text-secondary hover:text-foreground hover:bg-secondary/5"
                          )}
                        >
                          <t.icon className="h-4 w-4" />
                          {t.label}
                        </button>
                      ));
                    })()}
                  </div>
                </div>

                {/* Event Logistics */}
                {isEvent && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="text-xs font-bold uppercase tracking-wider text-secondary ml-1">Event Details</label>
                    <div
                      className={clsx(
                        "cc-section cc-radius-24 overflow-hidden divide-y divide-secondary/10 transition-shadow",
                        activeSection === "eventDetails" && "cc-shadow-soft"
                      )}
                      onFocusCapture={() => setActiveSection("eventDetails")}
                      onClick={() => setActiveSection("eventDetails")}
                    >
                      {/* Date */}
                      <div className="flex items-center justify-between px-4 py-3.5 cc-row-hover focus-within:cc-row-active">
                        <span className="text-sm text-secondary">Date</span>
                        <div className="relative">
                          <input
                            type="date"
                            value={eventDate}
                            onChange={(e) => setEventDate(e.target.value)}
                            className="cc-picker-input cursor-pointer"
                            required={isEvent}
                          />
                          <CalendarIcon className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 cc-picker-icon" />
                        </div>
                      </div>
                      {/* Start Time */}
                      <div className="flex items-center justify-between px-4 py-3.5 cc-row-hover focus-within:cc-row-active">
                        <span className="text-sm text-secondary">Start Time</span>
                        <div className="relative">
                          <input
                            type="time"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            className="cc-picker-input cursor-pointer"
                            required={isEvent}
                          />
                          <ClockIcon className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 cc-picker-icon" />
                        </div>
                      </div>
                      {/* End Time */}
                      <div className="flex items-center justify-between px-4 py-3.5 cc-row-hover focus-within:cc-row-active">
                        <span className="text-sm text-secondary">End Time</span>
                        <div className="relative">
                          <input
                            type="time"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            className="cc-picker-input cursor-pointer"
                            required={isEvent}
                          />
                          <ClockIcon className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 cc-picker-icon" />
                        </div>
                      </div>

                      {/* Location URL */}
                      <div className="relative flex items-center pl-4 pr-2.5 py-1 cc-row-hover focus-within:cc-row-active">
                        <input
                          value={locationUrl}
                          onChange={(e) => setLocationUrl(e.target.value)}
                          className="w-full bg-transparent py-2.5 text-sm text-foreground placeholder:text-secondary focus:outline-none"
                          placeholder="Paste Map URL (Apple/Google)"
                        />
                        <button
                          type="button"
                          onClick={() => openView("mapHelp", {})}
                          className="ml-2 flex flex-none items-center justify-center rounded-full p-1.5 text-secondary hover:bg-secondary/10 hover:text-foreground transition-colors"
                          title="Help"
                        >
                          <QuestionMarkCircleIcon className="h-5 w-5" />
                        </button>
                      </div>
                      {/* Location Label */}
                      {coordinates && (
                        <div className="px-4 py-2 text-xs text-secondary border-t border-secondary/5">
                          <span className="font-mono">lat: {coordinates.lat}, lng: {coordinates.lng}</span>
                        </div>
                      )}
                      <input
                        value={locationLabel}
                        onChange={(e) => setLocationLabel(e.target.value)}
                        className="w-full bg-transparent px-4 py-3.5 text-sm text-foreground placeholder:text-secondary focus:outline-none cc-row-hover focus-within:cc-row-active"
                        placeholder="Location Label (e.g. Library)"
                      />
                      {/* Map Toggle */}
                      {coordinates && (
                        <div className="flex items-center justify-between px-4 py-3.5 cc-row-hover focus-within:cc-row-active">
                          <span className="text-sm text-secondary">Show map preview</span>
                          <button
                            type="button"
                            role="switch"
                            onClick={() => setShowMapPreview(!showMapPreview)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${showMapPreview ? 'bg-brand' : 'bg-secondary/40'}`}
                          >
                            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${showMapPreview ? 'translate-x-5' : 'translate-x-1'}`} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Extra Notes */}
                {isEvent && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-secondary ml-1">Additional Info</label>
                    <div
                      className={clsx(
                        "cc-section cc-radius-24 overflow-hidden divide-y divide-secondary/10 transition-shadow",
                        activeSection === "extraInfo" && "cc-shadow-soft"
                      )}
                      onFocusCapture={() => setActiveSection("extraInfo")}
                      onClick={() => setActiveSection("extraInfo")}
                    >
                      <textarea
                        rows={2}
                        value={dressCode}
                        onChange={(e) => setDressCode(e.target.value)}
                        className="w-full resize-none bg-transparent px-4 py-3.5 text-sm text-foreground focus:outline-none cc-row-hover focus-within:cc-row-active placeholder:text-secondary"
                        placeholder="Dress Code (Optional)"
                      />
                      <textarea
                        rows={2}
                        value={extraNotes}
                        onChange={(e) => setExtraNotes(e.target.value)}
                        className="w-full resize-none bg-transparent px-4 py-3.5 text-sm text-foreground focus:outline-none cc-row-hover focus-within:cc-row-active placeholder:text-secondary"
                        placeholder="Other Notes (Optional)"
                      />
                    </div>
                  </div>
                )}

                {formError && (
                  <div className="w-full rounded-xl bg-red-500/10 p-3 text-xs text-red-400">
                    {formError}
                  </div>
                )}

                {authError && (
                  <div className="w-full rounded-xl bg-red-500/10 p-3 text-xs text-red-400">
                    {authError}
                  </div>
                )}

                <div className="flex w-full gap-3 items-center">
                  {/* Cancel Button - Icon on mobile, text on desktop */}
                  <button
                    type="button"
                    onClick={() => router.back()}
                    aria-label="Cancel"
                    className={clsx(
                      "flex h-11 items-center justify-center rounded-full bg-secondary/15 text-secondary hover:bg-secondary/25 hover:text-foreground transition-all cc-hover-shadow",
                      isMainNarrow ? "w-11 px-0" : "flex-1 px-6"
                    )}
                  >
                    {isMainNarrow ? (
                      /* Icon only - visible on mobile/narrow */
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                      </svg>
                    ) : (
                      /* Text - visible on desktop */
                      <span className="text-sm font-medium">Cancel</span>
                    )}
                  </button>

                  {/* Create Button - Primary action */}
                  <button
                    type="submit"
                    disabled={saving || uploading}
                    className="flex-1 h-11 rounded-full bg-brand px-6 text-sm font-bold text-brand-foreground cc-shadow-soft cc-hover-shadow transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:hover:scale-100"
                  >
                    {saving ? "Creating..." : "Create Post"}
                  </button>
                </div>
              </form>
            </div>

            {/* Right Column: Preview (Stacked on mobile, sticky on desktop) */}
            <div className={clsx("sticky top-24", mainWidth < 1024 ? "" : "col-span-5")}>
              <div className="space-y-6">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-secondary ml-1">Live Preview</h2>
                </div>

                {/* Preview Card Wrapper */}
                <div>
                  <PostCard

                    post={{
                      id: "preview",
                      title: description || "New Post",
                      content: description, // Old field
                      imageUrls: previewUrls,
                      date: eventDate,
                      startTime: startTime,
                      endTime: endTime,
                      locationLabel: locationLabel,

                      authorName: (
                        selectedClubId === "campus"
                          ? profile?.campus
                          : selectedClubId
                            ? userClubs.find(c => c.id === selectedClubId)?.name
                            : profile?.preferredName
                      ) || user?.displayName || "You",
                      authorUsername: selectedClubId ? undefined : profile?.username,
                      authorAvatarUrl: selectedClubId ? undefined : (profile?.photoURL || user?.photoURL),

                      authorId: user?.uid || "user", // Dummy ID
                      coordinates: isEvent && showMapPreview && coordinates ? coordinates : undefined,
                      type: type,
                      isEvent: isEvent,
                      likes: [],
                      goingUids: [],
                      maybeUids: [],
                      notGoingUids: [],
                      commentsCount: 0,
                      repliesCommentsCount: 0,
                      clubId: (selectedClubId && selectedClubId !== "campus") ? selectedClubId : undefined,
                      createdAt: new Date() as any, // Mock timestamp
                      isVerified: selectedClubId && selectedClubId !== "campus"
                        ? userClubs.find(c => c.id === selectedClubId)?.isVerified
                        : undefined,
                      ownerType: selectedClubId === "campus" ? "campus" : selectedClubId ? "club" : "personal",
                      campusName: selectedClubId === "campus" ? profile?.campus : undefined,
                      campusAvatarUrl: selectedClubId === "campus" ? campusImageUrl || undefined : undefined,
                    }}
                    previewMode={true}
                    variant="threads"
                    hideCommentPreview={true}
                  />
                </div>

                <p className="text-xs text-secondary text-center px-4">
                  This is how your post will appear in the feed.
                </p>
              </div>
            </div>

          </div>
        </div >
      </div >
    </>
  );
}