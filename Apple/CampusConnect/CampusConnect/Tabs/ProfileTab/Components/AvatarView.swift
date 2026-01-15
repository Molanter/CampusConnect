//
//  AvatarView.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/12/26.
//


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

    var body: some View {
        Group {
            if let urlString,
               let url = URL(string: urlString) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    default:
                        fallback
                    }
                }
            } else {
                fallback
            }
        }
        .frame(width: size, height: size)
        .clipShape(clipShape)
        .overlay(strokeOverlay)
    }

    // MARK: - Fallbacks

    @ViewBuilder
    private var fallback: some View {
        switch kind {

        // 🏫 Campus — NO background, NO stroke, text only
        case .campus(let shortName):
            Text(shortName?.uppercased() ?? "")
                .font(.system(size: size * 0.5, weight: .bold))
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, maxHeight: .infinity)

        // 👤 Profile — circle, fill, stroke, person icon
        case .profile:
            Circle()
                .fill(.foreground.opacity(0.08))
                .overlay(
                    Image(systemName: "person.fill")
                        .font(.system(size: size * 0.45))
                        .foregroundStyle(.secondary)
                )

        // 👥 / 🏠 Club or Dorm — rounded square, stroke, icon
        case .club(_, let isDorm):
            RoundedRectangle(cornerRadius: size * 0.25, style: .continuous)
                .fill(.foreground.opacity(0.06))
                .overlay(
                    Image(systemName: isDorm ? "house.fill" : "person.2.fill")
                        .font(.system(size: size * 0.4))
                        .foregroundStyle(.secondary)
                )
        }
    }

    // MARK: - Shapes

    private var clipShape: some Shape {
        switch kind {
        case .profile:
            return AnyShape(Circle())
        case .club:
            return AnyShape(RoundedRectangle(cornerRadius: size * 0.25, style: .continuous))
        case .campus:
            return AnyShape(Rectangle()) // no visible shape
        }
    }

    // MARK: - Stroke

    @ViewBuilder
    private var strokeOverlay: some View {
        switch kind {
        case .profile:
            Circle()
                .stroke(.secondary.opacity(0.25), lineWidth: 1)

        case .club:
            RoundedRectangle(cornerRadius: size * 0.25, style: .continuous)
                .stroke(.secondary.opacity(0.25), lineWidth: 1)

        case .campus:
            EmptyView()
        }
    }
}
