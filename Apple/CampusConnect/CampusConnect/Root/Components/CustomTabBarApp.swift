//
//  CustomTabBarApp.swift
//  CampusConnect
//
//  Same UI as the example, but using CampusConnect tabs.
//

import SwiftUI


/// CampusConnect Tabs (main capsule tabs)
enum AppTab: String, CaseIterable, AnimatedTabSelectionProtocol{
    case feed, create, profile, search

    var symbolImage: String {
        switch self {
        case .feed: return "link"
        case .create: return "plus"
        case .profile: return "person.circle"
        case .search: return "magnifyingglass"
        }
    }
    
    var title: String {
        switch self {
        case .feed: return "Feed"
        case .create: return "Create"
        case .profile: return "Profile"
        case .search: return "Search"
        }
    }

    var index: Int { Self.allCases.firstIndex(of: self) ?? 0 }
}

struct CustomTabBarApp: View {
    /// Show search on the RIGHT as a separate control (like iOS 26 search tab)
    var showsSearchBar: Bool = true

    @Binding var activeTab: AppTab
    @Binding var searchText: String
    var onSearchBarExpanded: (Bool) -> ()
    var onSearchTextFieldActive: (Bool) -> ()

    /// View Properties
    @GestureState private var isActive: Bool = false
    @State private var isInitialOffsetSet: Bool = false
    @State private var dragOffset: CGFloat = 0
    @State private var lastDragOffset: CGFloat?

    /// Search Bar Properties
    @State private var isSearchExpanded: Bool = false
    @FocusState private var isKeyboardActive: Bool

