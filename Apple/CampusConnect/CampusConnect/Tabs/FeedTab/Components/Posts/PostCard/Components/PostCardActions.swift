//
//  PostCardActions.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/21/26.
//

import SwiftUI

struct PostCardActions: View {
    let post: PostDoc
    let isMine: Bool

    let likeCount: Int
    let isLikedByMe: Bool

    let metaColor: Color
    let iconSize: CGFloat

    let onToggleLike: (_ uid: String) -> Void

    @EnvironmentObject private var profileStore: ProfileStore
    @StateObject private var attendanceVM = PostAttendanceVM()

    // local presentation state
    @State private var showComments = false
    @State private var showEdit = false
    @State private var showReport = false
    @State private var showAttendanceSheet = false
    @State private var likeBounceToken: Int = 0
    
    private var currentUid: String {
        (profileStore.profile?.id ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var commentsCount: Int { post.commentsCount ?? 0 }
    private var editCount: Int { post.editCount ?? 0 }

    // key changes when uid loads / post changes / event toggles
    private var attendanceTaskKey: String {
        "\(post.id)|\(currentUid)|\(post.type == .event ? "event" : "none")"
    }

    var body: some View {
        HStack(spacing: 14) {

            // Like
            Button {
                guard !currentUid.isEmpty else { return }
                // ✅ immediate bounce
                withAnimation(.bouncy(duration: 0.28, extraBounce: 0.18)) {
                    likeBounceToken += 1
                }
                onToggleLike(currentUid)
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: isLikedByMe ? "heart.fill" : "heart")
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(height: iconSize)
                        .foregroundStyle(isLikedByMe ? K.Colors.primary : metaColor)
                        .symbolEffect(.bounce, value: likeBounceToken) // ✅ SF Symbol bounce

                    if likeCount > 0 {
                        Text("\(likeCount)")
                            .font(.caption)
                            .monospacedDigit()
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .buttonStyle(.plain)
            
            // Comments
            Button {
                showComments = true
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "bubble.left.and.text.bubble.right")
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(height: iconSize)

                    if commentsCount > 0 {
                        Text("\(commentsCount)")
                            .font(.caption)
                            .monospacedDigit()
                    }
                }
                .foregroundStyle(metaColor)
            }
            .buttonStyle(.plain)

            // Attendance (events only)
            if post.type == .event {
                let enabled = !currentUid.isEmpty

                AttendanceButton(
                    status: attendanceVM.myStatus,
                    count: attendanceVM.displayCount,
                    iconSize: iconSize,
                    metaColor: metaColor,
                    onSelect: { attendanceVM.toggle($0) },
                    onShowAttendees: { showAttendanceSheet = true }
                )
                .disabled(!enabled)
                .tint(.secondary)
            }

            // Edit
            Button {
                guard isMine else { return }
                showEdit = true
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "pencil")
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(height: iconSize)

                    if editCount > 0 {
                        Text("\(editCount)")
                            .font(.caption)
                            .monospacedDigit()
                    }
                }
                .foregroundStyle(isMine ? metaColor : metaColor.opacity(0.45))
            }
            .buttonStyle(.plain)
            .disabled(!isMine)

            // More / report
            Menu {
                Button(role: .destructive) {
                    showReport = true
                } label: {
                    Label("Report", systemImage: "flag")
                        .tint(.red)
                }
            } label: {
                Image(systemName: "ellipsis")
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: iconSize, height: iconSize)
                    .rotationEffect(.degrees(90))
                    .frame(width: 34, height: 34)
                    .contentShape(Rectangle())
            }
            .tint(.secondary)
        }
        .padding(.top, 2)

        // ✅ Attendance listener owned here
        .task(id: attendanceTaskKey) {
            if post.type == .event, !currentUid.isEmpty {
                attendanceVM.start(postId: post.id, uid: currentUid)
            } else {
                attendanceVM.stop()
            }
        }
        .onDisappear {
            attendanceVM.stop()
        }

        // ✅ Sheets owned here
        .sheet(isPresented: $showComments) {
            PostCommentsSheet(postId: post.id)
                .presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $showEdit) {
            EditPostView(postId: post.id, initial: post)
        }
        .sheet(isPresented: $showReport) {
            ReportPostSheet(postId: post.id)
        }
        .sheet(isPresented: $showAttendanceSheet) {
            AttendeeListSheet(
                going: attendanceVM.going,
                maybe: attendanceVM.maybe,
                notGoing: attendanceVM.notGoing
            )
            .presentationDetents([.medium, .large])
        }
    }
}
