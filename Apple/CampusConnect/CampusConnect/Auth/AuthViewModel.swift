//
//  AuthViewModel.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/11/26.
//

import SwiftUI
import FirebaseAuth
import FirebaseCore
import Combine

#if canImport(GoogleSignIn)
import GoogleSignIn
import GoogleSignInSwift
#endif

@MainActor
final class AuthViewModel: ObservableObject {
    @Published var user: FirebaseAuth.User? = nil
    @Published var isAuthReady: Bool = false     // ✅ add this
    @Published var isLoading: Bool = false
    @Published var errorMessage: String? = nil

    private var authListener: AuthStateDidChangeListenerHandle?

    func startListening() {
        guard authListener == nil else { return }
        authListener = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            guard let self else { return }
            self.user = user
            self.isAuthReady = true               // ✅ first callback means auth state is known
        }
    }

    deinit {
        if let authListener {
            Auth.auth().removeStateDidChangeListener(authListener)
        }
    }

    func signOut() {
        do { try Auth.auth().signOut() }
        catch { errorMessage = error.localizedDescription }
    }

    // MARK: - Email / Password
    func signInWithEmail(email: String, password: String) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            _ = try await Auth.auth().signIn(withEmail: email, password: password)
        } catch {
            let ns = error as NSError
            if let code = AuthErrorCode(rawValue: ns.code) {
                switch code {
                case .userNotFound:
                    do {
                        _ = try await Auth.auth().createUser(withEmail: email, password: password)
                    } catch {
                        errorMessage = error.localizedDescription
                    }
                case .wrongPassword:
                    errorMessage = "Wrong password."
                case .invalidEmail:
                    errorMessage = "Invalid email address."
                case .networkError:
                    errorMessage = "Network error. Try again."
                default:
                    errorMessage = error.localizedDescription
                }
            } else {
                errorMessage = error.localizedDescription
            }
        }
    }

    // MARK: - Google
    func signInWithGoogle() async {
        #if canImport(GoogleSignIn)
        guard let clientID = FirebaseApp.app()?.options.clientID else {
            errorMessage = "Missing Google clientID."
            return
        }
        guard let rootVC = await UIApplication.shared.topMostViewController() else {
            errorMessage = "Unable to find root view controller."
            return
        }

        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        _ = GIDConfiguration(clientID: clientID)

        do {
            let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: rootVC, hint: nil, additionalScopes: [])
            guard let idToken = result.user.idToken?.tokenString else {
                errorMessage = "Missing Google ID token."
                return
            }

            let accessToken = result.user.accessToken.tokenString
            let credential = GoogleAuthProvider.credential(withIDToken: idToken, accessToken: accessToken)
            _ = try await Auth.auth().signIn(with: credential)
        } catch {
            errorMessage = error.localizedDescription
        }
        #else
        errorMessage = "GoogleSignIn not available."
        #endif
    }

    // MARK: - Apple
    func signInWithApple(idTokenString: String, nonce: String) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        let credential = OAuthProvider.credential(
            providerID: .apple,
            idToken: idTokenString,
            rawNonce: nonce
        )

        do {
            _ = try await Auth.auth().signIn(with: credential)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
