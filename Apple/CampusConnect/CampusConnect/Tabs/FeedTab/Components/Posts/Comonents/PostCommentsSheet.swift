//
//  PostCommentsSheet.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/19/26.
//

import SwiftUI

struct PostCommentsSheet: View {
    let postId: String

    @StateObject private var vm = PostCommentsVM()
    @EnvironmentObject private var profileStore: ProfileStore
    @Environment(\.dismiss) private var dismiss

    @State private var composerText = ""
    @FocusState private var isComposerFocused: Bool

    // Reply / Edit mode
    @State private var replyingToCommentId: String? = nil
    @State private var editingTarget: EditingTarget? = nil

    // Report placeholder
    @State private var showReportAlert = false
    @State private var reportTargetLabel = ""

    private var currentUserId: String {
        (profileStore.profile?.id ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var body: some View {
        NavigationStack {
            contentView
                .navigationTitle("Comments")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar { topBar }
                .task(id: postId) { vm.start(postId: postId) }
                .onDisappear { vm.stop() }
                .safeAreaInset(edge: .bottom, spacing: 0) { composerInset }
                .alert("Report", isPresented: $showReportAlert) {
                    Button("OK", role: .cancel) {}
                } message: {
                    Text("Reporting is not available yet\(reportTargetLabel.isEmpty ? "" : " (\(reportTargetLabel))").")
                }
        }
    }

    // MARK: - Top bar

    private var topBar: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Button {
                dismiss()
            } label: {
                Text("Done")
                .foregroundStyle(K.Colors.primary)
            }
        }
    }

    // MARK: - Main content

