//
//  CampusConnectApp.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/10/26.
//

import SwiftUI

@main
struct CampusConnectApp: App {
    // register app delegate for Firebase setup
    @UIApplicationDelegateAdaptor(AppDelegate.self) var delegate
    
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

