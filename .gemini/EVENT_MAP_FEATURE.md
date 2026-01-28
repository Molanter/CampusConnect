# Event Map Display Feature - Implementation Summary

## Overview
The application **already has full support** for displaying maps with location pins for events in post cards when coordinates are saved to Firestore.

## How It Works

### 1. Data Structure
Events store location data in Firestore with the following fields:
- `coordinates`: Object with `{ lat: number, lng: number }`
- `locationLabel`: String (optional, for display name)
- `locationUrl`: String (optional, for external map links)

### 2. Components Involved

#### MediaHorizontalScroll Component
**Location**: `/Site/components/post-detail/media-horizontal-scroll.tsx`

This is the main component that renders maps for events in the feed:
- Uses `@react-google-maps/api` library
- Displays a Google Map with a marker when `post.coordinates` exists
- Falls back to a MapPinIcon if the map hasn't loaded yet
- Renders in a horizontal scrollable container alongside images
- Map dimensions: 180-240px height (responsive)
- Includes a "Location" label overlay

**Key Features**:
- Interactive map disabled (draggable: false)
- Zoom level set to 15 for neighborhood-level view
- Clean UI with no default controls
- Rounded corners (24px border-radius)
- Border styling with `border-secondary/10`

#### PostMediaStrip Component
**Location**: `/Site/components/post-detail/post-media-strip.tsx`

Alternative component for post detail views:
- Displays map as a square aspect-ratio card
- Maximum width of 448px (max-w-md)
- Larger, more prominent display
- 32px border-radius for premium look

### 3. Integration Points

The map is automatically displayed in:
1. **Feed Post Cards** - via `MediaHorizontalScroll`
2. **Post Detail View** - via `PostMediaStrip`
3. **Right Sidebar** - when viewing post details
4. **Compact Post Cards** - for condensed views
5. **Explore Event Cards** - in the explore section

### 4. Configuration

**Google Maps API Key**:
- Stored in `.env.local` as `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- Currently configured: `AIzaSyDJ3Qja7LMU48LI1ivdKz6V7vK11LI250k`
- Loaded via `useJsApiLoader` hook with "places" library

### 5. User Experience Flow

1. **Event Creation**: User adds location via LocationPicker component
2. **Data Storage**: Coordinates saved to Firestore post document
3. **Feed Display**: Post card checks for `post.coordinates`
4. **Map Rendering**: If coordinates exist, MediaHorizontalScroll renders map
5. **Interaction**: User can click map to open post details
6. **Detail View**: Larger map shown in post detail with location actions

### 6. Styling

Maps use the app's design system:
- `cc-media-scroll`: Container with horizontal scroll
- `cc-radius-24`: 24px border radius
- `border-secondary/10`: Subtle border
- Responsive sizing based on viewport
- Consistent with image media styling

### 7. Fallback Behavior

If coordinates exist but map fails to load:
- Shows MapPinIcon placeholder
- Maintains layout structure
- Prevents UI breaking

If no coordinates:
- Component only shows images (if any)
- No map placeholder shown
- Clean, minimal presentation

## Code Example

```typescript
// In post-card.tsx
{!hideMediaGrid && (post.coordinates || images.length > 0) && (
    <div className={description ? "mt-2 mb-2" : "mt-2.5 mb-2"}>
        <MediaHorizontalScroll
            post={post}
            onClick={onDetailsClick}
            isNarrow={isNarrow}
        />
    </div>
)}
```

## Dependencies

- `@react-google-maps/api`: ^2.x
- Google Maps JavaScript API
- `@heroicons/react`: For MapPinIcon fallback

## Testing

To verify the feature:
1. Create an event with location coordinates
2. Check the feed - map should appear in the post card
3. Click the map - should open post details
4. Verify map shows correct location with pin marker

## Notes

- Maps are non-interactive in feed (performance optimization)
- Full interactivity available in post detail view
- Coordinates must be valid lat/lng objects
- API key is public (client-side) but restricted by domain
