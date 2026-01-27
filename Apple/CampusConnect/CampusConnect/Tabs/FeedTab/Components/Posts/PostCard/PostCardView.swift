//
//  PostCardView.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/14/26.
//

import SwiftUI
import MapKit

struct PostCardView: View {
    let post: PostDoc

    private let media: Media

    enum Media: Equatable {
        case none
        case remote(urls: [String])
        case local(images: [UIImage])
    }

    @StateObject private var vm = PostCardVM()

    @EnvironmentObject private var profileStore: ProfileStore
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.openURL) private var openURL

    private let avatarSize: CGFloat = 34
    private let mediaHeight: CGFloat = 135
    private var leadingIndent: CGFloat { avatarSize + 10 }

    private var metaColor: Color { .secondary }
    private var dividerColor: Color { Color.secondary.opacity(colorScheme == .dark ? 0.25 : 0.35) }
    private var strokeColor: Color { Color.secondary.opacity(colorScheme == .dark ? 0.22 : 0.30) }
    private var mediaBg: Color { Color(.secondarySystemBackground) }

    // “regular list row color”
    private var announcementCardBg: Color { Color(.secondarySystemGroupedBackground) }
    private var isAnnouncement: Bool { post.type == .announcement }

    private let actionIconSize: CGFloat = 18

    init(post: PostDoc) {
        self.post = post
        self.media = post.imageUrls.isEmpty ? .none : .remote(urls: post.imageUrls)
    }

    init(post: PostDoc, localImages: [UIImage]) {
        self.post = post
        self.media = localImages.isEmpty ? .none : .local(images: localImages)
    }

    private var isEntityPost: Bool { post.ownerType == .club || post.ownerType == .campus }

    private var isMine: Bool {
        guard let uid = profileStore.profile?.id, !uid.isEmpty else { return false }
        return post.authorId == uid
    }

    // For club/campus posts → show "by @username"
    // For personal posts → show @username if present
    private var secondaryLabel: String? {
        if let u = vm.authorUsername, !u.isEmpty { return "@\(u)" }
        return nil
    }

    private var trimmedText: String { post.description.trimmingCharacters(in: .whitespacesAndNewlines) }

    private var shouldShowMapTile: Bool {
        guard post.type == .event else { return false }
        return normalizedCoordinate(lat: post.event?.lat, lng: post.event?.lng) != nil
    }

    private var hasMedia: Bool {
        if shouldShowMapTile { return true }
        switch media {
        case .none: return false
        case .remote(let urls): return !urls.isEmpty
        case .local(let imgs): return !imgs.isEmpty
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 10) {

                // ✅ OWNER avatar (club/campus/personal identity), not author
                AvatarView(
                    urlString: vm.ownerPhotoURL,
                    size: avatarSize,
                    kind: avatarKind
                )

                VStack(alignment: .leading, spacing: 4) {
                    if trimmedText.isEmpty {
                        Spacer(minLength: 0)
                        headerLine
                        Spacer(minLength: 0)
                    } else {
                        headerLine

                        if isAnnouncement {
                            PostBodyMarkdown(
                                text: trimmedText,
                                isAnnouncement: true,
                                markerColor: K.Colors.primary,
                                overrideTextColor: nil
                            )
                            .fixedSize(horizontal: false, vertical: true)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        } else {
                            Text(trimmedText)
                                .font(.subheadline)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
                .frame(minHeight: avatarSize)

                Spacer(minLength: 0)
            }

            if hasMedia { mediaStrip }

            actions
                .padding(.leading, leadingIndent)
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 14)

        // Announcement “card”
        .background {
            if isAnnouncement {
                RoundedRectangle(cornerRadius: K.Layout.cornerRadius, style: .continuous)
                    .fill(announcementCardBg)
            }
        }
        .overlay {
            if isAnnouncement {
                RoundedRectangle(cornerRadius: K.Layout.cornerRadius, style: .continuous)
                    .stroke(strokeColor, lineWidth: 1)
            }
        }
        .overlay(alignment: .bottom) {
            if !isAnnouncement {
                Rectangle().fill(dividerColor).frame(height: 0.5)
            }
        }
        .padding(.vertical, isAnnouncement ? 6 : 0)

        .task(id: post.id) {
            let uid = profileStore.profile?.id ?? ""
            await vm.load(post: post, currentUidForLikeState: uid)
        }
    }

    // MARK: Header

    private var headerLine: some View {
        HStack(spacing: 6) {
            HStack(spacing: 6) {

                // ✅ OWNER name, not author display name
                Text(vm.ownerName)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                    .truncationMode(.tail)

                if isEntityPost, vm.ownerVerified {
                    Image(systemName: "checkmark.seal.fill")
                        .font(.footnote)
                        .foregroundStyle(K.Colors.primary)
                        .accessibilityLabel("Verified")
                }
            }
            .layoutPriority(2)

            Text("•").foregroundStyle(metaColor)

            if isEntityPost { Text("by").foregroundStyle(metaColor) }

            if let label = secondaryLabel, !label.isEmpty {
                Text(label)
                    .foregroundStyle(metaColor)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .frame(minWidth: 0, alignment: .leading)
                    .layoutPriority(0)
            }

            Text("•").foregroundStyle(metaColor)

            Text(feedTimeText())
                .foregroundStyle(metaColor)
                .lineLimit(1)
                .layoutPriority(1)
        }
        .font(.footnote)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: Media

    private var mediaStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                if shouldShowMapTile {
                    mapTile()
                        .padding(.leading, leadingIndent)
                }

                switch media {
                case .none:
                    EmptyView()

                case .remote(let urls):
                    ForEach(Array(urls.prefix(10).enumerated()), id: \.offset) { index, urlString in
                        mediaTileRemote(
                            urlString,
                            leadingPad: (!shouldShowMapTile && index == 0) ? leadingIndent : 0
                        )
                    }

                case .local(let images):
                    ForEach(Array(images.prefix(10).enumerated()), id: \.offset) { index, img in
                        mediaTileLocal(
                            img,
                            leadingPad: (!shouldShowMapTile && index == 0) ? leadingIndent : 0
                        )
                    }
                }
            }
        }
        .cornerRadius(K.Layout.cornerRadius / 2)
    }

    private func mapTile() -> some View {
        let label = (post.event?.locationLabel ?? "").isEmpty ? "Event location" : (post.event?.locationLabel ?? "")
        return MapTileMenu(
            coord: normalizedCoordinate(lat: post.event?.lat, lng: post.event?.lng),
            label: label,
            size: mediaHeight,
            strokeColor: strokeColor,
            background: mediaBg,
            accent: K.Colors.primary,
            metaColor: metaColor
        )
    }

    private func normalizedCoordinate(lat: Double?, lng: Double?) -> CLLocationCoordinate2D? {
        guard let lat, let lng else { return nil }

        if abs(lat) <= 90, abs(lng) <= 180 {
            let c = CLLocationCoordinate2D(latitude: lat, longitude: lng)
            return CLLocationCoordinate2DIsValid(c) ? c : nil
        }

        if abs(lng) <= 90, abs(lat) <= 180 {
            let c = CLLocationCoordinate2D(latitude: lng, longitude: lat)
            return CLLocationCoordinate2DIsValid(c) ? c : nil
        }

        return nil
    }

    private func openAppleMaps(to coord: CLLocationCoordinate2D, name: String?) {
        let placemark = MKPlacemark(coordinate: coord)
        let item = MKMapItem(placemark: placemark)
        item.name = (name ?? "").isEmpty ? "Event Location" : name
        item.openInMaps(launchOptions: [
            MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDriving
        ])
    }

    private func mediaTileRemote(_ urlString: String, leadingPad: CGFloat) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: 14, style: .continuous).fill(mediaBg)

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
        .padding(.leading, leadingPad)
    }

    private func mediaTileLocal(_ img: UIImage, leadingPad: CGFloat) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: 14, style: .continuous).fill(mediaBg)

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
        .padding(.leading, leadingPad)
    }

    // MARK: Actions

    private var actions: some View {
        PostCardActions(
            post: post,
            isMine: isMine,
            likeCount: vm.likeCount,
            isLikedByMe: vm.isLikedByMe,
            metaColor: metaColor,
            iconSize: actionIconSize,
            onToggleLike: { uid in
                Task { await vm.toggleLike(postId: post.id, currentUid: uid) }
            }
        )
    }

    // MARK: Avatar kind

    private var avatarKind: AvatarKind {
        switch post.ownerType {
        case .personal:
            return .profile
        case .club:
            return .club(name: vm.ownerName, isDorm: vm.ownerIsDorm)
        case .campus:
            return .campus(shortName: initials(vm.ownerName))
        }
    }

    private func initials(_ text: String) -> String {
        let parts = text.split { $0 == " " || $0 == "-" || $0 == "_" }
        let first = parts.first?.prefix(1) ?? ""
        let second = parts.dropFirst().first?.prefix(1) ?? ""
        return (first + second).uppercased()
    }

    private func feedTimeText() -> String {
        let now = Date()

        if post.type == .event, let startsAt = post.event?.startsAt {
            let seconds = Int(startsAt.timeIntervalSince(now))

            if seconds <= 60 { return "rn" }
            if seconds < 3600 { return "\(seconds / 60)m" }
            if seconds < 86_400 { return "\(seconds / 3600)h" }
            if seconds < 604_800 { return "\(seconds / 86_400)d" }

            return formatDate(startsAt)
        }

        guard let createdAt = post.createdAt else { return "" }

        let seconds = Int(now.timeIntervalSince(createdAt))

        if seconds < 60 { return "rn" }
        if seconds < 3600 { return "\(seconds / 60)m" }
        if seconds < 86_400 { return "\(seconds / 3600)h" }
        if seconds < 604_800 { return "\(seconds / 86_400)d" }
        if seconds < 15_552_000 { return "\(seconds / 604_800)w" }

        return formatDate(createdAt)
    }

    private func formatDate(_ date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = .current
        f.dateFormat = "MM/dd/yyyy"
        return f.string(from: date)
    }
}
