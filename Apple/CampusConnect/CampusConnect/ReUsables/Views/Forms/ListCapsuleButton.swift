//
//  ListCapsuleButton.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/11/26.
//


import SwiftUI

struct ListCapsuleButton<Label: View>: View {
    let action: () -> Void
    @ViewBuilder let label: Label

    init(action: @escaping () -> Void, @ViewBuilder label: () -> Label) {
        self.action = action
        self.label = label()
    }

    var body: some View {
        Button(action: action) {
            label
                .frame(maxWidth: .infinity)
                .padding()
                .background(K.Colors.primary)
                .foregroundStyle(.white)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .listRowInsets(EdgeInsets())
        .listRowBackground(Color.clear)
    }
}