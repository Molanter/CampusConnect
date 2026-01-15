//
//  PostEditorView.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/13/26.
//

import SwiftUI
import PhotosUI

enum PostEditorMode: Equatable {
    case create
    case edit(postId: String)
}

struct PostEditorView: View {
    let mode: PostEditorMode
    let initial: PostDoc?

    @EnvironmentObject private var profileStore: ProfileStore
    @Environment(\.dismiss) private var dismiss

    @StateObject private var vm = PostEditorVM()

    // Identity
    @State private var selectedIdentityId: String = ""

    // Content
    @State private var postType: PostType = .post
    @State private var descriptionText: String = ""

    // Event
    @State private var event = PostEventLogistics()
    @State private var eventLocationUrlInput: String = ""

    // Images
    @State private var pickedPhotoItems: [PhotosPickerItem] = []
    @State private var newPhotos: [UIImage] = []

    // Errors
    @State private var errorMessage: String?

    // MARK: - Derived

    private var isCreateMode: Bool {
        if case .create = mode { return true }
        return false
    }

    private var navTitle: String {
        isCreateMode ? "Create" : "Edit"
    }

    private var selectedIdentity: PostAsIdentity? {
        vm.identities.first(where: { $0.id == selectedIdentityId })
        ?? vm.identities.first
    }

    private var wordCount: Int {
        descriptionText.split { $0.isWhitespace || $0.isNewline }.count
    }

    private var canUseAnnouncement: Bool {
        guard let sel = selectedIdentity else { return false }
        switch sel.ownerType {
        case .campus:
            return profileStore.isCampusAdmin
        case .club:
            return profileStore.announcementClubIds.contains(sel.ownerId)
        case .personal:
            return false
        }
    }

    private var allowedTypes: [PostType] {
        var base = PostType.allCases.filter { $0 != .announcement }
        if canUseAnnouncement { base.append(.announcement) }
        return base
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            Form {
                postAsSection
                descriptionSection
                photosSection
                typeSection
                eventSection
                errorSection
            }
            .navigationTitle(navTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { toolbarContent }
            .task {
                await loadIdentities()
                applyInitialIfNeeded()
                enforceTypeRules()
            }
            .onChange(of: pickedPhotoItems) { _ in
                Task { await appendPickedPhotos() }
            }
            .onChange(of: selectedIdentityId) { _ in
                enforceTypeRules()
            }
        }
    }

    // MARK: - Toolbar

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .cancellationAction) {
            Button("Cancel") { dismiss() }
                .disabled(vm.isSaving)
        }

        ToolbarItem(placement: .confirmationAction) {
            NavigationLink {
                PostPreviewView(
                    post: previewPost(),
                    images: newPhotos,
                    mode: mode,
                    onConfirm: { Task { await save() } }
                )
            } label: {
                Text("Preview")
            }
            .disabled(
                vm.isSaving ||
                wordCount > 300 ||
                selectedIdentity == nil
            )
        }
    }

    // MARK: - Post As Section

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

    private func appendPickedPhotos() async {
        var appended: [UIImage] = []

        for item in pickedPhotoItems {
            if let data = try? await item.loadTransferable(type: Data.self),
               let img = UIImage(data: data) {
                appended.append(img)
            }
        }

        newPhotos.append(contentsOf: appended)
        pickedPhotoItems = []
    }

    // MARK: - Type

    private var typeSection: some View {
        Section("Type") {
            Picker("Type", selection: $postType) {
                ForEach(allowedTypes, id: \.self) { t in
                    Text(title(for: t)).tag(t)
                }
            }
            .pickerStyle(.segmented)
        }
    }

    private func title(for t: PostType) -> String {
        switch t {
        case .post: return "Post"
        case .event: return "Event"
        case .announcement: return "Ann."
        }
    }

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
            }
        }
    }

    // MARK: - Errors

    @ViewBuilder
    private var errorSection: some View {
        if let errorMessage {
            Section {
                Text(errorMessage).foregroundStyle(.red)
            }
        }
    }

    // MARK: - Preview Builder

    private func previewPost() -> PostDoc {
        let sel = selectedIdentity

        return PostDoc(
            id: initial?.id ?? "preview",
            ownerType: sel?.ownerType ?? .personal,
            ownerId: sel?.ownerId ?? (profileStore.profile?.id ?? ""),
            description: descriptionText,
            authorId: profileStore.profile?.id ?? "",
            type: postType,
            imageUrls: [],
            createdAt: Date(),
            editedAt: nil,
            editCount: nil,
            commentsCount: nil,
            repliesCommentsCount: nil,
            seenCount: nil,
            likes: nil,
            seenBy: nil,
            event: postType == .event ? event : nil
        )
    }

    // MARK: - Save

    private func save() async {
        guard let sel = selectedIdentity else { return }

        let campusId = (profileStore.profile?.campusId ?? "").trimmed

        do {
            switch mode {
            case .create:
                _ = try await vm.createPost(
                    description: descriptionText,
                    ownerType: sel.ownerType,
                    ownerId: sel.ownerId,
                    campusId: campusId,
                    type: postType,
                    newImages: newPhotos,
                    event: postType == .event ? event : nil
                )
                dismiss()

            case .edit(let postId):
                try await vm.updatePost(
                    postId: postId,
                    description: descriptionText,
                    type: postType,
                    ownerType: sel.ownerType,
                    ownerId: sel.ownerId,
                    campusId: campusId,
                    retainedExistingUrls: initial?.imageUrls ?? [],
                    newImages: newPhotos,
                    event: postType == .event ? event : nil
                )
                dismiss()
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Helpers

    private func loadIdentities() async {
        let p = profileStore.profile
        await vm.loadPostAsIdentities(
            uid: p?.id ?? "",
            campusId: p?.campusId
        )

        if selectedIdentityId.isEmpty, let first = vm.identities.first {
            selectedIdentityId = first.id
        }
    }

    private func enforceTypeRules() {
        if postType == .announcement && !canUseAnnouncement {
            postType = .post
        }
    }

    private func applyInitialIfNeeded() {
        guard let initial else { return }
        guard descriptionText.trimmed.isEmpty else { return }

        descriptionText = initial.description
        postType = initial.type
        if let e = initial.event { event = e }

        if let match = vm.identities.first(
            where: { $0.ownerType == initial.ownerType && $0.ownerId == initial.ownerId }
        ) {
            selectedIdentityId = match.id
        }
    }
}

private extension String {
    var trimmed: String {
        trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
