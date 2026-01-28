//
//  MapTileMenu.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/15/26.
//

import SwiftUI
import MapKit

struct MapTileMenu: View {
    let coord: CLLocationCoordinate2D?
    let label: String
    let size: CGFloat
    let strokeColor: Color
    let background: Color
    let accent: Color
    let metaColor: Color

    @Environment(\.openURL) private var openURL

    init(
        coord: CLLocationCoordinate2D?,
        label: String,
        size: CGFloat = 135,
        strokeColor: Color,
        background: Color,
        accent: Color,
        metaColor: Color = .secondary
    ) {
        self.coord = coord
        self.label = label.trimmingCharacters(in: .whitespacesAndNewlines)
        self.size = size
        self.strokeColor = strokeColor
        self.background = background
        self.accent = accent
        self.metaColor = metaColor
    }

    var body: some View {
        tile
            .contextMenu {
                Button {
                    guard let coord else { return }
                    openAppleMaps(to: coord, name: label.isEmpty ? nil : label)
                } label: {
                    Label("Open in Apple Maps", systemImage: "map")
                }
                .disabled(coord == nil)

                Button {
                    guard let coord else { return }
                    openGoogleMaps(to: coord, name: label.isEmpty ? nil : label)
                } label: {
                    Label("Open in Google Maps", systemImage: "g.circle")
                }
                .disabled(coord == nil)
            } preview: {
                mapPreview
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Open event location")
    }

    // MARK: - Tile

    private var tile: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(background)

            if let coord {
                let region = MKCoordinateRegion(
                    center: coord,
                    span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)
                )

                Map(initialPosition: .region(region), interactionModes: []) {
                    Marker("Location", coordinate: coord)
                }
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(alignment: .bottomLeading) {
                    HStack(spacing: 6) {
                        Image(systemName: "mappin.and.ellipse")
                            .font(.caption.weight(.semibold))

                        Text(label.isEmpty ? "Open map" : label)
                            .font(.caption.weight(.semibold))
                            .lineLimit(1)
                    }
                    .foregroundStyle(.primary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 8)
                    .background(.ultraThinMaterial, in: Capsule())
                    .padding(10)
                }
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(strokeColor, lineWidth: 1)
                )
            } else {
                VStack(spacing: 8) {
                    Image(systemName: "mappin.and.ellipse")
                        .font(.system(size: 28, weight: .semibold))
                        .foregroundStyle(accent)

                    Text("Map")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(metaColor)
                        .lineLimit(1)

                    if !label.isEmpty {
                        Text(label)
                            .font(.caption)
                            .foregroundStyle(metaColor)
                            .lineLimit(2)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 8)
                    }
                }
                .padding(.vertical, 10)
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(strokeColor, lineWidth: 1)
                )
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    // MARK: - Context menu preview

    @ViewBuilder
    private var mapPreview: some View {
        if let coord {
            let region = MKCoordinateRegion(
                center: coord,
                span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)
            )

            ZStack {
                Map(initialPosition: .region(region), interactionModes: []) {
                    Marker("Location", coordinate: coord)
                }
                .allowsHitTesting(false)

                VStack(alignment: .leading, spacing: 6) {
                    Spacer()
                    HStack(spacing: 6) {
                        Image(systemName: "mappin.and.ellipse")
                            .font(.caption.weight(.semibold))
                        Text(label.isEmpty ? "Event Location" : label)
                            .font(.caption.weight(.semibold))
                            .lineLimit(1)
                    }
                    .foregroundStyle(.primary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 8)
                    .background(.ultraThinMaterial, in: Capsule())
                }
                .padding(12)
            }
            .frame(width: 320, height: 220)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        } else {
            VStack(spacing: 10) {
                Image(systemName: "mappin.and.ellipse")
                    .font(.system(size: 34, weight: .semibold))
                    .foregroundStyle(accent)
                Text("No location")
                    .font(.headline)
                if !label.isEmpty {
                    Text(label)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 10)
                }
            }
            .frame(width: 320, height: 220)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
    }

    // MARK: - Maps openers

    private func openAppleMaps(to coord: CLLocationCoordinate2D, name: String?) {
        let placemark = MKPlacemark(coordinate: coord)
        let item = MKMapItem(placemark: placemark)
        item.name = (name ?? "").isEmpty ? "Event Location" : name
        item.openInMaps(launchOptions: [
            MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDriving
        ])
    }

    private func openGoogleMaps(to coord: CLLocationCoordinate2D, name: String?) {
        let nameTrimmed = (name ?? "").trimmingCharacters(in: .whitespacesAndNewlines)

        var appComps = URLComponents()
        appComps.scheme = "comgooglemaps"
        appComps.host = ""
        appComps.queryItems = [
            URLQueryItem(name: "q", value: nameTrimmed.isEmpty
                         ? "\(coord.latitude),\(coord.longitude)"
                         : "\(coord.latitude),\(coord.longitude)(\(nameTrimmed))"),
            URLQueryItem(name: "center", value: "\(coord.latitude),\(coord.longitude)"),
            URLQueryItem(name: "zoom", value: "14")
        ]

        if let appURL = appComps.url, UIApplication.shared.canOpenURL(appURL) {
            openURL(appURL)
            return
        }

        var webComps = URLComponents(string: "https://www.google.com/maps/search/")!
        webComps.queryItems = [
            URLQueryItem(name: "api", value: "1"),
            URLQueryItem(name: "query", value: "\(coord.latitude),\(coord.longitude)")
        ]
        if let webURL = webComps.url {
            openURL(webURL)
        }
    }
}
