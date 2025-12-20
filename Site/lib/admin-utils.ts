"use client";

import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

export function isGlobalAdmin(
  email?: string | null,
  admins?: string[] | null
) {
  if (!email || !admins) return false;
  return admins.includes(email.toLowerCase());
}

export async function fetchGlobalAdminEmails() {
  try {
    const ref = doc(db, "config", "admin");
    const snap = await getDoc(ref);
    const data = snap.data() as { globalAdminEmails?: string[] } | undefined;
    const emails = data?.globalAdminEmails ?? [];
    return emails.map((email) => email.toLowerCase());
  } catch (error) {
    console.error("Error loading global admin emails:", error);
    return [];
  }
}

