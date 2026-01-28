//
//  FeedContext.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/14/26.
//

import Foundation

// FeedContext.swift

enum FeedContext: Equatable {
    case main
    case profile(campusId: String, targetUserId: String)
    case club(campusId: String, clubId: String)
}
