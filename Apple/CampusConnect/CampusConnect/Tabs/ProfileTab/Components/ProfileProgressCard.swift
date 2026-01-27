//
//  ProfileProgressCard.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/24/26.
//


import SwiftUI

struct ProfileProgressCard: View {
    let text: String
    var body: some View {
        HStack(spacing: 10) {
            ProgressView()
            Text(text).foregroundStyle(.secondary).font(.subheadline)
            Spacer()
        }
        .padding(14)
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

