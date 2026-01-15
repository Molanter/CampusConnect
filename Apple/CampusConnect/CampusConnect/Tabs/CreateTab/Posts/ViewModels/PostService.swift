//
//  PostService.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/13/26.
//


import SwiftUI
import Combine
import UIKit
import FirebaseAuth
import FirebaseFirestore
import FirebaseStorage

struct PostAsIdentity: Identifiable, Equatable {
    let id: String
    let ownerType: PostOwnerType
    let ownerId: String
    let label: String
    let photoURL: String?
    let isDorm: Bool
    let isVerified: Bool
}

@MainActor
final class PostEditorVM: ObservableObject {

    enum EditorError: LocalizedError {
        case notSignedIn
        case missingCampusId
        case wordLimitExceeded
        case noPermission

        var errorDescription: String? {
            switch self {
            case .notSignedIn: return "Not signed in."
            case .missingCampusId: return "Missing campusId."
            case .wordLimitExceeded: return "Description is over 300 words."
            case .noPermission: return "You don’t have permission to edit this post."
            }
        }
    }

    @Published private(set) var identities: [PostAsIdentity] = []
    @Published private(set) var isLoadingIdentities = false
    @Published private(set) var isSaving = false
    @Published var errorMessage: String?

    private let db = Firestore.firestore()
    private let storage = Storage.storage()

    // MARK: - Public

    func loadPostAsIdentities(
        uid: String,
        campusId: String?
    ) async {
        guard !isLoadingIdentities else { return }
        isLoadingIdentities = true
        defer { isLoadingIdentities = false }

        var out: [PostAsIdentity] = []

        // 1) Fetch user (for personal identity)
        guard let userSnap = try? await db.collection("users").document(uid).getDocument(),
              let userData = userSnap.data()
        else {
            identities = []
            return
        }

        let displayName =
            (userData["displayName"] as? String)
            ?? (userData["name"] as? String)
            ?? (userData["username"] as? String)
            ?? "Me"

        let userPhoto = userData["photoURL"] as? String

        // Personal identity (always)
        out.append(
            PostAsIdentity(
                id: "personal:\(uid)",
                ownerType: .personal,
                ownerId: uid,
                label: displayName,
                photoURL: userPhoto,
                isDorm: false,
                isVerified: false
            )
        )

        // 2) Campus identity (if campusId exists)
        let campusId = (campusId ?? "").trimmed
        if !campusId.isEmpty,
           let campusSnap = try? await db.collection("campuses").document(campusId).getDocument(),
           let campus = campusSnap.data()
        {
            let campusName = (campus["name"] as? String) ?? "Campus"
            let campusLogo =
                (campus["logoUrl"] as? String)
                ?? (campus["avatarUrl"] as? String)

            let isVerified =
                (campus["verificationStatus"] as? String) == "approved"
                || (campus["isVerified"] as? Bool) == true
                || (campus["isUniversity"] as? Bool) == true

            out.append(
                PostAsIdentity(
                    id: "campus:\(campusId)",
                    ownerType: .campus,
                    ownerId: campusId,
                    label: campusName,
                    photoURL: campusLogo,
                    isDorm: false,
                    isVerified: isVerified
                )
            )
        }

        // 3) Clubs user can post as (owner/admin OR allowMemberPosts)
        let emailLower = (userData["email"] as? String ?? "").trimmed.lowercased()

        let clubSnaps = try? await db.collection("clubs")
            .whereField("memberIds", arrayContains: uid)
            .getDocuments()

        for doc in clubSnaps?.documents ?? [] {
            let clubId = doc.documentID
            let club = doc.data()

            // 🔑 Resolve membership flexibly
            guard let member = await fetchMemberDataByDocId(
                clubId: clubId,
                uid: uid,
                emailLower: emailLower
            ) else { continue }

            // Status check
            let status = ((member["status"] as? String) ?? "").lowercased()
            let approved = status.isEmpty || status == "approved" || status == "active"
            guard approved else { continue }

            let role = ((member["role"] as? String) ?? "member").lowercased()
            let allowMemberPosts = (club["allowMemberPosts"] as? Bool) == true

            // ✅ FINAL RULE
            let canPost =
                role == "owner"
                || role == "admin"
                || allowMemberPosts

            guard canPost else { continue }

            out.append(
                PostAsIdentity(
                    id: "club:\(clubId)",
                    ownerType: .club,
                    ownerId: clubId,
                    label: (club["name"] as? String) ?? "Club",
                    photoURL:
                        (club["logoUrl"] as? String)
                        ?? (club["avatarUrl"] as? String),
                    isDorm: false,
                    isVerified:
                        (club["verificationStatus"] as? String) == "approved"
                        || (club["isVerified"] as? Bool) == true
                )
            )
        }

        // Sort: personal → campus → clubs (A–Z)
        out.sort {
            let ra = rank($0.ownerType)
            let rb = rank($1.ownerType)
            if ra != rb { return ra < rb }
            return $0.label.localizedCaseInsensitiveCompare($1.label) == .orderedAscending
        }

        identities = out
    }
    // MARK: - create/update unchanged

