//
//  FeedViewModel.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/14/26.
//

import SwiftUI
import Combine
import FirebaseFirestore
import FirebaseAuth

@MainActor
final class FeedViewModel: ObservableObject {

    @Published private(set) var posts: [PostDoc] = []
    @Published private(set) var isLoadingInitial = false
    @Published private(set) var isLoadingMore = false
    @Published private(set) var hasMore = true
    @Published var errorMessage: String?

    private let db = Firestore.firestore()
    private let auth = Auth.auth()

    private let POSTS_PER_PAGE = 15
    private let TODAYS_EVENTS_CAP = 50

    private var lastDoc: DocumentSnapshot?
    private var profileStore: ProfileStore
    private var cancellables: Set<AnyCancellable> = []

    init(profileStore: ProfileStore) {
        self.profileStore = profileStore
        bindCampusRefresh()
    }

    func refresh() async {
        posts = []
        lastDoc = nil
        hasMore = true
        errorMessage = nil
        await loadInitial()
    }

    // MARK: - Initial Load (keep current query shape)

    func loadInitial() async {
        guard !isLoadingInitial else { return }
        guard let campusId = profileStore.profile?.campusId, !campusId.isEmpty else { return }

        isLoadingInitial = true
        defer { isLoadingInitial = false }

        do {
            let today = Self.todayYYYYMMDD()

            // 1) Today's events (pinned)
            let todays = try await fetchTodaysEvents(today: today, campusId: campusId)

            // 2) Main timeline (first page) — keep current query: orderBy(createdAt desc) + limit + cursor
            let (batch, newLast) = try await fetchChronologicalBatch(
                campusId: campusId,
                startAfter: nil
            )

            posts = mergeDedupSort(todays: todays, main: batch)
            lastDoc = newLast
            hasMore = (batch.count == POSTS_PER_PAGE)

        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Fetch More

    func fetchMore() async {
        guard hasMore, !isLoadingMore else { return }
        guard let campusId = profileStore.profile?.campusId, !campusId.isEmpty else { return }

        isLoadingMore = true
        defer { isLoadingMore = false }

        do {
            let (batch, newLast) = try await fetchChronologicalBatch(
                campusId: campusId,
                startAfter: lastDoc
            )

            if batch.isEmpty {
                hasMore = false
                return
            }

            var seen = Set(posts.map(\.id))
            var appended: [PostDoc] = []
            appended.reserveCapacity(batch.count)

            for p in batch where !seen.contains(p.id) {
                seen.insert(p.id)
                appended.append(p)
            }

            posts = (posts + appended).sorted(by: Self.sortNewestFirst)
            lastDoc = newLast
            hasMore = (batch.count == POSTS_PER_PAGE)

        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Campus refresh binding

    private func bindCampusRefresh() {
        profileStore.$profile
            .map { $0?.campusId }
            .removeDuplicates()
            .sink { [weak self] _ in
                guard let self else { return }
                Task { await self.refresh() }
            }
            .store(in: &cancellables)
    }

    // MARK: - Firestore Queries

    private func postsCol() -> CollectionReference { db.collection("posts") }

    private func fetchTodaysEvents(today: String, campusId: String) async throws -> [PostDoc] {
        // NOTE: still filtering by campusId; this is your feed scope field
        var q: Query = postsCol()
            .whereField("campusId", isEqualTo: campusId)
            .whereField("type", isEqualTo: PostType.event.rawValue)
            .whereField("date", isEqualTo: today)
            .limit(to: TODAYS_EVENTS_CAP)

        let snap = try await q.getDocuments()
        let mapped = snap.documents.compactMap(mapDocToPost(_:))
        return mapped.sorted(by: Self.sortNewestFirst)
    }

    /// KEEP CURRENT QUERY: orderBy createdAt desc + limit + cursor
    /// Campus scoping stays on campusId (feed scope), ownerId is only ownership.
    private func fetchChronologicalBatch(
        campusId: String,
        startAfter: DocumentSnapshot?
    ) async throws -> ([PostDoc], DocumentSnapshot?) {

        var q: Query = postsCol()
            .whereField("campusId", isEqualTo: campusId)
            .order(by: "createdAt", descending: true)
            .limit(to: POSTS_PER_PAGE)

        if let startAfter { q = q.start(afterDocument: startAfter) }

        let snap = try await q.getDocuments()
        let mapped = snap.documents.compactMap(mapDocToPost(_:))
        return (mapped, snap.documents.last)
    }

    // MARK: - Merge / Sort

    private func mergeDedupSort(todays: [PostDoc], main: [PostDoc]) -> [PostDoc] {
        var seen = Set<String>()
        var out: [PostDoc] = []
        out.reserveCapacity(todays.count + main.count)

        for p in todays where !seen.contains(p.id) { seen.insert(p.id); out.append(p) }
        for p in main where !seen.contains(p.id) { seen.insert(p.id); out.append(p) }

        out.sort(by: Self.sortNewestFirst)
        return out
    }

    private static func sortNewestFirst(_ a: PostDoc, _ b: PostDoc) -> Bool {
        (a.createdAt ?? .distantPast) > (b.createdAt ?? .distantPast)
    }

    private static func todayYYYYMMDD() -> String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = .current
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date())
    }

    // MARK: - Firestore -> PostDoc (updated to new PostDoc + ownerType/ownerId)

    private func mapDocToPost(_ doc: QueryDocumentSnapshot) -> PostDoc? {
        let d = doc.data()

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

        if authorId.isEmpty { return nil }

        let type: PostType = {
            if let raw = d["type"] as? String, let t = PostType(rawValue: raw) { return t }
            if (d["isEvent"] as? Bool) == true { return .event }
            if (d["isAnnouncement"] as? Bool) == true { return .announcement }
            return .post
        }()

        // feed scoping stays on campusId
        let campusId = (d["campusId"] as? String) ?? ""

        // ownerType + ownerId
        let ownerType: PostOwnerType = {
            if let raw = d["ownerType"] as? String, let t = PostOwnerType(rawValue: raw) { return t }

            // legacy inference:
            if let raw = d["ownerKind"] as? String, let t = PostOwnerType(rawValue: raw) { return t }
            if d["clubId"] != nil { return .club }
            if d["campusId"] != nil, d["clubId"] == nil, (d["isCampusPost"] as? Bool) == true { return .campus }
            return .personal
        }()

        let ownerId: String = {
            if let s = d["ownerId"] as? String, !s.isEmpty { return s }

            // legacy fallbacks:
            if ownerType == .club, let s = d["clubId"] as? String, !s.isEmpty { return s }
            if ownerType == .campus, !campusId.isEmpty { return campusId } // campus owner defaults to campusId
            return authorId // personal owner defaults to author
        }()

        let imageUrls: [String] = {
            if let arr = d["imageUrls"] as? [String] { return arr }
            if let one = d["imageUrl"] as? String, !one.isEmpty { return [one] }
            return []
        }()

        let createdAt =
            (d["createdAt"] as? Timestamp)?.dateValue()
            ?? (d["created_at"] as? Timestamp)?.dateValue()

        let editedAt =
            (d["editedAt"] as? Timestamp)?.dateValue()
            ?? (d["edited_at"] as? Timestamp)?.dateValue()

        let editCount: Int? = {
            if let n = d["editCount"] as? Int { return n }
            if let n = d["editCount"] as? Int64 { return Int(n) }
            if let n = d["editCount"] as? Double { return Int(n) }
            return nil
        }()

        func intOpt(_ key: String) -> Int? {
            if let n = d[key] as? Int { return n }
            if let n = d[key] as? Int64 { return Int(n) }
            if let n = d[key] as? Double { return Int(n) }
            return nil
        }

        let commentsCount = intOpt("commentsCount")
        let repliesCommentsCount = intOpt("repliesCommentsCount")
        let seenCount = intOpt("seenCount")

        let likes = d["likes"] as? [String]
        let seenBy = d["seenBy"] as? [String]

        let event: PostEventLogistics? = {
            guard type == .event else { return nil }

            // either nested map `event` or top-level `startsAt` etc.
            if let eventDict = d["event"] as? [String: Any] {
                var e = PostEventLogistics()
                if let ts = eventDict["startsAt"] as? Timestamp { e.startsAt = ts.dateValue() }
                e.locationLabel = eventDict["locationLabel"] as? String ?? ""
                e.lat = eventDict["lat"] as? Double
                e.lng = eventDict["lng"] as? Double
                return e
            }

            var e = PostEventLogistics()
            if let ts = d["startsAt"] as? Timestamp { e.startsAt = ts.dateValue() }
            e.locationLabel = d["locationLabel"] as? String ?? ""
            e.lat = d["lat"] as? Double
            e.lng = d["lng"] as? Double
            return e
        }()

        return PostDoc(
            id: doc.documentID,
            ownerType: ownerType,
            ownerId: ownerId,
            description: description,
            authorId: authorId,
            type: type,
            imageUrls: imageUrls,
            createdAt: createdAt,
            editedAt: editedAt,
            editCount: editCount,
            commentsCount: commentsCount,
            repliesCommentsCount: repliesCommentsCount,
            seenCount: seenCount,
            likes: likes,
            seenBy: seenBy,
            event: event
        )
    }
}
