//
//  ClubService.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/27/26.
//

// ClubServiceFS.swift
import Foundation
import FirebaseFirestore

// If you already have a `ClubService` protocol elsewhere, delete this protocol block.
// Keep ONLY the `actor ClubServiceFS` and make it conform to your existing protocol.
protocol ClubService: Sendable {
    func fetchClub(id: String) async throws -> Club
    func fetchClubs(campusId: String, limit: Int) async throws -> [Club]
    func createClub(
        campusId: String,
        createdBy: String,
        name: String,
        description: String,
        category: String,
        isPrivate: Bool
    ) async throws -> String
}

actor ClubServiceFS: ClubService {
    private let db = Firestore.firestore()

    func fetchClub(id: String) async throws -> Club {
        let snap = try await getDocument(db.collection("clubs").document(id))

        guard snap.exists else {
            throw NSError(
                domain: "ClubServiceFS",
                code: 404,
                userInfo: [NSLocalizedDescriptionKey: "Club not found"]
            )
        }

        return mapClub(doc: snap)
    }

    func fetchClubs(campusId: String, limit: Int = 200) async throws -> [Club] {
        let snap = try await getDocuments(
            db.collection("clubs")
                .whereField("campusId", isEqualTo: campusId)
                .limit(to: limit)
        )

        return snap.documents
            .map(mapClub(doc:))
            .sorted { $0.name.lowercased() < $1.name.lowercased() }
    }

    func createClub(
        campusId: String,
        createdBy: String,
        name: String,
        description: String,
        category: String,
        isPrivate: Bool
    ) async throws -> String {
        let payload: [String: Any] = [
            "campusId": campusId,
            "createdBy": createdBy,
            "name": name,
            "description": description,
            "category": category,
            "isPrivate": isPrivate,
            "isVerified": false,
            "memberCount": 1,
            "memberIds": [createdBy],
            "createdAt": FieldValue.serverTimestamp(),
            "updatedAt": FieldValue.serverTimestamp()
        ]

        let ref = try await addDocument(db.collection("clubs"), data: payload)
        return ref.documentID
    }

    // MARK: - Mapping (tolerant, no FirebaseFirestoreSwift needed)

    private func mapClub(doc: DocumentSnapshot) -> Club {
        var c = Club()
        c.id = doc.documentID

        let data = doc.data() ?? [:]
        c.campusId = data["campusId"] as? String ?? ""
        c.name = data["name"] as? String ?? ""

        c.description = data["description"] as? String ?? ""
        c.category = data["category"] as? String ?? ""

        c.logoUrl = data["logoUrl"] as? String
        c.coverImageUrl = data["coverImageUrl"] as? String

        c.isPrivate = data["isPrivate"] as? Bool ?? false
        c.isVerified = data["isVerified"] as? Bool ?? false
        c.verificationStatus = data["verificationStatus"] as? String
        c.postingPermission = data["postingPermission"] as? String
        c.allowMemberPosts = data["allowMemberPosts"] as? Bool ?? false

        if let i = data["memberCount"] as? Int {
            c.memberCount = i
        } else if let d = data["memberCount"] as? Double {
            c.memberCount = Int(d)
        } else {
            c.memberCount = 0
        }

        c.memberIds = data["memberIds"] as? [String] ?? []
        c.createdBy = data["createdBy"] as? String ?? ""

        if let ts = data["createdAt"] as? Timestamp { c.createdAt = ts.dateValue() }
        if let ts = data["updatedAt"] as? Timestamp { c.updatedAt = ts.dateValue() }
        if let ts = data["verifiedAt"] as? Timestamp { c.verifiedAt = ts.dateValue() }

        return c
    }

    // MARK: - Async wrappers

    private func getDocument(_ ref: DocumentReference) async throws -> DocumentSnapshot {
        try await withCheckedThrowingContinuation { cont in
            ref.getDocument { snap, err in
                if let err { cont.resume(throwing: err); return }
                guard let snap else {
                    cont.resume(throwing: NSError(domain: "ClubServiceFS", code: -1,
                                                 userInfo: [NSLocalizedDescriptionKey: "Missing snapshot"]))
                    return
                }
                cont.resume(returning: snap)
            }
        }
    }

    private func getDocuments(_ query: Query) async throws -> QuerySnapshot {
        try await withCheckedThrowingContinuation { cont in
            query.getDocuments { snap, err in
                if let err { cont.resume(throwing: err); return }
                guard let snap else {
                    cont.resume(throwing: NSError(domain: "ClubServiceFS", code: -2,
                                                 userInfo: [NSLocalizedDescriptionKey: "Missing snapshot"]))
                    return
                }
                cont.resume(returning: snap)
            }
        }
    }

    private func addDocument(_ col: CollectionReference, data: [String: Any]) async throws -> DocumentReference {
        try await withCheckedThrowingContinuation { cont in
            var ref: DocumentReference?
            ref = col.addDocument(data: data) { err in
                if let err { cont.resume(throwing: err); return }
                guard let ref else {
                    cont.resume(throwing: NSError(domain: "ClubServiceFS", code: -3,
                                                 userInfo: [NSLocalizedDescriptionKey: "Missing document reference"]))
                    return
                }
                cont.resume(returning: ref)
            }
        }
    }
}
