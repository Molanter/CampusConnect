//
//  ReportReason.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/20/26.
//


import SwiftUI

enum ReportReason: String, CaseIterable, Identifiable, Codable {
    case spam
    case harassment
    case hate
    case nudity
    case violence
    case illegal
    case other

    var id: String { rawValue }

    var label: String {
        switch self {
        case .spam: return "Spam"
        case .harassment: return "Harassment"
        case .hate: return "Hate speech"
        case .nudity: return "Nudity or sexual content"
        case .violence: return "Violence or threats"
        case .illegal: return "Illegal activity"
        case .other: return "Other"
        }
    }
}
