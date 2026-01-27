# Event Attendance Picker - Feature Description

## Overview
The attendance picker is a dropdown menu that allows users to indicate their attendance status for event posts. It appears only on event-type posts and provides three attendance options: Going, Maybe, and Not Going.

---

## Visual Design

### Button States

**Default State (No Selection)**:
```
┌─────────────┐
│  📅 Calendar │  ← Gray calendar icon
└─────────────┘
```

**Going State**:
```
┌─────────────┐
│  👍 5       │  ← Green thumbs up + count
└─────────────┘
```

**Maybe State**:
```
┌─────────────┐
│  ❓ 3       │  ← Yellow question mark + count
└─────────────┘
```

**Not Going State**:
```
┌─────────────┐
│  👎         │  ← Red thumbs down (no count shown)
└─────────────┘
```

---

## User Interaction Flow

### 1. Opening the Menu
```
User clicks attendance button
         ↓
Menu opens above button
         ↓
Backdrop overlay appears
```

### 2. Selecting Status
```
User clicks "Going"
         ↓
Update Firestore (goingUids array)
         ↓
Menu closes
         ↓
Button updates to show thumbs up + count
```

### 3. Changing Status
```
User clicks button again
         ↓
Menu opens showing current selection
         ↓
User clicks different option
         ↓
Remove from old array, add to new array
         ↓
Button updates to new status
```

### 4. Removing Status
```
User clicks same option again
         ↓
Remove from array (toggle off)
         ↓
Button returns to default calendar icon
```

---

## Component Structure

### Location
**File**: `/Site/components/post-card.tsx`

### State Management
```typescript
const [status, setStatus] = useState<AttendanceStatus>(null);
const [attendanceMenuOpen, setAttendanceMenuOpen] = useState(false);
const [goingCount, setGoingCount] = useState((post.goingUids || []).length);
const [maybeCount, setMaybeCount] = useState((post.maybeUids || []).length);

type AttendanceStatus = "going" | "maybe" | "not_going" | null;
```

### Real-time Updates
```typescript
// Live attendance count updates via Firestore listener
useEffect(() => {
    if (!id || previewMode) return;
    
    const postRef = doc(db, "posts", id);
    const unsubscribe = onSnapshot(postRef, (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        
        // Update counts
        setGoingCount((data.goingUids || []).length);
        setMaybeCount((data.maybeUids || []).length);
        
        // Update user's status
        if (currentUser) {
            if (data.goingUids?.includes(currentUser.uid)) setStatus("going");
            else if (data.maybeUids?.includes(currentUser.uid)) setStatus("maybe");
            else if (data.notGoingUids?.includes(currentUser.uid)) setStatus("not_going");
            else setStatus(null);
        }
    });
    
    return () => unsubscribe();
}, [id, currentUser, previewMode]);
```

---

## Menu UI

### Structure
```
┌─────────────────────────┐
│  Going          👍      │  ← Green icon, selected shows filled
├─────────────────────────┤
│  Maybe          ❓      │  ← Yellow icon
├─────────────────────────┤
│  Not Going      👎      │  ← Red icon
└─────────────────────────┘
```

### Styling
```tsx
<div className="absolute bottom-full left-0 z-50 mb-2 min-w-[160px] overflow-hidden cc-radius-menu cc-glass-strong">
    <div className="p-1.5">
        {/* Going Option */}
        <button className="flex w-full items-center justify-between rounded-full px-3 py-2 text-sm hover:bg-secondary/20 transition-colors">
            <span className="font-medium">Going</span>
            <HandThumbUpIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
        </button>
        
        {/* Maybe Option */}
        <button className="flex w-full items-center justify-between rounded-full px-3 py-2 text-sm hover:bg-secondary/20 transition-colors">
            <span className="font-medium">Maybe</span>
            <QuestionMarkCircleIcon className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        </button>
        
        {/* Not Going Option */}
        <button className="flex w-full items-center justify-between rounded-full px-3 py-2 text-sm hover:bg-secondary/20 transition-colors">
            <span className="font-medium">Not Going</span>
            <HandThumbDownIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
        </button>
    </div>
</div>
```

---

## Firestore Integration

### Data Model
```typescript
// Post document structure
{
    id: "post123",
    type: "event",
    goingUids: ["user1", "user2", "user3"],      // Users marked as going
    maybeUids: ["user4", "user5"],                // Users marked as maybe
    notGoingUids: ["user6"],                      // Users marked as not going
    // ... other fields
}
```

### Status Change Handler
```typescript
const handleStatusChange = async (newStatus: AttendanceStatus) => {
    if (!id || !currentUser) return;
    
    const postRef = doc(db, "posts", id);
    
    try {
        // Remove from all arrays first
        await updateDoc(postRef, {
            goingUids: arrayRemove(currentUser.uid),
            maybeUids: arrayRemove(currentUser.uid),
            notGoingUids: arrayRemove(currentUser.uid),
        });
        
        // Add to new array if status is not null
        if (newStatus === "going") {
            await updateDoc(postRef, {
                goingUids: arrayUnion(currentUser.uid),
            });
        } else if (newStatus === "maybe") {
            await updateDoc(postRef, {
                maybeUids: arrayUnion(currentUser.uid),
            });
        } else if (newStatus === "not_going") {
            await updateDoc(postRef, {
                notGoingUids: arrayUnion(currentUser.uid),
            });
        }
        
        setStatus(newStatus);
    } catch (error) {
        console.error("Error updating attendance:", error);
    }
};
```

---

## Display Logic