    private var contentView: some View {
        Group {
            if vm.isLoading && vm.comments.isEmpty {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)

            } else if vm.comments.isEmpty {
                noCommentsView

            } else {
                ScrollView { commentsList }
            }
        }
    }

    @ViewBuilder
    private var noCommentsView: some View {
        ContentUnavailableView(
            "No comments yet",
            systemImage: "bubble.left.and.bubble.right",
            description: Text("Be the first to leave a comment.")
        )
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(24)
    }
    
    private var commentsList: some View {
        LazyVStack(alignment: .leading, spacing: 14) {
            if let msg = vm.errorMessage {
                Text(msg).foregroundStyle(.red).font(.footnote)
            }

            ForEach(vm.comments) { c in
                commentRow(c)

                if !c.replies.isEmpty {
                    repliesBlock(for: c)
                }
            }

            Spacer(minLength: 12)
        }
        .padding(14)
    }

    private func commentRow(_ c: PostComment) -> some View {
        CommentCell(
            comment: c,
            currentUserId: currentUserId,
            onReply: {
                beginReply(commentId: c.id)
            },
            onToggleLike: {
                toggleLikeComment(c)
            },
            onEdit: {
                beginEditComment(c)
            },
            onDelete: {
                Task { await vm.deleteComment(postId: postId, commentId: c.id) }
            },
            onReport: {
                reportTargetLabel = "comment"
                showReportAlert = true
            }
        )
    }

    private func repliesBlock(for comment: PostComment) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(comment.replies) { r in
                ReplyCell(
                    reply: r,
                    currentUserId: currentUserId,
                    onToggleLike: {
                        toggleLikeReply(reply: r, commentId: comment.id)
                    },
                    onEdit: {
                        beginEditReply(r, commentId: comment.id)
                    },
                    onDelete: {
                        Task { await vm.deleteReply(postId: postId, commentId: comment.id, replyId: r.id) }
                    },
                    onReport: {
                        reportTargetLabel = "reply"
                        showReportAlert = true
                    }
                )
            }
        }
        .padding(.leading, 44)
        .overlay(alignment: .leading) {
            Rectangle()
                .fill(Color.secondary.opacity(0.25))
                .frame(width: 2)
                .padding(.leading, 16)
        }
    }

    // MARK: - Composer inset

    private var composerInset: some View {
        CommentTextFieldBar(
            text: $composerText,
            focus: $isComposerFocused,
            header: composerHeader,
            sendStyle: sendStyle,
            onCancelHeader: cancelComposerHeader,
            onSend: { Task { await send() } }
        )
        .frame(maxWidth: .infinity, alignment: .bottom)
        .fixedSize(horizontal: false, vertical: true)
        .padding(.horizontal, 12)
        .padding(.top, 8)
        .padding(.bottom, 8)
    }

    private var composerHeader: CommentTextFieldBar.Header? {
        if let e = editingTarget {
            return .editing(label: e.headerLabel)
        }
        if let r = replyingToUser {
            return .replying(username: r.username, photoURL: r.photoURL)
        }
        return nil
    }

    private var sendStyle: CommentTextFieldBar.SendStyle {
        editingTarget == nil ? .send : .save
    }

    private func cancelComposerHeader() {
        if editingTarget != nil {
            editingTarget = nil
            composerText = ""
        } else {
            replyingToCommentId = nil
        }
    }

    // MARK: - Reply/Edit state helpers

    private var replyingToUser: (username: String, photoURL: String?)? {
        guard let cid = replyingToCommentId,
              let c = vm.comments.first(where: { $0.id == cid }) else { return nil }
        return (c.authorUsername, c.authorPhotoURL)
    }

    private func beginReply(commentId: String) {
        // entering reply clears edit mode
        editingTarget = nil
        replyingToCommentId = commentId
        isComposerFocused = true
    }

    private func beginEditComment(_ c: PostComment) {
        // entering edit clears reply mode
        replyingToCommentId = nil
        editingTarget = .comment(commentId: c.id)
        composerText = c.text
        isComposerFocused = true
    }

    private func beginEditReply(_ r: PostReply, commentId: String) {
        replyingToCommentId = nil
        editingTarget = .reply(commentId: commentId, replyId: r.id)
        composerText = r.text
        isComposerFocused = true
    }

    // MARK: - Like helpers

    private func toggleLikeComment(_ c: PostComment) {
        let uid = currentUserId
        guard !uid.isEmpty else { return }
        let liked = c.likedBy[uid] != nil

        Task {
            await vm.toggleLikeComment(
                postId: postId,
                commentId: c.id,
                uid: uid,
                isCurrentlyLiked: liked
            )
        }
    }

    private func toggleLikeReply(reply: PostReply, commentId: String) {
        let uid = currentUserId
        guard !uid.isEmpty else { return }
        let liked = reply.likedBy[uid] != nil

        Task {
            await vm.toggleLikeReply(
                postId: postId,
                commentId: commentId,
                replyId: reply.id,
                uid: uid,
                isCurrentlyLiked: liked
            )
        }
    }

    // MARK: - Send

    private func send() async {
        let cleanText = composerText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanText.isEmpty else { return }

        let uid = currentUserId
        guard !uid.isEmpty else {
            vm.errorMessage = "Missing user id."
            return
        }

        // ✅ EDIT MODE (reuse composer)
        if let target = editingTarget {
            composerText = ""
            editingTarget = nil

            switch target {
            case .comment(let commentId):
                await vm.editComment(postId: postId, commentId: commentId, newText: cleanText)
            case .reply(let commentId, let replyId):
                await vm.editReply(postId: postId, commentId: commentId, replyId: replyId, newText: cleanText)
            }
            return
        }

        // ✅ NORMAL SEND (comment or reply)
        composerText = ""

        let authorUsername = (profileStore.profile?.username ?? "user").trimmingCharacters(in: .whitespacesAndNewlines)
        let authorPhotoURL = (profileStore.profile?.photoURL ?? "").trimmingCharacters(in: .whitespacesAndNewlines)

        if let cid = replyingToCommentId {
            await vm.postReply(
                postId: postId,
                commentId: cid,
                text: cleanText,
                authorId: uid,
                authorUsername: authorUsername,
                authorPhotoURL: authorPhotoURL.isEmpty ? nil : authorPhotoURL
            )
            replyingToCommentId = nil
        } else {
            await vm.postComment(
                postId: postId,
                text: cleanText,
                authorId: uid,
                authorUsername: authorUsername,
                authorPhotoURL: authorPhotoURL.isEmpty ? nil : authorPhotoURL
            )
        }
    }
}

// MARK: - Inline edit target

private enum EditingTarget: Equatable {
    case comment(commentId: String)
    case reply(commentId: String, replyId: String)

    var headerLabel: String {
        switch self {
        case .comment: return "Editing comment"
        case .reply: return "Editing reply"
        }
    }
}

// MARK: - Telegram-ish liquid-glass composer

