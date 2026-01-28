//
//  PostTypeSegmentPicker.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/20/26.
//

import SwiftUI
import UIKit

struct PostTypeSegmentPicker: View {
    let title: String
    let allowedTypes: [PostType]
    @Binding var selection: PostType

    /// Optional footer shown only when `.announcement` is selected.
    /// Pass something like: "You can post Announcements because you’re a campus admin."
    let announcementFooterText: String?

    private var showIconsOnly: Bool { allowedTypes.count >= 3 }
    private var isAnnouncementSelected: Bool { selection == .announcement }

    var body: some View {
        Section {
            Picker("Type", selection: $selection) {
                ForEach(allowedTypes, id: \.self) { t in
                    if showIconsOnly {
                        Image(systemName: symbol(for: t))
                            .tag(t)
                            .accessibilityLabel(title(for: t))
                    } else {
                        if let ui = renderedSegmentImage(for: t) {
                            Image(uiImage: ui)
                                .tag(t)
                                .accessibilityLabel(title(for: t))
                        } else {
                            Label(title(for: t), systemImage: symbol(for: t))
                                .tag(t)
                        }
                    }
                }
            }
            .pickerStyle(.segmented)
            .frame(height: 45)
        } header: {
            HStack {
                Text(title)
                Spacer()
                if showIconsOnly {
                    Text("Icons")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
        } footer: {
            if isAnnouncementSelected, let announcementFooterText, !announcementFooterText.isEmpty {
                HStack(spacing: 8) {
                    Image(systemName: "questionmark")
                    Text(announcementFooterText)
                }
                .font(.footnote)
                .foregroundStyle(.secondary)
            }
        }
        .listRowInsets(EdgeInsets())
        .listRowBackground(Color.clear)
    }

    // MARK: - Render (ImageRenderer)

    private func renderedSegmentImage(for t: PostType) -> UIImage? {
        let renderer = ImageRenderer(content: segmentLabelView(for: t))
        renderer.scale = UIScreen.main.scale
        renderer.isOpaque = false
        return renderer.uiImage
    }

    private func segmentLabelView(for t: PostType) -> some View {
        HStack(spacing: 6) {
            Image(systemName: symbol(for: t))
            Text(title(for: t))
        }
        .font(.subheadline.weight(.semibold))
        .padding(.vertical, 6)
        .fixedSize()
        .foregroundStyle(.primary)
    }

    private func title(for t: PostType) -> String {
        switch t {
        case .post: return "Post"
        case .event: return "Event"
        case .announcement: return "Announcement"
        }
    }

    private func symbol(for t: PostType) -> String {
        switch t {
        case .post: return "text.below.photo"
        case .event: return "calendar"
        case .announcement: return "megaphone"
        }
    }
}
