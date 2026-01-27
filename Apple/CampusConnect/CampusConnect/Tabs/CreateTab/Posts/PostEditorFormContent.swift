//
//  PostEditorFormContent.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/15/26.
//


import SwiftUI
import PhotosUI

struct PostEditorFormContent: View {
    let modeTitle: String
    @ObservedObject var vm: PostEditorVM

    @EnvironmentObject private var profileStore: ProfileStore

    @Binding var selectedIdentityId: String
    @Binding var postType: PostType
    @Binding var descriptionText: String
    @Binding var event: PostEventLogistics

    @Binding var showLocationSheet: Bool

    @Binding var pickedPhotoItems: [PhotosPickerItem]
    @Binding var newPhotos: [UIImage]

    @Binding var errorMessage: String?

    private var selectedIdentity: PostAsIdentity? {
        vm.identities.first(where: { $0.id == selectedIdentityId }) ?? vm.identities.first
    }

    private var wordCount: Int {
        descriptionText.split { $0.isWhitespace || $0.isNewline }.count
    }

    private var canUseAnnouncement: Bool {
        guard let sel = selectedIdentity else { return false }

        switch sel.ownerType {
        case .campus:
            // campus announcements: campus admins only
            return profileStore.isCampusAdmin

        case .club:
            // club announcements: club admins/owners only (NOT allowMemberPosts)
            let clubId = (sel.clubId ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !clubId.isEmpty else { return false }

            // Make this list contain ONLY clubs where the user is admin/owner
            // (do not include clubs where they can post as a member).
            return profileStore.announcementClubIds.contains(clubId)

        case .personal:
            return false
        }
    }

    private var allowedTypes: [PostType] {
        var base = PostType.allCases.filter { $0 != .announcement }
        if canUseAnnouncement { base.append(.announcement) }
        return base
    }

    var body: some View {
        postAsSection
        descriptionSection
        photosSection
        typeSection
        eventSection
        errorSection
    }

    // MARK: - Post As

    private var postAsSection: some View {
        Section("Post as") {
            if vm.isLoadingIdentities && vm.identities.isEmpty {
                ProgressView()
            } else if vm.identities.isEmpty {
                Text("Unable to load identities")
                    .foregroundStyle(.secondary)
            } else {
                Menu {
                    ForEach(vm.identities) { id in
                        Button {
                            selectedIdentityId = id.id
                        } label: {
                            Label(id.label, systemImage: menuIconName(for: id))
                        }
                    }
                } label: {
                    HStack(spacing: 10) {
                        if let sel = selectedIdentity {
                            AvatarView(
                                urlString: sel.photoURL,
                                size: 28,
                                kind: avatarKind(for: sel)
                            )

                            HStack(spacing: 6) {
                                Text(sel.label)
                                if sel.isVerified {
                                    Image(systemName: "checkmark.seal.fill")
                                        .font(.footnote)
                                        .foregroundStyle(K.Colors.primary)
                                }
                            }
                        } else {
                            Text("Select identity")
                        }

                        Spacer()
                        Image(systemName: "chevron.up.chevron.down")
                            .foregroundStyle(.secondary)
                    }
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func menuIconName(for identity: PostAsIdentity) -> String {
        switch identity.ownerType {
        case .personal: return "person.crop.circle"
        case .club:     return identity.isDorm ? "house" : "person.2"
        case .campus:   return "building.2"
        }
    }

    private func avatarKind(for identity: PostAsIdentity) -> AvatarKind {
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

    // MARK: - Description

    private var descriptionSection: some View {
        Section {
            TextEditor(text: $descriptionText)
                .frame(minHeight: 140)
                .tint(K.Colors.primary)
        } header: {
            HStack {
                Text("Description")
                Spacer()
                Text("\(wordCount)/300")
                    .foregroundStyle(wordCount > 300 ? .red : .secondary)
            }
        }
    }

    // MARK: - Photos

    private var photosSection: some View {
        Section("Photos") {
            PhotosPicker(
                selection: $pickedPhotoItems,
                maxSelectionCount: 10,
                matching: .images
            ) {
                Label("Add Photos", systemImage: "plus")
                    .foregroundStyle(K.Colors.primary)
            }
            .tint(K.Colors.primary)

            if !newPhotos.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(Array(newPhotos.enumerated()), id: \.offset) { idx, img in
                            Image(uiImage: img)
                                .resizable()
                                .scaledToFill()
                                .frame(width: 92, height: 92)
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                                .overlay(alignment: .topTrailing) {
                                    Button {
                                        newPhotos.remove(at: idx)
                                    } label: {
                                        Image(systemName: "xmark.circle.fill")
                                            .foregroundStyle(.white)
                                            .padding(6)
                                    }
                                    .buttonStyle(.plain)
                                }
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
        }
    }

    // MARK: - Type

    
    private var announcementReasonText: String? {
        guard allowedTypes.contains(.announcement) else { return nil }
        guard let sel = selectedIdentity else { return nil }

        switch sel.ownerType {
        case .campus:
            return "You can post Announcements because you’re a campus admin."
        case .club:
            return "You can post Announcements because you’re a club admin."
        case .personal:
            return nil
        }
    }

    @ViewBuilder
    private var typeSection: some View {
        PostTypeSegmentPicker(
            title: "Type",
            allowedTypes: allowedTypes,
            selection: $postType,
            announcementFooterText: announcementReasonText
        )
    }
    
//    @ViewBuilder
//    private var typeSection: some View {
//        PostTypeSegmentPicker(
//            title: "Type",
//            allowedTypes: allowedTypes,
//            selection: $postType
//        )
//    }

    // MARK: - Event

    @ViewBuilder
    private var eventSection: some View {
        if postType == .event {
            Section("Event details") {
                DatePicker(
                    "Date & Time",
                    selection: $event.startsAt,
                    displayedComponents: [.date, .hourAndMinute]
                )

                TextField("Location label (optional)", text: $event.locationLabel)

                Button {
                    showLocationSheet = true
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            let label = event.locationUrl.trimmingCharacters(in: .whitespacesAndNewlines)
                            Text(label.isEmpty ? "Pick location" : label)
                                .foregroundStyle(label.isEmpty ? .secondary : .primary)
                                .lineLimit(1)
                        }

                        Spacer()
                        Image(systemName: "chevron.right")
                            .foregroundStyle(.secondary)
                    }
                }
                .buttonStyle(.plain)

                if let coords = formatCoordinates(lat: event.lat, lng: event.lng) {
                    Text(coords)
                        .foregroundStyle(.secondary)
                        .font(.footnote)
                }
            }
        }
    }

    private func formatCoordinates(lat: Double?, lng: Double?) -> String? {
        guard let lat, let lng else { return nil }
        return String(format: "%.5f, %.5f", lat, lng)
    }

    // MARK: - Errors

    @ViewBuilder
    private var errorSection: some View {
        if let errorMessage {
            Section {
                Text(errorMessage)
                    .foregroundStyle(.red)
            }
        }
    }
}
