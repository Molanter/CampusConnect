//
//  FeedView.swift
//  CampusConnect
//
//  Infinite scroll trigger:
//   - When last cell appears, call vm.fetchMore()
//

import SwiftUI

struct FeedView: View {
    @StateObject private var vm: FeedViewModel

    init(context: FeedContext) {
        _vm = StateObject(wrappedValue: FeedViewModel(context: context))
    }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 0) {

                if vm.isLoadingInitial && vm.posts.isEmpty {
                    ProgressView().padding(.vertical, 24)
                }

                ForEach(vm.posts) { post in
                    let label = vm.ownerLabelByPostId[post.id]
                    let photoURL = vm.ownerPhotoByPostId[post.id]
                    let isDorm = vm.ownerIsDormByPostId[post.id] ?? false

                    PostCardView(
                        identity: post.feedIdentity(label: label, photoURL: photoURL, isDorm: isDorm),
                        username: vm.usernameByPostId[post.id],
                        authorUsername: vm.authorUsernameByPostId[post.id],
                        timeText: post.feedTimeText,
                        text: post.description,
                        media: post.feedMedia
                    )
                    .onAppear {
                        // Scroll-to-bottom trigger
                        if post.id == vm.posts.last?.id {
                            Task { await vm.fetchMore() }
                        }
                    }
                }

                if vm.isLoadingMore {
                    ProgressView().padding(.vertical, 16)
                } else if !vm.hasMore && !vm.posts.isEmpty {
                    Text("End of feed")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .padding(.vertical, 18)
                }
            }
            .padding(.top, 6)
        }
        .refreshable { await vm.refresh() }
        .task {
            if vm.posts.isEmpty { await vm.loadInitial() }
        }
        .overlay(alignment: .top) {
            if let msg = vm.errorMessage {
                Text(msg)
                    .font(.footnote)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(.red.opacity(0.85), in: Capsule())
                    .padding(.top, 10)
            }
        }
    }
}