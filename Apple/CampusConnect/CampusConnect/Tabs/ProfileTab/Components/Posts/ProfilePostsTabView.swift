//
//  ProfilePostsTabView.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/24/26.
//


import SwiftUI

struct ProfilePostsTabView: View {
    let uid: String
    @Binding var postsCount: Int

    @StateObject private var vm = ProfilePostsVM()

    var body: some View {
        Group {
            if vm.isLoading && vm.posts.isEmpty {
                ProfileProgressCard(text: "Loading…")
            } else if vm.posts.isEmpty {
                ContentUnavailableView(
                    "No posts yet",
                    systemImage: "square.and.pencil",
                    description: Text("When you post, they’ll show up here.")
                )
                .padding(.horizontal, K.Layout.padding)
            } else if let msg = vm.errorMessage, !msg.isEmpty {
                Text(msg)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                ForEach(vm.posts, id: \.id) { p in
                    PostCardView(post: p)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .padding(.horizontal, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .task(id: uid) {
            await vm.loadIfNeeded(uid: uid)
            postsCount = vm.posts.count
        }
        .refreshable {
            await vm.refresh(uid: uid)
            postsCount = vm.posts.count
        }
        .onChange(of: vm.posts.count) { _, newValue in
            postsCount = newValue
        }
    }
}
