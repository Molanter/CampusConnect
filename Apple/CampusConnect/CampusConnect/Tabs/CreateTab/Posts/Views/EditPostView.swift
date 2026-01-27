//
//  EditPostView.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/15/26.
//

import SwiftUI
import PhotosUI

struct EditPostView: View {
    let postId: String
    let initial: PostDoc

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

    // Location picker
    @State private var showLocationSheet = false

    // Images
    @State private var pickedPhotoItems: [PhotosPickerItem] = []
    @State private var newPhotos: [UIImage] = []

    // Errors
    @State private var errorMessage: String?

    // ✅ local optimistic updated post for UI (preview + optional callbacks)
    @State private var localPost: PostDoc? = nil

    private var selectedIdentity: PostAsIdentity? {
        vm.identities.first(where: { $0.id == selectedIdentityId }) ?? vm.identities.first
    }

    private var wordCount: Int {
        descriptionText.split { $0.isWhitespace || $0.isNewline }.count
    }

    var body: some View {
        NavigationStack {
            Form {
                PostEditorFormContent(
                    modeTitle: "Edit",
                    vm: vm,
                    selectedIdentityId: $selectedIdentityId,
                    postType: $postType,
                    descriptionText: $descriptionText,
                    event: $event,
                    showLocationSheet: $showLocationSheet,
                    pickedPhotoItems: $pickedPhotoItems,
                    newPhotos: $newPhotos,
                    errorMessage: $errorMessage
                )
            }
            .navigationTitle("Edit")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { toolbarContent }
            .task {
                await loadIdentities()
                applyInitial()
                enforceTypeRules()
                // seed local post once
                localPost = buildLocalPost(from: initial)
            }
            .onChange(of: pickedPhotoItems) { _, _ in
                Task { await appendPickedPhotos() }
            }
            .onChange(of: selectedIdentityId) { _, _ in
                enforceTypeRules()
                localPost = buildLocalPost(from: initial)
            }
            .onChange(of: postType) { _, _ in
                localPost = buildLocalPost(from: initial)
            }
            .onChange(of: descriptionText) { _, _ in
                localPost = buildLocalPost(from: initial)
            }
            .onChange(of: event.startsAt) { _, _ in
                localPost = buildLocalPost(from: initial)
            }
            .onChange(of: event.locationLabel) { _, _ in
                localPost = buildLocalPost(from: initial)
            }
            .onChange(of: event.locationUrl) { _, _ in
                localPost = buildLocalPost(from: initial)
            }
            .onChange(of: event.lat) { _, _ in
                localPost = buildLocalPost(from: initial)
            }
            .onChange(of: event.lng) { _, _ in
                localPost = buildLocalPost(from: initial)
            }
            .sheet(isPresented: $showLocationSheet) {
                LocationSearchSheet(
                    title: "Event location",
                    initialQuery: event.locationLabel.trimmingCharacters(in: .whitespacesAndNewlines)
                ) { picked in
                    event.locationLabel = picked.label
                    event.lat = picked.lat
                    event.lng = picked.lng
                    event.locationUrl = picked.urlString ?? ""
                }
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
                    post: (localPost ?? buildLocalPost(from: initial)),
                    images: newPhotos,
                    isEditing: true,
                    onConfirm: { Task { await save() } }
                )
            } label: {
                Text("Preview")
                    .foregroundStyle(K.Colors.primary)
            }
            .disabled(vm.isSaving || wordCount > 300 || selectedIdentity == nil)
        }
    }

    // MARK: - Save

    private func save() async {
        guard let sel = selectedIdentity else { return }

        let campusId = sel.campusId.trimmingCharacters(in: .whitespacesAndNewlines)
        let clubId: String? = {
            guard sel.ownerType == .club else { return nil }
            let v = (sel.clubId ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            return v.isEmpty ? nil : v
        }()

        let p = profileStore.profile

        // ✅ author snapshot: always the real author (current user), fallback to initial
        let aUsername = (p?.username ?? initial.authorUsername ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let aName = (p?.displayName ?? initial.authorDisplayName ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let aPhoto = (p?.photoURL ?? initial.authorPhotoURL ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        // ✅ owner snapshot: comes ONLY from selected identity (never from author fallback)
        let ownerLabel = sel.label.trimmingCharacters(in: .whitespacesAndNewlines)
        let ownerPhoto = (sel.photoURL ?? "").trimmingCharacters(in: .whitespacesAndNewlines)

        // If label is somehow empty, fallback to the existing owner snapshot (not author).
        let finalOwnerName: String? = {
            if !ownerLabel.isEmpty { return ownerLabel }
            let v = (initial.ownerName ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            return v.isEmpty ? nil : v
        }()

        // If identity has no photo, store nil (so updatePost deletes ownerPhotoURL).
        let finalOwnerPhoto: String? = ownerPhoto.isEmpty ? nil : ownerPhoto

        // ✅ optimistic local update (so parent/UI can reflect immediately if you pass it back)
        localPost = buildLocalPost(from: initial)

        do {
            try await vm.updatePost(
                postId: postId,
                description: descriptionText,
                type: postType,
                ownerType: sel.ownerType,
                clubId: clubId,
                campusId: campusId,
                retainedExistingUrls: initial.imageUrls,
                newImages: newPhotos,
                event: postType == .event ? event : nil,

                ownerName: finalOwnerName,
                ownerPhotoURL: finalOwnerPhoto,
                authorUsername: aUsername.isEmpty ? nil : aUsername,
                authorDisplayName: aName.isEmpty ? nil : aName,
                authorPhotoURL: aPhoto.isEmpty ? nil : aPhoto
            )
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Helpers

    private func loadIdentities() async {
        let p = profileStore.profile
        await vm.loadPostAsIdentities(uid: p?.id ?? "", campusId: p?.campusId)

        if selectedIdentityId.isEmpty, let first = vm.identities.first {
            selectedIdentityId = first.id
        }
    }

    private func applyInitial() {
        // Only apply once (avoid overriding user's edits after identities load)
        if !descriptionText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return }

        descriptionText = initial.description
        postType = initial.type
        if let e = initial.event { event = e }

        let match: PostAsIdentity? = {
            switch initial.ownerType {
            case .personal:
                return vm.identities.first(where: { $0.ownerType == .personal })
            case .campus:
                let campusId = initial.campusId.trimmingCharacters(in: .whitespacesAndNewlines)
                return vm.identities.first(where: {
                    $0.ownerType == .campus &&
                    $0.campusId.trimmingCharacters(in: .whitespacesAndNewlines) == campusId
                })
            case .club:
                let initClub = (initial.clubId ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                return vm.identities.first(where: {
                    $0.ownerType == .club &&
                    ($0.clubId ?? "").trimmingCharacters(in: .whitespacesAndNewlines) == initClub
                })
            }
        }()

        if let match { selectedIdentityId = match.id }
    }

    private func enforceTypeRules() {
        if postType == .announcement {
            guard let sel = selectedIdentity else { postType = .post; return }
            let allowed: Bool = {
                switch sel.ownerType {
                case .campus:
                    return profileStore.isCampusAdmin
                case .club:
                    let clubId = (sel.clubId ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                    return !clubId.isEmpty && profileStore.announcementClubIds.contains(clubId)
                case .personal:
                    return false
                }
            }()
            if !allowed { postType = .post }
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

    // ✅ single source of truth for a locally-updated post model
    private func buildLocalPost(from base: PostDoc) -> PostDoc {
        let sel = selectedIdentity
        let p = profileStore.profile

        let campusId = (sel?.campusId ?? profileStore.profile?.campusId ?? base.campusId)
            .trimmingCharacters(in: .whitespacesAndNewlines)

        let clubId: String? = {
            guard let sel else { return base.clubId }
            guard sel.ownerType == .club else { return nil }
            let v = (sel.clubId ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            return v.isEmpty ? nil : v
        }()

        // author snapshot (always person)
        let aUsername = (p?.username ?? base.authorUsername ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let aName = (p?.displayName ?? base.authorDisplayName ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let aPhoto = (p?.photoURL ?? base.authorPhotoURL ?? "").trimmingCharacters(in: .whitespacesAndNewlines)

        // owner snapshot (always identity)
        let ownerLabel: String = {
            if let sel {
                let v = sel.label.trimmingCharacters(in: .whitespacesAndNewlines)
                if !v.isEmpty { return v }
            }
            return (base.ownerName ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        }()

        let ownerPhoto: String = {
            if let sel {
                return (sel.photoURL ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            }
            return (base.ownerPhotoURL ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        }()

        return PostDoc(
            id: base.id,

            ownerType: sel?.ownerType ?? base.ownerType,
            campusId: campusId,
            clubId: clubId,

            description: descriptionText,
            authorId: p?.id ?? base.authorId,
            type: postType,
            imageUrls: base.imageUrls,

            ownerName: ownerLabel.isEmpty ? nil : ownerLabel,
            ownerPhotoURL: ownerPhoto.isEmpty ? nil : ownerPhoto,

            authorUsername: aUsername.isEmpty ? nil : aUsername,
            authorDisplayName: aName.isEmpty ? nil : aName,
            authorPhotoURL: aPhoto.isEmpty ? nil : aPhoto,

            createdAt: base.createdAt,
            editedAt: base.editedAt,
            editCount: base.editCount,

            commentsCount: base.commentsCount,
            repliesCommentsCount: base.repliesCommentsCount,
            seenCount: base.seenCount,

            likedBy: base.likedBy,

            event: postType == .event ? event : nil
        )
    }
}
