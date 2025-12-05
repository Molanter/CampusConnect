import { AttendanceCard } from "./attendance-card";

type EventPostProps = {
  id: string;
  title: string;
  description?: string | null;
  imageUrls?: string[] | null;
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  locationLabel?: string | null;
  campusName?: string | null;
  hostDisplayName?: string | null;
  hostUsername?: string | null;
  hostPhotoURL?: string | null;
  coordinates?: { lat: number; lng: number } | null;
  onOpenDetail?: () => void;
  onOpenComments?: () => void;
  onOpenAttendance?: () => void;
};

export function EventPost({
  id,
  title,
  description,
  imageUrls,
  date,
  startTime,
  endTime,
  locationLabel,
  campusName,
  hostDisplayName,
  hostUsername,
  hostPhotoURL,
  coordinates,
  onOpenDetail,
  onOpenComments,
  onOpenAttendance,
}: EventPostProps) {
  const dateLabel = date ?? "";
  const timeLabel = startTime ?? "";
  const location =
    locationLabel || campusName || "Location TBA";

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onOpenDetail) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpenDetail();
    }
  };

  return (
    <div className="space-y-2">
      <div
        className="block w-full text-left cursor-pointer"
        role={onOpenDetail ? "button" : undefined}
        tabIndex={onOpenDetail ? 0 : -1}
        onClick={onOpenDetail}
        onKeyDown={handleKeyDown}
      >
        <AttendanceCard
          id={id}
          compact
          title={title}
          description={description ?? ""}
          images={imageUrls ?? []}
          date={dateLabel}
          time={timeLabel}
          location={location}
          hostName={hostDisplayName || "Host"}
          hostUsername={hostUsername || undefined}
          hostAvatarUrl={hostPhotoURL || null}
          coordinates={coordinates || null}
          onCommentsClick={onOpenComments}
          onAttendanceClick={onOpenAttendance}
        />
      </div>
    </div>
  );
}


