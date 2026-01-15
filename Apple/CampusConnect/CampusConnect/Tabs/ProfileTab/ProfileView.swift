//
//  ProfileView.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/12/26.
//


import SwiftUI

struct ProfileView: View {
    @EnvironmentObject private var authVM: AuthViewModel
    @StateObject private var vm = ProfileViewModel()
    
    var body: some View {
        NavigationStack {
            Group {
                if vm.isLoading {
                    ProgressView()
                } else if let msg = vm.errorMessage {
                    VStack(spacing: 12) {
                        Text(msg).foregroundStyle(.red)
                        Button("Retry") { Task { await vm.load() } }
                    }
                } else if let p = vm.profile {
                    List {
                        header(p)

                        Section("Campus") {
                            row("Campus", p.campus ?? "—")
                            row("Campus ID", p.campusId ?? "—")
                        }

                        Section("Academic") {
                            row("Role", p.role.rawValue)
                            row("Year", p.yearOfStudy ?? "—")
                            row("Major", p.major ?? "—")
                            row("Dorm", p.dorm ?? "—")
                        }

                        Section {
                            Button("Sign out", role: .destructive) {
                                authVM.signOut()
                            }
                        }
                    }
                    .listStyle(.insetGrouped)
                } else {
                    Text("No profile data.")
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Profile")
            .task {
                await vm.load()
            }
            .refreshable {
                await vm.load()
            }
        }
    }

    private func header(_ p: UserProfile) -> some View {
        Section {
            HStack(spacing: 12) {
                AvatarView(
                    urlString: p.photoURL,
                    size: 50,
                    kind: .profile
                )
                VStack(alignment: .leading, spacing: 4) {
                    Text(p.displayName)
                        .font(.headline)

                    if !p.username.isEmpty {
                        Text("@\(p.username)")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
            }
        }
    }

    private func row(_ title: String, _ value: String) -> some View {
        HStack {
            Text(title)
            Spacer()
            Text(value).foregroundStyle(.secondary)
        }
    }
}
