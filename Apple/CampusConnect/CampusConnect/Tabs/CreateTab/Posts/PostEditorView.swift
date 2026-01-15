//
//  PostEditorMode.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/13/26.
//


import SwiftUI
import PhotosUI

enum PostEditorMode {
    case create
    case edit(postId: String)
}

struct PostEditorView: View {
    let mode: PostEditorMode

    // Provide identities user can post as (personal + clubs + campus if admin)
    let identities: [PostIdentity]

    // Required for analytics + gating
    let campusId: String

    // For edit mode: preload these from your post doc
    let initial: PostDoc?

    @Environment(\.dismiss) private var dismiss

    @State private var selectedIdentityId: String = ""
    @State private var postType: PostType = .post
    @State private var descriptionText: String = ""

    // Event
    @State private var event = PostEventLogistics()
    @State private var eventLocationUrlInput: String = ""

    @StateObject private var imagesVM = PostImagesVM()

    @State private var isSaving = false
    @State private var errorMessage: String?

    private var selectedIdentity: PostIdentity {
        identities.first(where: { $0.id == selectedIdentityId }) ?? identities.first!
    }

    private var wordCount: Int { PostService.wordCount(descriptionText) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {

                    // Post As
                    GlassCard {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Post as").font(.headline)
                            Picker("Post as", selection: $selectedIdentityId) {
                                ForEach(identities) { id in
                                    Text(id.label).tag(id.id)
                                }
                            }
                            .pickerStyle(.menu)
                        }
                    }

                    // Description + counter
                    GlassCard {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                Text("Description").font(.headline)
                                Spacer()
                                Text("\(wordCount)/300")
                                    .font(.caption)
                                    .foregroundStyle(wordCount > 300 ? .red : .secondary)
                            }

                            TextEditor(text: $descriptionText)
                                .frame(minHeight: 120)
                                .overlay(alignment: .topLeading) {
                                    if descriptionText.isEmpty {
                                        Text("Write something…")
                                            .foregroundStyle(.secondary)
                                            .padding(.top, 8)
                                            .padding(.leading, 5)
                                    }
                                }
                        }
                    }

                    // Images
                    GlassCard {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                Text("Images").font(.headline)
                                Spacer()

                                PhotosPicker(selection: $imagesVM.pickedItems,
                                             maxSelectionCount: 10,
                                             matching: .images) {
                                    Label("Add", systemImage: "plus")
                                }
                            }

                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 10) {
                                    ForEach(Array(imagesVM.existingUrls.enumerated()), id: \.offset) { idx, url in
                                        RemoteThumb(urlString: url)
                                            .frame(width: 92, height: 92)
                                            .overlay(alignment: .topTrailing) {
                                                removeButton { imagesVM.removeExisting(at: idx) }
                                            }
                                    }

                                    ForEach(Array(imagesVM.newImages.enumerated()), id: \.offset) { idx, img in
                                        Image(uiImage: img)
                                            .resizable()
                                            .scaledToFill()
                                            .frame(width: 92, height: 92)
                                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                            .overlay(alignment: .topTrailing) {
                                                removeButton { imagesVM.removeNew(at: idx) }
                                            }
                                    }
                                }
                                .padding(.vertical, 2)
                            }
                        }
                    }
                    .task(id: imagesVM.pickedItems) {
                        await imagesVM.loadPickedImages()
                    }

                    // Type selector
                    GlassCard {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Type").font(.headline)
                            Picker("", selection: $postType) {
                                ForEach(PostType.allCases) { t in
                                    Text(t.title).tag(t)
                                }
                            }
                            .pickerStyle(.segmented)
                        }
                    }

                    // Event logistics (only if event)
                    if postType == .event {
                        GlassCard {
                            VStack(alignment: .leading, spacing: 12) {
                                Text("Event details").font(.headline)

                                DatePicker("Date & Time", selection: $event.startsAt, displayedComponents: [.date, .hourAndMinute])

                                VStack(alignment: .leading, spacing: 6) {
                                    Text("Location link (optional)")
                                        .font(.subheadline)
                                        .foregroundStyle(.secondary)

                                    TextField("Paste Google/Apple Maps link", text: $eventLocationUrlInput)
                                        .textInputAutocapitalization(.never)
                                        .autocorrectionDisabled()
                                        .onChange(of: eventLocationUrlInput) { newValue in
                                            event.locationUrl = newValue
                                            if let parsed = MapParser.parse(urlString: newValue) {
                                                if !parsed.label.isEmpty { event.locationLabel = parsed.label }
                                                event.lat = parsed.lat
                                                event.lng = parsed.lng
                                            }
                                        }

                                    if let lat = event.lat, let lng = event.lng {
                                        Text("Parsed: \(lat), \(lng)")
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                }

                                TextField("Location label (optional)", text: $event.locationLabel)
                            }
                        }
                    }

                    if let errorMessage {
                        Text(errorMessage)
                            .foregroundStyle(.red)
                            .font(.footnote)
                            .multilineTextAlignment(.center)
                            .padding(.top, 6)
                    }

                    // Footer
                    HStack(spacing: 12) {
                        Button("Cancel") { dismiss() }
                            .buttonStyle(.bordered)

                        Button {
                            Task { await save() }
                        } label: {
                            HStack {
                                Spacer()
                                if isSaving { ProgressView() } else { Text(modeTitle).fontWeight(.semibold) }
                                Spacer()
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(isSaving || wordCount > 300)
                    }
                }
                .padding()
            }
            .navigationTitle(navTitle)
            .navigationBarTitleDisplayMode(.inline)
            .onAppear { loadInitialIfNeeded() }
        }
    }

    private var navTitle: String {
        switch mode {
        case .create: return "Create"
        case .edit: return "Edit"
        }
    }

    private var modeTitle: String {
        switch mode {
        case .create: return "Save"
        case .edit: return "Update"
        }
    }

    private func loadInitialIfNeeded() {
        // Initial identity default
        if selectedIdentityId.isEmpty {
            selectedIdentityId = identities.first?.id ?? ""
        }

        guard let initial else { return }
        descriptionText = initial.description
        postType = initial.type
        imagesVM.existingUrls = initial.imageUrls

        // if editing: try to keep same identity
        selectedIdentityId = initial.ownerId

        if initial.type == .event, let e = initial.event {
            event = e
            eventLocationUrlInput = e.locationUrl
        }
    }

    private func save() async {
        errorMessage = nil
        isSaving = true
        defer { isSaving = false }

        do {
            switch mode {
            case .create:
                _ = try await PostService.createPost(
                    description: descriptionText,
                    identity: selectedIdentity,
                    campusId: campusId,
                    type: postType,
                    existingImageUrls: imagesVM.existingUrls,
                    newImages: imagesVM.newImages,
                    event: postType == .event ? event : nil
                )
                dismiss()

            case .edit(let postId):
                try await PostService.updatePost(
                    postId: postId,
                    description: descriptionText,
                    type: postType,
                    identity: selectedIdentity,
                    campusId: campusId,
                    retainedExistingUrls: imagesVM.existingUrls,
                    newImages: imagesVM.newImages,
                    event: postType == .event ? event : nil
                )
                dismiss()
            }
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func removeButton(_ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: "xmark.circle.fill")
                .foregroundStyle(.white)
                .symbolRenderingMode(.hierarchical)
                .padding(6)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Small UI helpers

private struct GlassCard<Content: View>: View {
    let content: Content
    init(@ViewBuilder _ content: () -> Content) { self.content = content() }

    var body: some View {
        VStack { content }
            .padding(14)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(.white.opacity(0.12), lineWidth: 1)
            )
    }
}

private struct RemoteThumb: View {
    let urlString: String
    var body: some View {
        AsyncImage(url: URL(string: urlString)) { phase in
            switch phase {
            case .success(let image):
                image.resizable().scaledToFill()
            default:
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(.foreground.opacity(0.06))
                    .overlay(Image(systemName: "photo").foregroundStyle(.secondary))
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}