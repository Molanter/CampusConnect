//
//  ProfileEventsVM.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/24/26.
//


import Foundation
import FirebaseFirestore
import Combine

@MainActor
final class ProfileEventsVM: ObservableObject {
    @Published private(set) var events: [PostDoc] = []
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    private let db = Firestore.firestore()
    private var loadedUid: String? = nil
    private var hasLoaded = false

    func loadIfNeeded(uid: String) async {
        let uid = uid.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !uid.isEmpty else { return }

        if loadedUid != uid {
            loadedUid = uid
            hasLoaded = false
            events = []
        }
        guard !hasLoaded else { return }

        errorMessage = nil
        do {
            try await load(uid: uid)
            hasLoaded = true
        } catch {
            errorMessage = (error as NSError).localizedDescription
        }
    }

    func refresh(uid: String) async {
        let uid = uid.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !uid.isEmpty else { return }
        loadedUid = uid
        hasLoaded = false
        events = []
        await loadIfNeeded(uid: uid)
    }

    private func load(uid: String) async throws {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }

        // Reads posts authored by uid and filters to event type.
        // (If you later store events only in /events, swap to that query.)
        let snap = try await db.collection("posts")
            .whereField("authorId", isEqualTo: uid)
            .getDocuments()

        var out: [PostDoc] = []
        out.reserveCapacity(snap.documents.count)

        for doc in snap.documents {
            guard let p = PostDocMapper.mapDocToPost(doc) else { continue }
            if p.type == .event { out.append(p) }
        }

        out.sort { ($0.createdAt ?? .distantPast) > ($1.createdAt ?? .distantPast) }
        events = out
    }
}
