# Firebase Functions Deployment Guide

Your Firebase Functions have been set up successfully! Here's how to deploy them:

## Step 1: Select Your Firebase Project

First, you need to select which Firebase project to use. Based on your available projects, I recommend using **BU Connect** (bu-connect-4e7cb).

Run this command to set the active project:

```bash
firebase use bu-connect-4e7cb
```

Or if you want to use a different project, run:
```bash
firebase use --add
```

## Step 2: Deploy the Functions

Once you've selected your project, deploy the functions with:

```bash
firebase deploy --only functions
```

## What These Functions Do

The deployed functions will automatically maintain comment counts on your posts and events:

- **onCommentCreated** / **onPostCommentCreated**: Increments `commentsCount` when a top-level comment is added
- **onCommentDeleted** / **onPostCommentDeleted**: Decrements `commentsCount` when a top-level comment is deleted
- **onReplyCreated** / **onPostReplyCreated**: Increments `repliesCommentsCount` when a reply is added
- **onReplyDeleted** / **onPostReplyDeleted**: Decrements `repliesCommentsCount` when a reply is deleted

## Files Created

- `functions/src/index.ts` - Your cloud functions code
- `functions/package.json` - Dependencies configuration
- `functions/tsconfig.json` - TypeScript configuration
- `firebase.json` - Updated with functions configuration

## Useful Commands

- **Deploy**: `firebase deploy --only functions`
- **View logs**: `firebase functions:log`
- **Test locally**: `npm run serve` (in functions directory)
- **Rebuild**: `npm run build` (in functions directory)

## Important Notes

⚠️ **Billing**: Cloud Functions require the Firebase Blaze (pay-as-you-go) plan. Make sure your project is upgraded.

⚠️ **Region**: Functions will deploy to `us-central1` by default. If you need a different region, you'll need to modify the function definitions.
