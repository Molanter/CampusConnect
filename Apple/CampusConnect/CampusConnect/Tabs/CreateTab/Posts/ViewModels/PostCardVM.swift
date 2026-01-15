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

    private static var profileCache: [String: UserProfile] = [:]
    private static var clubCache: [String: Club] = [:]
    private static var campusCache: [String: Campus] = [:]

    func load(post: PostDoc) async {
        async let author = fetchAuthor(post.authorId)

        switch post.ownerType {
        case .personal:
            let a = await author

            ownerName = (a?.displayName.isEmpty == false) ? a!.displayName : "Unknown"
            ownerPhotoURL = a?.photoURL
            ownerVerified = false
            ownerIsDorm = false

            authorUsername = (a?.username.isEmpty == false) ? a?.username : nil
            authorDisplayName = a?.displayName
            authorPhotoURL = a?.photoURL

        case .club:
            async let club = fetchClub(post.ownerId)
            let (a, c) = await (author, club)

            ownerName = (c?.name.isEmpty == false) ? c!.name : "Club"
            ownerPhotoURL = c?.logoUrl

            // ✅ Verified logic for clubs
            // Prefer explicit isVerified, also support verificationStatus == "approved" if present in model.
            ownerVerified = {
                if let isV = c?.isVerified { return isV }
                if let status = c?.verificationStatus?.lowercased() { return status == "approved" }
                return false
            }()

            ownerIsDorm = false

            authorUsername = (a?.username.isEmpty == false) ? a?.username : nil
            authorDisplayName = a?.displayName
            authorPhotoURL = a?.photoURL

        case .campus:
            async let campus = fetchCampus(post.ownerId)
            let (a, c) = await (author, campus)

            ownerName = (c?.name.isEmpty == false) ? c!.name : "Campus"
            ownerPhotoURL = c?.logoUrl

            // ✅ Verified logic for campuses
            // Do NOT default to true. Only show checkmark when verified/university.
            ownerVerified = {
                if let isUni = c?.isUniversity, isUni { return true }
                // If you later add verificationStatus/isVerified into Campus model, include them here.
                return false
            }()

            ownerIsDorm = false

            authorUsername = (a?.username.isEmpty == false) ? a?.username : nil
            authorDisplayName = a?.displayName
            authorPhotoURL = a?.photoURL
        }
    }

    private func fetchAuthor(_ uid: String) async -> UserProfile? {
        guard !uid.isEmpty else { return nil }
        if let cached = Self.profileCache[uid] { return cached }
        do {
            let p = try await ProfileServiceFS.fetchProfile(uid: uid)
            Self.profileCache[uid] = p
            return p
        } catch { return nil }
    }

    private func fetchClub(_ id: String) async -> Club? {
        guard !id.isEmpty else { return nil }
        if let cached = Self.clubCache[id] { return cached }
        do {
            let c = try await ClubServiceFS.fetchClub(id: id)
            Self.clubCache[id] = c
            return c
        } catch { return nil }
    }

    private func fetchCampus(_ id: String) async -> Campus? {
        guard !id.isEmpty else { return nil }
        if let cached = Self.campusCache[id] { return cached }
        do {
            let c = try await CampusServiceFS.fetchCampus(id: id)
            Self.campusCache[id] = c
            return c
        } catch { return nil }
    }
}
