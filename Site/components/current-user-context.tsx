"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export interface CurrentUserProfile {
    uid: string;
    email: string | null;
    displayName: string;
    username?: string;
    photoURL?: string;
    campus?: string;
    campusId?: string;
    bio?: string;
    verified?: boolean;
    // Add other profile fields as needed
}

interface CurrentUserContextType {
    firebaseUser: FirebaseUser | null; // Firebase Auth user
    userProfile: CurrentUserProfile | null; // Firestore user profile data
    loading: boolean;
}

const CurrentUserContext = createContext<CurrentUserContextType | undefined>(undefined);

export function CurrentUserProvider({ children }: { children: ReactNode }) {
    const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
    const [userProfile, setUserProfile] = useState<CurrentUserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Listen to Firebase Auth state changes
        const unsubAuth = onAuthStateChanged(auth, (user) => {
            setFirebaseUser(user);

            if (!user) {
                setUserProfile(null);
                setLoading(false);
            }
        });

        return () => unsubAuth();
    }, []);

    useEffect(() => {
        if (!firebaseUser) {
            setUserProfile(null);
            setLoading(false);
            return;
        }

        // Listen to the user's Firestore profile in real-time
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const unsubProfile = onSnapshot(
            userDocRef,
            (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.data();
                    setUserProfile({
                        uid: firebaseUser.uid,
                        email: firebaseUser.email,
                        displayName: data.displayName || data.name || data.preferredName || firebaseUser.displayName || "User",
                        username: data.username,
                        photoURL: data.photoURL || firebaseUser.photoURL || undefined,
                        campus: data.campus,
                        campusId: data.campusId,
                        bio: data.bio,
                        verified: data.verified,
                        // Add other fields as needed
                    });
                } else {
                    // User exists in Auth but not in Firestore yet
                    setUserProfile({
                        uid: firebaseUser.uid,
                        email: firebaseUser.email,
                        displayName: firebaseUser.displayName || "User",
                        photoURL: firebaseUser.photoURL || undefined,
                    });
                }
                setLoading(false);
            },
            (error) => {
                console.error("Error fetching user profile:", error);
                setLoading(false);
            }
        );

        return () => unsubProfile();
    }, [firebaseUser]);

    return (
        <CurrentUserContext.Provider value={{ firebaseUser, userProfile, loading }}>
            {children}
        </CurrentUserContext.Provider>
    );
}

export function useCurrentUser() {
    const context = useContext(CurrentUserContext);
    if (context === undefined) {
        throw new Error("useCurrentUser must be used within a CurrentUserProvider");
    }
    return context;
}
