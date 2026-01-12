//
//  SignInInfoSheet.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/11/26.
//

import SwiftUI

// MARK: - Info Sheet for signIn View
struct SignInInfoSheet: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("**Campus Connect uses sign-in to:**")

                        bullet("Keep your posts and profile tied to you")
                        bullet("Protect your campus feed from spam")
                        bullet("Let you save preferences and notifications")
                    }
                } header: {
                    Text("Why you need to sign in?")
                }

                Section {
                    Text("If you’ve never used Campus Connect before, just tap **Google** or **Apple** — your account will be created automatically.")
                } header: {
                    Text("New here?")
                }

            }
            .navigationTitle("About Sign In")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func bullet(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text("•").font(.headline)
            Text(text)
        }
    }
}


#Preview {
    SignInInfoSheet()
}
