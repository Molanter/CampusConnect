//
//  RootView.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/11/26.
//

//  Shows Auth UI or the main Tab UI depending on auth state.

import SwiftUI
import FirebaseAuth

struct RootView: View {
    @StateObject private var authVM = AuthViewModel()
    @StateObject private var profileStore = ProfileStore()

    var body: some View {
        Group {
            if !authVM.isAuthReady {
                Image(systemName: "link")
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(height: 100)
            } else if authVM.user == nil {
                SignInView()
            } else {
                ProfileGateView()
            }
        }
        .environmentObject(authVM)
        .environmentObject(profileStore)
        .onAppear { authVM.startListening() }
        .onChange(of: authVM.user?.uid) { _ in
            profileStore.bindToAuth(authVM: authVM)
        }
        .task {
            // initial bind (covers first launch where onChange may not fire yet)
            profileStore.bindToAuth(authVM: authVM)
        }
    }
}
