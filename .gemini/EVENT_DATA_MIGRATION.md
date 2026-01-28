# Event Data Structure Migration - Implementation Summary

## Problem
The event data structure in Firestore has changed from the old format to a new format:

### Old Format
```typescript
{
  coordinates: { lat: 44.9340488, lng: -93.4092805 },
  date: "2026-01-23",
  startTime: "16:00"
}
```

### New Format
```typescript
{
  lat: 44.9340488,
  lng: -93.4092805,
  locationLabel: "717 MN-7 W",
  locationUrl: "https://maps.apple.com/?ll=44.9340488,-93.4092805",
  startsAt: Timestamp (January 23, 2026 at 4:00:00 PM UTC-6)
}
```

## Solution Implemented

### 1. Updated Post Type
**File**: `/Site/lib/posts.ts`

Added support for both old and new formats:
```typescript
export type Post = {
  // ... existing fields
  
  // Old format (still supported)
  coordinates?: { lat: number; lng: number };
  date?: string; // yyyy-mm-dd
  startTime?: string; // hh:mm
  
  // New format
  lat?: number;
  lng?: number;
  startsAt?: any; // Timestamp
  
  // ... other fields
}
```

### 2. Updated Data Mapping
**File**: `/Site/lib/hooks/use-feed.ts`

The `mapDocToPost` function now:

#### Converts Flat Coordinates to Object
```typescript
// Convert flat lat/lng to coordinates object if needed
let coordinates = data.coordinates;
if (!coordinates && data.lat !== undefined && data.lng !== undefined) {
    coordinates = { lat: data.lat, lng: data.lng };
}
```

This ensures the map components (which expect `coordinates` object) continue to work with the new flat structure.

#### Converts startsAt Timestamp to date/startTime
```typescript
// Handle startsAt timestamp conversion to date/startTime
let date = data.date;
let startTime = data.startTime;
if (data.startsAt && !date) {
    try {
        const startsAtDate = data.startsAt.toDate ? data.startsAt.toDate() : new Date(data.startsAt);
        
        // Format as YYYY-MM-DD
        const year = startsAtDate.getFullYear();
        const month = String(startsAtDate.getMonth() + 1).padStart(2, '0');
        const day = String(startsAtDate.getDate()).padStart(2, '0');
        date = `${year}-${month}-${day}`;
        
        // Format as HH:MM
        const hours = String(startsAtDate.getHours()).padStart(2, '0');
        const minutes = String(startsAtDate.getMinutes()).padStart(2, '0');
        startTime = `${hours}:${minutes}`;
    } catch (e) {
        console.warn('Error parsing startsAt:', e);
    }
}
```

This ensures the UI components (which expect `date` and `startTime` strings) continue to work with the new timestamp format.

## Backward Compatibility

The implementation maintains **full backward compatibility**:

✅ **Old events** with `coordinates` object → Work as before
✅ **Old events** with `date`/`startTime` → Work as before
✅ **New events** with flat `lat`/`lng` → Converted to `coordinates` object
✅ **New events** with `startsAt` timestamp → Converted to `date`/`startTime` strings

## Components Affected

All components that display events will now work with both formats:

1. **MediaHorizontalScroll** - Map display in feed
2. **PostMediaStrip** - Map display in detail view
3. **PostCard** - Event cards in feed
4. **PostDetailMainInfo** - Event detail view
5. **ClubProfileView** - Club events display

## Testing

To verify the fix:

1. ✅ Old events should continue to display correctly
2. ✅ New events with `lat`/`lng` should show maps with pins
3. ✅ New events with `startsAt` should show correct date/time
4. ✅ Location labels should display properly

## Example Data Flow

### Input (Firestore)
```json
{
  "type": "event",
  "lat": 44.9340488,
  "lng": -93.4092805,
  "locationLabel": "717 MN-7 W",
  "startsAt": "2026-01-23T22:00:00Z"
}
```

### Output (Post Object)
```typescript
{
  type: "event",
  lat: 44.9340488,
  lng: -93.4092805,
  coordinates: { lat: 44.9340488, lng: -93.4092805 }, // ← Converted
  locationLabel: "717 MN-7 W",
  startsAt: Timestamp,
  date: "2026-01-23", // ← Converted
  startTime: "16:00"  // ← Converted (adjusted for timezone)
}
```

### Result
- Map components use `coordinates` object → ✅ Map displays with pin
- Time display components use `date`/`startTime` → ✅ Shows "January 23, 2026 at 4:00 PM"
- Location label displays → ✅ Shows "717 MN-7 W"

## Notes

- The conversion happens at the data mapping layer, so no changes needed in UI components
- Timezone handling is automatic via JavaScript Date object
- Error handling included for malformed timestamps
- All existing map functionality (click to open detail, location actions, etc.) continues to work
