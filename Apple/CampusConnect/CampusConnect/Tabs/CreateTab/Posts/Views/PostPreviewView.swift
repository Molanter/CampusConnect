//
//  PostPreviewView.swift
//  CampusConnect
//

import SwiftUI

struct PostPreviewView: View {
    let post: PostDoc
    let images: [UIImage]
    let mode: PostEditorMode
    let onConfirm: () -> Void

    @Environment(\.dismiss) private var dismiss

    private var actionTitle: String {
        switch mode {
        case .create: return "Create Post"
        case .edit:   return "Update Post"
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                PostCardView(post: post, localImages: images)
                    .padding(.vertical)
            }
            .navigationTitle("Preview")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Back") { dismiss() }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button(actionTitle) {
                        onConfirm()
                        dismiss()
                    }
                    .fontWeight(.semibold)
                }
            }
        }
    }
}