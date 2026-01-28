//
//  ProfileClubsTabView.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/24/26.
//


import SwiftUI

struct ProfileClubsTabView: View {
    @Binding var clubsCount: Int
    @StateObject private var vm = ProfileClubsVM()

    var body: some View {
        Group {
            if vm.isLoading && vm.clubs.isEmpty {
                ProfileProgressCard(text: "Loading clubs…")
            } else if vm.clubs.isEmpty {
                EmptyStateView(
                    symbol: "person.2",
                    title: "No clubs found",
                    description: "Join a club and it will show here."
                )
                .padding(.horizontal, K.Layout.padding)
            } else if let msg = vm.errorMessage, !msg.isEmpty {
                Text(msg)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                VStack(spacing: 0) {
                    ForEach(vm.clubs, id: \.id) { club in
                        ClubRow(club: club)
                        if club.id != vm.clubs.last?.id {
                            Divider().opacity(0.6)
                        }
                    }
                }
                .padding(.vertical, 6)
                .background(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .fill(Color(.secondarySystemGroupedBackground))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(Color.secondary.opacity(0.18), lineWidth: 1)
                )
            }

            
        }
        .padding(.horizontal, 16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .task {
            await vm.loadIfNeeded()
            clubsCount = vm.clubs.count
        }
        .refreshable {
            await vm.refresh()
            clubsCount = vm.clubs.count
        }
        .onChange(of: vm.clubs.count) { _, newValue in
            clubsCount = newValue
        }
    }

    private struct ClubRow: View {
        let club: Club

        var body: some View {
            Button {
                // navigate to club page
            } label: {
                HStack(spacing: 12) {
                    ClubLogo(urlString: club.logoUrl, size: 42)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(club.name).font(.headline).lineLimit(1)
                        if !club.campusId.isEmpty {
                            Text(club.campusId).font(.footnote).foregroundStyle(.secondary).lineLimit(1)
                        }
                    }

                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right").foregroundStyle(.tertiary)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }

        private struct ClubLogo: View {
            let urlString: String?
            let size: CGFloat

            var body: some View {
                ZStack {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(Color(.tertiarySystemFill))

                    if let urlString,
                       let url = URL(string: urlString.trimmingCharacters(in: .whitespacesAndNewlines)) {
                        AsyncImage(url: url) { phase in
                            if case .success(let img) = phase {
                                img.resizable().scaledToFill()
                            } else {
                                Image(systemName: "person.2.fill").foregroundStyle(.secondary)
                            }
                        }
                    } else {
                        Image(systemName: "person.2.fill").foregroundStyle(.secondary)
                    }
                }
                .frame(width: size, height: size)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(Color.secondary.opacity(0.18), lineWidth: 1)
                )
            }
        }
    }
}
