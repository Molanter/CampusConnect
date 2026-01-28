//
//  CommentCell.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/19/26.
//

import SwiftUI

struct CommentCell: View {
    let comment: PostComment
    let currentUserId: String

    let onReply: () -> Void
    let onToggleLike: () -> Void
    let onEdit: () -> Void
    let onDelete: () -> Void
    let onReport: () -> Void

    private var isMine: Bool { comment.authorId == currentUserId }
    private var isLiked: Bool { comment.likedBy[currentUserId] != nil }
    private var likeCount: Int { comment.likedBy.count }
    private var editCount: Int { comment.editedCount }
    private var replyCount: Int { comment.replies.count }

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            AvatarView(urlString: comment.authorPhotoURL, size: 34, kind: .profile)

            VStack(alignment: .leading, spacing: 6) {
                header

                Text(comment.text)
                    .font(.subheadline)
                    .fixedSize(horizontal: false, vertical: true)

                actions
            }
        }
    }

    private var header: some View {
        HStack(spacing: 8) {
            Text("@\(comment.authorUsername)")
                .font(.subheadline.weight(.semibold))

            Text("•")
                .foregroundStyle(.secondary)

            Text(timeText(comment.createdAt))
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }

    private var actions: some View {
        HStack(spacing: 10) {

            // Reply + count (if > 0)
            Button(action: onReply) {
                HStack(spacing: 5) {
                    Image(systemName: "arrowshape.turn.up.left")
                    if replyCount > 0 {
                        Text("\(replyCount)")
                            .font(.footnote.weight(.semibold))
                    }
                }
            }
            .buttonStyle(.plain)
            .foregroundStyle(.secondary)

            // Like + count
            Button(action: onToggleLike) {
                HStack(spacing: 5) {
                    Image(systemName: isLiked ? "heart.fill" : "heart")
                        .foregroundStyle(isLiked ? K.Colors.primary : .secondary)

                    if likeCount > 0 {
                        Text("\(likeCount)")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .buttonStyle(.plain)

            // Edit
            if isMine {
                Button(action: onEdit) {
                    HStack(spacing: 5) {
                        Image(systemName: "pencil")
                        if editCount > 0 {
                            Text("\(editCount)")
                                .font(.footnote.weight(.semibold))
                        }
                    }
                }
                .buttonStyle(.plain)
                .foregroundStyle(.secondary)
            } else if editCount > 0 {
                HStack(spacing: 6) {
                    Image(systemName: "pencil")
                    Text("\(editCount)")
                        .font(.footnote.weight(.semibold))
                }
                .foregroundStyle(.secondary)
            }

            // ✅ Ellipsis right next to edit
            Menu {
                Button { onReport() } label: {
                    Label("Report", systemImage: "flag")
                }
                .foregroundStyle(.primary) // regular color

                if isMine {
                    Button(role: .destructive) { onDelete() } label: {
                        Label("Delete", systemImage: "trash")
                            .foregroundStyle(.primary) // icon regular; role still makes text red
                    }
                }
            } label: {
                Image(systemName: "ellipsis")
                    .rotationEffect(.degrees(90))
                    .font(.system(size: 16, weight: .semibold))
                    .frame(width: 28, height: 28)
                    .contentShape(Rectangle())
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)

            Spacer()
        }
        .font(.system(size: 16))
        .padding(.top, 2)
    }}

struct ReplyCell: View {
    let reply: PostReply
    let currentUserId: String

    let onToggleLike: () -> Void
    let onEdit: () -> Void
    let onDelete: () -> Void
    let onReport: () -> Void

    private var isMine: Bool { reply.authorId == currentUserId }
    private var isLiked: Bool { reply.likedBy[currentUserId] != nil }
    private var likeCount: Int { reply.likedBy.count }
    private var editCount: Int { reply.editedCount }

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            AvatarView(urlString: reply.authorPhotoURL, size: 26, kind: .profile)

            VStack(alignment: .leading, spacing: 4) {
                header

                Text(reply.text)
                    .font(.subheadline)
                    .fixedSize(horizontal: false, vertical: true)

                actions
            }
        }
    }

    private var header: some View {
        HStack(spacing: 8) {
            Text("@\(reply.authorUsername)")
                .font(.subheadline.weight(.semibold))

            Text("•")
                .foregroundStyle(.secondary)

            Text(timeText(reply.createdAt))
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }

    private var actions: some View {
        HStack(spacing: 10) {

            Button(action: onToggleLike) {
                HStack(spacing: 5) {
                    Image(systemName: isLiked ? "heart.fill" : "heart")
                        .foregroundStyle(isLiked ? K.Colors.primary : .secondary)

                    if likeCount > 0 {
                        Text("\(likeCount)")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .buttonStyle(.plain)

            if isMine {
                Button(action: onEdit) {
                    HStack(spacing: 5) {
                        Image(systemName: "pencil")
                        if editCount > 0 {
                            Text("\(editCount)")
                                .font(.footnote.weight(.semibold))
                        }
                    }
                }
                .buttonStyle(.plain)
                .foregroundStyle(.secondary)
            } else if editCount > 0 {
                HStack(spacing: 5) {
                    Image(systemName: "pencil")
                    Text("\(editCount)")
                        .font(.footnote.weight(.semibold))
                }
                .foregroundStyle(.secondary)
            }

            Menu {
                Button { onReport() } label: {
                    Label("Report", systemImage: "flag")
                        .foregroundStyle(.primary)
                }

                if isMine {
                    Button(role: .destructive) { onDelete() } label: {
                        Label("Delete", systemImage: "trash")
                            .foregroundStyle(.primary)
                    }
                }
            } label: {
                Image(systemName: "ellipsis")
                    .rotationEffect(.degrees(90))
                    .font(.system(size: 16, weight: .semibold))
                    .frame(width: 28, height: 28)
                    .contentShape(Rectangle())
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)

            Spacer()
        }
        .font(.system(size: 16))
        .padding(.top, 2)
    }}

private func timeText(_ date: Date) -> String {
    let s = Int(Date().timeIntervalSince(date))
    if s < 60 { return "rn" }
    if s < 3600 { return "\(s / 60)m" }
    if s < 86_400 { return "\(s / 3600)h" }
    return "\(s / 86_400)d"
}
