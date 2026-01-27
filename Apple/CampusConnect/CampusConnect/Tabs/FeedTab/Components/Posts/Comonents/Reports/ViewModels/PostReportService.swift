//
//  PostReportService.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/20/26.
//


import Foundation
import FirebaseAuth
import FirebaseFirestore

struct PostReportService {
    enum ReportError: LocalizedError {
        case notSignedIn
        case invalidPostId

        var errorDescription: String? {
            switch self {
            case .notSignedIn: return "You must be signed in to report posts."
            case .invalidPostId: return "Invalid post."
            }
        }
    }

    func submitReport(postId: String, reason: ReportReason, details: String?) async throws {
        guard !postId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw ReportError.invalidPostId
        }
        guard let uid = Auth.auth().currentUser?.uid else {
            throw ReportError.notSignedIn
        }

        let trimmedDetails = (details ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        let cappedDetails = String(trimmedDetails.prefix(500))

        let data: [String: Any] = [
            "reporterUid": uid,
            "reason": reason.rawValue,
            "details": cappedDetails.isEmpty ? NSNull() : cappedDetails,
            "createdAt": FieldValue.serverTimestamp()
        ]

        let ref = Firestore.firestore()
            .collection("posts")
            .document(postId)
            .collection("reports")

        try await addDocumentAsync(ref: ref, data: data)
    }

    // Works across Firebase versions (no reliance on async Firestore APIs).
    private func addDocumentAsync(ref: CollectionReference, data: [String: Any]) async throws {
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            ref.addDocument(data: data) { error in
                if let error {
                    cont.resume(throwing: error)
                } else {
                    cont.resume(returning: ())
                }
            }
        }
    }
}
