//
//  ProfileService.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/12/26.
//


import Foundation
import FirebaseAuth
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
        let campusId = (data["campusId"] as? String) ?? (data["universityId"] as? String)
        let campusName = (data["campus"] as? String) ?? ""

        let roleRaw = (data["role"] as? String) ?? "Student"
        let role = UserRole(rawValue: roleRaw) ?? .student

        return UserProfile(
            id: uid,
            username: username,
            displayName: displayName,
            photoURL: data["photoURL"] as? String,
            campusId: campusId,
            universityId: data["universityId"] as? String,
            campus: campusName,
            role: role,
            dorm: data["dorm"] as? String,
            major: data["major"] as? String,
            yearOfStudy: data["yearOfStudy"] as? String
        )
    }

    static func isUsernameAvailable(_ username: String, excluding uid: String) async throws -> Bool {
        let normalized = username.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if normalized.isEmpty { return false }

        let q = db.collection("users")
            .whereField("usernameLower", isEqualTo: normalized)
            .limit(to: 1)

        let snap = try await q.getDocuments()
        if let doc = snap.documents.first {
            return doc.documentID == uid // if it's me, it's okay
        }
        return true
    }

    static func userOwnsClubsOnCampus(uid: String, campusId: String) async throws -> Bool {
        // Adjust fields to match your schema (ownerUid/ownerId + campusId)
        let q = db.collection("clubs")
            .whereField("ownerUid", isEqualTo: uid)
            .whereField("campusId", isEqualTo: campusId)
            .limit(to: 1)

        let snap = try await q.getDocuments()
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

        if role == .student, campus.hasDorms {
            let d = (dorm ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            if d.isEmpty { throw ProfileSetupError.dormRequired }
        }

        // Uniqueness check
        let ok = try await isUsernameAvailable(uname, excluding: uid)
        if !ok { throw ProfileSetupError.usernameTaken }

        // Club ownership check if changing campus
        if let prev = previousCampusId, !prev.isEmpty, prev != campus.id {
            let owns = try await userOwnsClubsOnCampus(uid: uid, campusId: prev)
            if owns { throw ProfileSetupError.ownsClubsMustTransfer }
        }

        // Dual-write campusId + universityId
        let payload: [String: Any] = [
            "username": uname,
            "usernameLower": uname.lowercased(),
            "campus": campus.name,
            "campusId": campus.id,
            "universityId": campus.id,
            "role": role.rawValue,
            "dorm": dorm ?? "",
            "major": major ?? "",
            "yearOfStudy": yearOfStudy ?? ""
        ]

        try await db.collection("users").document(uid).setData(payload, merge: true)

        // Side effects (hooks)
        if let prev = previousCampusId, prev != campus.id {
            try await autoJoinDefaultClubs(uid: uid, campus: campus)
        }
        if role == .student, campus.hasDorms, let dorm, !dorm.isEmpty {
            try await autoJoinDormClub(uid: uid, campus: campus, dormName: dorm)
        }
    }

    // MARK: - Side effects (stubs)

    static func autoJoinDefaultClubs(uid: String, campus: Campus) async throws {
        // Implement your membership model here (e.g. teams/{clubId}/members/{uid})
        // This is intentionally a stub.
    }

    static func autoJoinDormClub(uid: String, campus: Campus, dormName: String) async throws {
        // Implement your dorm club enrollment here (find dorm club by name/campusId, then join)
        // This is intentionally a stub.
    }
}
