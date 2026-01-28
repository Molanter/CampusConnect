//
//  ProfileClubsVM.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/24/26.
//

import Foundation
import FirebaseFirestore
import FirebaseAuth
import Combine

@MainActor
final class ProfileClubsVM: ObservableObject {

    @Published private(set) var clubs: [Club] = []
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    private let db = Firestore.firestore()

    private var loadedAuthUid: String?
    private var hasLoaded = false
    private var hasRefreshedTokenOnce = false

    private let maxMembershipDocs = 500
    private let maxConcurrentClubFetches = 8

    func loadIfNeeded() async {
        guard let authUid = currentAuthUidOrSetError() else { return }

        if loadedAuthUid != authUid {
            loadedAuthUid = authUid
            hasLoaded = false
            hasRefreshedTokenOnce = false
            clubs = []
            errorMessage = nil
        }

        guard !hasLoaded else { return }

        errorMessage = nil
        do {
            try await loadMyClubs(authUid: authUid)
            hasLoaded = true
        } catch {
            setFirestoreError(error, context: "members CG uid==\(authUid) -> clubs/{clubId}")
        }
    }

    func refresh() async {
        loadedAuthUid = nil
        hasLoaded = false
        hasRefreshedTokenOnce = false
        clubs = []
        errorMessage = nil
        await loadIfNeeded()
    }

    private func loadMyClubs(authUid: String) async throws {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }

        dbg("loadMyClubs: start uid=\(authUid)")
        try await refreshIDTokenIfNeededOnce()

        // Requires composite COLLECTION_GROUP index: members (uid ASC, clubId ASC)
        let membersSnap = try await db.collectionGroup("members")
            .whereField("uid", isEqualTo: authUid)
            .whereField("clubId", isGreaterThan: "")
            .order(by: "clubId")
            .limit(to: maxMembershipDocs)
            .getDocuments()

        dbg("loadMyClubs: member docs=\(membersSnap.documents.count)")

        var clubIds = Set<String>()
        clubIds.reserveCapacity(membersSnap.documents.count)

        for m in membersSnap.documents {
            let data = m.data()

            let clubIdFromField = (data["clubId"] as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines)

            let clubIdFromPath = m.reference.parent.parent?.documentID

            let clubId = (clubIdFromField?.isEmpty == false) ? clubIdFromField : clubIdFromPath
            guard let clubId, !clubId.isEmpty else { continue }

            let status = ((data["status"] as? String) ?? "").lowercased()
            let approved = status.isEmpty || status == "approved" || status == "active"
            guard approved else { continue }

            clubIds.insert(clubId)
        }

        let ids = Array(clubIds)
        dbg("loadMyClubs: unique clubIds=\(ids.count)")

        guard !ids.isEmpty else {
            clubs = []
            dbg("loadMyClubs: no clubs after filtering")
            return
        }

        var fetched: [Club] = []
        fetched.reserveCapacity(ids.count)

        for chunk in ids.chunked(maxConcurrentClubFetches) {
            try await withThrowingTaskGroup(of: Club?.self) { group in
                for clubId in chunk {
                    group.addTask { [db] in
                        let snap = try await db.collection("clubs").document(clubId).getDocument()
                        guard snap.exists else { return nil }

                        // ✅ decode + fix id from documentID
                        var club = try snap.data(as: Club.self)
                        club.id = snap.documentID
                        return club
                    }
                }

                for try await club in group {
                    if let club { fetched.append(club) }
                }
            }
        }

        // Dedupe by id for SwiftUI ForEach safety
        var seen = Set<String>()
        var deduped: [Club] = []
        deduped.reserveCapacity(fetched.count)

        for c in fetched {
            let key = c.id.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !key.isEmpty else { continue }
            if seen.insert(key).inserted {
                deduped.append(c)
            }
        }

        clubs = deduped.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        dbg("loadMyClubs: final clubs.count=\(clubs.count)")
    }

    // MARK: - Auth helpers

    private func currentAuthUidOrSetError() -> String? {
        guard let raw = Auth.auth().currentUser?.uid else {
            errorMessage = "You must be signed in to load clubs."
            dbg("auth: currentUser nil")
            return nil
        }
        let uid = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !uid.isEmpty else {
            errorMessage = "You must be signed in to load clubs."
            dbg("auth: uid empty")
            return nil
        }
        dbg("auth: uid=\(uid)")
        return uid
    }

    private func refreshIDTokenIfNeededOnce() async throws {
        guard !hasRefreshedTokenOnce else { return }
        guard let user = Auth.auth().currentUser else { return }

        dbg("auth: forcing token refresh...")
        _ = try await withCheckedThrowingContinuation { (cont: CheckedContinuation<String, Error>) in
            user.getIDTokenForcingRefresh(true) { token, error in
                if let error { cont.resume(throwing: error); return }
                cont.resume(returning: token ?? "")
            }
        }
        hasRefreshedTokenOnce = true
        dbg("auth: token refresh done")
    }

    // MARK: - Error mapping

    private func setFirestoreError(_ error: Error, context: String) {
        let ns = error as NSError
        dbg("Firestore ERROR context=\(context) domain=\(ns.domain) code=\(ns.code) msg=\(ns.localizedDescription)")

        if ns.domain == FirestoreErrorDomain {
            switch ns.code {
            case 9:
                errorMessage =
                """
                Firestore index required for this query.
                Create a composite COLLECTION_GROUP index for: members
                Fields: uid ASC, clubId ASC
                \(ns.localizedDescription)
                """
            case 7:
                errorMessage = "Missing or insufficient permissions for: \(context). \(ns.localizedDescription)"
            default:
                errorMessage = ns.localizedDescription
            }
        } else {
            errorMessage = ns.localizedDescription
        }
    }

    private func dbg(_ s: String) {
        #if DEBUG
        print("🟦[ProfileClubsVM] \(s)")
        #endif
    }
}

private extension Array {
    func chunked(_ size: Int) -> [[Element]] {
        guard size > 0 else { return [self] }
        var out: [[Element]] = []
        out.reserveCapacity((count + size - 1) / size)
        var i = 0
        while i < count {
            out.append(Array(self[i..<Swift.min(i + size, count)]))
            i += size
        }
        return out
    }
}
