//
//  AttendanceStatus.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/21/26.
//


import Foundation
import FirebaseFirestore

enum AttendanceStatus: String, CaseIterable, Equatable {
    case going, maybe, notGoing
}

struct PostAttendanceSnapshot: Equatable {
    var going: [String]
    var maybe: [String]
    var notGoing: [String]
}

final class PostAttendanceServiceFS {
    static let db = Firestore.firestore()

    static func listen(postId: String, onChange: @escaping (Result<PostAttendanceSnapshot, Error>) -> Void) -> ListenerRegistration {
        db.collection("posts").document(postId).addSnapshotListener { snap, err in
            if let err {
                onChange(.failure(err))
                return
            }
            let d = snap?.data() ?? [:]
            let going = (d["goingUids"] as? [String]) ?? []
            let maybe = (d["maybeUids"] as? [String]) ?? []
            let notGoing = (d["notGoingUids"] as? [String]) ?? []
            onChange(.success(.init(going: going, maybe: maybe, notGoing: notGoing)))
        }
    }

    static func setAttendance(postId: String, uid: String, status: AttendanceStatus?) async throws {
        let ref = db.collection("posts").document(postId)

        try await runTransaction { tx in
            let snap: DocumentSnapshot
            do { snap = try tx.getDocument(ref) }
            catch { throw error }

            let d = snap.data() ?? [:]
            var going = (d["goingUids"] as? [String]) ?? []
            var maybe = (d["maybeUids"] as? [String]) ?? []
            var notGoing = (d["notGoingUids"] as? [String]) ?? []

            // remove from all
            going.removeAll { $0 == uid }
            maybe.removeAll { $0 == uid }
            notGoing.removeAll { $0 == uid }

            // add to selected (or nil = clear)
            if let status {
                switch status {
                case .going: going.append(uid)
                case .maybe: maybe.append(uid)
                case .notGoing: notGoing.append(uid)
                }
            }

            tx.updateData([
                "goingUids": going,
                "maybeUids": maybe,
                "notGoingUids": notGoing
            ], forDocument: ref)
        }
    }

    // MARK: - Async transaction helper

    private static func runTransaction(_ block: @escaping (Transaction) throws -> Void) async throws {
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            db.runTransaction({ tx, errPtr -> Any? in
                do {
                    try block(tx)
                    return nil
                } catch {
                    errPtr?.pointee = error as NSError
                    return nil
                }
            }, completion: { _, err in
                if let err {
                    cont.resume(throwing: err)
                } else {
                    cont.resume(returning: ())
                }
            })
        }
    }
}
