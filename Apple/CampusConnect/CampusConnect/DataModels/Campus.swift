//
//  Campus.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/12/26.
//


import Foundation

struct Campus: Identifiable, Hashable {
    let id: String
    let name: String
    let shortName: String?
    let hasDorms: Bool
    let dorms: [String]          // or fetch from subcollection if you prefer
    let defaultClubIds: [String] // for auto-join (optional)

    static let empty = Campus(id: "", name: "", shortName: nil, hasDorms: false, dorms: [], defaultClubIds: [])
}