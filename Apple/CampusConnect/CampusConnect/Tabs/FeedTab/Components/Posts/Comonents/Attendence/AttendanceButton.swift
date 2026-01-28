//
//  AttendanceButton.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/21/26.
//

import SwiftUI

struct AttendanceButton: View {
    let status: AttendanceStatus?
    let count: Int
    let iconSize: CGFloat
    let metaColor: Color

    let onSelect: (AttendanceStatus) -> Void
    let onShowAttendees: () -> Void

    private var iconName: String {
        switch status {
        case .going: return "hand.thumbsup.fill"
        case .maybe: return "questionmark.circle.fill"
        case .notGoing: return "hand.thumbsdown.fill"
        case .none: return "calendar"
        }
    }

    private var iconTint: Color {
        switch status {
        case .going: return .green
        case .maybe: return .yellow
        case .notGoing: return .red
        case .none: return metaColor
        }
    }

    var body: some View {
        HStack(spacing: 6) {
            // ✅ Menu trigger = icon only
            Menu {
                Button { onSelect(.going) } label: {
                    Label("Going", systemImage: "hand.thumbsup.fill")
                }
                .tint(.green)

                Button { onSelect(.maybe) } label: {
                    Label("Maybe", systemImage: "questionmark.circle.fill")
                }
                .tint(.yellow)

                Button { onSelect(.notGoing) } label: {
                    Label("Not Going", systemImage: "hand.thumbsdown.fill")
                }
                .tint(.red)
            } label: {
                Image(systemName: iconName)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(height: iconSize)
                    .foregroundStyle(iconTint)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            // ✅ Count = separate button (opens sheet)
            if count > 0 {
                Button {
                    onShowAttendees()
                } label: {
                    Text("\(count)")
                        .font(.caption)
                        .monospacedDigit()
                        .foregroundStyle(.secondary)       // ✅ secondary color
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Show attendees, \(count)")
            }
        }
        .accessibilityLabel(accessibilityLabel)
    }

    private var accessibilityLabel: String {
        switch status {
        case .going: return "Going"
        case .maybe: return "Maybe"
        case .notGoing: return "Not going"
        case .none: return "RSVP"
        }
    }
}
