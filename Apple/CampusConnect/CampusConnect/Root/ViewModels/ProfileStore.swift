//
//  ProfileStore.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/13/26.
//

import Foundation
import Combine
import FirebaseAuth
import FirebaseFirestore

@MainActor
final class ProfileStore: ObservableObject {

    @Published var profile: UserProfile? = nil
    @Published var isReady: Bool = false
    @Published var isLoading: Bool = false
    @Published var errorMessage: String? = nil

    // Permissions
    @Published var isCampusAdmin: Bool = false

    // Campus display (label + avatar)
    @Published var campusDisplayName: String? = nil
    @Published var campusLogoURL: String? = nil
    @Published var campusShortName: String? = nil

    // Clubs (owner/admin)
    @Published var adminClubIds: [String] = []
    @Published var announcementClubIds: Set<String> = [] // owner/admin clubs

    private var listener: ListenerRegistration?
    private let db = Firestore.firestore()

    func bindToAuth(authVM: AuthViewModel) {
        Task { await loadForCurrentUser(authVM: authVM) }
    }

    func loadForCurrentUser(authVM: AuthViewModel) async {
        listener?.remove()
        listener = nil

        errorMessage = nil
        isReady = false
        isLoading = true
        defer { isLoading = false }

        guard let uid = authVM.user?.uid else {
            clear()
            return
        }

        listener = db.collection("users").document(uid).addSnapshotListener { [weak self] snap, err in
            guard let self else { return }

            if let err {
                Task { @MainActor in
                    self.errorMessage = err.localizedDescription
                    self.profile = nil
                    self.isCampusAdmin = false
                    self.campusDisplayName = nil
                    self.campusLogoURL = nil
                    self.campusShortName = nil
                    self.adminClubIds = []
                    self.announcementClubIds = []
                    self.isReady = true
                }
                return
            }

            Task { @MainActor in
                let authUser = Auth.auth().currentUser

                guard let snap, snap.exists, let data = snap.data() else {
                    self.profile = UserProfile(
                        id: uid,
                        username: "",
                        displayName: authUser?.displayName ?? "User",
                        photoURL: authUser?.photoURL?.absoluteString,
                        campusId: nil,
                        campus: nil,
                        role: .student,
                        dorm: nil,
                        major: nil,
                        yearOfStudy: nil,
                        email: authUser?.email
                    )
                    self.isReady = true
                    await self.refreshAll()
                    return
                }

                let displayName =
                    (data["displayName"] as? String) ??
                    (data["name"] as? String) ??
                    (data["fullName"] as? String) ??
                    (authUser?.displayName ?? "User")

                let campusId = (data["campusId"] as? String)

                let roleRaw = ((data["role"] as? String) ?? "student").lowercased()
                let role: UserRole
                switch roleRaw {
                case "faculty": role = .faculty
                case "staff": role = .staff
                default: role = .student
                }

                self.profile = UserProfile(
                    id: uid,
                    username: (data["username"] as? String) ?? "",
                    displayName: displayName,
                    photoURL: (data["photoURL"] as? String) ?? authUser?.photoURL?.absoluteString,
                    campusId: campusId,
                    campus: data["campus"] as? String,
                    role: role,
                    dorm: data["dorm"] as? String,
                    major: data["major"] as? String,
                    yearOfStudy: data["yearOfStudy"] as? String,
                    email: (data["email"] as? String) ?? authUser?.email
                )

                self.isReady = true
                await self.refreshAll()
            }
        }
    }

    func clear() {
        listener?.remove()
        listener = nil

        profile = nil
        errorMessage = nil

        isCampusAdmin = false
        campusDisplayName = nil
        campusLogoURL = nil
        campusShortName = nil

        adminClubIds = []
        announcementClubIds = []

        isReady = true
        isLoading = false
    }

    deinit { listener?.remove() }
}

// MARK: - Refresh All

extension ProfileStore {
    func refreshAll() async {
        errorMessage = nil
        await refreshCampusAdminAndName()
        await refreshAdminClubs()
    }
}

// MARK: - Campus Admin + Campus Name/Logo/ShortName

extension ProfileStore {

