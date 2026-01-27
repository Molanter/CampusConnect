//
//  PostServiceFS.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/20/26.
//



import Foundation
import FirebaseFirestore

enum PostServiceError: Error {
    case missingPostId
}

struct PostServiceFS {
    private static let db = Firestore.firestore()

    // If your path differs, change this in one place.
    private static func postRef(_ postId: String) -> DocumentReference {
        db.collection("posts").document(postId)
    }

    /// Writes likes as an ARRAY of uid strings in `likedBy`.
    static func setLike(postId: String, uid: String, isLiked: Bool) async throws {
        guard !postId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw PostServiceError.missingPostId
        }
        let uidTrimmed = uid.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !uidTrimmed.isEmpty else { return }

        let ref = postRef(postId)

        let op = isLiked
            ? FieldValue.arrayUnion([uidTrimmed])
            : FieldValue.arrayRemove([uidTrimmed])

        try await ref.updateDataAsync(["likedBy": op])
    }
}

// MARK: - Async wrapper

private extension DocumentReference {
    func updateDataAsync(_ fields: [String: Any]) async throws {
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            self.updateData(fields) { error in
                if let error {
                    cont.resume(throwing: error)
                } else {
                    cont.resume(returning: ())
                }
            }
        }
    }
}
