//
//  UserProfile.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/12/26.
//


import SwiftUI
import FirebaseFirestore

struct UserProfile: Identifiable {
    let id: String // uid

    var username: String
    var displayName: String
    var photoURL: String?

    var campusId: String?
    var campus: String?

    var role: UserRole
    var dorm: String?
    var major: String?
    var yearOfStudy: String?

    // ✅ needed for campus adminEmails check
    var email: String?

    var isCompleteBasic: Bool {
        !username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        ((campusId ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false)
    }
}

enum UserRole: String, Codable, CaseIterable, Equatable {
    case student
    case faculty
    case staff
}

enum FirestoreDecodeErr: Error { case missing }

final class ProfileServiceFS {
    static let db = Firestore.firestore()

    // Change "users" if your profiles are stored elsewhere.
    static func fetchProfile(uid: String) async throws -> UserProfile {
        let snap = try await db.collection("users").document(uid).getDocument()
        guard let d = snap.data() else { throw FirestoreDecodeErr.missing }

        let username = (d["username"] as? String) ?? ""
        let displayName =
            (d["displayName"] as? String)
            ?? (d["name"] as? String)
            ?? ""

        let photoURL =
            (d["photoURL"] as? String)
            ?? (d["profilePictureUrl"] as? String)
            ?? (d["avatarUrl"] as? String)

        let campusId = d["campusId"] as? String
        let campus = d["campus"] as? String
        let dorm = d["dorm"] as? String
        let major = d["major"] as? String
        let yearOfStudy = d["yearOfStudy"] as? String
        let email = d["email"] as? String

        let roleRaw = (d["role"] as? String) ?? UserRole.student.rawValue
        let role = UserRole(rawValue: roleRaw) ?? .student

        return UserProfile(
            id: snap.documentID,
            username: username,
            displayName: displayName,
            photoURL: photoURL,
            campusId: campusId,
            campus: campus,
            role: role,
            dorm: dorm,
            major: major,
            yearOfStudy: yearOfStudy,
            email: email
        )
    }
}
