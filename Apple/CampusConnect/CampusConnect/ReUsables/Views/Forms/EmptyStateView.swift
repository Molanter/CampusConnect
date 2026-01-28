//
//  EmptyStateView.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/24/26.
//

import SwiftUI

struct EmptyStateView: View {
    let symbol: String
    let title: String
    let description: String

    let actionTitle: String?
    let actionSymbol: String?
    let action: (() -> Void)?

    @State private var animate = false
    @State private var didTrigger = false
    @State private var appearTask: Task<Void, Never>?

    init(
        symbol: String,
        title: String,
        description: String,
        actionTitle: String? = nil,
        actionSymbol: String? = nil,
        action: (() -> Void)? = nil
    ) {
        self.symbol = symbol
        self.title = title
        self.description = description
        self.actionTitle = actionTitle
        self.actionSymbol = actionSymbol
        self.action = action
    }

    var body: some View {
        ContentUnavailableView {
            VStack(spacing: 10) {
                Image(systemName: symbol)
                    .font(.system(size: 44, weight: .semibold))
                    .symbolEffect(.bounce, value: animate)
                    .foregroundStyle(.secondary)

                Text(title)
                    .font(.headline)
            }
        } description: {
            Text(description)
        } actions: {
            if let action,
               let actionTitle,
               let actionSymbol {
                Button(action: action) {
                    Label(actionTitle, systemImage: actionSymbol)
                }
            }
        }
        .onAppear {
            guard !didTrigger else { return }
            didTrigger = true

            // cancel any previous (defensive)
            appearTask?.cancel()
            appearTask = Task { @MainActor in
                // If you want no delay, remove this line
                 try? await Task.sleep(nanoseconds: 120_000_000)
                animate.toggle()
            }
        }
        .onDisappear {
            appearTask?.cancel()
            appearTask = nil
        }
    }
}
