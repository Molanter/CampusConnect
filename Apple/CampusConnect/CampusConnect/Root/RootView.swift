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

    var body: some View {
        Group {
            if !authVM.isAuthReady {
                Image(systemName: "link")
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(height: 100)
            } else if authVM.user == nil {
                SignInView()
                    .environmentObject(authVM)
            } else {
                ProfileGateView()
                    .environmentObject(authVM)
            }
        }
        .onAppear { authVM.startListening() }
    }
}
