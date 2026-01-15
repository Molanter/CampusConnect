//
//  FeedViewModel.swift
//  CampusConnect
//
//  Firestore feed implementation mirroring useFeed:
//
//  WHAT WE USE TO FETCH
//   - collection("posts")
//   - query + where + orderBy + limit
//
//  ORDER
//   - Initial: Today's events pinned first (date == today)
//   - Then: main timeline by createdAt desc
//   - Final: merged list sorted by createdAt (newest first)
//
//  BATCH SIZES
//   - POSTS_PER_PAGE = 15 (timeline)
//   - TODAYS_EVENTS_CAP = 50
//
//  INFINITE SCROLL
//   - Cursor pagination via lastDoc (DocumentSnapshot)
//   - startAfter(lastDoc) to fetch next page
//   - If returned < 15 => hasMore = false
//
//  VISIBILITY
//   - "visible" or missing => show
//   - "under_review" => only author
//   - "hidden" => never
//

import Foundation
import FirebaseFirestore
import FirebaseAuth

@MainActor
final class FeedViewModel: ObservableObject {

    // Output: unified model only
    @Published private(set) var posts: [PostDoc] = []

    @Published private(set) var isLoadingInitial = false
    @Published private(set) var isLoadingMore = false
    @Published private(set) var hasMore = true
    @Published var errorMessage: String?

    // UI-friendly metadata (optional; if you store these on post docs, you can remove these maps)
    private(set) var ownerLabelByPostId: [String: String] = [:]
    private(set) var ownerPhotoByPostId: [String: String] = [:]
    private(set) var ownerIsDormByPostId: [String: Bool] = [:]
    private(set) var usernameByPostId: [String: String] = [:]
    private(set) var authorUsernameByPostId: [String: String] = [:]

    // Moderation field is not in PostDoc, so we cache it for filtering
    private var visibilityByPostId: [String: String?] = [:]

    private let db = Firestore.firestore()
    private let auth = Auth.auth()

    private let POSTS_PER_PAGE = 15
    private let TODAYS_EVENTS_CAP = 50

    private var lastDoc: DocumentSnapshot?
    private var context: FeedContext

    init(context: FeedContext) {
        self.context = context
    }

    func setContext(_ newContext: FeedContext) {
        guard newContext != context else { return }
        context = newContext
        Task { await refresh() }
    }

    func refresh() async {
        posts = []
        lastDoc = nil
        hasMore = true
        errorMessage = nil

        ownerLabelByPostId = [:]
        ownerPhotoByPostId = [:]
        ownerIsDormByPostId = [:]
        usernameByPostId = [:]
        authorUsernameByPostId = [:]
        visibilityByPostId = [:]

        await loadInitial()
    }

    // MARK: - Initial Load (Layered Fetch)

