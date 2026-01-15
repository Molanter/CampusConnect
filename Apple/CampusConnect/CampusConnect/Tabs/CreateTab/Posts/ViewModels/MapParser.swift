//
//  MapParser.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/13/26.
//


import SwiftUI

struct ParsedLocation {
    var label: String
    var lat: Double?
    var lng: Double?
}

// Handles common patterns:
// - Google Maps: ".../@lat,lng,..." or "...?q=lat,lng" or "...?query=lat,lng"
// - Apple Maps: "...?ll=lat,lng" or "...?q=Label&ll=lat,lng"
enum MapParser {
    static func parse(urlString: String) -> ParsedLocation? {
        guard let url = URL(string: urlString.trimmingCharacters(in: .whitespacesAndNewlines)) else { return nil }
        let s = url.absoluteString

        // 1) @lat,lng
        if let at = s.range(of: "@") {
            let tail = s[at.upperBound...]
            let comps = tail.split(separator: "/").first?.split(separator: ",") ?? []
            if comps.count >= 2, let lat = Double(comps[0]), let lng = Double(comps[1]) {
                return ParsedLocation(label: "", lat: lat, lng: lng)
            }
        }

        // 2) Query params
        if let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems {
            func dblPair(_ value: String?) -> (Double, Double)? {
                guard let value else { return nil }
                let parts = value.split(separator: ",")
                guard parts.count == 2, let a = Double(parts[0]), let b = Double(parts[1]) else { return nil }
                return (a, b)
            }

            let q = items.first(where: { $0.name == "q" })?.value
            if let (lat, lng) = dblPair(q) { return ParsedLocation(label: "", lat: lat, lng: lng) }

            let query = items.first(where: { $0.name == "query" })?.value
            if let (lat, lng) = dblPair(query) { return ParsedLocation(label: "", lat: lat, lng: lng) }

            let ll = items.first(where: { $0.name == "ll" })?.value
            if let (lat, lng) = dblPair(ll) {
                let label = items.first(where: { $0.name == "q" })?.value ?? ""
                return ParsedLocation(label: label, lat: lat, lng: lng)
            }
        }

        return ParsedLocation(label: "", lat: nil, lng: nil)
    }
}
