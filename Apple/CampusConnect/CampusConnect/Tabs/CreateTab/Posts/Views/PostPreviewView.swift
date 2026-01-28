//
//  PostPreviewView.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/15/26.
//

import SwiftUI

struct PostPreviewView: View {
    @EnvironmentObject private var appState: AppState

    let post: PostDoc
    let images: [UIImage]
    let isEditing: Bool
    let onConfirm: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var isSubmitting = false

    private var actionTitle: String {
        isEditing ? "Update Post" : "Create Post"
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Preview") {
                    PostCardView(post: post, localImages: images)
                        .listRowInsets(.init(top: 0, leading: 0, bottom: 0, trailing: 0))
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                }

                Section {
                    ListCapsuleButton(action: {
                        guard !isSubmitting else { return }
                        isSubmitting = true
                        onConfirm()
                        appState.appTab = .feed
                        dismiss()
                    }) {
                        HStack(spacing: 10) {
                            if isSubmitting {
                                ProgressView()
                                    .controlSize(.small)
                            }
                            Text(isSubmitting ? "Saving..." : actionTitle)
                                .font(.headline)
                        }
                    }
                    .disabled(isSubmitting)
                }
                .listSectionSeparator(.hidden)
            }
            .navigationTitle("Preview")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