    func loadInitial() async {
        guard !isLoadingInitial else { return }
        isLoadingInitial = true
        defer { isLoadingInitial = false }

        do {
            let today = Self.todayYYYYMMDD()

            // 1) Today's events (pinned)
            let todays = try await fetchTodaysEvents(today: today)

            // 2) Main timeline (first page)
            let (batch, newLast) = try await fetchChronologicalBatch(startAfter: nil)

            // Merge + dedupe + final sort
            posts = mergeDedupSort(todays: todays, main: batch)
            lastDoc = newLast
            hasMore = (batch.count == POSTS_PER_PAGE)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Fetch More (Cursor pagination)

    func fetchMore() async {
        guard hasMore, !isLoadingMore else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }

        do {
            let (batch, newLast) = try await fetchChronologicalBatch(startAfter: lastDoc)

            if batch.isEmpty {
                hasMore = false
                return
            }

            // Dedup against current list
            var seen = Set(posts.map(\.id))
            var appended: [PostDoc] = []
            appended.reserveCapacity(batch.count)

            for p in batch where !seen.contains(p.id) {
                seen.insert(p.id)
                appended.append(p)
            }

            posts = (posts + appended).sorted(by: Self.sortNewestFirst)
            lastDoc = newLast

            // Stop if fewer than page size returned
            hasMore = (batch.count == POSTS_PER_PAGE)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Firestore Queries

    private func postsCol() -> CollectionReference { db.collection("posts") }

    private func applyContextFilters(_ q: Query) -> Query {
        switch context {
        case .main(let campusId):
            return q.whereField("campusId", isEqualTo: campusId)

        case .profile(let campusId, let targetUserId):
            return q
                .whereField("campusId", isEqualTo: campusId)
                .whereField("authorId", isEqualTo: targetUserId)

        case .club(let campusId, let clubId):
            // club feed: only posts "as club" for that club
            return q
                .whereField("campusId", isEqualTo: campusId)
                .whereField("ownerType", isEqualTo: PostOwnerType.club.rawValue)
                .whereField("ownerId", isEqualTo: clubId)
        }
    }

    /// Today's pinned events: where date == today (yyyy-MM-dd), cap at 50
    private func fetchTodaysEvents(today: String) async throws -> [PostDoc] {
        var q: Query = postsCol()
        q = applyContextFilters(q)
        q = q.whereField("type", isEqualTo: PostType.event.rawValue)
        q = q.whereField("date", isEqualTo: today) // matches your useFeed overview
        q = q.order(by: "createdAt", descending: true)
        q = q.limit(to: TODAYS_EVENTS_CAP)

        let snap = try await q.getDocuments()
        let mapped = snap.documents.compactMap(mapDocToPost(_:))
        return applyVisibilityFilters(mapped)
    }

    /// Main chronological feed: orderBy(createdAt desc), limit 15, startAfter(lastDoc) for pagination
    private func fetchChronologicalBatch(startAfter: DocumentSnapshot?) async throws -> ([PostDoc], DocumentSnapshot?) {
        var q: Query = postsCol()
        q = applyContextFilters(q)
        q = q.order(by: "createdAt", descending: true)
        q = q.limit(to: POSTS_PER_PAGE)

        if let startAfter { q = q.start(afterDocument: startAfter) }

        let snap = try await q.getDocuments()
        let mapped = snap.documents.compactMap(mapDocToPost(_:))
        let filtered = applyVisibilityFilters(mapped)

        return (filtered, snap.documents.last)
    }

    // MARK: - Visibility / Moderation

    private func visibility(for postId: String) -> String? { visibilityByPostId[postId] ?? nil }

    private func applyVisibilityFilters(_ input: [PostDoc]) -> [PostDoc] {
        let uid = auth.currentUser?.uid

        return input.filter { post in
            let vis = visibility(for: post.id) // "visible" | "under_review" | "hidden" | nil(legacy)

            if vis == "hidden" { return false }
            if vis == "visible" || vis == nil { return true }
            if vis == "under_review" { return (uid != nil && uid == post.authorId) }
            return false
        }
    }

    // MARK: - Merge / Dedup / Final Sort

    private func mergeDedupSort(todays: [PostDoc], main: [PostDoc]) -> [PostDoc] {
        var seen = Set<String>()
        var out: [PostDoc] = []
        out.reserveCapacity(todays.count + main.count)

        for p in todays where !seen.contains(p.id) {
            seen.insert(p.id)
            out.append(p)
        }
        for p in main where !seen.contains(p.id) {
            seen.insert(p.id)
            out.append(p)
        }

        out.sort(by: Self.sortNewestFirst)
        return out
    }

    private static func sortNewestFirst(_ a: PostDoc, _ b: PostDoc) -> Bool {
        (a.createdAt ?? .distantPast) > (b.createdAt ?? .distantPast)
    }

    // MARK: - Firestore -> PostDoc (translation layer like mapDocToPost)

    private func mapDocToPost(_ doc: QueryDocumentSnapshot) -> PostDoc? {
        let d = doc.data()

        // Required fields for PostDoc
        guard
            let description = d["description"] as? String,
            let authorId = d["authorId"] as? String,
            let ownerTypeRaw = d["ownerType"] as? String,
            let ownerType = PostOwnerType(rawValue: ownerTypeRaw),
            let ownerId = d["ownerId"] as? String,
            let typeRaw = d["type"] as? String,
            let type = PostType(rawValue: typeRaw),
            let campusId = d["campusId"] as? String
        else { return nil }

        // Normalize imageUrls: [String] OR legacy imageUrl: String
        let imageUrls: [String] = {
            if let arr = d["imageUrls"] as? [String] { return arr }
            if let one = d["imageUrl"] as? String { return [one] }
            return []
        }()

        let createdAt = (d["createdAt"] as? Timestamp)?.dateValue()
        let editedAt = (d["editedAt"] as? Timestamp)?.dateValue()

        let editCount: Int? = {
            if let n = d["editCount"] as? Int { return n }
            if let n = d["editCount"] as? Int64 { return Int(n) }
            if let n = d["editCount"] as? Double { return Int(n) }
            return nil
        }()

        // Event
        let event: PostEventLogistics? = {
            guard type == .event else { return nil }
            guard let eventDict = d["event"] as? [String: Any] else { return PostEventLogistics() }

            var e = PostEventLogistics()
            if let ts = eventDict["startsAt"] as? Timestamp { e.startsAt = ts.dateValue() }
            e.locationLabel = eventDict["locationLabel"] as? String ?? ""
            e.locationUrl = eventDict["locationUrl"] as? String ?? ""
            e.lat = eventDict["lat"] as? Double
            e.lng = eventDict["lng"] as? Double
            return e
        }()

        // Cache moderation fields (not part of PostDoc currently)
        visibilityByPostId[doc.documentID] = d["visibility"] as? String

        // Optional UI convenience caches (only if stored on the post doc)
        if let label = d["ownerLabel"] as? String { ownerLabelByPostId[doc.documentID] = label }
        if let photo = d["ownerPhotoURL"] as? String { ownerPhotoByPostId[doc.documentID] = photo }
        if let isDorm = d["isDorm"] as? Bool { ownerIsDormByPostId[doc.documentID] = isDorm }
        if let u = d["username"] as? String { usernameByPostId[doc.documentID] = u }
        if let au = d["authorUsername"] as? String { authorUsernameByPostId[doc.documentID] = au }

        return PostDoc(
            id: doc.documentID,
            description: description,
            authorId: authorId,
            ownerType: ownerType,
            ownerId: ownerId,
            type: type,
            imageUrls: imageUrls,
            campusId: campusId,
            createdAt: createdAt,
            editedAt: editedAt,
            editCount: editCount,
            event: event
        )
    }

    // MARK: - Date helper

    private static func todayYYYYMMDD() -> String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = .current
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date())
    }
}