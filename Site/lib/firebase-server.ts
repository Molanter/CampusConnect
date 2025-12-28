import * as admin from 'firebase-admin';

import * as fs from 'fs';
import * as path from 'path';

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'campus-vibes-e34f0';
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'campus-vibes-e34f0.firebasestorage.app';

// Explicitly set the project ID in the environment for underlying Google libraries
process.env.GCLOUD_PROJECT = projectId;
process.env.GOOGLE_CLOUD_PROJECT = projectId;

export let isAdminInitialized = false;

if (!admin.apps.length) {
    try {
        // 1. Try Environment Variable (Easiest for local setup)
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId,
                storageBucket
            });
            isAdminInitialized = true;
            console.log("Firebase Admin initialized via FIREBASE_SERVICE_ACCOUNT env var");
        }
        // 2. Try Service Account Key file
        else if (fs.existsSync(path.resolve(process.cwd(), 'service-account.json'))) {
            const saPath = path.resolve(process.cwd(), 'service-account.json');
            admin.initializeApp({
                credential: admin.credential.cert(saPath),
                projectId,
                storageBucket
            });
            isAdminInitialized = true;
            console.log("Firebase Admin initialized via service-account.json");
        }
        // 3. Last resort: applicationDefault (only works in GAE/Cloud Run or if gcloud is configured)
        else {
            try {
                admin.initializeApp({
                    credential: admin.credential.applicationDefault(),
                    projectId,
                    storageBucket
                });
                isAdminInitialized = true;
                console.log("Firebase Admin initialized via applicationDefault");
            } catch (adcError) {
                // If this fails, we are in non-admin mode
                admin.initializeApp({
                    projectId,
                    storageBucket
                });
                isAdminInitialized = false;
                console.warn("Firebase Admin initialized in basic mode (No Service Account)");
            }
        }
    } catch (error) {
        console.error("Firebase Admin fatal initialization error:", error);
    }
} else {
    // Already exists
    isAdminInitialized = true; // Assume true if already there
}

export const adminDb = admin.firestore();
export const adminStorage = admin.storage();
export const adminAuth = admin.auth();
