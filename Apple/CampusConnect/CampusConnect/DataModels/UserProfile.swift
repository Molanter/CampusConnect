//
//  UserProfile.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/12/26.
//


import SwiftUI

struct UserProfile: Identifiable {
    let id: String // uid

    var username: String
    var displayName: String
    var photoURL: String?

    var campusId: String?
    var campus: String?

    var role: UserRole
    var dorm: String?
    var major: String?
    var yearOfStudy: String?

    // ✅ needed for campus adminEmails check
    var email: String?

    var isCompleteBasic: Bool {
        !username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        ((campusId ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false)
    }
}

enum UserRole: String, Codable, CaseIterable, Equatable {
    case student
    case faculty
    case staff
}
