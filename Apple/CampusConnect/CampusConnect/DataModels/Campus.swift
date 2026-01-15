//
//  Campus.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/12/26.
//


import SwiftUI
import FirebaseFirestore

struct Campus: Identifiable, Equatable {
    let id: String
    let name: String
    let shortName: String
    let logoUrl: String?
    let isActive: Bool
    let isUniversity: Bool
    let dorms: [String]
    let adminEmails: [String]
    let adminUids: [String]
    let locations: [CampusLocation]
    let migratedAt: Date?
}

struct CampusLocation: Equatable {
    let id: String
    let name: String
}

final class CampusServiceFS {
    static let db = Firestore.firestore()

    static func fetchCampus(id: String) async throws -> Campus {
        let snap = try await db.collection("campuses").document(id).getDocument()
        guard let d = snap.data() else { throw FirestoreDecodeErr.missing }

        let locations: [CampusLocation] = (d["locations"] as? [[String: Any]] ?? []).compactMap { item in
            guard let id = item["id"] as? String else { return nil }
            return CampusLocation(id: id, name: item["name"] as? String ?? "")
        }

        return Campus(
            id: snap.documentID,
            name: d["name"] as? String ?? "",
            shortName: d["shortName"] as? String ?? "",
            logoUrl: d["logoUrl"] as? String,
            isActive: d["isActive"] as? Bool ?? true,
            isUniversity: d["isUniversity"] as? Bool ?? false,
            dorms: d["dorms"] as? [String] ?? [],
            adminEmails: d["adminEmails"] as? [String] ?? [],
            adminUids: d["adminUids"] as? [String] ?? [],
            locations: locations,
            migratedAt: (d["migratedAt"] as? Timestamp)?.dateValue()
        )
    }
    
    static func fetchCampuses() async throws -> [Campus] {
            let snap = try await db.collection("campuses")
                .order(by: "name")
                .getDocuments()

            return try snap.documents.map { doc in
                let d = doc.data()
                if d.isEmpty { throw FirestoreDecodeErr.missing }
                
                let locations: [CampusLocation] = (d["locations"] as? [[String: Any]] ?? []).compactMap { item in
                    guard let id = item["id"] as? String else { return nil }
                    return CampusLocation(
                        id: id,
                        name: item["name"] as? String ?? ""
                    )
                }

                return Campus(
                    id: doc.documentID,
                    name: d["name"] as? String ?? "",
                    shortName: d["shortName"] as? String ?? "",
                    logoUrl: d["logoUrl"] as? String,
                    isActive: d["isActive"] as? Bool ?? true,
                    isUniversity: d["isUniversity"] as? Bool ?? false,
                    dorms: d["dorms"] as? [String] ?? [],
                    adminEmails: d["adminEmails"] as? [String] ?? [],
                    adminUids: d["adminUids"] as? [String] ?? [],
                    locations: locations,
                    migratedAt: (d["migratedAt"] as? Timestamp)?.dateValue()
                )
            }
        }
}


import FirebaseFirestore

struct CampusFB: Identifiable, Equatable {
    let id: String
    let name: String
    let shortName: String
    let logoUrl: String?
    let isUniversity: Bool
    let isActive: Bool
    let adminEmails: [String]
    let adminUids: [String]
    let locations: [CampusLocationFB]
    let migratedAt: Date?

    init(data: [String: Any], documentId: String) {
        func ts(_ k: String) -> Date? {
            (data[k] as? Timestamp)?.dateValue()
        }

        self.id = documentId
        self.name = data["name"] as? String ?? ""
        self.shortName = data["shortName"] as? String ?? ""
        self.logoUrl = (data["logoUrl"] as? String) ?? (data["avatarUrl"] as? String)
        self.isUniversity = data["isUniversity"] as? Bool ?? false
        self.isActive = data["isActive"] as? Bool ?? true
        self.adminEmails = data["adminEmails"] as? [String] ?? []
        self.adminUids = data["adminUids"] as? [String] ?? []
        self.migratedAt = ts("migratedAt")

        self.locations = (data["locations"] as? [[String: Any]] ?? [])
            .map { CampusLocationFB(data: $0) }
    }
}

struct CampusLocationFB: Identifiable, Equatable {
    let id: String
    let name: String
    let address: String?
    let lat: Double?
    let lng: Double?

    init(data: [String: Any]) {
        self.id = data["id"] as? String ?? UUID().uuidString
        self.name = data["name"] as? String ?? ""
        self.address = data["address"] as? String
        self.lat = data["lat"] as? Double
        self.lng = data["lng"] as? Double
    }
}
