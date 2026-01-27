//
//  ProfilePageVM.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/21/26.
//

import SwiftUI
import FirebaseCore
import FirebaseFirestore
import FirebaseAuth
import Combine

@MainActor
final class ProfilePageVM: ObservableObject {

    // MARK: - Output

    @Published private(set) var posts: [PostDoc] = []
    @Published private(set) var clubs: [Club] = []

    @Published private(set) var isLoadingPosts = false
    @Published private(set) var isLoadingClubs = false

    @Published var errorMessage: String?

    var postsCount: Int { posts.count }
    var clubsCount: Int { clubs.count }

    // MARK: - Private

    private let db = Firestore.firestore()

    private var hasLoadedPosts = false
    private var hasLoadedClubs = false

    private var loadedPostsUid: String? = nil
    private var loadedClubsUid: String? = nil

    private var hasRefreshedAuthTokenForClubs = false

    // MARK: - Public (lazy + refresh)

    func loadPostsIfNeeded(uid: String) async {
        let uid = uid.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !uid.isEmpty else { return }

        if loadedPostsUid != uid {
            loadedPostsUid = uid
            hasLoadedPosts = false
            posts = []
        }
        guard !hasLoadedPosts else { return }

        errorMessage = nil
        do {
            try await loadPostsWebShape(uid: uid)
            hasLoadedPosts = true
        } catch {
            setError(error, context: "posts(authorId == \(uid)) + legacy events fallback")
        }
    }

    /// Call this ONLY when Clubs tab appears.
    /// Uses AUTH uid (membership docs store uid = auth uid).
    func loadClubsIfNeeded(uid: String) async {
        guard let authUidRaw = Auth.auth().currentUser?.uid else {
            errorMessage = "You must be signed in to load clubs."
            return
        }

        let authUid = authUidRaw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !authUid.isEmpty else {
            errorMessage = "You must be signed in to load clubs."
            return
        }

        // Cache clubs per AUTH uid
        if loadedClubsUid != authUid {
            loadedClubsUid = authUid
            hasLoadedClubs = false
            hasRefreshedAuthTokenForClubs = false
            clubs = []
        }
        guard !hasLoadedClubs else { return }

        errorMessage = nil
        do {
            try await loadClubsCollectionGroup(authUid: authUid)
            hasLoadedClubs = true
        } catch {
            setError(error, context: "clubs: collectionGroup(members).where(uid==\(authUid)) -> GET clubs/{clubId}")
        }
    }

    /// Pull-to-refresh: refetch ONLY the active tab.
    /// Assumes your tabs are: 0 Posts, 1 Events, 2 Comments, 3 Clubs (adjust if different).
    func refresh(uid: String, tab: Int) async {
        let uid = uid.trimmingCharacters(in: .whitespacesAndNewlines)
        errorMessage = nil

        switch tab {
        case 3: // Clubs tab index (adjust if yours is different)
            loadedClubsUid = nil
            hasLoadedClubs = false
            hasRefreshedAuthTokenForClubs = false
            clubs = []
            await loadClubsIfNeeded(uid: uid)

        default:
            guard !uid.isEmpty else { return }
            loadedPostsUid = uid
            hasLoadedPosts = false
            posts = []
            await loadPostsIfNeeded(uid: uid)
        }
    }

    // MARK: - Diagnostics

    private func debugFirebaseIdentity(tag: String) async {
        #if DEBUG
        let app = FirebaseApp.app()
        let projectId = app?.options.projectID ?? "nil"
        let googleAppId = app?.options.googleAppID ?? "nil"
        let bundleId = Bundle.main.bundleIdentifier ?? "nil"

        let user = Auth.auth().currentUser
        let uid = user?.uid ?? "nil"

        var tokenPrefix = "nil"
        if let user {
            do {
                let token = try await getIDTokenAsync(user: user, forceRefresh: false)
                tokenPrefix = String(token.prefix(12)) + "…"
            } catch {
                tokenPrefix = "TOKEN_ERROR: \(error.localizedDescription)"
            }
        }

        print("🔎[\(tag)] projectId=\(projectId) googleAppId=\(googleAppId) bundleId=\(bundleId) uid=\(uid) token=\(tokenPrefix)")
        #endif
    }

