//
//  MainTabView.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/11/26.
//

import SwiftUI

struct MainTabView: View {
    @EnvironmentObject private var authVM: AuthViewModel
    @EnvironmentObject private var profileStore: ProfileStore

    @State private var activeTab: AppTab = .feed
    @State private var searchText: String = ""
    @State private var isSearchExpanded: Bool = false
    @State private var isSearchFieldActive: Bool = false

    var body: some View {
        Group {
            if #available(iOS 26.0, *) {
                // System tab bar (iOS 26+)
                TabView {
                    Tab("Feed", systemImage: "link") {
                        FeedView(profileStore: profileStore)
                    }

                    Tab("Create", systemImage: "plus") {
                        PostEditorView(mode: .create, initial: nil)
                    }

                    Tab("Profile", systemImage: "person.circle") {
                        ProfileView()
                            .environmentObject(authVM)
                    }

                    Tab(role: .search) {
                        ExploreView(searchText: searchText)
                            .searchable(text: $searchText)
                    }
                }
                .accentColor(K.Colors.primary)
            } else {
                // Custom tab bar (below iOS 26) with separate Explore circle on the LEFT
                ZStack(alignment: .bottom) {
                    Group {
                        if isSearchExpanded || isSearchFieldActive {
                            ExploreView(searchText: searchText)
                        } else {
                            tabContent
                        }
                    }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)

                    CustomTabBarApp(
                        activeTab: $activeTab,
                        searchText: $searchText,
                        onSearchBarExpanded: { isSearchExpanded = $0 },
                        onSearchTextFieldActive: { isSearchFieldActive = $0 }
                    )
                }
            }
        }
    }

    @ViewBuilder
    private var tabContent: some View {
        switch activeTab {
        case .feed:
            FeedView(profileStore: profileStore)

        case .create:
            PostEditorView(mode: .create, initial: nil)

        case .profile:
            ProfileView()
                .environmentObject(authVM)
        }
    }
}

// MARK: - Screens

struct ExploreView: View {
    let searchText: String

    var body: some View {
        NavigationStack {
            Text("Explore: \(searchText)")
        }
    }
}
