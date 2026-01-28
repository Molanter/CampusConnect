//
//  PostCardVM.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/14/26.
//

import SwiftUI
import Combine

@MainActor
final class PostCardVM: ObservableObject {

    @Published private(set) var ownerName: String = "Unknown"
    @Published private(set) var ownerPhotoURL: String? = nil
    @Published private(set) var ownerVerified: Bool = false
    @Published private(set) var ownerIsDorm: Bool = false

    @Published private(set) var authorUsername: String? = nil
    @Published private(set) var authorDisplayName: String? = nil
    @Published private(set) var authorPhotoURL: String? = nil

    @Published private(set) var likeCount: Int = 0
    @Published private(set) var isLikedByMe: Bool = false

    private let cache = PostCardCache.shared

    // ✅ DI for Club reads (fixes instance-method error)
    private let clubService: ClubService

    init(clubService: ClubService = ClubServiceFS()) {
        self.clubService = clubService
    }

    func load(post: PostDoc, currentUidForLikeState: String? = nil) async {
        // 1) Apply denormalized fields immediately (fast UI)
        applyDenormalizedIfPresent(post: post)

        // 2) Likes seed
        if let uid = currentUidForLikeState {
            applyLikes(from: post, currentUid: uid)
        } else {
            likeCount = post.likedBy?.count ?? 0
            isLikedByMe = false
        }

        // 3) No fetching. Fill minimal fallbacks only.
        let nameEmpty = ownerName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || ownerName == "Unknown"
        let photoEmpty = ownerPhotoURL?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty != false

        switch post.ownerType {
        case .personal:
            // For personal posts, owner should match author snapshot if present.
            if nameEmpty {
                if let aName = authorDisplayName?.trimmingCharacters(in: .whitespacesAndNewlines),
                   !aName.isEmpty {
                    ownerName = aName
                } else {
                    ownerName = "Unknown"
                }
            }
            if photoEmpty {
                // If owner photo is missing, fall back to author photo if present.
                if let aPhoto = authorPhotoURL?.trimmingCharacters(in: .whitespacesAndNewlines),
                   !aPhoto.isEmpty {
                    ownerPhotoURL = aPhoto
                } else {
                    ownerPhotoURL = nil
                }
            }

        case .club:
            if nameEmpty { ownerName = "Club" }
            if photoEmpty { ownerPhotoURL = nil }

        case .campus:
            if nameEmpty { ownerName = "Campus" }
            if photoEmpty { ownerPhotoURL = nil }
        }

        // No reads → default these unless you denormalize them too.
        ownerVerified = false
        ownerIsDorm = false
    }

    // MARK: - Denormalized fast-path

    private func applyDenormalizedIfPresent(post: PostDoc) {
        // owner snapshot
        let oName = post.ownerName?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let oName, !oName.isEmpty { ownerName = oName }

        let oPhoto = post.ownerPhotoURL?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let oPhoto, !oPhoto.isEmpty { ownerPhotoURL = oPhoto }

        // author snapshot (NO fetch if missing)
        let aUser = post.authorUsername?.trimmingCharacters(in: .whitespacesAndNewlines)
        authorUsername = (aUser?.isEmpty == false) ? aUser : nil

        let aName = post.authorDisplayName?.trimmingCharacters(in: .whitespacesAndNewlines)
        authorDisplayName = (aName?.isEmpty == false) ? aName : nil

        let aPhoto = post.authorPhotoURL?.trimmingCharacters(in: .whitespacesAndNewlines)
        authorPhotoURL = (aPhoto?.isEmpty == false) ? aPhoto : nil

        // Keep as-is (unless you denormalize these later)
        ownerVerified = false
        ownerIsDorm = false
    }

    // MARK: - Field helpers

    private func applyOwnerFromAuthor(_ a: UserProfile?) {
        ownerName = (a?.displayName.isEmpty == false) ? (a?.displayName ?? "Unknown") : "Unknown"
        ownerPhotoURL = a?.photoURL
        ownerVerified = false
        ownerIsDorm = false
    }

    private func applyAuthorFields(_ a: UserProfile?) {
        authorUsername = (a?.username.isEmpty == false) ? a?.username : nil
        authorDisplayName = (a?.displayName.isEmpty == false) ? a?.displayName : nil
        authorPhotoURL = a?.photoURL
    }

    // MARK: - Likes

    func applyLikes(from post: PostDoc, currentUid: String) {
        likeCount = post.likedBy?.count ?? 0
        isLikedByMe = post.likedBy?.contains(currentUid) ?? false
    }

    func toggleLike(postId: String, currentUid: String) async {
        guard !postId.isEmpty, !currentUid.isEmpty else { return }

        let next = !isLikedByMe

        isLikedByMe = next
        likeCount = max(0, likeCount + (next ? 1 : -1))

        do {
            try await PostServiceFS.setLike(postId: postId, uid: currentUid, isLiked: next)
        } catch {
            isLikedByMe.toggle()
            likeCount = max(0, likeCount + (next ? -1 : 1))
        }
    }

    // MARK: - Fetchers

    private func fetchAuthor(_ uid: String) async -> UserProfile? {
        guard !uid.isEmpty else { return nil }
        if let cached = await cache.profile(uid) { return cached }

        do {
            let p = try await ProfileServiceFS.fetchProfile(uid: uid)
            await cache.storeProfile(p, for: uid)
            return p
        } catch {
            return nil
        }
    }

    private func fetchClub(_ id: String?) async -> Club? {
        guard let id, !id.isEmpty else { return nil }
        if let cached = await cache.club(id) { return cached }

        do {
            let c = try await clubService.fetchClub(id: id) // ✅ fixed
            await cache.storeClub(c, for: id)
            return c
        } catch {
            return nil
        }
    }

    private func fetchCampus(_ id: String) async -> Campus? {
        guard !id.isEmpty else { return nil }
        if let cached = await cache.campus(id) { return cached }

        do {
            let c = try await CampusServiceFS.fetchCampus(id: id)
            await cache.storeCampus(c, for: id)
            return c
        } catch {
            return nil
        }
    }
}

// MARK: - Concurrency-safe cache

actor PostCardCache {
    static let shared = PostCardCache()

    private var profileCache: [String: UserProfile] = [:]
    private var clubCache: [String: Club] = [:]
    private var campusCache: [String: Campus] = [:]

    func profile(_ uid: String) -> UserProfile? { profileCache[uid] }
    func club(_ id: String) -> Club? { clubCache[id] }
    func campus(_ id: String) -> Campus? { campusCache[id] }

    func storeProfile(_ p: UserProfile, for uid: String) { profileCache[uid] = p }
    func storeClub(_ c: Club, for id: String) { clubCache[id] = c }
    func storeCampus(_ c: Campus, for id: String) { campusCache[id] = c }
}