    private struct ClubsFetchError: LocalizedError {
        enum Step { case membersQuery, clubGet(String) }
        let step: Step
        let underlying: Error

        var errorDescription: String? {
            switch step {
            case .membersQuery:
                return "Clubs fetch failed at memberships query (collectionGroup members). \(underlying.localizedDescription)"
            case .clubGet(let clubId):
                return "Clubs fetch failed at GET clubs/\(clubId). \(underlying.localizedDescription)"
            }
        }
    }

    // MARK: - Error reporting

    private func setError(_ error: Error, context: String) {
        let ns = error as NSError

        // IMPORTANT: do Firestore mapping FIRST so we don't mask index errors with LocalizedError text.
        if ns.domain == FirestoreErrorDomain {
            switch ns.code {
            case 9:
                errorMessage = "Firestore index required for this query. (FAILED_PRECONDITION) \(ns.localizedDescription)"
            case 7:
                errorMessage = "Missing or insufficient permissions for: \(context). \(ns.localizedDescription)"
            case 16:
                errorMessage = "You must be signed in. \(ns.localizedDescription)"
            default:
                errorMessage = ns.localizedDescription
            }

            #if DEBUG
            let app = FirebaseApp.app()
            let projectId = app?.options.projectID ?? "nil"
            let googleAppId = app?.options.googleAppID ?? "nil"
            let bundleId = Bundle.main.bundleIdentifier ?? "nil"
            let auid = Auth.auth().currentUser?.uid ?? "nil"
            print("Firestore error projectId=\(projectId) googleAppId=\(googleAppId) bundleId=\(bundleId) authUid=\(auid) domain=\(ns.domain) code=\(ns.code) context=\(context) msg=\(ns.localizedDescription)")
            #endif
            return
        }

        // Non-Firestore errors: prefer staged LocalizedError if present
        if let le = error as? LocalizedError,
           let msg = le.errorDescription,
           !msg.isEmpty {
            errorMessage = msg
        } else {
            errorMessage = ns.localizedDescription
        }

        #if DEBUG
        print("Error domain=\(ns.domain) code=\(ns.code) context=\(context) msg=\(ns.localizedDescription)")
        #endif
    }

    // MARK: - Clubs (collectionGroup members -> GET clubs)

