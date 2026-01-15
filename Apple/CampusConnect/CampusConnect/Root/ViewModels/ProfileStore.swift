// ProfileStore.swift
import Foundation
import Combine
import FirebaseAuth
import FirebaseFirestore

@MainActor
final class ProfileStore: ObservableObject {
    @Published var profile: UserProfile? = nil
    @Published var isReady: Bool = false
    @Published var isLoading: Bool = false
    @Published var errorMessage: String? = nil

    private var listener: ListenerRegistration?

    func bindToAuth(authVM: AuthViewModel) {
        // Call when authVM.user changes (or on app start)
        Task { await loadForCurrentUser(authVM: authVM) }
    }

    func loadForCurrentUser(authVM: AuthViewModel) async {
        listener?.remove()
        listener = nil

        errorMessage = nil
        isReady = false
        isLoading = true
        defer { isLoading = false }

        guard let uid = authVM.user?.uid else {
            profile = nil
            isReady = true
            return
        }

        // Live sync across the app (recommended)
        listener = Firestore.firestore()
            .collection("users")
            .document(uid)
            .addSnapshotListener { [weak self] snap, err in
                guard let self else { return }

                if let err {
                    Task { @MainActor in
                        self.errorMessage = err.localizedDescription
                        self.profile = nil
                        self.isReady = true
                    }
                    return
                }

                Task { @MainActor in
                    guard let snap, snap.exists, let data = snap.data() else {
                        self.profile = UserProfile(
                            id: uid,
                            username: "",
                            displayName: Auth.auth().currentUser?.displayName ?? "User",
                            photoURL: Auth.auth().currentUser?.photoURL?.absoluteString,
                            campusId: nil,
                            universityId: nil,
                            campus: nil,
                            role: .student,
                            dorm: nil,
                            major: nil,
                            yearOfStudy: nil
                        )
                        self.isReady = true
                        return
                    }

                    let displayName =
                        (data["displayName"] as? String) ??
                        (data["name"] as? String) ??
                        (data["fullName"] as? String) ??
                        (Auth.auth().currentUser?.displayName ?? "User")

                    let campusId = (data["campusId"] as? String) ?? (data["universityId"] as? String)
                    let roleRaw = (data["role"] as? String) ?? "Student"
                    let role = UserRole(rawValue: roleRaw) ?? .student

                    self.profile = UserProfile(
                        id: uid,
                        username: (data["username"] as? String) ?? "",
                        displayName: displayName,
                        photoURL: (data["photoURL"] as? String) ?? Auth.auth().currentUser?.photoURL?.absoluteString,
                        campusId: campusId,
                        universityId: data["universityId"] as? String,
                        campus: data["campus"] as? String,
                        role: role,
                        dorm: data["dorm"] as? String,
                        major: data["major"] as? String,
                        yearOfStudy: data["yearOfStudy"] as? String
                    )
                    self.isReady = true
                }
            }

        // Mark ready once listener is attached
        isReady = true
    }

    func clear() {
        listener?.remove()
        listener = nil
        profile = nil
        errorMessage = nil
        isReady = true
    }

    deinit {
        listener?.remove()
    }
}