//
//  SettingsDestination.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/27/26.
//


import SwiftUI

enum SettingsDestination: CaseIterable, Identifiable {
    case account
    case privacy
    case notifications
    case appearance
    case clubs
    case createClub

    var id: String { title }

    var title: String {
        switch self {
        case .account: return "Account"
        case .privacy: return "Privacy"
        case .notifications: return "Notifications"
        case .appearance: return "Appearance"
        case .clubs: return "Clubs"
        case .createClub: return "Create Club"
        }
    }

    var symbol: String {
        switch self {
        case .account: return "person.crop.circle.fill"
        case .privacy: return "hand.raised.fill"
        case .notifications: return "bell.badge.fill"
        case .appearance: return "paintbrush.fill"
        case .clubs: return "person.3.fill"
        case .createClub: return "plus.circle.fill"
        }
    }

    var tint: Color {
        switch self {
        case .account, .privacy: return .blue
        case .notifications: return .red
        case .appearance: return .purple
        case .clubs, .createClub: return .green
        }
    }

    var destination: AnyView {
        switch self {
        case .account:
            AnyView(AccountSettingsView().hideTabBar())
        case .privacy:
            AnyView(PrivacySettingsView().hideTabBar())
        case .notifications:
            AnyView(NotificationsSettingsView().hideTabBar())
        case .appearance:
            AnyView(AppearanceSettingsView().hideTabBar())
        case .clubs:
            AnyView(ClubsView().hideTabBar())
        case .createClub:
            AnyView(CreateClubView().hideTabBar())
        }
    }
}
