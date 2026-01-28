//
//  ProfilePostsVM.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/24/26.
//


import Foundation
import FirebaseFirestore
import Combine

@MainActor
final class ProfilePostsVM: ObservableObject {
    @Published private(set) var posts: [PostDoc] = []
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
            posts = []
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
        posts = []
        await loadIfNeeded(uid: uid)
    }

    private func load(uid: String) async throws {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }

        let snap = try await db.collection("posts")
            .whereField("authorId", isEqualTo: uid)
            .getDocuments()

        var out: [PostDoc] = []
        out.reserveCapacity(snap.documents.count)

        for doc in snap.documents {
            if let p = PostDocMapper.mapDocToPost(doc) { out.append(p) }
        }

        // legacy fallback (kept from your original VM)
        if out.isEmpty {
            let legacy = try await db.collection("events")
                .whereField("hostUserId", isEqualTo: uid)
                .getDocuments()

            let fallbackCampusId = PostDocMapper.guessCampusId(from: legacy.documents)
            for doc in legacy.documents {
                if let p = PostDocMapper.mapLegacyEventDocToPost(doc, fallbackCampusId: fallbackCampusId) {
                    out.append(p)
                }
            }
        }

        out.sort { ($0.createdAt ?? .distantPast) > ($1.createdAt ?? .distantPast) }
        posts = out
    }
}
