"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

type University = {
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

function MapHelpModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-[#1C1C1E] ring-1 ring-white/10 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <h3 className="text-lg font-bold text-white">How to get a Map Link</h3>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <h4 className="font-semibold text-blue-400 flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C7.31 0 3.5 3.81 3.5 8.5c0 5.42 7.72 14.73 8.06 15.13.19.23.53.23.72 0 .34-.4 8.06-9.71 8.06-15.13C20.5 3.81 16.69 0 12 0zm0 12.5c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" /></svg>
              Google Maps
            </h4>
            <p className="text-sm text-neutral-300">
              You can copy the URL from your browser's address bar, or use the "Share" button and click "Copy Link".
            </p>
            <code className="block rounded bg-black/30 p-2 text-xs text-neutral-400">
              maps.app.goo.gl/... or google.com/maps/...
            </code>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-pink-400 flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" /></svg>
              Apple Maps
            </h4>
            <p className="text-sm text-neutral-300">
              Select a location, click the "Share" button, and choose "Copy Link". It usually looks like:
            </p>
            <code className="block rounded bg-black/30 p-2 text-xs text-neutral-400">
              maps.apple.com/?...&ll=lat,lng...
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CreateEventPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialClubId = searchParams.get("clubId");

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [universities, setUniversities] = useState<University[]>([]);
  const [universitiesLoading, setUniversitiesLoading] = useState(false);

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
  const [isMapHelpOpen, setIsMapHelpOpen] = useState(false);
  const [showMapPreview, setShowMapPreview] = useState(true); // Toggle for map preview

  // Club posting state
  const [userClubs, setUserClubs] = useState<{ id: string; name: string; role: string }[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(initialClubId);
  const [loadingClubs, setLoadingClubs] = useState(false);
  const [selectedClubName, setSelectedClubName] = useState<string | null>(null);

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

  // ---- Load universities for colors (optional) ----
  useEffect(() => {
    const loadUniversities = async () => {
      try {
        setUniversitiesLoading(true);
        const snap = await getDocs(collection(db, "universities"));
        const items: University[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name || "",
            shortName: data.shortName ?? null,
            primaryColor: data.primaryColor ?? data.themeColor ?? null,
            secondaryColor: data.secondaryColor ?? null,
            themeColor: data.themeColor ?? null,
          };
        });
        setUniversities(items);
      } catch (err) {
        console.error("Error loading universities for event page", err);
      } finally {
        setUniversitiesLoading(false);
      }
    };

    void loadUniversities();
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
    profile?.campusId && universities.length
      ? universities.find((u) => u.id === profile.campusId) || null
      : null;

  const selectedByName =
    !selectedById && trimmedCampusName && universities.length
      ? universities.find((u) => {
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

      // 2. Create post document in "events" collection (keeping collection name for data continuity)
      // 2. Create post document in "posts" collection
      const baseData: any = {
        description: description.trim(),
        authorId: user.uid,
        authorName: profile?.preferredName || user.displayName || "Anonymous",
        authorUsername: profile?.username || null,
        // authorAvatarUrl removed
        createdAt: serverTimestamp(),
        likes: [],
        isEvent: isEvent,
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
  if (authLoading || profileLoading || universitiesLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-neutral-400">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 text-neutral-300">
        <p>You must sign in to create events.</p>
        <button
          onClick={() => router.push("/login")}
          className="rounded-full bg-white px-6 py-2 text-sm font-medium text-black hover:bg-neutral-200"
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <>
      <Toast toast={toast} onClear={() => setToast(null)} />

      {/* Background with abstract mesh for glass effect */}
      <div className="fixed inset-0 -z-10 bg-neutral-950">
        <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-neutral-800/20 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-neutral-800/20 blur-[100px]" />
      </div>

      <div className="min-h-screen px-4 py-8 text-neutral-200 md:px-8 md:py-12 @container">
        <div className="mx-auto w-full max-w-3xl lg:max-w-4xl xl:max-w-5xl @min-[1100px]:max-w-[1600px]">

          {/* Header */}
          <header className="mb-8 text-center md:text-left w-full max-w-xl mx-auto @min-[1100px]:max-w-none @min-[1100px]:mx-0">
            <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
              Create Post
            </h1>
            <p className="mt-2 text-neutral-400">
              Share what's happening on campus.
            </p>
          </header>

          <form onSubmit={handleCreateEvent} className="grid gap-8 @min-[1100px]:grid-cols-12">

            {/* Left Column: Main Form Inputs */}
            <div className="space-y-6 @min-[1100px]:col-span-7 w-full max-w-xl mx-auto @min-[1100px]:max-w-none @min-[1100px]:mx-0">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-500">
                Post Details
              </h2>

              {/* Section: Post As */}
              <div className="space-y-2 mb-6">
                <h3 className="ml-4 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                  Post As
                </h3>
                <div className="rounded-3xl bg-neutral-900/40 p-1 backdrop-blur-2xl ring-1 ring-white/10">
                  <div className="relative bg-neutral-800/30 rounded-[20px] hover:bg-neutral-800/50 transition-colors">
                    <select
                      value={selectedClubId || ""}
                      onChange={(e) => setSelectedClubId(e.target.value || null)}
                      className="w-full appearance-none bg-transparent px-4 py-3 text-sm text-white focus:outline-none"
                    >
                      <option value="" className="bg-neutral-900 text-white">Personal (Your Account)</option>
                      {userClubs.map((club) => (
                        <option key={club.id} value={club.id} className="bg-neutral-900 text-white">
                          Club: {club.name} ({club.role})
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-neutral-500">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </div>
                  </div>
                </div>
                {loadingClubs && (
                  <p className="ml-4 text-[10px] text-neutral-500 animate-pulse">Loading your clubs...</p>
                )}
              </div>

              {/* Section: Basic Info */}
              <div className="rounded-3xl bg-neutral-900/40 p-1 backdrop-blur-2xl ring-1 ring-white/10">
                <div className="space-y-[1px]">


                  <div className="relative bg-neutral-800/30 first:rounded-t-[20px] last:rounded-b-[20px] hover:bg-neutral-800/50 transition-colors">
                    <textarea
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="peer w-full resize-none bg-transparent px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none"
                      placeholder="Description"
                    />
                  </div>

                  {/* Image Upload */}
                  <div className="relative bg-neutral-800/30 first:rounded-t-[20px] last:rounded-b-[20px] hover:bg-neutral-800/50 transition-colors">
                    <div className="flex flex-col gap-3 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-neutral-400">
                          {selectedFiles.length > 0
                            ? `${selectedFiles.length} photo${selectedFiles.length > 1 ? 's' : ''} selected`
                            : "Add Photos"}
                        </span>
                        <label className="cursor-pointer rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20">
                          Choose Files
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={handleImageSelect}
                          />
                        </label>
                      </div>

                      {/* Thumbnail Preview List */}
                      {previewUrls.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-2">
                          {previewUrls.map((url, idx) => (
                            <div key={url} className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-white/10">
                              <img src={url} alt="Preview" className="h-full w-full object-cover" />
                              <button
                                type="button"
                                onClick={() => removeImage(idx)}
                                className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-[10px] text-white hover:bg-red-500"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Make Event Toggle */}
              <div className="rounded-3xl bg-neutral-900/40 p-1 backdrop-blur-2xl ring-1 ring-white/10 mt-6">
                <div className="flex items-center justify-between bg-neutral-800/30 px-4 py-3 rounded-[20px] hover:bg-neutral-800/50 transition-colors">
                  <span className="text-sm font-medium text-white">Make this an event?</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isEvent}
                    onClick={() => setIsEvent(!isEvent)}
                    style={{
                      backgroundColor: isEvent ? '#ffb200' : '#525252'
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-900`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isEvent ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                  </button>
                </div>
              </div>

              {/* Section: Logistics */}
              {isEvent && (
                <div className="space-y-2">
                  <h3 className="ml-4 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                    Time & Location
                  </h3>
                  <div className="rounded-3xl bg-neutral-900/40 p-1 backdrop-blur-2xl ring-1 ring-white/10">
                    <div className="space-y-[1px]">
                      <div className="flex items-center justify-between bg-neutral-800/30 px-4 py-3 first:rounded-t-[20px] last:rounded-b-[20px] hover:bg-neutral-800/50 transition-colors">
                        <span className="text-sm text-neutral-300">Date</span>
                        <input
                          type="date"
                          value={eventDate}
                          onChange={(e) => setEventDate(e.target.value)}
                          className="bg-transparent text-right text-sm text-white focus:outline-none [color-scheme:dark]"
                          required={isEvent}
                        />
                      </div>
                      <div className="flex items-center justify-between bg-neutral-800/30 px-4 py-3 first:rounded-t-[20px] last:rounded-b-[20px] hover:bg-neutral-800/50 transition-colors">
                        <span className="text-sm text-neutral-300">Start Time</span>
                        <input
                          type="time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="bg-transparent text-right text-sm text-white focus:outline-none [color-scheme:dark]"
                          required={isEvent}
                        />
                      </div>
                      <div className="flex items-center justify-between bg-neutral-800/30 px-4 py-3 first:rounded-t-[20px] last:rounded-b-[20px] hover:bg-neutral-800/50 transition-colors">
                        <span className="text-sm text-neutral-300">End Time</span>
                        <input
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="bg-transparent text-right text-sm text-white focus:outline-none [color-scheme:dark]"
                          required={isEvent}
                        />
                      </div>
                      <div className="relative bg-neutral-800/30 first:rounded-t-[20px] last:rounded-b-[20px] hover:bg-neutral-800/50 transition-colors flex items-center">
                        <input
                          value={locationUrl}
                          onChange={(e) => setLocationUrl(e.target.value)}
                          className="w-full bg-transparent px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none"
                          placeholder="Paste Map URL (Apple/Google)"
                        />
                        <button
                          type="button"
                          onClick={() => setIsMapHelpOpen(true)}
                          className="mr-3 text-neutral-500 hover:text-white transition-colors"
                          title="How to get link?"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                          </svg>
                        </button>
                      </div>
                      <div className="relative bg-neutral-800/30 first:rounded-t-[20px] last:rounded-b-[20px] hover:bg-neutral-800/50 transition-colors">
                        <input
                          value={locationLabel}
                          onChange={(e) => setLocationLabel(e.target.value)}
                          className="w-full bg-transparent px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none"
                          placeholder="Location Label (e.g. Student Center)"
                        />
                      </div>
                      {coordinates && (
                        <div className="flex items-center justify-between bg-neutral-800/30 px-4 py-3 first:rounded-t-[20px] last:rounded-b-[20px] hover:bg-neutral-800/50 transition-colors">
                          <span className="text-sm text-neutral-300">Show map in preview</span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={showMapPreview}
                            onClick={() => setShowMapPreview(!showMapPreview)}
                            style={{
                              backgroundColor: showMapPreview ? '#ffb200' : '#525252'
                            }}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-900`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showMapPreview ? 'translate-x-6' : 'translate-x-1'
                                }`}
                            />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Section: Extra Details */}
              {isEvent && (
                <div className="space-y-2">
                  <h3 className="ml-4 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                    More Info
                  </h3>
                  <div className="rounded-3xl bg-neutral-900/40 p-1 backdrop-blur-2xl ring-1 ring-white/10">
                    <div className="space-y-[1px]">
                      <div className="relative bg-neutral-800/30 first:rounded-t-[20px] last:rounded-b-[20px] hover:bg-neutral-800/50 transition-colors">
                        <input
                          value={dressCode}
                          onChange={(e) => setDressCode(e.target.value)}
                          className="w-full bg-transparent px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none"
                          placeholder="Dress Code (Optional)"
                        />
                      </div>
                      <div className="relative bg-neutral-800/30 first:rounded-t-[20px] last:rounded-b-[20px] hover:bg-neutral-800/50 transition-colors">
                        <input
                          value={extraNotes}
                          onChange={(e) => setExtraNotes(e.target.value)}
                          className="w-full bg-transparent px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none"
                          placeholder="Extra Notes (Optional)"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Right Column: Preview / Actions */}
            <div className="space-y-6 @min-[1100px]:col-span-5 @min-[1100px]:sticky @min-[1100px]:top-8 @min-[1100px]:h-fit w-full max-w-xl mx-auto @min-[1100px]:max-w-none @min-[1100px]:mx-0">
              <div>
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-500 text-center">
                  Preview
                </h2>

                <div className="flex flex-col gap-4 mx-auto w-full">
                  {/* Details Card with integrated Media Grid (PostCard handles it all) */}
                  <PostCard
                    post={{
                      id: "preview",
                      title: "",
                      content: description,
                      imageUrls: previewUrls,
                      date: isEvent ? eventDate : undefined,
                      startTime: isEvent ? startTime : undefined,
                      endTime: isEvent ? endTime : undefined,
                      locationLabel: isEvent ? locationLabel : undefined,
                      authorId: user?.uid || "current",
                      authorName: selectedClubName || profile?.preferredName || user?.displayName || "You",
                      authorUsername: selectedClubId ? undefined : profile?.username,
                      authorAvatarUrl: selectedClubId ? undefined : (profile?.photoURL || user?.photoURL), // Fallback to generic icon for clubs for now
                      coordinates: isEvent && showMapPreview && coordinates ? coordinates : undefined,
                      isEvent: isEvent,
                      likes: [],
                      goingUids: [],
                      maybeUids: [],
                      notGoingUids: [],
                      clubId: selectedClubId || undefined,
                    }}
                    previewMode={true}
                    variant="threads"
                  />
                </div>
              </div>

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

              <div className="flex w-full flex-col gap-3">
                <button
                  type="submit"
                  disabled={saving || uploading}
                  className="w-full rounded-full bg-[#ffb200] py-3 text-sm font-bold text-black shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:hover:scale-100"
                >
                  {saving ? "Creating..." : "Create Post"}
                </button>
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="w-full rounded-full bg-neutral-800/50 py-3 text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>

          </form>
        </div>
      </div>
      <MapHelpModal isOpen={isMapHelpOpen} onClose={() => setIsMapHelpOpen(false)} />
    </>
  );
}