    private func nonEmptyString(_ v: Any?) -> String? {
        let s = (v as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
        return (s?.isEmpty == false) ? s : nil
    }

    private func refreshCampusAdminAndName() async {
        guard let p = profile else {
            isCampusAdmin = false
            campusDisplayName = nil
            campusLogoURL = nil
            campusShortName = nil
            return
        }

        let campusId = (p.campusId ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard !campusId.isEmpty else {
            isCampusAdmin = false
            campusDisplayName = nil
            campusLogoURL = nil
            campusShortName = nil
            return
        }

        do {
            let doc = try await db.collection("campuses").document(campusId).getDocument()
            let data = doc.data() ?? [:]

            campusDisplayName =
                nonEmptyString(data["name"]) ??
                nonEmptyString(data["campusName"]) ??
                nonEmptyString(data["title"]) ??
                "Campus"

            campusLogoURL =
                nonEmptyString(data["logoUrl"]) ??
                nonEmptyString(data["logoURL"]) ??
                nonEmptyString(data["avatarUrl"]) ??
                nonEmptyString(data["avatarURL"])

            campusShortName =
                nonEmptyString(data["shortName"]) ??
                nonEmptyString(data["short"]) ??
                nonEmptyString(data["abbr"]) ??
                nonEmptyString(data["abbreviation"])

            let adminEmails = (data["adminEmails"] as? [String]) ?? []
            let adminUids = (data["adminUids"] as? [String]) ?? (data["admins"] as? [String]) ?? []

            let emailLower = (p.email ?? "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .lowercased()

            let uid = p.id

            let adminEmailsLower = adminEmails
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }

            isCampusAdmin =
                (!emailLower.isEmpty && adminEmailsLower.contains(emailLower)) ||
                adminUids.contains(uid)

        } catch {
            isCampusAdmin = false
            campusDisplayName = nil
            campusLogoURL = nil
            campusShortName = nil
        }
    }
}

// MARK: - Admin Clubs (owner/admin memberships)

extension ProfileStore {

    private func refreshAdminClubs() async {
        guard let p = profile else {
            adminClubIds = []
            announcementClubIds = []
            return
        }

        let uid = p.id
        let emailLower = (p.email ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

        // 1) Fetch clubs user is a member of (prefer memberIds)
        var clubCache: [String: [String: Any]] = [:]

        do {
            let snap = try await db.collection("clubs")
                .whereField("memberIds", arrayContains: uid)
                .getDocuments()

            for d in snap.documents {
                clubCache[d.documentID] = d.data()
            }
        } catch {
            self.errorMessage = "clubs(memberIds) failed: \(error.localizedDescription)"
            adminClubIds = []
            announcementClubIds = []
            return
        }

        // 1b) Fallback if memberIds is incomplete
        if clubCache.isEmpty {
            do {
                let mSnap = try await db.collectionGroup("members")
                    .whereField("uid", isEqualTo: uid)
                    .getDocuments()

                var clubIds: [String] = []
                clubIds.reserveCapacity(mSnap.documents.count)

                for m in mSnap.documents {
                    if let clubId = m.reference.parent.parent?.documentID {
                        clubIds.append(clubId)
                    }
                }

                for clubId in Set(clubIds) where clubCache[clubId] == nil {
                    do {
                        let clubDoc = try await db.collection("clubs").document(clubId).getDocument()
                        if clubDoc.exists {
                            clubCache[clubId] = clubDoc.data() ?? [:]
                        }
                    } catch { /* ignore */ }
                }
            } catch {
                // ignore fallback error
            }
        }

        // 2) Determine admin clubs via membership doc:
        //    - status approved/active/empty
        //    - role owner/admin
        // NOTE: announcementClubIds must ONLY include admin/owner clubs (NOT allowMemberPosts)
        var adminIds = Set<String>()
        var announcementIds = Set<String>()

        for (clubId, _) in clubCache {
            guard let memberData = await fetchMemberDataRelaxed(
                clubId: clubId,
                uid: uid,
                emailLower: emailLower
            ) else { continue }

            let status = ((memberData["status"] as? String) ?? "").lowercased()
            let isApprovedOrActive = status.isEmpty || status == "approved" || status == "active"
            guard isApprovedOrActive else { continue }

            let role = ((memberData["role"] as? String) ?? "").lowercased()
            let isAdminOrOwner = (role == "owner" || role == "admin")
            guard isAdminOrOwner else { continue }

            adminIds.insert(clubId)
            announcementIds.insert(clubId)
        }

        // 3) Sort admin clubs by name (UX)
        let sortedAdminIds: [String] = adminIds.sorted { a, b in
            let an = ((clubCache[a]?["name"] as? String) ?? (clubCache[a]?["title"] as? String) ?? a).lowercased()
            let bn = ((clubCache[b]?["name"] as? String) ?? (clubCache[b]?["title"] as? String) ?? b).lowercased()
            return an < bn
        }

        adminClubIds = sortedAdminIds
        announcementClubIds = announcementIds // <- keep it [String] if your property is [String]
    }
    
    private func fetchMemberDataRelaxed(clubId: String, uid: String, emailLower: String) async -> [String: Any]? {
        // A) members/{uid}
        do {
            let d1 = try await db.collection("clubs").document(clubId)
                .collection("members").document(uid)
                .getDocument()
            if d1.exists { return d1.data() }
        } catch {
            if self.errorMessage == nil { self.errorMessage = "members/{uid} read failed: \(error.localizedDescription)" }
        }

        // B) members/{emailLower}
        if !emailLower.isEmpty {
            do {
                let d2 = try await db.collection("clubs").document(clubId)
                    .collection("members").document(emailLower)
                    .getDocument()
                if d2.exists { return d2.data() }
            } catch {
                if self.errorMessage == nil { self.errorMessage = "members/{email} read failed: \(error.localizedDescription)" }
            }
        }

        // C) fallback query: members where uid == uid
        do {
            let q = try await db.collection("clubs").document(clubId)
                .collection("members")
                .whereField("uid", isEqualTo: uid)
                .limit(to: 1)
                .getDocuments()
            return q.documents.first?.data()
        } catch {
            if self.errorMessage == nil { self.errorMessage = "members query failed: \(error.localizedDescription)" }
            return nil
        }
    }
}
