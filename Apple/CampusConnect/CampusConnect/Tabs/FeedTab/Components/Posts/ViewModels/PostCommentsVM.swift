//
//  PostCommentsVM.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/19/26.
//

import SwiftUI
import Combine
import FirebaseFirestore

@MainActor
final class PostCommentsVM: ObservableObject {
    @Published var comments: [PostComment] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private var db: Firestore { Firestore.firestore() }

    private var commentListener: ListenerRegistration?
    private var replyListeners: [String: ListenerRegistration] = [:]

    deinit {
        commentListener?.remove()
        replyListeners.values.forEach { $0.remove() }
    }

    // MARK: - Live listeners

    func start(postId: String) {
        stop()
        isLoading = true
        errorMessage = nil

        let ref = db.collection("posts")
            .document(postId)
            .collection("comments")
            .order(by: "createdAt", descending: false)

        commentListener = ref.addSnapshotListener { [weak self] snap, err in
            guard let self else { return }
            self.isLoading = false

            if let err {
                self.errorMessage = err.localizedDescription
                return
            }

            // ✅ Preserve existing replies to prevent flicker/disappearing
            let existingById: [String: PostComment] = Dictionary(uniqueKeysWithValues: self.comments.map { ($0.id, $0) })

            let docs = snap?.documents ?? []
            let next: [PostComment] = docs.compactMap { d in
                let data = d.data()
                let ts = data["createdAt"] as? Timestamp

                let likedMap = (data["likedBy"] as? [String: Timestamp]) ?? [:]
                let likedBy = likedMap.mapValues { $0.dateValue() }

                let editedCount = data["editedCount"] as? Int ?? 0
                let editedAt = (data["editedAt"] as? Timestamp)?.dateValue()

                // ✅ keep replies already loaded for this comment
                let existingReplies = existingById[d.documentID]?.replies ?? []

                return PostComment(
                    id: d.documentID,
                    text: (data["text"] as? String) ?? "",
                    authorId: (data["authorId"] as? String) ?? "",
                    authorUsername: (data["authorUsername"] as? String) ?? "user",
                    authorPhotoURL: data["authorPhotoURL"] as? String,
                    createdAt: ts?.dateValue() ?? Date(),
                    likedBy: likedBy,
                    editedCount: editedCount,
                    editedAt: editedAt,
                    replies: existingReplies
                )
            }

            self.comments = next
            self.attachReplyListeners(postId: postId)
        }
    }

    func stop() {
        commentListener?.remove()
        commentListener = nil

        replyListeners.values.forEach { $0.remove() }
        replyListeners.removeAll()

        comments = []
    }

    private func attachReplyListeners(postId: String) {
        let commentIds = Set(comments.map(\.id))

        // remove listeners for deleted comments
        for (cid, l) in replyListeners where !commentIds.contains(cid) {
            l.remove()
            replyListeners[cid] = nil
        }

        // add listeners for new comments
        for cid in commentIds where replyListeners[cid] == nil {
            let ref = db.collection("posts")
                .document(postId)
                .collection("comments")
                .document(cid)
                .collection("replies")
                .order(by: "createdAt", descending: false)

            replyListeners[cid] = ref.addSnapshotListener { [weak self] snap, err in
                guard let self else { return }
                if let err {
                    self.errorMessage = err.localizedDescription
                    return
                }

                let docs = snap?.documents ?? []
                let replies: [PostReply] = docs.compactMap { d in
                    let data = d.data()
                    let ts = data["createdAt"] as? Timestamp

                    let likedMap = (data["likedBy"] as? [String: Timestamp]) ?? [:]
                    let likedBy = likedMap.mapValues { $0.dateValue() }

                    let editedCount = data["editedCount"] as? Int ?? 0
                    let editedAt = (data["editedAt"] as? Timestamp)?.dateValue()

                    return PostReply(
                        id: d.documentID,
                        text: (data["text"] as? String) ?? "",
                        authorId: (data["authorId"] as? String) ?? "",
                        authorUsername: (data["authorUsername"] as? String) ?? "user",
                        authorPhotoURL: data["authorPhotoURL"] as? String,
                        createdAt: ts?.dateValue() ?? Date(),
                        likedBy: likedBy,
                        editedCount: editedCount,
                        editedAt: editedAt
                    )
                }

                if let idx = self.comments.firstIndex(where: { $0.id == cid }) {
                    self.comments[idx].replies = replies
                }
            }
        }
    }

