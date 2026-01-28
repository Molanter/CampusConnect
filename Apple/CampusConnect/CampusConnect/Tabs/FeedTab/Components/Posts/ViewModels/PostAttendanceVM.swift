//
//  PostAttendanceVM.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/21/26.
//


import Foundation
import SwiftUI
import Combine
import FirebaseFirestore

@MainActor
final class PostAttendanceVM: ObservableObject {
    @Published private(set) var going: [String] = []
    @Published private(set) var maybe: [String] = []
    @Published private(set) var notGoing: [String] = []

    @Published var isMenuOpen: Bool = false
    @Published var errorMessage: String?

    private var postId: String = ""
    private var uid: String = ""
    private var listener: ListenerRegistration?

    deinit { listener?.remove() }

    func start(postId: String, uid: String) {
        stop()
        self.postId = postId
        self.uid = uid.trimmingCharacters(in: .whitespacesAndNewlines)

        listener = PostAttendanceServiceFS.listen(postId: postId) { [weak self] res in
            guard let self else { return }
            Task { @MainActor in
                switch res {
                case .success(let snap):
                    self.going = snap.going
                    self.maybe = snap.maybe
                    self.notGoing = snap.notGoing
                case .failure(let err):
                    self.errorMessage = err.localizedDescription
                }
            }
        }
    }

    func stop() {
        listener?.remove()
        listener = nil
        going = []
        maybe = []
        notGoing = []
        errorMessage = nil
        isMenuOpen = false
    }

    var myStatus: AttendanceStatus? {
        guard !uid.isEmpty else { return nil }
        if going.contains(uid) { return .going }
        if maybe.contains(uid) { return .maybe }
        if notGoing.contains(uid) { return .notGoing }
        return nil
    }

    var displayCount: Int {
        // matches the web “show count only for Going/Maybe”
        switch myStatus {
        case .going: return going.count
        case .maybe: return maybe.count
        default: return 0
        }
    }

    func toggle(_ status: AttendanceStatus) {
        guard !postId.isEmpty, !uid.isEmpty else { return }

        let previous = (going, maybe, notGoing)
        let wasSame = (myStatus == status)

        // optimistic local
        going.removeAll { $0 == uid }
        maybe.removeAll { $0 == uid }
        notGoing.removeAll { $0 == uid }

        let nextStatus: AttendanceStatus? = wasSame ? nil : status
        if let nextStatus {
            switch nextStatus {
            case .going: going.append(uid)
            case .maybe: maybe.append(uid)
            case .notGoing: notGoing.append(uid)
            }
        }

        // close menu immediately
        isMenuOpen = false

        Task {
            do {
                try await PostAttendanceServiceFS.setAttendance(postId: postId, uid: uid, status: nextStatus)
            } catch {
                // revert on failure
                await MainActor.run {
                    (self.going, self.maybe, self.notGoing) = previous
                    self.errorMessage = error.localizedDescription
                }
            }
        }
    }
}
