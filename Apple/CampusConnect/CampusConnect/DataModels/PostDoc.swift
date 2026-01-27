//
//  PostDoc.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/13/26.
//


import SwiftUI
import FirebaseFirestore

enum PostType: String, Codable, CaseIterable, Equatable {
    case post, event, announcement
}

enum PostOwnerType: String, Codable, CaseIterable, Equatable {
    case personal, club, campus
}


struct PostEventLogistics: Codable, Equatable {
    var startsAt: Date = Date()
    var locationLabel: String = ""
    var locationUrl: String = ""
    var lat: Double?
    var lng: Double?
    // attendance (event-only) — matches web
    var goingUids: [String]?
    var maybeUids: [String]?
    var notGoingUids: [String]?
}

struct PostDoc: Identifiable, Codable, Equatable {
    let id: String

    // scope / ownership
    var ownerType: PostOwnerType
    var campusId: String
    var clubId: String?

    // main
    var description: String
    var authorId: String
    var type: PostType
    var imageUrls: [String]

    // ✅ denormalized display fields (snapshots)
    var ownerName: String?
    var ownerPhotoURL: String?

    var authorUsername: String?
    var authorDisplayName: String?
    var authorPhotoURL: String?

    // timestamps / edits
    var createdAt: Date?
    var editedAt: Date?
    var editCount: Int?

    // counters
    var commentsCount: Int?
    var repliesCommentsCount: Int?
    var seenCount: Int?

    // arrays
    var likedBy: [String]?

    // event-only
    var event: PostEventLogistics?
}
