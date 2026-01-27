//
//  Club.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/14/26.
//

import SwiftUI
import FirebaseFirestore

// ✅ Tolerant decode (won’t fail when fields are missing)
// ✅ Extra fields in Firestore are ignored automatically
// ✅ Handles memberCount stored as Int OR Double
// ✅ Handles timestamps stored as Timestamp OR Date
// ✅ IMPORTANT: id is set manually from snap.documentID after decoding

struct Club: Identifiable, Equatable, Codable {

    // Firestore document id (set manually)
    var id: String = ""

    // Core
    var campusId: String = ""
    var name: String = ""

    // Optional/variable schema fields
    var description: String = ""
    var category: String = ""

    var logoUrl: String?
    var coverImageUrl: String?

    var isPrivate: Bool = false
    var isVerified: Bool = false
    var verificationStatus: String?
    var postingPermission: String?
    var allowMemberPosts: Bool = false

    var memberCount: Int = 0
    var memberIds: [String] = []

    var createdBy: String = ""

    var createdAt: Date?
    var updatedAt: Date?
    var verifiedAt: Date?

    enum CodingKeys: String, CodingKey {
        // NOTE: id intentionally excluded
        case campusId
        case name
        case description
        case category
        case logoUrl
        case coverImageUrl
        case isPrivate
        case isVerified
        case verificationStatus
        case postingPermission
        case allowMemberPosts
        case memberCount
        case memberIds
        case createdBy
        case createdAt
        case updatedAt
        case verifiedAt
    }
    
    // MARK: - Default init (safe; restores Club() after custom Decodable init)
    init() {}

    // MARK: - Decodable (tolerant)

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)

        campusId = try c.decodeIfPresent(String.self, forKey: .campusId) ?? ""
        name = try c.decodeIfPresent(String.self, forKey: .name) ?? ""

        description = try c.decodeIfPresent(String.self, forKey: .description) ?? ""
        category = try c.decodeIfPresent(String.self, forKey: .category) ?? ""

        logoUrl = try c.decodeIfPresent(String.self, forKey: .logoUrl)
        coverImageUrl = try c.decodeIfPresent(String.self, forKey: .coverImageUrl)

        isPrivate = try c.decodeIfPresent(Bool.self, forKey: .isPrivate) ?? false
        isVerified = try c.decodeIfPresent(Bool.self, forKey: .isVerified) ?? false
        verificationStatus = try c.decodeIfPresent(String.self, forKey: .verificationStatus)
        postingPermission = try c.decodeIfPresent(String.self, forKey: .postingPermission)
        allowMemberPosts = try c.decodeIfPresent(Bool.self, forKey: .allowMemberPosts) ?? false

        if let i = try c.decodeIfPresent(Int.self, forKey: .memberCount) {
            memberCount = i
        } else if let d = try c.decodeIfPresent(Double.self, forKey: .memberCount) {
            memberCount = Int(d)
        } else {
            memberCount = 0
        }

        memberIds = try c.decodeIfPresent([String].self, forKey: .memberIds) ?? []
        createdBy = try c.decodeIfPresent(String.self, forKey: .createdBy) ?? ""

        createdAt = Self.decodeDateOrTimestamp(from: c, key: .createdAt)
        updatedAt = Self.decodeDateOrTimestamp(from: c, key: .updatedAt)
        verifiedAt = Self.decodeDateOrTimestamp(from: c, key: .verifiedAt)

        // id stays "" here; set from DocumentSnapshot.documentID after decode
        id = ""
    }

    // MARK: - Encodable

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)

        try c.encode(campusId, forKey: .campusId)
        try c.encode(name, forKey: .name)
        try c.encode(description, forKey: .description)
        try c.encode(category, forKey: .category)

        try c.encodeIfPresent(logoUrl, forKey: .logoUrl)
        try c.encodeIfPresent(coverImageUrl, forKey: .coverImageUrl)

        try c.encode(isPrivate, forKey: .isPrivate)
        try c.encode(isVerified, forKey: .isVerified)
        try c.encodeIfPresent(verificationStatus, forKey: .verificationStatus)
        try c.encodeIfPresent(postingPermission, forKey: .postingPermission)
        try c.encode(allowMemberPosts, forKey: .allowMemberPosts)

        try c.encode(memberCount, forKey: .memberCount)
        try c.encode(memberIds, forKey: .memberIds)

        try c.encode(createdBy, forKey: .createdBy)

        try c.encodeIfPresent(createdAt, forKey: .createdAt)
        try c.encodeIfPresent(updatedAt, forKey: .updatedAt)
        try c.encodeIfPresent(verifiedAt, forKey: .verifiedAt)
    }

    private static func decodeDateOrTimestamp(
        from c: KeyedDecodingContainer<CodingKeys>,
        key: CodingKeys
    ) -> Date? {
        if let d = try? c.decodeIfPresent(Date.self, forKey: key) { return d }
        if let ts = try? c.decodeIfPresent(Timestamp.self, forKey: key) { return ts.dateValue() }
        return nil
    }
}