private struct CommentTextFieldBar: View {
    enum Header: Equatable {
        case replying(username: String, photoURL: String?)
        case editing(label: String)
    }

    enum SendStyle: Equatable {
        case send
        case save
    }

    @Binding var text: String
    var focus: FocusState<Bool>.Binding

    let header: Header?
    let sendStyle: SendStyle
    let onCancelHeader: () -> Void
    let onSend: () -> Void

    @Environment(\.colorScheme) private var colorScheme

    private var outerStroke: Color {
        colorScheme == .dark ? .white.opacity(0.14) : .black.opacity(0.10)
    }

    private var shadowColor: Color {
        colorScheme == .dark ? .black.opacity(0.40) : .black.opacity(0.12)
    }

    private var trimmed: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var hasText: Bool { !trimmed.isEmpty }
    private let capsule = Capsule(style: .continuous)

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let header { headerCapsule(header) }
            inputRow
        }
        .animation(.spring(response: 0.25, dampingFraction: 0.9), value: hasText)
    }

    private func headerCapsule(_ header: Header) -> some View {
        Button(action: onCancelHeader) {
            glassContainer(in: capsule) {
                HStack(spacing: 10) {
                    switch header {
                    case .replying(let username, let photoURL):
                        Image(systemName: "arrowshape.turn.up.left.fill")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(.secondary)

                        AvatarView(urlString: photoURL, size: 22, kind: .profile)

                        Text("@\(username)")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)

                    case .editing(let label):
                        Image(systemName: "pencil.line")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(.secondary)

                        Text(label)
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }

                    Spacer(minLength: 0)

                    Image(systemName: "xmark")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.secondary.opacity(0.7))
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .buttonStyle(.plain)
        .contentShape(Capsule(style: .continuous))
    }

    private var inputRow: some View {
        HStack(alignment: .bottom, spacing: 10) {
            glassContainer(in: capsule) {
                TextField("Comment", text: $text, axis: .vertical)
                    .focused(focus)
                    .textFieldStyle(.plain)
                    .background(.clear)
                    .lineLimit(1...5)
                    .submitLabel(.send)
                    .onSubmit { if hasText { onSend() } }
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .shadow(color: shadowColor, radius: 18, x: 0, y: 10)

            if hasText {
                Button(action: onSend) {
                    Image(systemName: sendStyle == .save ? "checkmark.circle.fill" : "arrow.up.circle.fill")
                        .font(.system(size: 32))
                        .foregroundStyle(K.Colors.primary)
                        .symbolRenderingMode(.hierarchical)
                }
                .buttonStyle(.plain)
                .transition(.scale.combined(with: .opacity))
            }
        }
    }

    @ViewBuilder
    private func glassContainer<Content: View>(
        in shape: Capsule,
        @ViewBuilder content: () -> Content
    ) -> some View {
        if #available(iOS 26.0, *) {
            content()
                .glassEffect(.regular, in: shape)
        } else {
            content()
                .background(shape.fill(Color(.secondarySystemBackground)))
                .overlay(shape.strokeBorder(outerStroke, lineWidth: 1))
        }
    }
}

#if DEBUG
extension PostCommentsVM {
    func seedPreviewData() {
        isLoading = false
        errorMessage = nil
        comments = [
            PostComment(
                id: "c1",
                text: "This is a comment. Looks good.",
                authorId: "u1",
                authorUsername: "alex",
                authorPhotoURL: "https://i.pravatar.cc/150?img=3",
                createdAt: Date().addingTimeInterval(-60 * 5),
                likedBy: ["u2": Date().addingTimeInterval(-60)],
                editedCount: 1,
                editedAt: Date().addingTimeInterval(-120),
                replies: [
                    PostReply(
                        id: "r1",
                        text: "Reply to the comment (1 level deep).",
                        authorId: "u2",
                        authorUsername: "kate",
                        authorPhotoURL: "https://i.pravatar.cc/150?img=8",
                        createdAt: Date().addingTimeInterval(-60 * 2),
                        likedBy: [:],
                        editedCount: 0,
                        editedAt: nil
                    )
                ]
            )
        ]
    }
}

#Preview("PostCommentsSheet") {
    let store = ProfileStore()
    return PostCommentsSheet(postId: "mockPost123")
        .environmentObject(store)
}
#endif