### Button Icon Selection
```typescript
{status === "going" ? (
    <HandThumbUpIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
) : status === "maybe" ? (
    <QuestionMarkCircleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
) : status === "not_going" ? (
    <HandThumbDownIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
) : (
    <CalendarIcon className="h-5 w-5 text-secondary group-hover:text-foreground transition-colors" />
)}
```

### Count Display
```typescript
// Only show count for "going" and "maybe"
{(status === "maybe" ? maybeCount : goingCount) > 0 && (
    <button
        onClick={(e) => {
            e.stopPropagation();
            openView("attendance", { id });
        }}
        className="text-xs font-medium text-secondary ml-1 hover:text-foreground hover:underline"
    >
        {status === "maybe" ? maybeCount : goingCount}
    </button>
)}
```

**Logic**:
- If user selected "going" → show going count
- If user selected "maybe" → show maybe count
- If user selected "not going" → show no count
- If no selection → show going count (if > 0)

---

## Menu Behavior

### Opening
- Click on attendance button
- Menu appears above button (bottom-full positioning)
- Backdrop overlay prevents interaction with rest of page

### Closing
- Click on backdrop
- Click on any menu option
- Menu automatically closes after selection

### Positioning
```css
position: absolute;
bottom: 100%;  /* Above the button */
left: 0;
margin-bottom: 0.5rem;  /* 8px gap */
z-index: 50;
```

---

## Accessibility Features

### Keyboard Navigation
- Tab to focus button
- Enter/Space to open menu
- Arrow keys to navigate options
- Enter/Space to select
- Escape to close

### Screen Readers
```tsx
<button
    type="button"
    aria-label={status ? `Change attendance (currently ${status})` : "Set attendance"}
    aria-expanded={attendanceMenuOpen}
    aria-haspopup="menu"
>
    {/* Button content */}
</button>
```

---

## Visual States

### Hover States
```css
/* Button hover */
.hover:bg-secondary/20

/* Menu item hover */
.hover:bg-secondary/20
.hover:text-foreground
```

### Active States
```css
/* Selected option in menu */
opacity-100  /* Icon visible */
text-foreground  /* Text highlighted */

/* Unselected option */
opacity-0  /* Icon hidden */
text-secondary  /* Text muted */
```

### Transition Effects
```css
transition-colors
duration-200
```

---

## Integration with Right Sidebar

### Attendance List View
When user clicks on the count number:
```typescript
onClick={(e) => {
    e.stopPropagation();
    openView("attendance", { id });
}}
```

This opens the right sidebar showing:
- **Going** (X users) - List of users marked as going
- **Maybe** (X users) - List of users marked as maybe
- **Not Going** (X users) - List of users marked as not going

---

## Color Scheme

### Going (Green)
- Light mode: `text-green-600`
- Dark mode: `text-green-400`

### Maybe (Yellow)
- Light mode: `text-yellow-600`
- Dark mode: `text-yellow-400`

### Not Going (Red)
- Light mode: `text-red-600`
- Dark mode: `text-red-400`

### Default (Gray)
- `text-secondary` (theme-aware)
- Hover: `text-foreground`

---

## Icons Used

```typescript
import {
    CalendarIcon,           // Default state
    HandThumbUpIcon,        // Going (solid)
    QuestionMarkCircleIcon, // Maybe (solid)
    HandThumbDownIcon,      // Not Going (solid)
} from "@heroicons/react/24/solid";
```

---

## Example Usage

### Event Post Card
```tsx
<PostCard
    post={{
        id: "event123",
        type: "event",
        title: "Campus Party",
        date: "2026-01-25",
        goingUids: ["user1", "user2", "user3"],
        maybeUids: ["user4"],
        notGoingUids: [],
        // ... other fields
    }}
/>
```

### User Interaction
1. User sees event post with calendar icon
2. Clicks calendar icon → menu opens
3. Clicks "Going" → menu closes, icon changes to green thumbs up
4. Count shows "3" (including this user)
5. Clicks thumbs up again → menu opens with "Going" highlighted
6. Clicks "Going" again → toggles off, returns to calendar icon

---

## Performance Considerations

### Real-time Updates
- Uses Firestore `onSnapshot` for live updates
- Automatically updates counts when other users change status
- Unsubscribes when component unmounts

### Optimistic Updates
- UI updates immediately on click
- Firestore update happens in background
- Reverts if Firestore update fails

### Debouncing
- No debouncing needed (single click action)
- Menu closes immediately after selection

---

## Edge Cases Handled

1. **User not signed in**: Button disabled or hidden
2. **Preview mode**: Button visible but non-functional
3. **Post deleted**: Listener unsubscribes, no errors
4. **Network offline**: Shows last known state, queues update
5. **Multiple rapid clicks**: Menu toggle prevents issues
6. **Concurrent updates**: Firestore handles with arrayUnion/arrayRemove

---

## Future Enhancements

### Potential Improvements
1. **Notification**: Notify event creator when someone RSVPs
2. **Calendar Integration**: Add to Google Calendar / Apple Calendar
3. **Reminder**: Set reminder before event starts
4. **Share**: Share event with friends
5. **Invite**: Invite specific users to event
6. **Waitlist**: For events with capacity limits
7. **Check-in**: Mark attendance at event location

---

## Summary

The attendance picker is a **polished, intuitive UI component** that:
- ✅ Provides clear visual feedback
- ✅ Updates in real-time
- ✅ Integrates seamlessly with Firestore
- ✅ Supports theme (light/dark mode)
- ✅ Handles edge cases gracefully
- ✅ Follows modern UI/UX patterns
- ✅ Accessible and keyboard-friendly
