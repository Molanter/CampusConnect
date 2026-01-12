//
//  EmailPasswordSignInSheet.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/11/26.
//

import SwiftUI

struct EmailPasswordSignInSheet: View {
    @EnvironmentObject private var authVM: AuthViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var email = ""
    @State private var password = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Email") {
                    TextField("", text: $email, prompt: Text(verbatim: "account@email.com"))
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }
                Section {
                    SecureField("Password", text: $password)
                } header: {
                    Text("Password")
                } footer: {
                    Text("Sign in here only if you already know your password.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Section {
                    ListCapsuleButton {
                        Task {
                            await authVM.signInWithEmail(email: email.trimmingCharacters(in: .whitespacesAndNewlines),
                                                         password: password)
                            if authVM.user != nil { dismiss() }
                        }
                    } label: {
                        HStack {
                            Spacer()
                            Text(authVM.isLoading ? "Signing in..." : "Sign in")
                                .fontWeight(.semibold)
                            Spacer()
                        }
                    }
                }

                if let msg = authVM.errorMessage {
                    Section {
                        Text(msg).foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Email Sign In")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }
}
