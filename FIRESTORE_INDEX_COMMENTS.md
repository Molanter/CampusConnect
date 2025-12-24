# Firestore Index Required for My Comments Tab

## Collection Group Index

To enable the My Comments tab functionality, you **must** create a composite index in Firestore.

### Index Configuration

- **Collection Groups**: `comments` and `replies`
- **Fields to index for both**:
  1. `authorUid` - **Ascending**
  2. `createdAt` - **Descending**

### How to Create the Index

1. **Automatic Creation**:
   - Navigate to your profile page and click the "Comments" tab
   - If the index doesn't exist, Firestore will log an error in the browser console
   - The error message will include a direct link to create the index automatically
   - Click the link and follow the prompts

2. **Manual Creation**:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Navigate to your project → Firestore Database → Indexes tab
   - Click "Create Index"
   - Set Collection Group ID: `comments`
   - Add fields:
     - Field: `authorId`, Order: Ascending
     - Field: `createdAt`, Order: Descending
   - Click "Create"

### Index Creation Time

Index creation typically takes a few minutes. You'll receive an email when it's ready.

### Why This Index is Required

The collectionGroup query with filters needs a composite index to efficiently:
1. Filter comments by `authorId` (to find user's comments across all posts)
2. Sort results by `createdAt` in descending order (newest first)

Without this index, the query will fail with a permission/index error.
