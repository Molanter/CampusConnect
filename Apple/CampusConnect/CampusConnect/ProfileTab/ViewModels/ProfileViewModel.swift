//
//  ProfileViewModel.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/12/26.
//


import Foundation
import Combine
import FirebaseAuth

@MainActor
final class ProfileViewModel: ObservableObject {
    @Published var profile: UserProfile?
    @Published var isLoading = false
    @Published var errorMessage: String?

    func load() async {
        errorMessage = nil
        isLoading = true
        defer { isLoading = false }

        guard let uid = Auth.auth().currentUser?.uid else {
            errorMessage = "Not signed in."
            return
        }

        do {
            profile = try await ProfileService.fetchProfile(uid: uid)
        } catch {
            errorMessage = "Failed to load profile."
        }
    }
}
