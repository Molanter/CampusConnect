//
//  CreatePostView.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/13/26.
//

import SwiftUI
import PhotosUI

struct CreatePostView: View {
    @EnvironmentObject private var profileStore: ProfileStore
    @EnvironmentObject private var appState: AppState
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
                    modeTitle: "Create",
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
            .navigationTitle("Create")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { toolbarContent }
            .task {
                await loadIdentities()
                enforceTypeRules()
            }
            .onChange(of: pickedPhotoItems) { _ in
                Task { await appendPickedPhotos() }
            }
            .onChange(of: selectedIdentityId) { _ in
                enforceTypeRules()
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
            Button("Cancel") {
                appState.appTab = .feed
                dismiss()
            }
                .disabled(vm.isSaving)
        }

        ToolbarItem(placement: .confirmationAction) {
            NavigationLink {
                PostPreviewView(
                    post: previewPost(initial: nil),
                    images: newPhotos,
                    isEditing: false,
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

        // author snapshot (personal)
        let aUsername = (p?.username ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let aName = (p?.displayName ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let aPhoto = (p?.photoURL ?? "").trimmingCharacters(in: .whitespacesAndNewlines)

        // owner snapshot (selected identity)
        let ownerLabel = (sel.label).trimmingCharacters(in: .whitespacesAndNewlines)
        let ownerPhoto = (sel.photoURL ?? "").trimmingCharacters(in: .whitespacesAndNewlines)

        do {
            _ = try await vm.createPost(
                description: descriptionText,
                ownerType: sel.ownerType,
                clubId: clubId,
                campusId: campusId,
                type: postType,
                newImages: newPhotos,
                event: postType == .event ? event : nil,

                // ✅ NEW: denormalized snapshot fields to store on the post doc
                ownerName: ownerLabel.isEmpty ? nil : ownerLabel,
                ownerPhotoURL: ownerPhoto.isEmpty ? nil : ownerPhoto,
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

    private func enforceTypeRules() {
        // If user cannot post announcements, force back to .post
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

    private func previewPost(initial: PostDoc?) -> PostDoc {
        let sel = selectedIdentity

        let campusId = (sel?.campusId ?? profileStore.profile?.campusId ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        let clubId: String? = {
            guard let sel, sel.ownerType == .club else { return nil }
            let v = (sel.clubId ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            return v.isEmpty ? nil : v
        }()

        let p = profileStore.profile

        // ✅ author snapshot (always from profile store for preview)
        let aUsername = (p?.username ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let aName = (p?.displayName ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let aPhoto = (p?.photoURL ?? "").trimmingCharacters(in: .whitespacesAndNewlines)

        // ✅ owner snapshot (from selected identity for preview)
        let ownerLabel = (sel?.label ?? aName).trimmingCharacters(in: .whitespacesAndNewlines)
        let ownerPhoto = (sel?.photoURL ?? aPhoto).trimmingCharacters(in: .whitespacesAndNewlines)

        return PostDoc(
            id: initial?.id ?? "preview",

            ownerType: sel?.ownerType ?? .personal,
            campusId: campusId,
            clubId: clubId,

            description: descriptionText,
            authorId: p?.id ?? "",
            type: postType,
            imageUrls: [],

            // ✅ denormalized fields used by PostCardVM (preview path)
            ownerName: ownerLabel.isEmpty ? nil : ownerLabel,
            ownerPhotoURL: ownerPhoto.isEmpty ? nil : ownerPhoto,

            authorUsername: aUsername.isEmpty ? nil : aUsername,
            authorDisplayName: aName.isEmpty ? nil : aName,
            authorPhotoURL: aPhoto.isEmpty ? nil : aPhoto,

            createdAt: Date(),
            editedAt: nil,
            editCount: nil,

            commentsCount: nil,
            repliesCommentsCount: nil,
            seenCount: nil,

            likedBy: nil,

            event: postType == .event ? event : nil
        )
    }
}
