//
//  MyProfileView.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/21/26.
//

import SwiftUI

enum ProfileRoute: Hashable {
    case settings(SettingsDestination?) // optional initial destination
}


struct MyProfileView: View {
    @EnvironmentObject private var profileStore: ProfileStore
    @EnvironmentObject private var appState: AppState

    @State private var tab: Int = 1

    // Header height measuring
    @State private var headerContentHeight: CGFloat = 1
    @State private var path: [ProfileRoute] = []

    private struct HeaderHeightKey: PreferenceKey {
        static var defaultValue: CGFloat = 1
        static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
            value = max(value, nextValue())
        }
    }

    // Scroll-to-top anchor behavior
    @State private var tabsTopMinY: CGFloat = 0
    private static let tabsTopAnchorID = "ProfileTabsTopAnchor"

    private struct TabsTopMinYKey: PreferenceKey {
        static var defaultValue: CGFloat = .zero
        static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = nextValue() }
    }

    // ✅ counts come from the tab views
    @State private var postsCount: Int = 0
    @State private var clubsCount: Int = 0

    private var uid: String {
        (profileStore.profile?.id ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var name: String {
        let v = (profileStore.profile?.displayName ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return v.isEmpty ? "Unknown" : v
    }

    private var usernameText: String {
        let v = (profileStore.profile?.username ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return v.isEmpty ? "" : "@\(v)"
    }

    private var subtitleLine: String {
        let campusId = (profileStore.profile?.campusId ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return campusId.isEmpty ? "" : campusId
    }

    private var avatarURL: URL? {
        let v = (profileStore.profile?.photoURL ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return v.isEmpty ? nil : URL(string: v)
    }

    var body: some View {
        NavigationStack {
            ScrollViewReader { scrollProxy in
                ScrollView {
                    LazyVStack(spacing: 12, pinnedViews: [.sectionHeaders]) {
                        profileHeader

                        Section {
                            tabsTopAnchor
                            tabContent
                                .padding(.top, 8)
                        } header: {
                            pickerHeader
                        }
                    }
                    .padding(.bottom, 16)
                }
                .coordinateSpace(name: "ProfileScroll")
                .onPreferenceChange(TabsTopMinYKey.self) { tabsTopMinY = $0 }
                .background(Color(.systemGroupedBackground))
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        NavigationLink(value: ProfileRoute.settings(nil)) {
                            Label("Settings", systemImage: "gearshape")
                        }

                    }
                }
                .onChange(of: tab) { _, _ in
                    if tabsTopMinY < -80 {
                        withAnimation(.easeInOut) {
                            scrollProxy.scrollTo(Self.tabsTopAnchorID, anchor: .top)
                        }
                    }
                }
            }
            .navigationDestination(for: ProfileRoute.self) { route in
                switch route {
                case .settings(let initial):
                    SettingsFlowView(initialDestination: initial)
                }
            }
            .onChange(of: appState.pendingLink) { _, newValue in
                guard let newValue else { return }
                
                switch newValue {
                case .settings(let dest):
                    // Deep link trigger:
                    // 1) We are already on Profile tab (AppState set it)
                    // 2) Push Settings, then optionally push inside Settings
                    path.removeAll()
                    path.append(.settings(dest))
                }
                
                appState.pendingLink = nil
            }
        }
    }

    // MARK: - Your segmented picker

    private var pickerHeader: some View {
        Picker("tab", selection: $tab) {
            Text("Posts").tag(1)
            Text("Events").tag(2)
            Text("Comments").tag(3)
            Text("Clubs").tag(4)
        }
        .pickerStyle(.segmented)
        .background {
            if #available(iOS 26.0, *) {
                Capsule(style: .continuous)
                    .glassEffect(.regular, in: Capsule(style: .continuous))
            } else {
                Capsule(style: .continuous)
                    .fill(Color(.systemGray6))
            }
        }
        .padding(.horizontal)
    }

    // MARK: - Anchor

    private var tabsTopAnchor: some View {
        Color.clear
            .frame(height: 0)
            .id(Self.tabsTopAnchorID)
            .background(
                GeometryReader { geo in
                    Color.clear
                        .preference(
                            key: TabsTopMinYKey.self,
                            value: geo.frame(in: .named("ProfileScroll")).minY
                        )
                }
            )
    }

    // MARK: - Tab content (now separate views)

    @ViewBuilder
    private var tabContent: some View {
        switch tab {
        case 1:
            ProfilePostsTabView(uid: uid, postsCount: $postsCount)

        case 2:
            ProfileEventsTabView(uid: uid)

        case 3:
            ProfileCommentsTabView(uid: uid)

        case 4:
            // clubs uses AUTH uid internally; doesn't need profile uid
            ProfileClubsTabView(clubsCount: $clubsCount)

        default:
            ProfilePostsTabView(uid: uid, postsCount: $postsCount)
        }
    }

    // MARK: - Header

    private var profileHeader: some View {
        GeometryReader { geo in
            let top = geo.safeAreaInsets.top
            let bgHeight = max(headerContentHeight + top, 1)

            ZStack(alignment: .top) {
                headerBackgroundImage
                    .scaledToFill()
                    .frame(height: bgHeight)
                    .clipped()
                    .cornerRadius(36)
                    .padding(.horizontal, 5)

                VStack(spacing: 10) {
                    headerOverlay
                    buttonsSection()
                }
                .padding(.top, top + 16)
                .padding(.horizontal, 16)
                .padding(.bottom, 16)
                .frame(maxWidth: .infinity)
                .background(
                    GeometryReader { inner in
                        Color.clear
                            .preference(key: HeaderHeightKey.self, value: inner.size.height)
                    }
                )
            }
        }
        .frame(height: max(headerContentHeight, 1))
        .onPreferenceChange(HeaderHeightKey.self) { h in
            headerContentHeight = max(h, 1)
        }
        .padding(.top, 8)
    }

    private var headerBackgroundImage: some View {
        AsyncImage(url: avatarURL) { phase in
            switch phase {
            case .success(let image):
                image.resizable()
            default:
                Color(.systemGray5)
            }
        }
    }

    @ViewBuilder
    private var headerOverlay: some View {
        if #available(iOS 26.0, *) {
            headerInfoContent
                .padding(.vertical, 14)
                .glassEffect(.clear.interactive(), in: .rect(cornerRadius: 36))
        } else {
            headerInfoContent
                .padding(.vertical, 14)
                .background {
                    RoundedRectangle(cornerRadius: 36, style: .continuous)
                        .fill(.ultraThinMaterial)
                }
        }
    }

    private var headerInfoContent: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                AvatarView(urlString: avatarURL?.absoluteString, size: 75, kind: .profile)
                    .frame(width: 75, height: 75)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(Color.secondary, lineWidth: 1))

                VStack(alignment: .leading, spacing: 2) {
                    Text(name)
                        .font(.title3)
                        .bold()

                    if !usernameText.isEmpty {
                        Text(usernameText)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .padding(.horizontal)

            if !subtitleLine.isEmpty {
                Text(subtitleLine)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal)
            }

            ScrollView(.horizontal) {
                HStack(spacing: 8) {
                    statCapsule(int: postsCount, text: "Posts").padding(.leading).onTapGesture {
                        tab = 1
                    }
                    statCapsule(int: clubsCount, text: "Clubs").onTapGesture {
                        tab = 4
                    }
                }
                .padding(.vertical, 6)
            }
            .scrollIndicators(.hidden)
            .clipShape(Capsule())
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func buttonsSection() -> some View {
        let editButton = Label("Edit Profile", systemImage: "pencil")
            .font(.headline.bold())
            .foregroundStyle(Color.primary)
            .padding()
            .frame(maxWidth: .infinity)

        if #available(iOS 26.0, *) {
            editButton
                .overlay { Capsule(style: .continuous).stroke(Color.secondary, lineWidth: 1) }
                .glassEffect(.clear.interactive(), in: .capsule)
        } else {
            editButton
                .overlay { Capsule(style: .continuous).stroke(Color.secondary, lineWidth: 1) }
        }
    }

    @ViewBuilder
    private func statCapsule(int: Int, text: String) -> some View {
        let content = HStack(spacing: 6) {
            Text(String(int)).bold()
            Text(text)
        }

        if #available(iOS 26.0, *) {
            content
                .font(.subheadline)
                .padding(7)
                .overlay {
                    Capsule(style: .continuous)
                        .stroke(Color.secondary, lineWidth: 1)
                }
                .glassEffect(.clear.interactive(), in: .capsule)
        } else {
            content
                .font(.subheadline)
                .padding(.vertical, 7)
                .padding(.horizontal, 10)
                .background { Capsule(style: .continuous).fill(.ultraThinMaterial) }
                .overlay { Capsule(style: .continuous).stroke(Color.secondary, lineWidth: 1) }
        }
    }
}
