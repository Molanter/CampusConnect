"use client";

import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ArrowUturnLeftIcon,
  HeartIcon,
  FlagIcon,
  PencilIcon,
  TrashIcon,
  EllipsisVerticalIcon,
} from "@heroicons/react/24/outline";
import { useUserProfile } from "./user-profiles-context";

const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

function CommentTextWithMentions({ text }: { text: string }) {
  const parts = text.split(/(@\w+)/g);

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("@")) {
          const username = part.slice(1);
          return (
            <Link
              key={index}
              href={`/user/u/${username}`}
              className="text-amber-400 hover:text-amber-300 hover:underline font-medium"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </Link>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

export type CommentRecord = {
  id: string;
  text: string;
  authorName: string;
  authorUsername?: string | null;
  authorUid?: string | null;
  authorPhotoURL?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  editCount?: number;
  editedAt?: Date | null;
  likes?: string[];
  replyTo?: {
    commentId: string;
    authorName: string;
    authorUsername?: string | null;
    authorUid?: string | null;
    text?: string;
  } | null;
  replyCount?: number;
  replies?: CommentRecord[];
  depth?: number;
  parentPath?: string[];
  reportCount?: number;
  isHidden?: boolean;
};

type CommentMessageProps = {
  comment: CommentRecord;
  currentUserId?: string | null;
  liked: boolean;
  likeCount: number;
  canEdit: boolean;
  canDelete: boolean;
  onReply: (comment: CommentRecord) => void;
  onLike: (comment: CommentRecord) => Promise<void> | void;
  onReport: (comment: CommentRecord) => Promise<void> | void;
  onDelete: (comment: CommentRecord) => Promise<void> | void;
  onEdit: (comment: CommentRecord, newText: string) => Promise<void> | void;
  depth?: number;
};

function getTimeLabel(date?: Date | null) {
  if (!date) return "Just now";
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 2_592_000_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  if (diff < 31_536_000_000) return `${Math.floor(diff / 2_592_000_000)}mo ago`;
  return `${Math.floor(diff / 31_536_000_000)}y ago`;
}

export function CommentMessage({
  comment,
  currentUserId,
  liked,
  likeCount,
  canEdit,
  canDelete,
  onReply,
  onLike,
  onReport,
  onDelete,
  onEdit,
  depth = 0,
}: CommentMessageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(comment.text);
  const [pending, setPending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const timeLabel = useMemo(() => getTimeLabel(comment.createdAt), [comment.createdAt]);

  const profile = useUserProfile(comment.authorUid || undefined);
  const displayName = profile?.displayName || comment.authorName || "User";
  const displayPhotoURL = profile?.photoURL || comment.authorPhotoURL;
  const displayUsername = profile?.username || comment.authorUsername;

  const replyCount = comment.replies?.length ?? 0;
  const canReply = depth === 0; // Only allow replying to top-level comments

  const handleSave = async () => {
    if (!draft.trim() || pending) return;
    setPending(true);
    try {
      await onEdit(comment, draft.trim());
      setIsEditing(false);
    } finally {
      setPending(false);
    }
  };

  const resetEdit = () => {
    setDraft(comment.text);
    setIsEditing(false);
    setPending(false);
  };

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setMenuOpen(true);
  };

  const handleLongPressStart = (e: React.TouchEvent) => {
    const timer = setTimeout(() => {
      const touch = e.touches[0];
      setMenuPosition({ x: touch.clientX, y: touch.clientY });
      setMenuOpen(true);
    }, 500);
    setLongPressTimer(timer);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const closeMenu = () => {
    setMenuOpen(false);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const handler = () => closeMenu();
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [menuOpen]);

  // Dynamic classes based on depth
  const isReply = depth > 0;
  const avatarSize = isReply ? "h-6 w-6" : "h-9 w-9";
  const containerPadding = ""; // Removed padding for tighter layout

  return (
    <>
      <div className="relative">
        <div
          className={cn(
            "flex gap-1.5",
            containerPadding
          )}
          onContextMenu={handleContextMenu}
          onTouchStart={handleLongPressStart}
          onTouchEnd={handleLongPressEnd}
          onTouchMove={handleLongPressEnd}
        >
          <div className="flex flex-col items-center">
            <div className={cn("shrink-0 overflow-hidden rounded-full bg-neutral-800", avatarSize)}>
              {displayPhotoURL ? (
                <img
                  src={displayPhotoURL}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-white/5 text-[10px] font-semibold text-white">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            {/* Vertical line piece in parent row - stretches to bottom */}
            {comment.replies && comment.replies.length > 0 && (
              <div className="w-[2px] flex-1 bg-white/8 rounded-t-full mt-1.5"></div>
            )}
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-white truncate">
                    {displayUsername || displayName}
                  </p>
                  <span className="text-xs text-neutral-500 shrink-0">{timeLabel}</span>
                </div>

                {comment.replyTo && (
                  <div className="rounded-xl border border-white/5 bg-white/5 px-2.5 py-1.5 text-xs text-neutral-300 mb-1">
                    <span className="text-neutral-500 mr-1">Replying to</span>
                    <span className="font-medium text-white">
                      {comment.replyTo.authorUsername || comment.replyTo.authorName}
                    </span>
                  </div>
                )}

                {isEditing ? (
                  <div className="space-y-2 pt-1">
                    <textarea
                      className="w-full rounded-2xl border border-white/10 bg-transparent px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={3}
                    />
                    <div className="flex justify-end gap-2 text-xs">
                      <button
                        type="button"
                        className="rounded-full border border-white/10 px-3 py-1 text-neutral-400 hover:border-white/20 hover:text-white"
                        onClick={resetEdit}
                        disabled={pending}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="rounded-full bg-white px-4 py-1 font-semibold text-black hover:bg-neutral-200 disabled:opacity-50"
                        onClick={handleSave}
                        disabled={pending || !draft.trim()}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-200">
                    <CommentTextWithMentions text={comment.text} />
                  </p>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-0.5">
                  {canReply && (
                    <button
                      type="button"
                      className="group flex items-center gap-1.5 text-xs font-medium text-neutral-400 hover:text-white"
                      onClick={() => onReply(comment)}
                    >
                      <ArrowUturnLeftIcon className="h-3.5 w-3.5" />
                      {replyCount > 0 && <span>{replyCount}</span>}
                    </button>
                  )}

                  <button
                    type="button"
                    className={cn(
                      "group flex items-center gap-1.5 text-xs font-medium",
                      liked ? "text-amber-400" : "text-neutral-400 hover:text-white"
                    )}
                    onClick={() => {
                      setLikeAnimating(true);
                      setTimeout(() => setLikeAnimating(false), 140);
                      onLike(comment);
                    }}
                  >
                    <HeartIcon
                      className={cn(
                        "h-3.5 w-3.5",
                        liked && "fill-amber-400 text-amber-400",
                        likeAnimating && "animate-like-pop"
                      )}
                    />
                    {likeCount > 0 && <span>{likeCount}</span>}
                  </button>

                  {canEdit && (
                    <button
                      type="button"
                      className="flex items-center gap-1 text-xs font-medium text-neutral-400 hover:text-white"
                      onClick={() => setIsEditing((prev) => !prev)}
                    >
                      <PencilIcon className="h-3.5 w-3.5" />
                      {(comment.editCount || 0) > 0 && <span>{comment.editCount}</span>}
                    </button>
                  )}

                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs font-medium text-neutral-400 hover:text-white"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setMenuPosition({ x: rect.left, y: rect.bottom });
                      setMenuOpen(true);
                    }}
                  >
                    <EllipsisVerticalIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Context Menu - rendered via portal to escape overflow clipping */}
          {menuOpen && typeof document !== 'undefined' && createPortal(
            <>
              <div
                className="fixed inset-0 z-[9998]"
                onClick={(e) => {
                  e.stopPropagation();
                  closeMenu();
                }}
              />
              <div
                className="fixed z-[9999] w-40 rounded-2xl border border-white/10 bg-[#1C1C1E]/95 backdrop-blur-xl p-1.5 text-xs text-white shadow-[0_20px_60px_rgba(0,0,0,0.8)] animate-fade-slide-in"
                style={{
                  top: menuPosition.y,
                  left: menuPosition.x,
                  transform: 'translate(-10%, 10px)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 hover:bg-white/10 transition-colors active:scale-95"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeMenu();
                    onReport(comment);
                  }}
                >
                  <FlagIcon className="h-4 w-4 text-neutral-400" />
                  Report
                </button>
                {canEdit && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 hover:bg-white/10 transition-colors active:scale-95"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeMenu();
                      setIsEditing(true);
                    }}
                  >
                    <PencilIcon className="h-4 w-4 text-neutral-400" />
                    Edit
                  </button>
                )}
                {canDelete && (
                  <>
                    <div className="my-1 h-px bg-white/5 mx-2" />
                    <button
                      type="button"
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-red-400 hover:bg-red-500/10 transition-colors active:scale-95"
                      onClick={(e) => {
                        e.stopPropagation();
                        closeMenu();
                        onDelete(comment);
                      }}
                    >
                      <TrashIcon className="h-4 w-4" />
                      Delete
                    </button>
                  </>
                )}
              </div>
            </>,
            document.body
          )}
        </div>

        {/* Nested Replies - Two-column layout with curve in avatar column */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="space-y-2.5 mt-2.5">
            {comment.replies.map((reply, index) => (
              <div key={reply.id} className="flex gap-1.5">
                {/* Left column: Curve in parent avatar column */}
                <div className="flex flex-col items-center relative" style={{ width: isReply ? '24px' : '36px' }}>
                  {/* Vertical line segment before curve - connects from parent or previous reply */}
                  <div
                    className="absolute w-[2px] bg-white/8"
                    style={{
                      left: isReply ? '11px' : '17px',
                      top: '-10px',
                      height: '10px',
                    }}
                  ></div>

                  {/* Curved connector (the branch) */}
                  <div
                    className="absolute border-l-2 border-b-2 border-white/8 rounded-bl-[12px]"
                    style={{
                      left: isReply ? '11px' : '17px',
                      top: 0,
                      width: '12px',
                      height: '20px',
                    }}
                  ></div>

                  {/* Vertical line segment after curve - continues down to the next branch (not for last reply) */}
                  {index < (comment.replies?.length ?? 0) - 1 && (
                    <div
                      className="absolute w-[2px] bg-white/8 rounded-t-full"
                      style={{
                        left: isReply ? '11px' : '17px',
                        top: '28px',
                        bottom: 0,
                      }}
                    ></div>
                  )}

                  {/* Curve tip rounding - positioned without overlap, exactly 1px deep semicircle */}
                  <div
                    className="absolute w-[1px] h-[2px] bg-white/8 rounded-r-full"
                    style={{
                      left: isReply ? '23px' : '29px',
                      top: '18px',
                    }}
                  ></div>
                </div>

                {/* Right column: Reply content */}
                <div className="flex-1 min-w-0">
                  <CommentMessage
                    comment={reply}
                    currentUserId={currentUserId}
                    liked={!!currentUserId && (reply.likes || []).includes(currentUserId)}
                    likeCount={reply.likes?.length ?? 0}
                    canEdit={reply.authorUid === currentUserId}
                    canDelete={canDelete}
                    onReply={onReply}
                    onLike={onLike}
                    onReport={onReport}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    depth={depth + 1}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
