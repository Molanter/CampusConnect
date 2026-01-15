//
//  FeedContext.swift
//  CampusConnect
//
//  Query intent only (NOT a post model).
//

import Foundation

enum FeedContext: Equatable {
    case main(campusId: String)
    case profile(campusId: String, targetUserId: String)
    case club(campusId: String, clubId: String)

    var campusId: String {
        switch self {
        case .main(let id), .profile(let id, _), .club(let id, _): return id
        }
    }
}