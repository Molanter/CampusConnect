//
//  ProfileService.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/12/26.
//

import Foundation
import FirebaseFirestore

enum ProfileSetupError: LocalizedError {
    case notSignedIn
    case usernameTaken
    case missingRequired(String)
    case dormRequired
    case ownsClubsMustTransfer
    case unknown

    var errorDescription: String? {
        switch self {
        case .notSignedIn: return "You are not signed in."
        case .usernameTaken: return "That username is already taken."
        case .missingRequired(let field): return "\(field) is required."
        case .dormRequired: return "Dorm / Residence is required for students at this campus."
        case .ownsClubsMustTransfer: return "You own clubs on your current campus. Transfer ownership before changing campus."
        case .unknown: return "Something went wrong."
        }
    }
}

final class ProfileService {
    static let db = Firestore.firestore()

    static func fetchProfile(uid: String) async throws -> UserProfile? {
        let ref = db.collection("users").document(uid)
        let snap = try await ref.getDocument()
        guard snap.exists, let data = snap.data() else { return nil }

        let displayName =
            (data["displayName"] as? String) ??
            (data["name"] as? String) ??
            (data["fullName"] as? String) ??
            "User"

        let username = (data["username"] as? String) ?? ""

        let campusId = (data["campusId"] as? String)
        let campusName = (data["campus"] as? String)

        // IMPORTANT: your enum raw values are lowercase: student/faculty/staff
        let roleRaw = ((data["role"] as? String) ?? "student").lowercased()
        let role = UserRole(rawValue: roleRaw) ?? .student

        return UserProfile(
            id: uid,
            username: username,
            displayName: displayName,
            photoURL: data["photoURL"] as? String,
            campusId: campusId,
            campus: campusName,
            role: role,
            dorm: data["dorm"] as? String,
            major: data["major"] as? String,
            yearOfStudy: data["yearOfStudy"] as? String,
            email: data["email"] as? String
        )
    }

    static func isUsernameAvailable(_ username: String, excluding uid: String) async throws -> Bool {
        let normalized = username.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if normalized.isEmpty { return false }

        let snap = try await db.collection("users")
            .whereField("usernameLower", isEqualTo: normalized)
            .limit(to: 1)
            .getDocuments()

        if let doc = snap.documents.first {
            return doc.documentID == uid
        }
        return true
    }

    static func userOwnsClubsOnCampus(uid: String, campusId: String) async throws -> Bool {
        let snap = try await db.collection("clubs")
            .whereField("ownerUid", isEqualTo: uid)
            .whereField("campusId", isEqualTo: campusId)
            .limit(to: 1)
            .getDocuments()

        return !snap.documents.isEmpty
    }

    static func saveProfile(
        uid: String,
        displayName: String?,
        username: String,
        campus: Campus,
        role: UserRole,
        dorm: String?,
        major: String?,
        yearOfStudy: String?,
        previousCampusId: String?
    ) async throws {
        let uname = username.trimmingCharacters(in: .whitespacesAndNewlines)
        if uname.isEmpty { throw ProfileSetupError.missingRequired("Username") }
        if campus.id.isEmpty { throw ProfileSetupError.missingRequired("Campus") }

        // If you still want dorm requirement, Campus.swift no longer has `hasDorms`.
        // Use campus.isUniversity OR look at dorms/locations rules you actually store.
        // Keeping your intent, but basing on isUniversity:
        if role == .student, campus.isUniversity {
            let d = (dorm ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            if d.isEmpty { throw ProfileSetupError.dormRequired }
        }

        let ok = try await isUsernameAvailable(uname, excluding: uid)
        if !ok { throw ProfileSetupError.usernameTaken }

        if let prev = previousCampusId, !prev.isEmpty, prev != campus.id {
            let owns = try await userOwnsClubsOnCampus(uid: uid, campusId: prev)
            if owns { throw ProfileSetupError.ownsClubsMustTransfer }
        }

        var payload: [String: Any] = [
            "username": uname,
            "usernameLower": uname.lowercased(),
            "role": role.rawValue,     // already lowercase
            "campusId": campus.id,
        ]

        if let displayName, !displayName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            payload["displayName"] = displayName
        }

        // Optional strings: write only if present, otherwise remove (prevents storing lots of "")
        func setOptional(_ key: String, _ value: String?) {
            let v = (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            if v.isEmpty {
                payload[key] = FieldValue.delete()
            } else {
                payload[key] = v
            }
        }

        setOptional("campus", campus.name)
        setOptional("dorm", dorm)
        setOptional("major", major)
        setOptional("yearOfStudy", yearOfStudy)

        try await db.collection("users").document(uid).setData(payload, merge: true)

        // side effects (still stubs)
        if let prev = previousCampusId, prev != campus.id {
            try await autoJoinDefaultClubs(uid: uid, campus: campus)
        }
        if role == .student, campus.isUniversity {
            let d = (dorm ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            if !d.isEmpty {
                try await autoJoinDormClub(uid: uid, campus: campus, dormName: d)
            }
        }
    }

    static func autoJoinDefaultClubs(uid: String, campus: Campus) async throws {}
    static func autoJoinDormClub(uid: String, campus: Campus, dormName: String) async throws {}
}
