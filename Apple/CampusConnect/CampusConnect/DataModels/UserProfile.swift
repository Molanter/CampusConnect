//
//  UserProfile.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/12/26.
//


import Foundation

struct UserProfile: Identifiable {
    let id: String // uid

    var username: String
    var displayName: String
    var photoURL: String?

    var campusId: String?
    var universityId: String?
    var campus: String?

    var role: UserRole
    var dorm: String?
    var major: String?
    var yearOfStudy: String?

    var isCompleteBasic: Bool {
        !username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        (campusId ?? "").isEmpty == false
    }
}

enum UserRole: String, CaseIterable, Identifiable {
    case student = "Student"
    case faculty = "Faculty"
    case staff = "Staff"

    var id: String { rawValue }
}
