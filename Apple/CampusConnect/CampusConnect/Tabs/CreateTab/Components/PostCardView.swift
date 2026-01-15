//
//  PostCardView.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/14/26.
//

import SwiftUI

struct PostCardView: View {
    let post: PostDoc

    private let media: Media

    enum Media: Equatable {
        case none
        case remote(urls: [String])
        case local(images: [UIImage])
    }

    @StateObject private var vm = PostCardVM()
    @Environment(\.colorScheme) private var colorScheme

    private let avatarSize: CGFloat = 34
    private let mediaHeight: CGFloat = 135
    private var leadingIndent: CGFloat { avatarSize + 10 }

    private var metaColor: Color { .secondary }
    private var dividerColor: Color { Color.secondary.opacity(colorScheme == .dark ? 0.25 : 0.35) }
    private var strokeColor: Color { Color.secondary.opacity(colorScheme == .dark ? 0.22 : 0.30) }
    private var mediaBg: Color { Color(.secondarySystemBackground) }

    init(post: PostDoc) {
        self.post = post
        self.media = post.imageUrls.isEmpty ? .none : .remote(urls: post.imageUrls)
    }

    init(post: PostDoc, localImages: [UIImage]) {
        self.post = post
        self.media = localImages.isEmpty ? .none : .local(images: localImages)
    }

    private var isEntityPost: Bool { post.ownerType == .club || post.ownerType == .campus }
    private var secondaryHandle: String? {
        isEntityPost ? vm.authorUsername : vm.authorUsername // for personal: author is the owner anyway
    }

    private var trimmedText: String { post.description.trimmingCharacters(in: .whitespacesAndNewlines) }

    private var hasMedia: Bool {
        switch media {
        case .none: return false
        case .remote(let urls): return !urls.isEmpty
        case .local(let imgs): return !imgs.isEmpty
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 10) {
                AvatarView(
                    urlString: vm.ownerPhotoURL,
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

                Spacer(minLength: 0)
            }

            if hasMedia { mediaStrip }

            actions
                .padding(.leading, leadingIndent)
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 14)
        .overlay(alignment: .bottom) {
            Rectangle().fill(dividerColor).frame(height: 0.5)
        }
        .task(id: post.id) {
            await vm.load(post: post)
        }
    }

    // MARK: Header

    private var headerLine: some View {
        HStack(spacing: 6) {
            HStack(spacing: 6) {
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

            if let handle = secondaryHandle, !handle.isEmpty {
                Text("@\(handle)")
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
                switch media {
                case .none:
                    EmptyView()
                case .remote(let urls):
                    ForEach(Array(urls.prefix(10).enumerated()), id: \.offset) { index, urlString in
                        mediaTileRemote(urlString, index: index)
                    }
                case .local(let images):
                    ForEach(Array(images.prefix(10).enumerated()), id: \.offset) { index, img in
                        mediaTileLocal(img, index: index)
                    }
                }
            }
        }
        .cornerRadius(K.Layout.cornerRadius / 2)
    }

    private func mediaTileRemote(_ urlString: String, index: Int) -> some View {
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
        .padding(.leading, index == 0 ? leadingIndent : 0)
    }

    private func mediaTileLocal(_ img: UIImage, index: Int) -> some View {
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
        .padding(.leading, index == 0 ? leadingIndent : 0)
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

    // MARK: Avatar kind (no PostIdentity)

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

        // EVENT → countdown to start
        if post.type == .event, let startsAt = post.event?.startsAt {
            let seconds = Int(startsAt.timeIntervalSince(now))

            if seconds <= 60 { return "rn" }
            if seconds < 3600 { return "\(seconds / 60)m" }
            if seconds < 86_400 { return "\(seconds / 3600)h" }
            if seconds < 604_800 { return "\(seconds / 86_400)d" }

            return formatDate(startsAt)
        }

        // NORMAL POST → time since created
        guard let createdAt = post.createdAt else { return "" }

        let seconds = Int(now.timeIntervalSince(createdAt))

        if seconds < 60 { return "rn" }
        if seconds < 3600 { return "\(seconds / 60)m" }
        if seconds < 86_400 { return "\(seconds / 3600)h" }
        if seconds < 604_800 { return "\(seconds / 86_400)d" }
        if seconds < 15_552_000 { return "\(seconds / 604_800)w" } // ~6 months

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
