//
//  PostEditorError.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/13/26.
//


import Foundation
import UIKit
import FirebaseAuth
import FirebaseFirestore
import FirebaseStorage

enum PostEditorError: LocalizedError {
    case notSignedIn
    case missingCampusId
    case wordLimitExceeded
    case noPermission
    case unknown

    var errorDescription: String? {
        switch self {
        case .notSignedIn: return "Not signed in."
        case .missingCampusId: return "Missing campusId."
        case .wordLimitExceeded: return "Description is over 300 words."
        case .noPermission: return "You don’t have permission to edit this post."
        case .unknown: return "Something went wrong."
        }
    }
}

final class PostService {
    static let db = Firestore.firestore()
    static let storage = Storage.storage()

    // MARK: - Create

    static func createPost(
        description: String,
        identity: PostIdentity,
        campusId: String,
        type: PostType,
        existingImageUrls: [String] = [],
        newImages: [UIImage],
        event: PostEventLogistics?
    ) async throws -> String {
        guard let uid = Auth.auth().currentUser?.uid else { throw PostEditorError.notSignedIn }

        let words = Self.wordCount(description)
        if words > 300 { throw PostEditorError.wordLimitExceeded }
        if campusId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { throw PostEditorError.missingCampusId }

        // Upload images sequentially (like web)
        let uploaded = try await uploadImages(newImages, pathPrefix: "post-images/\(uid)")

        var payload: [String: Any] = [
            "description": description.trimmingCharacters(in: .whitespacesAndNewlines),
            "authorId": uid,
            "ownerType": identity.ownerType.rawValue,
            "ownerId": identity.id,
            "type": type.rawValue,
            "imageUrls": existingImageUrls + uploaded,
            "campusId": campusId,
            "createdAt": FieldValue.serverTimestamp(),
            "visibility": "visible"
        ]

        if type == .event, let event {
            payload["startsAt"] = Timestamp(date: event.startsAt)
            payload["locationLabel"] = event.locationLabel
            payload["locationUrl"] = event.locationUrl
            if let lat = event.lat, let lng = event.lng {
                payload["lat"] = lat
                payload["lng"] = lng
            }
        }

        let ref = try await db.collection("posts").addDocument(data: payload)
        return ref.documentID
    }

    // MARK: - Update (editCount + editedAt + image diffing)

    static func updatePost(
        postId: String,
        description: String,
        type: PostType,
        identity: PostIdentity,
        campusId: String,
        retainedExistingUrls: [String],
        newImages: [UIImage],
        event: PostEventLogistics?
    ) async throws {
        guard let uid = Auth.auth().currentUser?.uid else { throw PostEditorError.notSignedIn }

        let words = Self.wordCount(description)
        if words > 300 { throw PostEditorError.wordLimitExceeded }

        // Ownership check hook (implement properly to match your rules)
        let allowed = try await canEditPost(postId: postId, currentUid: uid, identity: identity)
        if !allowed { throw PostEditorError.noPermission }

        let uploaded = try await uploadImages(newImages, pathPrefix: "post-images/\(uid)")
        let finalUrls = retainedExistingUrls + uploaded

        var update: [String: Any] = [
            "description": description.trimmingCharacters(in: .whitespacesAndNewlines),
            "type": type.rawValue,
            "ownerType": identity.ownerType.rawValue,
            "ownerId": identity.id,
            "campusId": campusId,
            "imageUrls": finalUrls,
            "editCount": FieldValue.increment(Int64(1)),
            "editedAt": FieldValue.serverTimestamp()
        ]

        if type == .event, let event {
            update["startsAt"] = Timestamp(date: event.startsAt)
            update["locationLabel"] = event.locationLabel
            update["locationUrl"] = event.locationUrl
            if let lat = event.lat, let lng = event.lng {
                update["lat"] = lat
                update["lng"] = lng
            } else {
                update["lat"] = FieldValue.delete()
                update["lng"] = FieldValue.delete()
            }
        } else {
            // remove event fields if not event anymore
            update["startsAt"] = FieldValue.delete()
            update["locationLabel"] = FieldValue.delete()
            update["locationUrl"] = FieldValue.delete()
            update["lat"] = FieldValue.delete()
            update["lng"] = FieldValue.delete()
        }

        try await db.collection("posts").document(postId).updateData(update)
    }

    // MARK: - Upload

    static func uploadImages(_ images: [UIImage], pathPrefix: String) async throws -> [String] {
        guard !images.isEmpty else { return [] }

        var urls: [String] = []
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

    // MARK: - Permission hook (stub)

    static func canEditPost(postId: String, currentUid: String, identity: PostIdentity) async throws -> Bool {
        // Implement: allow if currentUid == authorId OR currentUid is admin of the identity club/campus.
        // For now: author-only (safe default).
        let snap = try await db.collection("posts").document(postId).getDocument()
        let authorId = snap.data()?["authorId"] as? String
        return authorId == currentUid
    }

    static func wordCount(_ text: String) -> Int {
        let parts = text.split { $0.isWhitespace || $0.isNewline }
        return parts.count
    }
}