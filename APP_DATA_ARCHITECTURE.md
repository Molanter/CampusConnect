# App Data Architecture

This document explains how we share commonly-used data across the CampusConnect app to avoid redundant Firestore queries.

## Contexts Overview

We use React Context providers to fetch data once and share it throughout the app. All providers are set up in `components/layout-shell.tsx`.

### 1. **CurrentUserProvider** (`components/current-user-context.tsx`)
- **Purpose**: Provides real-time access to the currently signed-in user's profile
- **Data Source**: Firebase Auth + Firestore `users/{currentUserId}` (real-time with `onSnapshot`)
- **Usage**: `const { firebaseUser, userProfile, loading } = useCurrentUser()`
- **Available Data**:
  - `firebaseUser` - Firebase Auth user object (uid, email, etc.)
  - `userProfile` - Full Firestore profile data (displayName, username, photoURL, campus, campusId, bio, verified, etc.)
  - `loading` - Boolean indicating if data is still loading
- **Benefits**: 
  - Single source of truth for current user
  - Real-time updates when profile changes
  - No need to fetch user data in every component
- **Used In**: Navbar, profile pages, post composer, any component needing current user info

### 2. **AppConfigProvider** (`components/app-config-context.tsx`)
- **Purpose**: Shares app-wide configuration like version number
- **Data Source**: Firestore `config/app_info`
- **Usage**: `const { config } = useAppConfig()`
- **Available Data**:
  - `config.version` - App version string
- **Used In**: Settings page, Settings footer

### 3. **UserProfilesProvider** (`components/user-profiles-context.tsx`)
- **Purpose**: Caches **other users'** profile data to avoid repeated fetches
- **Data Source**: Firestore `users/{uid}`
- **Usage**: 
  - `const profile = useUserProfile(uid)` - Auto-fetches if not cached
  - `const { profiles, fetchProfile } = useUserProfiles()` - Manual control
- **Available Data**:
  - `uid`, `displayName`, `username`, `photoURL`, `campus`
- **Used In**: User rows, comments, post author displays, etc.
- **Note**: For the **current user**, use `CurrentUserProvider` instead

### 4. **ClubProfilesProvider** (`components/club-profiles-context.tsx`)
- **Purpose**: Caches club profile data to avoid repeated fetches
- **Data Source**: Firestore `clubs/{clubId}`
- **Similar API to UserProfilesProvider**

### 5. **AdminModeProvider** (`components/admin-mode-context.tsx`)
- **Purpose**: Tracks admin status and admin mode toggle
- **Usage**: `const { isGlobalAdminUser, adminModeOn } = useAdminMode()`

### 6. **RightSidebarProvider** (`components/right-sidebar-context.tsx`)
- **Purpose**: Controls the right sidebar state
- **Usage**: `const { view, setView, isVisible } = useRightSidebar()`

## Provider Hierarchy

```tsx
<AdminModeProvider>
  <CurrentUserProvider>
    <AppConfigProvider>
      <UserProfilesProvider>
        <ClubProfilesProvider>
          <RightSidebarProvider>
            <App />
          </RightSidebarProvider>
        </ClubProfilesProvider>
      </UserProfilesProvider>
    </AppConfigProvider>
  </CurrentUserProvider>
</AdminModeProvider>
```

## Benefits

1. **Performance**: Data is fetched once and cached
2. **Consistency**: Same data across all components
3. **Real-time Updates**: CurrentUserProvider uses `onSnapshot` for live profile updates
4. **Network Efficiency**: Reduces Firestore read operations
5. **Simplicity**: Components don't manage their own data fetching

## Adding New Shared Data

To add new app-wide config:

1. Update the `AppConfig` interface in `app-config-context.tsx`
2. Update the fetch logic to include the new field
3. Use `config.yourNewField` anywhere in the app

## Usage Examples

### Getting Current User Profile
```tsx
const { userProfile, loading } = useCurrentUser();

if (loading) return <div>Loading...</div>;
if (!userProfile) return <div>Please sign in</div>;

return <div>Welcome {userProfile.displayName}!</div>;
```

### Getting Another User's Profile
```tsx
const profile = useUserProfile(someUserId);
return <div>{profile?.displayName || 'Loading...'}</div>;
```

### Getting App Config
```tsx
const { config } = useAppConfig();
return <div>Version: {config.version}</div>;
```
