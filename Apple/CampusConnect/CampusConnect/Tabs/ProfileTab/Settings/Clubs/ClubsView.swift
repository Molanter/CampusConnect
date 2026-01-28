//
//  ClubsView.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/27/26.
//


import SwiftUI

struct ClubsView: View {
    @EnvironmentObject private var profileStore: ProfileStore
    @StateObject private var vm = ClubsVM()

    // Adjust this path after you answer the question:
    private var campusId: String {
        (profileStore.profile?.campusId ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var body: some View {
        Group {
            if campusId.isEmpty {
                EmptyStateView(
                    symbol: "building.2",
                    title: "No campus selected",
                    description: "Your profile does not have a campus id yet."
                )
            } else if vm.isLoading && vm.clubs.isEmpty {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let msg = vm.errorMessage, vm.clubs.isEmpty {
                EmptyStateView(
                    symbol: "exclamationmark.triangle",
                    title: "Couldn’t load clubs",
                    description: msg,
                    actionTitle: "Retry",
                    actionSymbol: "arrow.clockwise",
                    action: { vm.start(campusId: campusId) }
                )
            } else if vm.clubs.isEmpty {
                EmptyStateView(
                    symbol: "person.3",
                    title: "No clubs yet",
                    description: "Be the first to create a club for your campus."
                )
            } else {
                List {
                    ForEach(vm.clubs) { club in
                        ClubRow(club: club)
                    }
                }
                .refreshable { await vm.refresh(campusId: campusId) }
            }
        }
        .task(id: campusId) {
            guard !campusId.isEmpty else { return }
            vm.start(campusId: campusId)
        }
    }
}

private struct ClubRow: View {
    let club: Club

    var body: some View {
        HStack(spacing: 12) {
            logo
            VStack(alignment: .leading, spacing: 3) {
                Text(club.name.isEmpty ? "Untitled Club" : club.name)
                    .font(.headline)
                    .lineLimit(1)

                if !club.category.isEmpty {
                    Text(club.category)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                } else if !club.description.isEmpty {
                    Text(club.description)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }

            Spacer()

            if club.isVerified {
                Image(systemName: "checkmark.seal.fill")
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 6)
    }

    @ViewBuilder
    private var logo: some View {
        let size: CGFloat = 44
        ZStack {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(.ultraThinMaterial)

            if let s = club.logoUrl, let url = URL(string: s) {
                AsyncImage(url: url) { phase in
                    if case .success(let img) = phase {
                        img.resizable().scaledToFill()
                    } else {
                        Image(systemName: "person.3.fill")
                            .foregroundStyle(.secondary)
                    }
                }
            } else {
                Image(systemName: "person.3.fill")
                    .foregroundStyle(.secondary)
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}
