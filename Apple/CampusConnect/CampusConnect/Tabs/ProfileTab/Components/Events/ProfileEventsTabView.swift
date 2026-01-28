//
//  ProfileEventsTabView.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/24/26.
//


import SwiftUI

struct ProfileEventsTabView: View {
    let uid: String

    @StateObject private var vm = ProfileEventsVM()

    var body: some View {
        Group {
            if vm.isLoading && vm.events.isEmpty {
                ProfileProgressCard(text: "Loading…")
            } else if vm.events.isEmpty {
                ContentUnavailableView(
                    "No events yet",
                    systemImage: "calendar",
                    description: Text("When you create events, they’ll show up here.")
                )
                .padding(.horizontal, K.Layout.padding)
            } else if let msg = vm.errorMessage, !msg.isEmpty {
                Text(msg)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                ForEach(vm.events, id: \.id) { p in
                    PostCardView(post: p)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            
        }
        .padding(.horizontal, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .task(id: uid) { await vm.loadIfNeeded(uid: uid) }
        .refreshable { await vm.refresh(uid: uid) }
    }
}
