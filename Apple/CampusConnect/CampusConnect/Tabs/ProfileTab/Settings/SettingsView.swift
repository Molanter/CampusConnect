//
//  SettingsView.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/27/26.
//


import SwiftUI

struct SettingsView: View {
    var body: some View {
        NavigationStack {
            List {
                Section("Account") {
                    row(.account)
                    row(.privacy)
                }

                Section("App") {
                    row(.notifications)
                    row(.appearance)
                }

                Section("Clubs") {
                    row(.clubs)
                    row(.createClub)
                }
            }
            .navigationTitle("Settings")
        }
    }

    private func row(_ dest: SettingsDestination) -> some View {
        NavigationLink {
            dest.destination
                .navigationTitle(dest.title)
                .navigationBarTitleDisplayMode(.inline)
//                .hideTabBar()
        } label: {
            HStack {
                ZStack(alignment: .center) {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(dest.tint)
                        .frame(width: 25, height: 25)
                    Image(systemName: dest.symbol)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(width: 15, height: 15)
                        .foregroundStyle(.white)
                }
                Text(dest.title)
            }
        }
    }
}



struct AccountSettingsView: View {
    var body: some View {
        EmptyStateView(
            symbol: "person.crop.circle",
            title: "Account",
            description: "Account settings will appear here."
        )
    }
}

struct PrivacySettingsView: View {
    var body: some View {
        EmptyStateView(
            symbol: "hand.raised",
            title: "Privacy",
            description: "Privacy settings will appear here."
        )
    }
}

struct NotificationsSettingsView: View {
    var body: some View {
        EmptyStateView(
            symbol: "bell",
            title: "Notifications",
            description: "Notification settings will appear here."
        )
    }
}

struct AppearanceSettingsView: View {
    var body: some View {
        EmptyStateView(
            symbol: "paintbrush",
            title: "Appearance",
            description: "Appearance settings will appear here."
        )
    }
}
