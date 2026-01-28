//
//  FeedView.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/14/26.
//


//  - For .main: campusId is read from ProfileStore (defaults to "all").
//  - Reacts to campusId changes and refreshes the feed.
//  - Infinite scroll: when last cell appears, vm.fetchMore() (guarded by hasMore/isLoadingMore).
//

import SwiftUI

struct FeedView: View {
    @StateObject private var vm: FeedViewModel

    // If your FeedViewModel init is now: init(profileStore:)
    init(profileStore: ProfileStore) {
        _vm = StateObject(wrappedValue: FeedViewModel(profileStore: profileStore))
    }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                if vm.isLoadingInitial && vm.posts.isEmpty {
                    ProgressView().padding(.vertical, 24)
                }

                ForEach(vm.posts) { post in
                    PostCardView(post: post)
                    .task(id: post.id) {
                        // infinite scroll
                        guard post.id == vm.posts.last?.id else { return }
                        await vm.fetchMore()
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
        .task { await vm.refresh() }
        .overlay {
            if !vm.isLoadingInitial && vm.posts.isEmpty && vm.errorMessage == nil {
                ContentUnavailableView("No posts yet", systemImage: "tray")
                    .padding(.top, 60)
            }
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

