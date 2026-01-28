//
//  AttendeeListSheet.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/21/26.
//


import SwiftUI
import Combine

struct AttendeeListSheet: View {
    let going: [String]
    let maybe: [String]
    let notGoing: [String]

    @StateObject private var vm = AttendeeListVM()

    var body: some View {
        NavigationStack {
            List {
                section(title: "Going", uids: going)
                section(title: "Maybe", uids: maybe)
                section(title: "Not Going", uids: notGoing)
            }
            .navigationTitle("Attendance")
            .navigationBarTitleDisplayMode(.inline)
            .task {
                await vm.load(going: going, maybe: maybe, notGoing: notGoing)
            }
        }
    }

    @ViewBuilder
    private func section(title: String, uids: [String]) -> some View {
        if !uids.isEmpty {
            Section(title) {
                ForEach(uids, id: \.self) { uid in
                    if let p = vm.profiles[uid] {
                        HStack(spacing: 10) {
                            AvatarView(urlString: p.photoURL, size: 32, kind: .profile)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(p.displayName)
                                    .font(.subheadline.weight(.semibold))
                                if !p.username.isEmpty {
                                    Text("@\(p.username)")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    } else {
                        Text(uid)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
    }
}

@MainActor
final class AttendeeListVM: ObservableObject {
    @Published var profiles: [String: UserProfile] = [:]

    func load(going: [String], maybe: [String], notGoing: [String]) async {
        let all = Array(Set(going + maybe + notGoing))
        guard !all.isEmpty else { return }

        await withTaskGroup(of: (String, UserProfile?).self) { group in
            for uid in all {
                group.addTask {
                    do {
                        let p = try await ProfileServiceFS.fetchProfile(uid: uid)
                        return (uid, p)
                    } catch {
                        return (uid, nil)
                    }
                }
            }

            var next: [String: UserProfile] = [:]
            for await (uid, p) in group {
                if let p { next[uid] = p }
            }
            profiles = next
        }
    }
}
