# Antigravity Prompt — Rename “University” → “Campus” (Gemini 3 Pro)

## Role
You are a senior full‑stack engineer working in a Next.js (App Router) + React + TypeScript + Tailwind project using Firebase Firestore.
Your task: **fully rename the concept “University” to “Campus” across the entire app** while preserving backward compatibility and ensuring the app is **ready to ship**.

## High-level goals
1. **Every UI label, route, variable, type, and Firestore path** should use **Campus** terminology.
2. The “Create Campus” admin form must include a toggle: **“Mark as university (enables dorms)”**.
3. Firestore writes should go to the new canonical paths:
   - `campuses/{campusId}` for campus documents
   - `campuses/{campusId}/dorms/{dormId}` for dorm docs (only when `isUniversity === true`)
4. Ensure no breakage for existing data stored in:
   - `universities/{id}` and `universities/{id}/dorms/*`
5. App must compile, run, and behave correctly on both desktop and mobile.

---

## Existing behavior to preserve
Current file: `app/admin/universities/create/page.tsx`

When creating a university, it writes:

### 1) `universities` collection (new doc)
- `name: string`
- `shortName: string | null`
- `locations: { id: string; name: string }[]`
- `isActive: boolean` (default true)
- `adminEmails: string[]`
- `primaryColor: string | null`
- `secondaryColor: string | null`
- `themeColor: string | null` (duplicate of primaryColor for backwards compatibility)

### 2) `dorms` subcollection (`universities/{id}/dorms`)
For each dorm line:
- `name: string`
- `locationId: string` (defaults to first location id)

---

## New spec (must implement exactly)

### A) Canonical model and collection
Use **campuses** as the primary entity.

Firestore doc: `campuses/{campusId}`:
- `name: string`
- `shortName: string | null`
- `locations: { id: string; name: string }[]`
- `isActive: boolean` (default true)
- `adminEmails: string[]`
- `primaryColor: string | null`
- `secondaryColor: string | null`
- `themeColor: string | null` (keep for legacy reads)
- `isUniversity: boolean` (NEW, default false)
- (optional but recommended) `createdAt: serverTimestamp()`, `createdBy: uid`

Dorms: `campuses/{campusId}/dorms/{dormId}`:
- `name: string`
- `locationId: string` (first location’s id)

**Dorms are only created when `isUniversity === true`.**
If `isUniversity === false`, dorm UI should be hidden and dorms must not be written.

### B) UI terminology
Every user-facing string should say **Campus** not University.
Examples:
- “Add New University” → “Add New Campus”
- “Create University” → “Create Campus”
- “University Name” → “Campus Name”
- “These admins can manage this university” → “…manage this campus”

### C) Create form changes
In `app/admin/universities/create/page.tsx`:
1. Move/rename to: `app/admin/campuses/create/page.tsx` (preferred).
2. Add toggle field:
   - label: “Mark as university (enables dorms)”
   - value: `isUniversity`
   - default: `false`
3. Render Dorms textarea only when `isUniversity === true`.

### D) Backward compatibility (required)
The app must continue to work if existing data is still under:
- `universities/{id}`
- `universities/{id}/dorms/*`

Implement one of these strategies (choose the most robust with minimal risk):

**Strategy 1 (recommended): Dual-read, single-write**
- All new creates/writes go to `campuses/*`
- Any reads that previously queried `universities/*` must:
  1) try `campuses/*`
  2) if not found, fallback to `universities/*`

**Strategy 2: Migration**
- Provide a script or admin-only page or Cloud Function to copy:
  - `universities/{id}` → `campuses/{id}` with `isUniversity: true`
  - `universities/{id}/dorms/*` → `campuses/{id}/dorms/*`
- After migration, reads can use only `campuses/*`

If you choose Strategy 1, you must also implement dorm fallback:
- read dorms from `campuses/{id}/dorms` first
- fallback to `universities/{id}/dorms` if empty/not found

---

## Step-by-step implementation plan (do in order)

### 1) Inventory & refactor map (must be explicit)
- Search project for: `university`, `universities`, `University`, `UNIVERSITY`
- List all impacted areas:
  - Routes/pages under `app/admin/universities`
  - Any campus selection logic
  - Firestore query helpers
  - Types/interfaces (e.g., `University`, `UniversityDoc`, etc.)
  - UI text in components

### 2) Introduce new types
Create/rename TypeScript type(s):
- `CampusLocation`
- `Campus`
- `Dorm`

Ensure all previous University types are replaced or aliased safely:
- Option: `type University = Campus` for a transition period if needed.

### 3) Firestore path helpers
Create a single source-of-truth helper file (example path):
- `src/lib/firestorePaths.ts`

Include functions:
- `campusDoc(campusId)`
- `campusDormsCol(campusId)`
- `legacyUniversityDoc(universityId)`
- `legacyDormsCol(universityId)`

### 4) Rewrite create page
Implement `app/admin/campuses/create/page.tsx`:

Required behavior:
- Validate inputs (name required, at least 1 location required, location id uniqueness, emails validity).
- On submit:
  1) create campus doc in `campuses`
  2) if `isUniversity` true: create dorm docs in `campuses/{id}/dorms`
- Set `themeColor = primaryColor` for compatibility.
- Ensure consistent trimming/normalizing:
  - emails lowercased and trimmed
  - location ids slug-like and trimmed
  - dorm names trimmed; ignore empty lines

### 5) Update admin navigation
Replace links:
- `/admin/universities` → `/admin/campuses`
- Ensure sidebar/menu buttons show “Campuses”.

### 6) Update everywhere else
Replace all Firestore reads/writes:
- `universities` → `campuses` (writes always)
- reads should use the chosen backward-compat strategy.

### 7) Security rules + indexes
Update Firestore rules to reflect `campuses`:
- Admin access based on `adminEmails` or your existing admin model.
- Dorm access only relevant when `isUniversity` true (rules can allow regardless; app logic gates creation).

Update any composite indexes if your queries require them.

### 8) QA checklist (must be executed)
- Create campus with `isUniversity=false`: dorm UI hidden, no dorm docs created.
- Create campus with `isUniversity=true`: dorm UI visible, dorm docs created with first locationId.
- Existing university data still displays (fallback read works).
- No UI shows “University” anywhere.
- Build passes: `npm run build` and app starts without errors.

---

## Output format requirements (very important)
When you finish, respond with:

1) **Files changed** list (paths).
2) For each file: short bullet summary of changes.
3) All code patches (full file content if small; otherwise focused diffs).
4) Notes on any assumptions made.

Do not skip steps. Be strict and systematic.
