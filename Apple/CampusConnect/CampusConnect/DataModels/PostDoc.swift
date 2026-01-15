//
//  PostType.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/13/26.
//


import SwiftUI
import CoreLocation

enum PostType: String, Codable, CaseIterable, Equatable {
    case post
    case event
    case announcement
}

struct PostEventLogistics: Codable, Equatable {
    var startsAt: Date = Date()
    var locationLabel: String = ""
    var lat: Double?
    var lng: Double?
}

struct PostDoc: Identifiable, Codable, Equatable {
    let id: String

    // main
    var description: String
    var authorId: String
    var ownerId: String
    var type: PostType
    var imageUrls: [String]
    var campusId: String

    // timestamps / edits
    var createdAt: Date?
    var editedAt: Date?
    var editCount: Int?

    // counters
    var commentsCount: Int?
    var repliesCommentsCount: Int?
    var seenCount: Int?

    // arrays
    var likes: [String]?
    var seenBy: [String]?

    // event-only
    var event: PostEventLogistics?
}
