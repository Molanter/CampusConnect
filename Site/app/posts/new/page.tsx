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
import { CalendarIcon, ClockIcon, QuestionMarkCircleIcon } from "@heroicons/react/24/outline";

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

  // Event form fields
  const [isEvent, setIsEvent] = useState(false);

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
  const [userClubs, setUserClubs] = useState<{ id: string; name: string; role: string }[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(initialClubId);
  const [loadingClubs, setLoadingClubs] = useState(false);
  const [selectedClubName, setSelectedClubName] = useState<string | null>(null);

  // Active section state for visual feedback
  const [activeSection, setActiveSection] = useState<
    "postAs" | "details" | "isEvent" | "eventDetails" | "extraInfo" | null
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

    // If it's a short Google Maps URL, expand it first
    if (url.includes("goo.gl") || url.includes("maps.app.goo.gl")) {
      try {
        console.log("Expanding URL:", url);
        const res = await fetch(`/api/expand-map-url?url=${encodeURIComponent(url)}`);
        if (res.ok) {
          const data = await res.json();
          console.log("Expanded data:", data);
          if (data.expandedUrl) {
            targetUrl = data.expandedUrl;
          }
        } else {
          console.error("Expansion failed:", res.status, res.statusText);
        }
      } catch (err) {
        console.error("Failed to expand map URL", err);
      }
    }

    console.log("Target URL for regex:", targetUrl);

    // Priority 1: Data params (!3d and !4d) - often used for specific pin location
    // Format: ...!3d38.835848!4d-77.0828711...
    const data3dRegex = /!3d(-?\d+\.\d+)/;
    const data4dRegex = /!4d(-?\d+\.\d+)/;
    const match3d = targetUrl.match(data3dRegex);
    const match4d = targetUrl.match(data4dRegex);

    if (match3d && match4d) {
      return {
        lat: parseFloat(match3d[1]),
        lng: parseFloat(match4d[1]),
      };
    }

    // Google Maps: @lat,lng
    const googleRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
    const googleMatch = targetUrl.match(googleRegex);
    if (googleMatch) {
      return {
        lat: parseFloat(googleMatch[1]),
        lng: parseFloat(googleMatch[2]),
      };
    }

    // Google Maps: /search/lat,lng
    const googleSearchRegex = /search\/(-?\d+\.\d+)[, ]\+?(-?\d+\.\d+)/;
    const googleSearchMatch = targetUrl.match(googleSearchRegex);
    if (googleSearchMatch) {
      return {
        lat: parseFloat(googleSearchMatch[1]),
        lng: parseFloat(googleSearchMatch[2]),
      };
    }

    // Google Maps: ?q=lat,lng
    const googleQueryRegex = /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/;
    const googleQueryMatch = targetUrl.match(googleQueryRegex);
    if (googleQueryMatch) {
      return {
        lat: parseFloat(googleQueryMatch[1]),
        lng: parseFloat(googleQueryMatch[2]),
      };
    }

    // Apple Maps: ll=lat,lng
    const appleRegex = /ll=(-?\d+\.\d+),(-?\d+\.\d+)/;
    const appleMatch = targetUrl.match(appleRegex);
    if (appleMatch) {
      return {
        lat: parseFloat(appleMatch[1]),
        lng: parseFloat(appleMatch[2]),
      };
    }

    return null;
  };

  // Auto-parse coordinates when URL changes
  useEffect(() => {
    const parse = async () => {
      const coords = await parseCoordinatesFromUrl(locationUrl);
      if (coords) {
        setCoordinates(coords);
      } else {
        // Only clear if user cleared the URL, otherwise keep previous valid coords?
        // Or clear if invalid? Let's clear if invalid to avoid mismatch.
        if (!locationUrl) setCoordinates(null);
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

  // ---- Load User's Clubs ----
  useEffect(() => {
    const loadUserClubs = async () => {
      if (!user) return;
      setLoadingClubs(true);
      try {
        const { getUserClubs } = await import("../../../lib/clubs");
        const userClubsList = await getUserClubs(user.uid);
        const availableClubs: { id: string; name: string; role: string }[] = [];

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
              availableClubs.push({
                id: club.id,
                name: club.name,
                role: memberData.role,
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
        isEvent: isEvent,
        // Moderation fields
        visibility: "visible",
        reportCount: 0,
      };

      if (imageUrls.length > 0) {
        baseData.imageUrls = imageUrls;
      }

      if (selectedClubId) {
        baseData.clubId = selectedClubId;
      }

      if (isEvent) {
        Object.assign(baseData, {
          date: eventDate, // yyyy-mm-dd
          startTime: startTime, // hh:mm
          endTime: endTime, // hh:mm
          locationLabel: locationLabel.trim(),
          coordinates: coordinates,
          goingUids: [],
          maybeUids: [],
          notGoingUids: [],
        });
      }

      await addDoc(collection(db, "posts"), baseData);

      // 3. Redirect back
      if (selectedClubId) {
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

              <form onSubmit={handleCreateEvent} className="space-y-6">

                {/* Post As */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-secondary ml-1">Post As</label>
                  <div
                    className={clsx(
                      "relative cc-section cc-radius-24 overflow-hidden transition-shadow",
                      activeSection === "postAs" && "cc-shadow-soft"
                    )}
                    onFocusCapture={() => setActiveSection("postAs")}
                    onClick={() => setActiveSection("postAs")}
                  >
                    <select
                      value={selectedClubId || ""}
                      onChange={(e) => setSelectedClubId(e.target.value || null)}
                      className="w-full appearance-none bg-transparent px-4 py-3.5 text-sm text-foreground focus:outline-none"
                    >
                      <option value="" className="bg-surface-2 text-foreground">Personal (Your Account)</option>
                      {userClubs.map((club) => (
                        <option key={club.id} value={club.id} className="bg-surface-2 text-foreground">
                          Club: {club.name} ({club.role})
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-secondary">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </div>
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
                            <div key={url} className="relative h-20 w-20 flex-shrink-0 overflow-hidden cc-radius-24 ring-1 ring-inset ring-secondary/20 bg-secondary/10 group">
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

                {/* Is Event Toggle */}
                <div
                  className={clsx(
                    "cc-section cc-radius-24 px-4 py-3 flex items-center justify-between transition-shadow",
                    activeSection === "isEvent" && "cc-shadow-soft"
                  )}
                  onClick={() => setActiveSection("isEvent")}
                >
                  <span className="text-sm font-medium text-foreground">Is this an event?</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isEvent}
                    onClick={() => setIsEvent(!isEvent)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isEvent ? 'bg-brand' : 'bg-secondary/40'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isEvent ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
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

                      authorName: (selectedClubId ? userClubs.find(c => c.id === selectedClubId)?.name : profile?.preferredName) || user?.displayName || "You",
                      authorUsername: selectedClubId ? undefined : profile?.username,
                      authorAvatarUrl: selectedClubId ? undefined : (profile?.photoURL || user?.photoURL),

                      authorId: user?.uid || "user", // Dummy ID
                      coordinates: isEvent && showMapPreview && coordinates ? coordinates : undefined,
                      isEvent: isEvent,
                      likes: [],
                      goingUids: [],
                      maybeUids: [],
                      notGoingUids: [],
                      commentsCount: 0,
                      repliesCommentsCount: 0,
                      clubId: selectedClubId || undefined,
                      createdAt: new Date() as any, // Mock timestamp
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
        </div>
      </div>
    </>
  );
}