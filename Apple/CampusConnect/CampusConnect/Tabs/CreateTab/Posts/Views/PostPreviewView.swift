//
//  PostPreviewView.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/15/26.
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
            Form {
                Section("Preview") {
                    PostCardView(post: post, localImages: images)
                        .listRowInsets(.init(top: 0, leading: 0, bottom: 0, trailing: 0))
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                }

                Section {
                    ListCapsuleButton(action: {
                        onConfirm()
                        dismiss()
                    }) {
                        Text(actionTitle)
                            .font(.headline)
                    }
                }
                .listSectionSeparator(.hidden)
            }
            .navigationTitle("Preview")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
