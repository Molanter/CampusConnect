//
//  CreateClubView.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/27/26.
//


import SwiftUI

struct CreateClubView: View {
    @EnvironmentObject private var profileStore: ProfileStore
    @StateObject private var vm = CreateClubVM()

    // Adjust these paths after you answer the question:
    private var campusId: String {
        (profileStore.profile?.campusId ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var userId: String {
        (profileStore.profile?.id ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var body: some View {
        Group {
            if campusId.isEmpty || userId.isEmpty {
                EmptyStateView(
                    symbol: "person.crop.circle.badge.exclamationmark",
                    title: "Profile not ready",
                    description: "Sign in and make sure your profile has a campus id before creating a club."
                )
            } else {
                form
                    .toolbar {
                        ToolbarItem(placement: .bottomBar) {
                            Text("By creating a club, you agree to our [Community Guidelines](https://example.com).")
                                .tint(K.Colors.primary)
                                .fixedSize()
                        }
                    }
            }
        }
    }

    private var form: some View {
        Form {
            Section("Basics") {
                TextField("Club name", text: $vm.name)
                TextField("Category (optional)", text: $vm.category)
                Toggle("Private club", isOn: $vm.isPrivate).tint(K.Colors.primary)
            }

            Section("Description") {
                TextField("What is this club about?", text: $vm.description, axis: .vertical)
                    .lineLimit(3...8)
            }

            if let err = vm.errorMessage {
                Section {
                    Text(err).foregroundStyle(.red)
                }
            }

            if let createdId = vm.createdClubId {
                Section {
                    Label("Created club: \(createdId)", systemImage: "checkmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
            }

            ListCapsuleButton {
                Task { await vm.submit(campusId: campusId, createdBy: userId) }
            } label: {
                if vm.isSubmitting {
                    HStack { Spacer(); ProgressView(); Spacer() }
                } else {
                    Text("Create Club")
                        .frame(maxWidth: .infinity, alignment: .center)
                }
            }
            .disabled(vm.isSubmitting)
        }
    }
}
