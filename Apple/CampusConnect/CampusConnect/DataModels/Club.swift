//
//  Club.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/14/26.
//


import SwiftUI
import FirebaseFirestore

struct Club: Identifiable, Equatable {
    let id: String
    let campusId: String
    let name: String
    let description: String
    let category: String
    let logoUrl: String?
    let coverImageUrl: String?
    let isPrivate: Bool
    let isVerified: Bool
    let verificationStatus: String?
    let postingPermission: String?
    let allowMemberPosts: Bool
    let memberCount: Int
    let memberIds: [String]
    let createdBy: String
    let createdAt: Date?
    let updatedAt: Date?
    let verifiedAt: Date?
}


final class ClubServiceFS {
    static let db = Firestore.firestore()

    static func fetchClub(id: String) async throws -> Club {
        let snap = try await db.collection("clubs").document(id).getDocument()
        guard let d = snap.data() else { throw FirestoreDecodeErr.missing }
        func ts(_ k: String) -> Date? { (d[k] as? Timestamp)?.dateValue() }

        return Club(
            id: snap.documentID,
            campusId: d["campusId"] as? String ?? "",
            name: d["name"] as? String ?? "",
            description: d["description"] as? String ?? "",
            category: d["category"] as? String ?? "",
            logoUrl: d["logoUrl"] as? String,
            coverImageUrl: d["coverImageUrl"] as? String,
            isPrivate: d["isPrivate"] as? Bool ?? false,
            isVerified: d["isVerified"] as? Bool ?? false,
            verificationStatus: d["verificationStatus"] as? String,
            postingPermission: d["postingPermission"] as? String,
            allowMemberPosts: d["allowMemberPosts"] as? Bool ?? false,
            memberCount: (d["memberCount"] as? Int) ?? Int((d["memberCount"] as? Double) ?? 0),
            memberIds: d["memberIds"] as? [String] ?? [],
            createdBy: d["createdBy"] as? String ?? "",
            createdAt: ts("createdAt"),
            updatedAt: ts("updatedAt"),
            verifiedAt: ts("verifiedAt")
        )
    }
}
