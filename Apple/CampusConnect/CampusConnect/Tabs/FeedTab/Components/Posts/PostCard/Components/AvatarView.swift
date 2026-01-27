//
//  AvatarView.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/12/26.
//
//  Rules:
//  - Clubs: prefer logoUrl (urlString); if empty use coverImageUrl (coverUrl) (fill + center);
//    if still empty show SF symbol (people for club, house for dorm) with light gray bg and adaptive icon color.
//  - Campus: prefer logoUrl (urlString); if empty show shortName initials with light gray bg and adaptive text color.
//  - Profile: circle, uses urlString if present; else person icon.
//  - Strokes: light gray for profile + club; NO stroke for campus.


import SwiftUI

enum AvatarKind {
    case campus(shortName: String?)
    case profile
    case club(name: String?, isDorm: Bool)
}

struct AvatarView: View {
    let urlString: String?
    let size: CGFloat
    let kind: AvatarKind

    @Environment(\.colorScheme) private var colorScheme

    // Always light gray background
    private let bg = Color(.systemGray5)
    private let strokeColor = Color(.systemGray4)

    private var fg: Color {
        colorScheme == .dark ? .white : .black
    }

    var body: some View {
        content
            .frame(width: size, height: size)
            .clipShape(clipShape)
            .overlay(strokeOverlay)
            .contentShape(clipShape)
    }

    // MARK: - Content router

    @ViewBuilder
    private var content: some View {
        switch kind {

        case .club:
            if let url = firstURL(urlString) {
                remoteImage(url, fallback: clubFallback)
            } else {
                clubFallback
            }

        case .campus(let shortName):
            if let url = firstURL(urlString) {
                remoteImage(url, fallback: campusFallback(shortName))
            } else {
                campusFallback(shortName)
            }

        case .profile:
            if let url = firstURL(urlString) {
                remoteImage(url, fallback: profileFallback)
            } else {
                profileFallback
            }
        }
    }

    // MARK: - Remote image

    private func remoteImage(_ url: URL, fallback: some View) -> some View {
        AsyncImage(url: url) { phase in
            if case .success(let image) = phase {
                image
                    .resizable()
                    .scaledToFill()
            } else {
                fallback
            }
        }
    }

    // MARK: - Campus fallback (NO stroke)

    private func campusFallback(_ shortName: String?) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.25, style: .continuous)
                .fill(bg)

            Text(initials(from: shortName))
                .font(.system(size: size * 0.42, weight: .bold))
                .foregroundStyle(fg)
        }
    }

    // MARK: - Club fallback

    private var clubFallback: some View {
        let isDorm: Bool = {
            if case .club(let name, let dorm) = kind {
                return dorm || (name ?? "").lowercased().contains("dorm")
            }
            return false
        }()

        let symbol = isDorm ? "house.fill" : "person.2.fill"

        return ZStack {
            RoundedRectangle(cornerRadius: size * 0.25, style: .continuous)
                .fill(bg)

            Image(systemName: symbol)
                .font(.system(size: size * 0.44, weight: .semibold))
                .foregroundStyle(fg)
        }
    }

    // MARK: - Profile fallback

    private var profileFallback: some View {
        ZStack {
            Circle().fill(bg)

            Image(systemName: "person.fill")
                .font(.system(size: size * 0.48, weight: .semibold))
                .foregroundStyle(fg)
        }
    }

    // MARK: - Shapes

    private var clipShape: AnyShape {
        switch kind {
        case .profile:
            return AnyShape(Circle())
        case .club, .campus:
            return AnyShape(RoundedRectangle(cornerRadius: size * 0.25, style: .continuous))
        }
    }

    // MARK: - Strokes

    @ViewBuilder
    private var strokeOverlay: some View {
        switch kind {
        case .profile:
            Circle().stroke(strokeColor, lineWidth: 1)

        case .club:
            RoundedRectangle(cornerRadius: size * 0.25, style: .continuous)
                .stroke(strokeColor, lineWidth: 1)

        case .campus:
            EmptyView() // ❌ no stroke for campus
        }
    }

    // MARK: - Helpers

    private func firstURL(_ s: String?) -> URL? {
        let t = (s ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return nil }
        return URL(string: t)
    }

    private func initials(from text: String?) -> String {
        let raw = (text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !raw.isEmpty else { return "" }
        if raw.count <= 2 { return raw.uppercased() }

        let parts = raw.split { $0 == " " || $0 == "-" || $0 == "_" }
        let first = parts.first?.prefix(1) ?? ""
        let second = parts.dropFirst().first?.prefix(1) ?? ""
        return (first + second).uppercased()
    }
}
