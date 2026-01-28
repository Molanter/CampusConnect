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
    @StateObject private var appState = AppState()

    @State private var pendingURL: URL? = nil

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
        .environmentObject(appState)
        .onAppear {
            authVM.startListening()
        }
        .onChange(of: authVM.isAuthReady) { _, _ in
        }
        .onChange(of: authVM.user?.uid) { _, _ in
            profileStore.bindToAuth(authVM: authVM)
        }
        .task {
            // initial bind (covers first launch where onChange may not fire yet)
            profileStore.bindToAuth(authVM: authVM)
        }
    }
}
