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
    @EnvironmentObject private var profileStore: ProfileStore

    var body: some View {
        Group {
            if authVM.user == nil {
                SignInView()
            } else if !profileStore.isReady {
                Image(systemName: "link")
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(height: 100)
            } else if requiresSetup {
                ProfileSetupView()
            } else {
                MainTabView()
            }
        }
    }

    private var requiresSetup: Bool {
        let username = profileStore.profile?.username
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

        let campusId = (profileStore.profile?.campusId ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        return username.isEmpty || campusId.isEmpty
    }
}
