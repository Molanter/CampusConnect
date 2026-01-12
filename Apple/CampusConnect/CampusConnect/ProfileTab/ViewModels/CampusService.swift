//
//  CampusService.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/12/26.
//


import Foundation
import FirebaseFirestore

final class CampusService {
    static let db = Firestore.firestore()

    static func fetchCampuses() async throws -> [Campus] {
        let snap = try await db.collection("campuses").order(by: "name").getDocuments()
        return snap.documents.map { doc in
            let d = doc.data()
            return Campus(
                id: doc.documentID,
                name: (d["name"] as? String) ?? "Campus",
                shortName: d["shortName"] as? String,
                hasDorms: (d["hasDorms"] as? Bool) ?? false,
                dorms: (d["dorms"] as? [String]) ?? [],
                defaultClubIds: (d["defaultClubIds"] as? [String]) ?? []
            )
        }
    }
}