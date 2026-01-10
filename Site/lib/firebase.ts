"use client";

import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth"; // Keep GoogleAuthProvider as it's used later
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { getMessaging, isSupported, Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase only if it hasn't been initialized yet
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Full Firestore client (supports real-time listeners)
export const db = getFirestore(app);

export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, "us-central1");
export const provider = new GoogleAuthProvider();

// Initialize messaging only in browser and if supported
let messagingInstance: Messaging | null = null;
let messagingPromise: Promise<Messaging | null> | null = null;

if (typeof window !== "undefined") {
  messagingPromise = isSupported().then((supported) => {
    if (supported) {
      messagingInstance = getMessaging(app);
      return messagingInstance;
    }
    return null;
  });
}

export const messaging = messagingInstance;

/**
 * Gets the messaging instance, waiting for initialization if necessary.
 */
export async function getMessagingInstance(): Promise<Messaging | null> {
  if (typeof window === "undefined") return null;
  if (messagingInstance) return messagingInstance;
  if (messagingPromise) return await messagingPromise;
  return null;
}

export { app };