    var body: some View {
        GeometryReader {
            let size = $0.size
            let tabs = AppTab.allCases
            let tabItemWidth = max(min(size.width / CGFloat(tabs.count + (showsSearchBar ? 1 : 0)), 90), 60)
            let tabItemHeight: CGFloat = 56

            ZStack {
                if isInitialOffsetSet {
                    let mainLayout = isKeyboardActive
                    ? AnyLayout(ZStackLayout(alignment: .leading))
                    : AnyLayout(HStackLayout(spacing: 12))

                    mainLayout {
                        let tabLayout = isSearchExpanded
                        ? AnyLayout(ZStackLayout())
                        : AnyLayout(HStackLayout(spacing: 0))

                        tabLayout {
                            ForEach(tabs, id: \.rawValue) { tab in
                                TabItemView(
                                    tab,
                                    width: isSearchExpanded ? 45 : tabItemWidth,
                                    height: isSearchExpanded ? 45 : tabItemHeight
                                )
                                .opacity(isSearchExpanded ? (activeTab == tab ? 1 : 0) : 1)
                            }
                        }
                        /// Draggable Active Tab
                        .background(alignment: .leading) {
                            ZStack {
                                Capsule(style: .continuous)
                                    .stroke(.gray.opacity(0.25), lineWidth: 3)
                                    .opacity(isActive ? 1 : 0)

                                Capsule(style: .continuous)
                                    .fill(.background)
                            }
                            .compositingGroup()
                            .frame(width: tabItemWidth, height: tabItemHeight)
                            .scaleEffect(isActive ? 1.3 : 1)
                            .offset(x: isSearchExpanded ? 0 : dragOffset)
                            .opacity(isSearchExpanded ? 0 : 1)
                        }
                        .padding(3)
                        .background(TabBarBackground())
                        .overlay {
                            if isSearchExpanded {
                                Capsule()
                                    .foregroundStyle(.clear)
                                    .contentShape(.capsule)
                                    .onTapGesture {
                                        withAnimation(.bouncy) {
                                            isSearchExpanded = false
                                        }
                                    }
                            }
                        }
                        /// Hiding when keyboard is active
                        .opacity(isKeyboardActive ? 0 : 1)

                        if showsSearchBar {
                            ExpandableSearchBar(height: isSearchExpanded ? 45 : tabItemHeight)
                        }
                    }
                    .optionalGeometryGroup()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
            .onAppear {
                guard !isInitialOffsetSet else { return }
                dragOffset = CGFloat(activeTab.index) * tabItemWidth
                isInitialOffsetSet = true
            }
        }
        .frame(height: 56)
        .padding(.horizontal, 25)
        .padding(.bottom, isKeyboardActive ? 10 : 0)
        .animation(.bouncy, value: dragOffset)
        .animation(.bouncy, value: isActive)
        .animation(.smooth, value: activeTab)
        .animation(.easeInOut(duration: 0.25), value: isKeyboardActive)
        .customOnChange(value: isKeyboardActive) {
            onSearchTextFieldActive($0)
        }
        .customOnChange(value: isSearchExpanded) {
            onSearchBarExpanded($0)
        }
    }

    // MARK: - Tab Item View
    @ViewBuilder
    private func TabItemView(_ tab: AppTab, width: CGFloat, height: CGFloat) -> some View {
        let tabs = AppTab.allCases
        let tabCount = tabs.count - 1

        VStack(spacing: 0) {
            Image(systemName: tab.symbolImage)
                .font(.title2)
                .symbolVariant(.fill)

            if !isSearchExpanded {
                Text(tab.title)
                    .font(.caption2)
                    .lineLimit(1)
            }
        }
        .foregroundStyle(activeTab == tab && !isSearchExpanded ? K.Colors.primary : Color.primary)
        .frame(width: width, height: height)
        .contentShape(.capsule)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .updating($isActive) { _, out, _ in out = true }
                .onChanged { value in
                    let xOffset = value.translation.width
                    if let lastDragOffset {
                        let newDragOffset = xOffset + lastDragOffset
                        dragOffset = max(min(newDragOffset, CGFloat(tabCount) * width), 0)
                    } else {
                        lastDragOffset = dragOffset
                    }
                }
                .onEnded { _ in
                    lastDragOffset = nil
                    let landingIndex = Int((dragOffset / width).rounded())
                    if tabs.indices.contains(landingIndex) {
                        dragOffset = CGFloat(landingIndex) * width
                        activeTab = tabs[landingIndex]
                    }
                }
        )
        .simultaneousGesture(
            TapGesture().onEnded {
                activeTab = tab
                dragOffset = CGFloat(tab.index) * width
            }
        )
        .optionalGeometryGroup()
    }

    // MARK: - Tab Bar Background
    @ViewBuilder
    private func TabBarBackground() -> some View {
        ZStack {
            Capsule(style: .continuous)
                .stroke(.gray.opacity(0.25), lineWidth: 1.5)

            Capsule(style: .continuous)
                .fill(.background.opacity(0.8))

            Capsule(style: .continuous)
                .fill(.ultraThinMaterial)
        }
        .compositingGroup()
    }

    // MARK: - Expandable Search (Explore)
    @ViewBuilder
    private func ExpandableSearchBar(height: CGFloat) -> some View {
        let searchLayout = isKeyboardActive
        ? AnyLayout(HStackLayout(spacing: 12))
        : AnyLayout(ZStackLayout(alignment: .trailing))

        searchLayout {
            HStack(spacing: 12) {
                Image(systemName: "magnifyingglass")
                    .font(isSearchExpanded ? .body : .title2)
                    .foregroundStyle(isSearchExpanded ? .gray : Color.primary)
                    .frame(width: isSearchExpanded ? nil : height, height: height)
                    .onTapGesture {
                        withAnimation(.bouncy) {
                            isSearchExpanded = true
                        }
                    }
                    .allowsHitTesting(!isSearchExpanded)

                if isSearchExpanded {
                    TextField("Search...", text: $searchText)
                        .focused($isKeyboardActive)
                }
            }
            .padding(.horizontal, isSearchExpanded ? 15 : 0)
            .background(TabBarBackground())
            .optionalGeometryGroup()
            .zIndex(1)

            Button {
                searchText = ""
                isKeyboardActive = false
                withAnimation(.bouncy) {
                    isSearchExpanded = false
                }
            } label: {
                Image(systemName: "xmark")
                    .font(.title2)
                    .foregroundStyle(Color.primary)
                    .frame(width: height, height: height)
                    .background(TabBarBackground())
            }
            .opacity(isKeyboardActive ? 1 : 0)
        }
    }

    private var accentColor: Color { K.Colors.primary }
}

// MARK: - Helpers (same as example)
extension View {
    @ViewBuilder
    func optionalGeometryGroup() -> some View {
        if #available(iOS 17, *) {
            self.geometryGroup()
        } else {
            self
        }
    }

    @ViewBuilder
    func customOnChange<T: Equatable>(value: T, result: @escaping (T) -> ()) -> some View {
        if #available(iOS 17, *) {
            self.onChange(of: value) { _, newValue in
                result(newValue)
            }
        } else {
            self.onChange(of: value) { newValue in
                result(newValue)
            }
        }
    }
}