    // MARK: - Writes (author passed in from the View)

    func postComment(
        postId: String,
        text: String,
        authorId: String,
        authorUsername: String,
        authorPhotoURL: String?
    ) async {
        let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return }

        let id = authorId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !id.isEmpty else {
            errorMessage = "Missing user id."
            return
        }

        let uname = authorUsername.trimmingCharacters(in: .whitespacesAndNewlines)
        let photo = (authorPhotoURL ?? "").trimmingCharacters(in: .whitespacesAndNewlines)

        var payload: [String: Any] = [
            "text": clean,
            "authorId": id,
            "authorUsername": uname.isEmpty ? "user" : uname,
            "createdAt": FieldValue.serverTimestamp(),
            "likedBy": [:],
            "editedCount": 0
        ]

        // ✅ do NOT write NSNull; omit the field if empty
        if !photo.isEmpty {
            payload["authorPhotoURL"] = photo
        }

        do {
            try await db.collection("posts")
                .document(postId)
                .collection("comments")
                .addDocument(data: payload)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func postReply(
        postId: String,
        commentId: String,
        text: String,
        authorId: String,
        authorUsername: String,
        authorPhotoURL: String?
    ) async {
        let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return }

        let id = authorId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !id.isEmpty else {
            errorMessage = "Missing user id."
            return
        }

        let uname = authorUsername.trimmingCharacters(in: .whitespacesAndNewlines)
        let photo = (authorPhotoURL ?? "").trimmingCharacters(in: .whitespacesAndNewlines)

        var payload: [String: Any] = [
            "text": clean,
            "authorId": id,
            "authorUsername": uname.isEmpty ? "user" : uname,
            "createdAt": FieldValue.serverTimestamp(),
            "likedBy": [:],
            "editedCount": 0
        ]

        // ✅ do NOT write NSNull; omit the field if empty
        if !photo.isEmpty {
            payload["authorPhotoURL"] = photo
        }

        do {
            try await db.collection("posts")
                .document(postId)
                .collection("comments")
                .document(commentId)
                .collection("replies")
                .addDocument(data: payload)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Likes (uid -> likedAt) — optimistic local update, no UI flicker

    func toggleLikeComment(postId: String, commentId: String, uid: String, isCurrentlyLiked: Bool) async {
        let uid = uid.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !uid.isEmpty else { return }

        guard let idx = comments.firstIndex(where: { $0.id == commentId }) else { return }
        let prev = comments[idx]

        // ✅ optimistic local
        var next = prev
        if isCurrentlyLiked {
            next.likedBy.removeValue(forKey: uid)
        } else {
            next.likedBy[uid] = Date()
        }
        comments[idx] = next

        let doc = db.collection("posts").document(postId)
            .collection("comments").document(commentId)

        do {
            if isCurrentlyLiked {
                try await doc.updateData([
                    "likedBy.\(uid)": FieldValue.delete()
                ])
            } else {
                try await doc.updateData([
                    "likedBy.\(uid)": FieldValue.serverTimestamp()
                ])
            }
        } catch {
            // revert on failure
            comments[idx] = prev
            errorMessage = error.localizedDescription
        }
    }

    func toggleLikeReply(postId: String, commentId: String, replyId: String, uid: String, isCurrentlyLiked: Bool) async {
        let uid = uid.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !uid.isEmpty else { return }

        guard let cIdx = comments.firstIndex(where: { $0.id == commentId }) else { return }
        guard let rIdx = comments[cIdx].replies.firstIndex(where: { $0.id == replyId }) else { return }

        let prevReply = comments[cIdx].replies[rIdx]

        // ✅ optimistic local
        var nextReply = prevReply
        if isCurrentlyLiked {
            nextReply.likedBy.removeValue(forKey: uid)
        } else {
            nextReply.likedBy[uid] = Date()
        }
        comments[cIdx].replies[rIdx] = nextReply

        let doc = db.collection("posts").document(postId)
            .collection("comments").document(commentId)
            .collection("replies").document(replyId)

        do {
            if isCurrentlyLiked {
                try await doc.updateData([
                    "likedBy.\(uid)": FieldValue.delete()
                ])
            } else {
                try await doc.updateData([
                    "likedBy.\(uid)": FieldValue.serverTimestamp()
                ])
            }
        } catch {
            // revert on failure
            comments[cIdx].replies[rIdx] = prevReply
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Edit — optimistic local update (no flicker)

    func editComment(postId: String, commentId: String, newText: String) async {
        let clean = newText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return }

        guard let idx = comments.firstIndex(where: { $0.id == commentId }) else { return }
        let prev = comments[idx]

        // ✅ optimistic local
        var next = prev
        next.text = clean
        next.editedCount += 1
        next.editedAt = Date()
        comments[idx] = next

        let doc = db.collection("posts").document(postId)
            .collection("comments").document(commentId)

        do {
            try await doc.updateData([
                "text": clean,
                "editedCount": FieldValue.increment(Int64(1)),
                "editedAt": FieldValue.serverTimestamp()
            ])
        } catch {
            comments[idx] = prev
            errorMessage = error.localizedDescription
        }
    }

    func editReply(postId: String, commentId: String, replyId: String, newText: String) async {
        let clean = newText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return }

        guard let cIdx = comments.firstIndex(where: { $0.id == commentId }) else { return }
        guard let rIdx = comments[cIdx].replies.firstIndex(where: { $0.id == replyId }) else { return }

        let prev = comments[cIdx].replies[rIdx]

        // ✅ optimistic local
        var next = prev
        next.text = clean
        next.editedCount += 1
        next.editedAt = Date()
        comments[cIdx].replies[rIdx] = next

        let doc = db.collection("posts").document(postId)
            .collection("comments").document(commentId)
            .collection("replies").document(replyId)

        do {
            try await doc.updateData([
                "text": clean,
                "editedCount": FieldValue.increment(Int64(1)),
                "editedAt": FieldValue.serverTimestamp()
            ])
        } catch {
            comments[cIdx].replies[rIdx] = prev
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Delete

    func deleteComment(postId: String, commentId: String) async {
        let postId = postId.trimmingCharacters(in: .whitespacesAndNewlines)
        let commentId = commentId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !postId.isEmpty, !commentId.isEmpty else { return }

        // optimistic local remove
        let previous = comments
        comments.removeAll { $0.id == commentId }

        // also stop reply listener for this comment immediately
        if let l = replyListeners[commentId] {
            l.remove()
            replyListeners[commentId] = nil
        }

        do {
            try await db.collection("posts")
                .document(postId)
                .collection("comments")
                .document(commentId)
                .delete()
        } catch {
            // revert on failure
            comments = previous
            errorMessage = error.localizedDescription
        }
    }

    func deleteReply(postId: String, commentId: String, replyId: String) async {
        let postId = postId.trimmingCharacters(in: .whitespacesAndNewlines)
        let commentId = commentId.trimmingCharacters(in: .whitespacesAndNewlines)
        let replyId = replyId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !postId.isEmpty, !commentId.isEmpty, !replyId.isEmpty else { return }

        guard let cIdx = comments.firstIndex(where: { $0.id == commentId }) else { return }

        let previousReplies = comments[cIdx].replies
        comments[cIdx].replies.removeAll { $0.id == replyId }

        do {
            try await db.collection("posts")
                .document(postId)
                .collection("comments")
                .document(commentId)
                .collection("replies")
                .document(replyId)
                .delete()
        } catch {
            // revert on failure
            comments[cIdx].replies = previousReplies
            errorMessage = error.localizedDescription
        }
    }
}
