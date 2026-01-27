//
//  ProfileCommentsTabView.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/24/26.
//


import SwiftUI

struct ProfileCommentsTabView: View {
    let uid: String
    @StateObject private var vm = ProfileCommentsVM()

    var body: some View {
        Group {
            ContentUnavailableView(
                "Comments",
                systemImage: "text.bubble",
                description: Text("Connect this tab when your comments query is ready.")
            )
            .padding(.horizontal, K.Layout.padding)

            if let msg = vm.errorMessage, !msg.isEmpty {
                Text(msg)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(.horizontal, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .task(id: uid) { await vm.loadIfNeeded(uid: uid) }
        .refreshable { await vm.refresh(uid: uid) }
    }
}
