//
//  PostComment.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/19/26.
//


import SwiftUI

struct PostComment: Identifiable, Equatable {
    let id: String
    var text: String
    let authorId: String
    let authorUsername: String
    let authorPhotoURL: String?
    let createdAt: Date

    // New
    var likedBy: [String: Date] = [:]      // uid -> likedAt
    var editedCount: Int = 0
    var editedAt: Date? = nil

    var replies: [PostReply] = []
}

struct PostReply: Identifiable, Equatable {
    let id: String
    var text: String
    let authorId: String
    let authorUsername: String
    let authorPhotoURL: String?
    let createdAt: Date

    // New
    var likedBy: [String: Date] = [:]      // uid -> likedAt
    var editedCount: Int = 0
    var editedAt: Date? = nil
}