    private func loadClubsCollectionGroup(authUid: String) async throws {
        guard !isLoadingClubs else { return }
        isLoadingClubs = true
        defer { isLoadingClubs = false }

        // If the user just signed in, refreshing once can avoid stale token / claims edge cases.
        try await refreshIDTokenIfNeededOnce()

        await debugFirebaseIdentity(tag: "beforeMembersQuery")

        // ✅ MUST match web: only where(uid == userId). No range/orderBy.
        let membersSnap: QuerySnapshot
        do {
            membersSnap = try await db.collectionGroup("members")
                .whereField("uid", isEqualTo: authUid)
                .limit(to: 500)
                .getDocuments()
        } catch {
            throw ClubsFetchError(step: .membersQuery, underlying: error)
        }

        // 2) Extract unique clubIds
        var clubIdsSet = Set<String>()
        clubIdsSet.reserveCapacity(membersSnap.documents.count)

        for doc in membersSnap.documents {
            let data = doc.data()

            // Prefer explicit field (your schema), fallback to path clubs/{clubId}/members/{memberId}
            let clubIdFromField = (data["clubId"] as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines)

            let clubIdFromPath = doc.reference.parent.parent?.documentID

            let clubId = (clubIdFromField?.isEmpty == false) ? clubIdFromField : clubIdFromPath
            guard let clubId, !clubId.isEmpty else { continue }

            // Status filter (keep)
            let status = ((data["status"] as? String) ?? "").lowercased()
            let approved = status.isEmpty || status == "approved" || status == "active"
            guard approved else { continue }

            clubIdsSet.insert(clubId)
        }

        let clubIds = Array(clubIdsSet)
        if clubIds.isEmpty {
            clubs = []
            return
        }

        await debugFirebaseIdentity(tag: "beforeClubGETs")

        // 3) GET each club doc (GET, not LIST)
        var fetched: [Club] = []
        fetched.reserveCapacity(clubIds.count)

        do {
            try await withThrowingTaskGroup(of: Club?.self) { group in
                for clubId in clubIds {
                    group.addTask { [db] in
                        let snap = try await db.collection("clubs").document(clubId).getDocument()
                        guard snap.exists else { return nil }
                        return try? snap.data(as: Club.self)
                    }
                }

                for try await club in group {
                    if let club { fetched.append(club) }
                }
            }
        } catch {
            throw ClubsFetchError(step: .clubGet("one-of-\(clubIds.count)"), underlying: error)
        }

        clubs = fetched.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    private func refreshIDTokenIfNeededOnce() async throws {
        guard !hasRefreshedAuthTokenForClubs else { return }
        guard let user = Auth.auth().currentUser else { return }

        _ = try await getIDTokenAsync(user: user, forceRefresh: true)
        hasRefreshedAuthTokenForClubs = true
    }

    private func getIDTokenAsync(user: User, forceRefresh: Bool) async throws -> String {
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<String, Error>) in
            user.getIDTokenForcingRefresh(forceRefresh) { token, error in
                if let error {
                    cont.resume(throwing: error)
                    return
                }
                cont.resume(returning: token ?? "")
            }
        }
    }

    // MARK: - Posts (unchanged)

    private func loadPostsWebShape(uid: String) async throws {
        guard !isLoadingPosts else { return }
        isLoadingPosts = true
        defer { isLoadingPosts = false }

        let snap = try await db.collection("posts")
            .whereField("authorId", isEqualTo: uid)
            .getDocuments()

        var out: [PostDoc] = []
        out.reserveCapacity(snap.documents.count)

        for doc in snap.documents {
            if let p = mapDocToPost(doc) { out.append(p) }
        }

        if out.isEmpty {
            let legacy = try await db.collection("events")
                .whereField("hostUserId", isEqualTo: uid)
                .getDocuments()

            let fallbackCampusId = guessCampusId(from: legacy.documents)
            for doc in legacy.documents {
                if let p = mapLegacyEventDocToPost(doc, fallbackCampusId: fallbackCampusId) {
                    out.append(p)
                }
            }
        }

        out.sort { ($0.createdAt ?? .distantPast) > ($1.createdAt ?? .distantPast) }
        posts = out
    }

    // MARK: - Mapping helpers (unchanged from your file)

    private func mapDocToPost(_ doc: QueryDocumentSnapshot) -> PostDoc? {
        let d = doc.data()

        func nonEmptyString(_ v: Any?) -> String? {
            let s = (v as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
            return (s?.isEmpty == false) ? s : nil
        }

        func pickString(_ keys: [String]) -> String? {
            for k in keys { if let s = nonEmptyString(d[k]) { return s } }
            return nil
        }

        func parseDate(_ v: Any?) -> Date? {
            if let ts = v as? Timestamp { return ts.dateValue() }
            if let date = v as? Date { return date }
            return nil
        }

        func parseInt(_ v: Any?) -> Int? {
            if let n = v as? Int { return n }
            if let n = v as? Int64 { return Int(n) }
            if let n = v as? Double { return Int(n) }
            return nil
        }

        let description =
            (d["description"] as? String)
            ?? (d["content"] as? String)
            ?? (d["text"] as? String)
            ?? ""

        let authorId =
            (d["authorId"] as? String)
            ?? (d["hostUserId"] as? String)
            ?? (d["ownerUid"] as? String)
            ?? (d["uid"] as? String)
            ?? ""
        let trimmedAuthor = authorId.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmedAuthor.isEmpty { return nil }

        let type: PostType = {
            if let raw = d["type"] as? String, let t = PostType(rawValue: raw) { return t }
            if (d["isEvent"] as? Bool) == true { return .event }
            if (d["isAnnouncement"] as? Bool) == true { return .announcement }
            return .post
        }()

        let campusId = (pickString(["campusId", "campusID"]) ?? "").trimmingCharacters(in: .whitespacesAndNewlines)

        var ownerType: PostOwnerType = {
            if let raw = d["ownerType"] as? String, let t = PostOwnerType(rawValue: raw) { return t }
            if let raw = d["ownerKind"] as? String, let t = PostOwnerType(rawValue: raw) { return t }
            if let _ = nonEmptyString(d["clubId"]) { return .club }
            if (d["isCampusPost"] as? Bool) == true { return .campus }
            return .personal
        }()

        let clubIdRaw = nonEmptyString(d["clubId"])
        let clubId: String? = (ownerType == .club) ? clubIdRaw : nil
        if ownerType == .club, clubId == nil { ownerType = .personal }

        let imageUrls: [String] = {
            if let arr = d["imageUrls"] as? [String] { return arr }
            if let arrAny = d["imageUrls"] as? [Any] {
                return arrAny.compactMap { ($0 as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) }
                    .filter { !$0.isEmpty }
            }
            if let one = nonEmptyString(d["imageUrl"]) { return [one] }
            return []
        }()

        let createdAt = parseDate(d["createdAt"]) ?? parseDate(d["created_at"])
        let editedAt = parseDate(d["editedAt"]) ?? parseDate(d["edited_at"])

        let editCount = parseInt(d["editCount"])
        let commentsCount = parseInt(d["commentsCount"])
        let repliesCommentsCount = parseInt(d["repliesCommentsCount"])
        let seenCount = parseInt(d["seenCount"])

        let likedBy: [String]? = {
            if let arr = d["likedBy"] as? [String] { return arr }
            if let dict = d["likedBy"] as? [String: Any] { return Array(dict.keys) }
            return nil
        }()

        let ownerName = pickString(["ownerName", "ownerDisplayName", "ownerLabel", "ownerTitle", "owner"])
        let ownerPhotoURL = pickString(["ownerPhotoURL", "ownerPhotoUrl", "ownerAvatarUrl", "ownerLogoUrl", "ownerImageUrl"])

        let authorUsername = pickString(["authorUsername", "username", "authorHandle"])
        let authorDisplayName = pickString(["authorDisplayName", "authorName", "displayName", "name"])
        let authorPhotoURL = pickString(["authorPhotoURL", "authorPhotoUrl", "authorAvatarUrl", "photoURL", "avatarUrl"])

        let event: PostEventLogistics? = {
            guard type == .event else { return nil }

            if let eventDict = d["event"] as? [String: Any] {
                var e = PostEventLogistics()
                if let ts = eventDict["startsAt"] as? Timestamp { e.startsAt = ts.dateValue() }
                if let dt = eventDict["startsAt"] as? Date { e.startsAt = dt }
                e.locationLabel = (eventDict["locationLabel"] as? String) ?? ""
                e.locationUrl = (eventDict["locationUrl"] as? String) ?? ""
                e.lat = eventDict["lat"] as? Double
                e.lng = eventDict["lng"] as? Double
                return e
            }

            var e = PostEventLogistics()
            if let ts = d["startsAt"] as? Timestamp { e.startsAt = ts.dateValue() }
            e.locationLabel = d["locationLabel"] as? String ?? ""
            e.locationUrl = d["locationUrl"] as? String ?? ""
            e.lat = d["lat"] as? Double
            e.lng = d["lng"] as? Double
            return e
        }()

        return PostDoc(
            id: doc.documentID,
            ownerType: ownerType,
            campusId: campusId,
            clubId: clubId,
            description: description,
            authorId: trimmedAuthor,
            type: type,
            imageUrls: imageUrls,
            ownerName: ownerName,
            ownerPhotoURL: ownerPhotoURL,
            authorUsername: authorUsername,
            authorDisplayName: authorDisplayName,
            authorPhotoURL: authorPhotoURL,
            createdAt: createdAt,
            editedAt: editedAt,
            editCount: editCount,
            commentsCount: commentsCount,
            repliesCommentsCount: repliesCommentsCount,
            seenCount: seenCount,
            likedBy: likedBy,
            event: event
        )
    }

    private func mapLegacyEventDocToPost(_ doc: QueryDocumentSnapshot, fallbackCampusId: String) -> PostDoc? {
        let d = doc.data()

        func nonEmptyString(_ v: Any?) -> String? {
            let s = (v as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
            return (s?.isEmpty == false) ? s : nil
        }

        func pickString(_ keys: [String]) -> String? {
            for k in keys { if let s = nonEmptyString(d[k]) { return s } }
            return nil
        }

        let authorId =
            (d["hostUserId"] as? String)
            ?? (d["authorId"] as? String)
            ?? (d["uid"] as? String)
            ?? ""
        let trimmedAuthor = authorId.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmedAuthor.isEmpty { return nil }

        let campusId = (pickString(["campusId", "campusID"]) ?? fallbackCampusId)
            .trimmingCharacters(in: .whitespacesAndNewlines)

        let description =
            (d["description"] as? String)
            ?? (d["content"] as? String)
            ?? (d["text"] as? String)
            ?? (d["title"] as? String)
            ?? ""

        let createdAt =
            (d["createdAt"] as? Timestamp)?.dateValue()
            ?? (d["created_at"] as? Timestamp)?.dateValue()

        let ownerName = pickString(["ownerName", "hostName", "name", "displayName"])
        let ownerPhotoURL = pickString(["ownerPhotoURL", "photoURL", "avatarUrl"])

        var e = PostEventLogistics()
        if let ts = d["startsAt"] as? Timestamp { e.startsAt = ts.dateValue() }
        if let ts = d["startTime"] as? Timestamp { e.startsAt = ts.dateValue() }
        e.locationLabel = (d["locationLabel"] as? String) ?? (d["location"] as? String) ?? ""
        e.locationUrl = (d["locationUrl"] as? String) ?? ""
        e.lat = d["lat"] as? Double
        e.lng = d["lng"] as? Double

        return PostDoc(
            id: doc.documentID,
            ownerType: .personal,
            campusId: campusId,
            clubId: nil,
            description: description,
            authorId: trimmedAuthor,
            type: .event,
            imageUrls: [],
            ownerName: ownerName,
            ownerPhotoURL: ownerPhotoURL,
            authorUsername: nil,
            authorDisplayName: nil,
            authorPhotoURL: nil,
            createdAt: createdAt,
            editedAt: nil,
            editCount: nil,
            commentsCount: nil,
            repliesCommentsCount: nil,
            seenCount: nil,
            likedBy: nil,
            event: e
        )
    }

    private func guessCampusId(from docs: [QueryDocumentSnapshot]) -> String {
        for doc in docs {
            if let c = doc.data()["campusId"] as? String,
               !c.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                return c.trimmingCharacters(in: .whitespacesAndNewlines)
            }
        }
        return ""
    }
}

// MARK: - Firestore helpers

private extension Array {
    func chunkedForFirestoreIn(_ size: Int) -> [[Element]] {
        guard size > 0 else { return [self] }
        var result: [[Element]] = []
        result.reserveCapacity((count + size - 1) / size)

        var i = 0
        while i < count {
            result.append(Array(self[i..<Swift.min(i + size, count)]))
            i += size
        }
        return result
    }
}
