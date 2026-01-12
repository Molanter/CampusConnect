//
//  AppleSignInCoordinator.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/11/26.
//

//  Handles nonce + token extraction for Firebase Apple sign-in.

import Foundation
import AuthenticationServices
import CryptoKit
import UIKit

final class AppleSignInCoordinator {
    static let shared = AppleSignInCoordinator()
    private init() {}

    private var currentNonce: String?
    private weak var authVM: AuthViewModel?
    private var authController: ASAuthorizationController?

    @MainActor
    func beginSignIn(authVM: AuthViewModel) {
        self.authVM = authVM

        let provider = ASAuthorizationAppleIDProvider()
        let request = provider.createRequest()

        // 🔑 Nonce setup (INLINE)
        let nonce = randomNonceString()
        currentNonce = nonce
        request.requestedScopes = [.fullName, .email]
        request.nonce = sha256(nonce)

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = AppleSignInDelegate.shared
        controller.presentationContextProvider = AppleSignInDelegate.shared
        AppleSignInDelegate.shared.coordinator = self

        // 🔒 keep strong reference (fixes error 1000)
        self.authController = controller

        controller.performRequests()
    }

    @MainActor
    fileprivate func complete(_ result: Result<ASAuthorization, Error>) async {
        defer { authController = nil }

        guard let authVM else { return }

        switch result {
        case .failure(let error):
            authVM.errorMessage = error.localizedDescription

        case .success(let auth):
            guard
                let credential = auth.credential as? ASAuthorizationAppleIDCredential,
                let nonce = currentNonce,
                let tokenData = credential.identityToken,
                let idToken = String(data: tokenData, encoding: .utf8)
            else {
                authVM.errorMessage = "Unable to read Apple credentials."
                return
            }

            await authVM.signInWithApple(idTokenString: idToken, nonce: nonce)
        }
    }
}

final class AppleSignInDelegate: NSObject,
    ASAuthorizationControllerDelegate,
    ASAuthorizationControllerPresentationContextProviding {

    static let shared = AppleSignInDelegate()
    weak var coordinator: AppleSignInCoordinator?

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first(where: { $0.isKeyWindow }) ?? UIWindow()
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        Task { await coordinator?.complete(.success(authorization)) }
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        Task { await coordinator?.complete(.failure(error)) }
    }
}

// MARK: - Nonce helpers

private func sha256(_ input: String) -> String {
    let inputData = Data(input.utf8)
    let hashed = SHA256.hash(data: inputData)
    return hashed.map { String(format: "%02x", $0) }.joined()
}

private func randomNonceString(length: Int = 32) -> String {
    precondition(length > 0)
    let charset: [Character] = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
    var result = ""
    var remaining = length

    while remaining > 0 {
        var randoms = [UInt8](repeating: 0, count: 16)
        let status = SecRandomCopyBytes(kSecRandomDefault, randoms.count, &randoms)
        if status != errSecSuccess { fatalError("Unable to generate nonce.") }

        for r in randoms {
            if remaining == 0 { break }
            if r < charset.count {
                result.append(charset[Int(r)])
                remaining -= 1
            }
        }
    }
    return result
}
