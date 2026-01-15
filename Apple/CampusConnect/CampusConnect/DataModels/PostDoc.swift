//
//  PostDoc.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/13/26.
//


import SwiftUI
import FirebaseFirestore

enum PostType: String, Codable, CaseIterable, Equatable {
    case post, event, announcement
}

enum PostOwnerType: String, Codable, CaseIterable, Equatable {
    case personal, club, campus
}

struct PostEventLogistics: Codable, Equatable {
    var startsAt: Date = Date()
    var locationLabel: String = ""
    var lat: Double?
    var lng: Double?
}

struct PostDoc: Identifiable, Codable, Equatable {
    let id: String
    
    // ownership
    var ownerType: PostOwnerType
    var ownerId: String         // personal: uid, club: clubId, campus: campusId
    
    // main
    var description: String
    var authorId: String        // who posted it (may differ from ownerId for clubs/campus)
    var type: PostType
    var imageUrls: [String]
    
    // timestamps / edits
    var createdAt: Date?
    var editedAt: Date?
    var editCount: Int?
    
    // counters
    var commentsCount: Int?
    var repliesCommentsCount: Int?
    var seenCount: Int?
    
    // arrays
    var likes: [String]?
    var seenBy: [String]?
    
    // event-only
    var event: PostEventLogistics?
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
