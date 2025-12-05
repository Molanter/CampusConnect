# Deploy Firestore Rules

The Firestore security rules have been updated to support the new reports subcollections and nested replies, but they need to be deployed to Firebase.

## Option 1: Deploy via Firebase Console (Easiest)

1. Go to https://console.firebase.google.com/
2. Select your project
3. Click on "Firestore Database" in the left menu
4. Click on the "Rules" tab
5. Copy the contents of `firestore.rules` from your project
6. Paste them into the Firebase Console editor
7. Click "Publish"

## Option 2: Deploy via Firebase CLI

Run this command in your terminal from the project root:

```bash
firebase deploy --only firestore:rules
```

If you get permission errors with the Firebase CLI, try:
```bash
sudo firebase deploy --only firestore:rules
```

Or reinstall Firebase tools:
```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

## What's Changed

The new rules add support for:
- Reading from `reports` subcollections under comments and replies
- Creating reports in these subcollections
- Proper permissions for nested replies up to 2 levels deep

Without deploying these rules, you'll continue to see "Missing or insufficient permissions" errors when opening comments.