    func createPost(
        description: String,
        ownerType: PostOwnerType,
        ownerId: String,
        campusId: String,
        type: PostType,
        newImages: [UIImage],
        event: PostEventLogistics?
    ) async throws -> String {
        guard !isSaving else { throw EditorError.noPermission }
        isSaving = true
        defer { isSaving = false }

        guard let uid = Auth.auth().currentUser?.uid else { throw EditorError.notSignedIn }
        try validate(description: description, campusId: campusId)

        let uploaded = try await uploadImages(newImages, pathPrefix: "post-images/\(uid)")

        var payload: [String: Any] = [
            "description": description.trimmed,
            "authorId": uid,
            "ownerType": ownerType.rawValue,
            "ownerId": ownerId,
            "type": type.rawValue,
            "imageUrls": uploaded,
            "campusId": campusId.trimmed,
            "createdAt": FieldValue.serverTimestamp(),
            "visibility": "visible"
        ]

        if type == .event, let event {
            payload["event"] = eventMap(event)
            payload["date"] = yyyyMMdd(from: event.startsAt)
        }

        let ref = try await db.collection("posts").addDocument(data: payload)
        return ref.documentID
    }

    func updatePost(
        postId: String,
        description: String,
        type: PostType,
        ownerType: PostOwnerType,
        ownerId: String,
        campusId: String,
        retainedExistingUrls: [String],
        newImages: [UIImage],
        event: PostEventLogistics?
    ) async throws {
        guard !isSaving else { throw EditorError.noPermission }
        isSaving = true
        defer { isSaving = false }

        guard let uid = Auth.auth().currentUser?.uid else { throw EditorError.notSignedIn }
        try validate(description: description, campusId: campusId)

        let allowed = try await canEditPost(postId: postId, currentUid: uid)
        guard allowed else { throw EditorError.noPermission }

        let uploaded = try await uploadImages(newImages, pathPrefix: "post-images/\(uid)")
        let finalUrls = retainedExistingUrls + uploaded

        var update: [String: Any] = [
            "description": description.trimmed,
            "type": type.rawValue,
            "ownerType": ownerType.rawValue,
            "ownerId": ownerId,
            "campusId": campusId.trimmed,
            "imageUrls": finalUrls,
            "editCount": FieldValue.increment(Int64(1)),
            "editedAt": FieldValue.serverTimestamp()
        ]

        if type == .event, let event {
            update["event"] = eventMap(event)
            update["date"] = yyyyMMdd(from: event.startsAt)
        } else {
            update["event"] = FieldValue.delete()
            update["date"] = FieldValue.delete()
        }

        try await db.collection("posts").document(postId).updateData(update)
    }

    // MARK: - Helpers (private)

    private func fetchMemberDataByDocId(clubId: String, uid: String, emailLower: String) async -> [String: Any]? {
        // A) members/{uid}
        do {
            let d1 = try await db.collection("clubs").document(clubId)
                .collection("members").document(uid)
                .getDocument()
            if d1.exists { return d1.data() }
        } catch { }

        // B) members/{emailLower}
        if !emailLower.isEmpty {
            do {
                let d2 = try await db.collection("clubs").document(clubId)
                    .collection("members").document(emailLower)
                    .getDocument()
                if d2.exists { return d2.data() }
            } catch { }
        }

        return nil
    }

    private func validate(description: String, campusId: String) throws {
        if campusId.trimmed.isEmpty { throw EditorError.missingCampusId }
        if wordCount(description) > 300 { throw EditorError.wordLimitExceeded }
    }

    private func canEditPost(postId: String, currentUid: String) async throws -> Bool {
        let snap = try await db.collection("posts").document(postId).getDocument()
        let authorId = snap.data()?["authorId"] as? String
        return authorId == currentUid
    }

    private func uploadImages(_ images: [UIImage], pathPrefix: String) async throws -> [String] {
        guard !images.isEmpty else { return [] }

        var urls: [String] = []
        urls.reserveCapacity(images.count)

        for (i, img) in images.enumerated() {
            guard let data = img.jpegData(compressionQuality: 0.9) else { continue }
            let name = "\(Int(Date().timeIntervalSince1970))-\(i).jpg"
            let ref = storage.reference().child("\(pathPrefix)/\(name)")
            _ = try await ref.putDataAsync(data, metadata: nil)
            let url = try await ref.downloadURL()
            urls.append(url.absoluteString)
        }

        return urls
    }

    private func eventMap(_ event: PostEventLogistics) -> [String: Any] {
        var map: [String: Any] = [
            "startsAt": Timestamp(date: event.startsAt),
            "locationLabel": event.locationLabel
        ]
        if let lat = event.lat { map["lat"] = lat }
        if let lng = event.lng { map["lng"] = lng }
        return map
    }

    private func yyyyMMdd(from date: Date) -> String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = .current
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: date)
    }

    private func rank(_ t: PostOwnerType) -> Int {
        switch t {
        case .personal: return 0
        case .campus:   return 1
        case .club:     return 2
        }
    }

    private func wordCount(_ text: String) -> Int {
        text.split { $0.isWhitespace || $0.isNewline }.count
    }
}

private extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}

private extension Array {
    func chunked(into size: Int) -> [[Element]] {
        guard size > 0 else { return [self] }
        var result: [[Element]] = []
        var i = 0
        while i < count {
            result.append(Array(self[i..<Swift.min(i + size, count)]))
            i += size
        }
        return result
    }
}
