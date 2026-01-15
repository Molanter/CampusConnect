//
//  PostCardView.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/14/26.
//

import SwiftUI

enum PostMediaSource: Equatable {
    case none
    case remote(urls: [String])          // existing post (edit/feed)
    case local(images: [UIImage])        // new picks (create)
    case mixed(remote: [String], local: [UIImage]) // edit: existing + new
}

struct PostCardView: View {
    let identity: PostIdentity?
    let username: String?
    let authorUsername: String?
    let timeText: String
    let text: String
    let media: PostMediaSource

    @Environment(\.colorScheme) private var colorScheme

    private let avatarSize: CGFloat = 34
    private let mediaHeight: CGFloat = 135
    private var leadingIndent: CGFloat { avatarSize + 10 }

    private var metaColor: Color { .secondary }
    private var dividerColor: Color {
        Color.secondary.opacity(colorScheme == .dark ? 0.25 : 0.35)
    }
    private var strokeColor: Color {
        Color.secondary.opacity(colorScheme == .dark ? 0.22 : 0.30)
    }
    private var mediaBg: Color { Color(.secondarySystemBackground) }

    private var trimmedText: String {
        text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var displayHandle: String? {
        switch identity?.ownerType {
        case .club, .campus: return authorUsername
        default: return username
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {

            // MARK: Header + Text (grouped)
            HStack(alignment: .top, spacing: 10) {
                AvatarView(
                    urlString: identity?.photoURL,
                    size: avatarSize,
                    kind: avatarKind
                )

                VStack(alignment: .leading, spacing: 4) {
                    headerLine

                    if !trimmedText.isEmpty {
                        Text(trimmedText)
                            .font(.subheadline)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }

                Spacer()
            }

            // MARK: Media (indented)
            if hasMedia {
                mediaStrip
                    .padding(.leading, leadingIndent)
            }

            // MARK: Actions (indented)
            actions
                .padding(.leading, leadingIndent)
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 14)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(dividerColor)
                .frame(height: 0.5)
        }
    }

    // MARK: Header line

    private var headerLine: some View {
        HStack(spacing: 6) {
            Text(identity?.label ?? "Unknown")
                .font(.subheadline.weight(.semibold))

            Text("•").foregroundStyle(metaColor)

            if identity?.ownerType == .club || identity?.ownerType == .campus {
                Text("by").foregroundStyle(metaColor)
            }

            if let handle = displayHandle {
                Text("@\(handle)").foregroundStyle(metaColor)
            }

            Text("•").foregroundStyle(metaColor)
            Text(timeText).foregroundStyle(metaColor)
        }
        .font(.footnote)
    }

    // MARK: Media
    private var hasMedia: Bool {
        switch media {
        case .none: return false
        case .remote(let urls): return !urls.isEmpty
        case .local(let images): return !images.isEmpty
        case .mixed(let remote, let local): return !remote.isEmpty || !local.isEmpty
        }
    }

    private var mediaStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                switch media {
                case .none:
                    EmptyView()

                case .local(let images):
                    ForEach(Array(images.prefix(10).enumerated()), id: \.offset) { index, img in
                        mediaTileLocal(img, index: index)
                    }

                case .remote(let urls):
                    ForEach(Array(urls.prefix(10).enumerated()), id: \.offset) { index, urlString in
                        mediaTileRemote(urlString, index: index)
                    }

                case .mixed(let remote, let local):
                    // remote first, then local (or swap order if you want)
                    ForEach(Array(remote.prefix(10).enumerated()), id: \.offset) { index, urlString in
                        mediaTileRemote(urlString, index: index)
                    }
                    let offset = min(remote.count, 10)
                    if offset < 10 {
                        ForEach(Array(local.prefix(10 - offset).enumerated()), id: \.offset) { i, img in
                            mediaTileLocal(img, index: offset + i)
                        }
                    }
                }
            }
            .padding(.vertical, 2)
        }
        .padding(.leading, 0)
    }
    
    private func mediaTileRemote(_ urlString: String, index: Int) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(mediaBg)

            if let url = URL(string: urlString.trimmingCharacters(in: .whitespacesAndNewlines)) {
                AsyncImage(url: url) { phase in
                    if case .success(let image) = phase {
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(height: mediaHeight)
                    } else {
                        Image(systemName: "photo")
                            .font(.system(size: 28))
                            .foregroundStyle(metaColor)
                    }
                }
            } else {
                Image(systemName: "photo")
                    .font(.system(size: 28))
                    .foregroundStyle(metaColor)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(strokeColor, lineWidth: 1)
        )
        .padding(.leading, index == 0 ? leadingIndent : 0)
    }
    
    private func mediaTileLocal(_ img: UIImage, index: Int) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(mediaBg)

            Image(uiImage: img)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(height: mediaHeight)
        }
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(strokeColor, lineWidth: 1)
        )
        .padding(.leading, index == 0 ? leadingIndent : 0) // first tile lines up with text column
    }

    // MARK: Actions

    private var actions: some View {
        HStack(spacing: 18) {
            Image(systemName: "heart")
            Image(systemName: "bubble.left")
            Spacer()
        }
        .font(.system(size: 18))
        .foregroundStyle(metaColor)
        .padding(.top, 2)
    }

    // MARK: Avatar kind

    private var avatarKind: AvatarKind {
        guard let identity else { return .profile }
        switch identity.ownerType {
        case .personal:
            return .profile
        case .club:
            return .club(name: identity.label, isDorm: identity.isDorm)
        case .campus:
            return .campus(shortName: initials(identity.label))
        }
    }

    private func initials(_ text: String) -> String {
        let parts = text.split { $0 == " " || $0 == "-" || $0 == "_" }
        let first = parts.first?.prefix(1) ?? ""
        let second = parts.dropFirst().first?.prefix(1) ?? ""
        return (first + second).uppercased()
    }
}


#Preview("PostCardView – Text + Media") {
    ScrollView {
            PostCardView(
                identity: mockCampusIdentity,
                username: nil,
                authorUsername: "molanter",
                timeText: "1h",
                text: "Campus-wide update. This post includes text and media and uses the same layout as the feed.",
                media: .remote(urls: mockRemoteImageURLs)
            )
        PostCardView(
            identity: mockClubIdentity,
            username: nil,
            authorUsername: "molanter",
            timeText: "5m",
            text: "", // ✅ media only
            media: .remote(urls: mockRemoteImageURLs)
        )
        PostCardView(
            identity: mockPersonalIdentity,
            username: "molanter",
            authorUsername: nil,
            timeText: "now",
            text: "Text-only post. No media attached. This should collapse the media section completely and keep spacing tight between header and text.",
            media: .none
        )

    }
    .background(Color(.systemBackground))
}

private let mockCampusIdentity = PostIdentity(
    id: "campus_bethel",
    label: "Bethel University",
    ownerType: .campus,
    photoURL: nil,
    isDorm: false
)

private let mockClubIdentity = PostIdentity(
    id: "club_commuter",
    label: "Commuter Students",
    ownerType: .club,
    photoURL: nil,
    isDorm: false
)

private let mockPersonalIdentity = PostIdentity(
    id: "user_me",
    label: "Edgars Yarmolatiy",
    ownerType: .personal,
    photoURL: nil,
    isDorm: false
)

private let mockRemoteImageURLs: [String] = [
    "https://images.unsplash.com/photo-1522199710521-72d69614c702",
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee"
]
