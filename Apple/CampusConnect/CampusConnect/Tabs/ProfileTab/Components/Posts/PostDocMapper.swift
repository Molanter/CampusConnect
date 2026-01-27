//
//  PostDocMapper.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/24/26.
//


import Foundation
import FirebaseFirestore

enum PostDocMapper {

    static func mapDocToPost(_ doc: QueryDocumentSnapshot) -> PostDoc? {
        let d = doc.data()

        func nonEmptyString(_ v: Any?) -> String? {
            let s = (v as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
            return (s?.isEmpty == false) ? s : nil
        }

        func pickString(_ keys: [String]) -> String? {
            for k in keys { if let s = nonEmptyString(d[k]) { return s } }
            return nil
        }

        func parseDate(_ v: Any?) -> Date? {
            if let ts = v as? Timestamp { return ts.dateValue() }
            if let date = v as? Date { return date }
            return nil
        }

        func parseInt(_ v: Any?) -> Int? {
            if let n = v as? Int { return n }
            if let n = v as? Int64 { return Int(n) }
            if let n = v as? Double { return Int(n) }
            return nil
        }

        let description =
            (d["description"] as? String)
            ?? (d["content"] as? String)
            ?? (d["text"] as? String)
            ?? ""

        let authorId =
            (d["authorId"] as? String)
            ?? (d["hostUserId"] as? String)
            ?? (d["ownerUid"] as? String)
            ?? (d["uid"] as? String)
            ?? ""
        let trimmedAuthor = authorId.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmedAuthor.isEmpty { return nil }

        let type: PostType = {
            if let raw = d["type"] as? String, let t = PostType(rawValue: raw) { return t }
            if (d["isEvent"] as? Bool) == true { return .event }
            if (d["isAnnouncement"] as? Bool) == true { return .announcement }
            return .post
        }()

        let campusId = (pickString(["campusId", "campusID"]) ?? "").trimmingCharacters(in: .whitespacesAndNewlines)

        var ownerType: PostOwnerType = {
            if let raw = d["ownerType"] as? String, let t = PostOwnerType(rawValue: raw) { return t }
            if let raw = d["ownerKind"] as? String, let t = PostOwnerType(rawValue: raw) { return t }
            if let _ = nonEmptyString(d["clubId"]) { return .club }
            if (d["isCampusPost"] as? Bool) == true { return .campus }
            return .personal
        }()

        let clubIdRaw = nonEmptyString(d["clubId"])
        let clubId: String? = (ownerType == .club) ? clubIdRaw : nil
        if ownerType == .club, clubId == nil { ownerType = .personal }

        let imageUrls: [String] = {
            if let arr = d["imageUrls"] as? [String] { return arr }
            if let arrAny = d["imageUrls"] as? [Any] {
                return arrAny.compactMap { ($0 as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) }
                    .filter { !$0.isEmpty }
            }
            if let one = nonEmptyString(d["imageUrl"]) { return [one] }
            return []
        }()

        let createdAt = parseDate(d["createdAt"]) ?? parseDate(d["created_at"])
        let editedAt = parseDate(d["editedAt"]) ?? parseDate(d["edited_at"])

        let editCount = parseInt(d["editCount"])
        let commentsCount = parseInt(d["commentsCount"])
        let repliesCommentsCount = parseInt(d["repliesCommentsCount"])
        let seenCount = parseInt(d["seenCount"])

        let likedBy: [String]? = {
            if let arr = d["likedBy"] as? [String] { return arr }
            if let dict = d["likedBy"] as? [String: Any] { return Array(dict.keys) }
            return nil
        }()

        let ownerName = pickString(["ownerName", "ownerDisplayName", "ownerLabel", "ownerTitle", "owner"])
        let ownerPhotoURL = pickString(["ownerPhotoURL", "ownerPhotoUrl", "ownerAvatarUrl", "ownerLogoUrl", "ownerImageUrl"])

        let authorUsername = pickString(["authorUsername", "username", "authorHandle"])
        let authorDisplayName = pickString(["authorDisplayName", "authorName", "displayName", "name"])
        let authorPhotoURL = pickString(["authorPhotoURL", "authorPhotoUrl", "authorAvatarUrl", "photoURL", "avatarUrl"])

        let event: PostEventLogistics? = {
            guard type == .event else { return nil }

            if let eventDict = d["event"] as? [String: Any] {
                var e = PostEventLogistics()
                if let ts = eventDict["startsAt"] as? Timestamp { e.startsAt = ts.dateValue() }
                if let dt = eventDict["startsAt"] as? Date { e.startsAt = dt }
                e.locationLabel = (eventDict["locationLabel"] as? String) ?? ""
                e.locationUrl = (eventDict["locationUrl"] as? String) ?? ""
                e.lat = eventDict["lat"] as? Double
                e.lng = eventDict["lng"] as? Double
                return e
            }

            var e = PostEventLogistics()
            if let ts = d["startsAt"] as? Timestamp { e.startsAt = ts.dateValue() }
            e.locationLabel = d["locationLabel"] as? String ?? ""
            e.locationUrl = d["locationUrl"] as? String ?? ""
            e.lat = d["lat"] as? Double
            e.lng = d["lng"] as? Double
            return e
        }()

        return PostDoc(
            id: doc.documentID,
            ownerType: ownerType,
            campusId: campusId,
            clubId: clubId,
            description: description,
            authorId: trimmedAuthor,
            type: type,
            imageUrls: imageUrls,
            ownerName: ownerName,
            ownerPhotoURL: ownerPhotoURL,
            authorUsername: authorUsername,
            authorDisplayName: authorDisplayName,
            authorPhotoURL: authorPhotoURL,
            createdAt: createdAt,
            editedAt: editedAt,
            editCount: editCount,
            commentsCount: commentsCount,
            repliesCommentsCount: repliesCommentsCount,
            seenCount: seenCount,
            likedBy: likedBy,
            event: event
        )
    }

    static func mapLegacyEventDocToPost(_ doc: QueryDocumentSnapshot, fallbackCampusId: String) -> PostDoc? {
        let d = doc.data()

        func nonEmptyString(_ v: Any?) -> String? {
            let s = (v as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
            return (s?.isEmpty == false) ? s : nil
        }

        func pickString(_ keys: [String]) -> String? {
            for k in keys { if let s = nonEmptyString(d[k]) { return s } }
            return nil
        }

        let authorId =
            (d["hostUserId"] as? String)
            ?? (d["authorId"] as? String)
            ?? (d["uid"] as? String)
            ?? ""
        let trimmedAuthor = authorId.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmedAuthor.isEmpty { return nil }

        let campusId = (pickString(["campusId", "campusID"]) ?? fallbackCampusId)
            .trimmingCharacters(in: .whitespacesAndNewlines)

        let description =
            (d["description"] as? String)
            ?? (d["content"] as? String)
            ?? (d["text"] as? String)
            ?? (d["title"] as? String)
            ?? ""

        let createdAt =
            (d["createdAt"] as? Timestamp)?.dateValue()
            ?? (d["created_at"] as? Timestamp)?.dateValue()

        let ownerName = pickString(["ownerName", "hostName", "name", "displayName"])
        let ownerPhotoURL = pickString(["ownerPhotoURL", "photoURL", "avatarUrl"])

        var e = PostEventLogistics()
        if let ts = d["startsAt"] as? Timestamp { e.startsAt = ts.dateValue() }
        if let ts = d["startTime"] as? Timestamp { e.startsAt = ts.dateValue() }
        e.locationLabel = (d["locationLabel"] as? String) ?? (d["location"] as? String) ?? ""
        e.locationUrl = (d["locationUrl"] as? String) ?? ""
        e.lat = d["lat"] as? Double
        e.lng = d["lng"] as? Double

        return PostDoc(
            id: doc.documentID,
            ownerType: .personal,
            campusId: campusId,
            clubId: nil,
            description: description,
            authorId: trimmedAuthor,
            type: .event,
            imageUrls: [],
            ownerName: ownerName,
            ownerPhotoURL: ownerPhotoURL,
            authorUsername: nil,
            authorDisplayName: nil,
            authorPhotoURL: nil,
            createdAt: createdAt,
            editedAt: nil,
            editCount: nil,
            commentsCount: nil,
            repliesCommentsCount: nil,
            seenCount: nil,
            likedBy: nil,
            event: e
        )
    }

    static func guessCampusId(from docs: [QueryDocumentSnapshot]) -> String {
        for doc in docs {
            if let c = doc.data()["campusId"] as? String,
               !c.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                return c.trimmingCharacters(in: .whitespacesAndNewlines)
            }
        }
        return ""
    }
}