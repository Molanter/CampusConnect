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
    @EnvironmentObject private var appState: AppState

    @State private var isSearchExpanded: Bool = false
    @State private var isSearchFieldActive: Bool = false
    
    private var shouldHideTabBar: Bool {
        appState.appTab == .create
    }

    var body: some View {
        Group {
            if #available(iOS 26.0, *) {
                
                // System tab bar (iOS 26+)
                /*Animated*/TabView(selection: $appState.appTab) {
                    Tab("Feed", systemImage: "link", value: .feed) {
                        FeedView(profileStore: profileStore)
                    }

                    Tab("Create", systemImage: "plus", value: .create) {
                        CreatePostView()
                            .toolbarVisibility(appState.appTab == .create ? .hidden : .visible, for: .tabBar)
                    }

                    Tab("Profile", systemImage: "person.circle", value: .profile) {
                        MyProfileView()
                            .environmentObject(authVM)
                    }

                    // keep the separated Search tab behavior
                    Tab(value: .search, role: .search) {
                        ExploreView(searchText: appState.searchText)
                            .searchable(text: $appState.searchText)
                    }
                } //effects: { tab in
//                    switch tab {
//                        case .feed: [.bounce.up]
//                    case .create: [.bounce.up]
//                    case .search: [.bounce]
//                    case .profile: [.wiggle]
//                        
//                    }
//                }
                .accentColor(K.Colors.primary)
            } else {
                // Custom tab bar (below iOS 26) with separate Explore circle on the LEFT
                ZStack(alignment: .bottom) {
                    Group {
                        if isSearchExpanded || isSearchFieldActive {
                            ExploreView(searchText: appState.searchText)
                        } else {
                            tabContent
                        }
                    }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)

                    if !shouldHideTabBar {
                        CustomTabBarApp(
                            activeTab: $appState.appTab,
                            searchText: $appState.searchText,
                            onSearchBarExpanded: { isSearchExpanded = $0 },
                            onSearchTextFieldActive: { isSearchFieldActive = $0 }
                        )
                    }
                }
                .ignoresSafeArea(.container, edges: shouldHideTabBar ? .bottom : [])
            }
        }
    }

    @ViewBuilder
    private var tabContent: some View {
        switch appState.appTab {
        case .feed:
            FeedView(profileStore: profileStore)

        case .create:
            CreatePostView()

        case .profile:
            MyProfileView()
                .environmentObject(authVM)
        case .search:
            ExploreView(searchText: appState.searchText)
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
