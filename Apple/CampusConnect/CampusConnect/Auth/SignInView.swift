//
//  SignInView.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/11/26.
//

import SwiftUI
import AuthenticationServices

struct SignInView: View {
    @EnvironmentObject private var authVM: AuthViewModel

    @State private var showEmailSheet = false
    @State private var showInfoSheet = false
    @State private var showAppleWarning = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 18) {
                Spacer()

                // Header (leading)
                VStack(alignment: .leading, spacing: 10) {
                    Text("Welcome to Campus Connect")
                        .font(.title.bold())

                    Text("Sign in to continue")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                VStack(spacing: 12) {
                    // Google
                    Button {
                        Task { await authVM.signInWithGoogle() }
                    } label: {
                        authButtonLabel(
                            icon: Image("google.g.logo"),
                            title: "Continue with Google"
                        )
                    }
                    .buttonStyle(.plain)
                    .background(.white, in: Capsule())
                    .glassButtonBackground()
                    .foregroundStyle(.black)

                    // Apple
                    Button {
                        showAppleWarning = true
                    } label: {
                        authButtonLabel(
                            icon: Image(systemName: "apple.logo"),
                            title: "Continue with Apple"
                        )
                    }
                    .buttonStyle(.plain)
                    .background(.black, in: Capsule())
                    .glassButtonBackground()
                    .foregroundStyle(.white)
                    .alert("Recommended sign-in", isPresented: $showAppleWarning) {
                        Button("Cancel", role: .cancel) {}

                        Button("Continue with Apple") {
                            Task { @MainActor in
                                AppleSignInCoordinator.shared.beginSignIn(authVM: authVM)
                            }
                        }
                    } message: {
                        Text("We recommend signing in with Google for the best experience across devices. You can still continue with Apple if you prefer.")
                    }
                }
                .padding(.top, 6)

                if authVM.isLoading {
                    ProgressView().padding(.top, 10)
                }

                if let msg = authVM.errorMessage {
                    Text(msg)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                        .padding(.top, 6)
                }

                Spacer()

                // Email link at bottom
                Button { showEmailSheet = true } label: {
                    Text("Continue with Email")
                        .font(.subheadline.weight(.semibold))
                        .underline()
                }
                .buttonStyle(.plain)
                .foregroundStyle(.secondary)
                .padding(.bottom, 10)
            }
            .padding(.horizontal, K.Layout.padding)
            .padding(.vertical, 16)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showInfoSheet = true } label: {
                        Image(systemName: "info.circle")
                    }
                    .accessibilityLabel("Why sign in?")
                }
            }
            .background(Color(.secondarySystemBackground))
            .sheet(isPresented: $showEmailSheet) {
                EmailPasswordSignInSheet()
                    .presentationDetents([.medium, .large])
                    .environmentObject(authVM)
            }
            .sheet(isPresented: $showInfoSheet) {
                SignInInfoSheet()
                    .presentationDetents([.medium, .large])
            }
        }
    }

    // MARK: - Button label (centered, consistent)
    private func authButtonLabel(icon: Image, title: String) -> some View {
        HStack(spacing: 12) {
            icon
                .resizableIfNeeded()
                .scaledToFit()
                .frame(width: 18, height: 18)

            Text(title)
                .fontWeight(.semibold)
        }
        .frame(maxWidth: .infinity)
        .frame(height: K.Layout.buttonHeight)
    }
}

// MARK: - Image helper
private extension Image {
    func resizableIfNeeded() -> Image {
        // Making it resizable prevents huge asset images from blowing up layout.
        self.resizable()
    }
}
