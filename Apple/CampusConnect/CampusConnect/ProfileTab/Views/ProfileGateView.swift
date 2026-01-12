//
//  ProfileGateView.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/12/26.
//



import SwiftUI
import Combine
import FirebaseAuth

struct ProfileGateView: View {
    @EnvironmentObject private var authVM: AuthViewModel
    @StateObject private var vm = ProfileGateViewModel()
    var body: some View {
        Group {
            if authVM.user == nil {
                SignInView()
            } else if vm.isLoading {
                ProgressView()
            } else if vm.requiresSetup {
                ProfileSetupView()
                    .environmentObject(authVM)
            } else {
                MainTabView()
                    .environmentObject(authVM)
            }
        }
        .task {
            await vm.refresh()
        }
        .onChange(of: authVM.user?.uid) { _ in
            Task { await vm.refresh() }
        }
    }
}


@MainActor
final class ProfileGateViewModel: ObservableObject {
    @Published var requiresSetup: Bool = false
    @Published var isLoading: Bool = false

    func refresh() async {
        isLoading = true
        defer { isLoading = false }

        guard let uid = Auth.auth().currentUser?.uid else {
            requiresSetup = false
            return
        }

        do {
            let profile = try await ProfileService.fetchProfile(uid: uid)

            let username = (profile?.username ?? "")
                .trimmingCharacters(in: .whitespacesAndNewlines)

            let campusId = (profile?.campusId ?? profile?.universityId ?? "")
                .trimmingCharacters(in: .whitespacesAndNewlines)

            requiresSetup = username.isEmpty || campusId.isEmpty
        } catch {
            requiresSetup = true
        }
    }
}
