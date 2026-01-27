//
//  AppState.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/15/26.
//


import SwiftUI
import Combine

@MainActor
final class AppState: ObservableObject {
    @Published var isAdminModeEnabled: Bool = false
    @Published var appTab: AppTab = .feed
    @Published var searchText: String = ""

}
