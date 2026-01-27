//
//  LocationSearchSheet.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/15/26.
//
//  Reusable location search + picker (MapKit local search)
//

import SwiftUI
import Combine
import MapKit

// MARK: - Result model you can store in Firestore (label + coords + optional url)

struct PickedLocation: Equatable, Hashable {
    let label: String
    let lat: Double
    let lng: Double
    let urlString: String?   // can be nil; keep in event.locationUrl if you want
}

// MARK: - ViewModel (MKLocalSearchCompleter + resolve to coordinate)

@MainActor
final class LocationSearchVM: NSObject, ObservableObject, MKLocalSearchCompleterDelegate {

    @Published private(set) var results: [MKLocalSearchCompletion] = []
    @Published private(set) var isLoading = false

    private let completer = MKLocalSearchCompleter()
    private var lastQuery: String = ""

    override init() {
        super.init()
        completer.delegate = self
        completer.resultTypes = [.address, .pointOfInterest]
    }

    func updateQuery(_ q: String) {
        let t = q.trimmingCharacters(in: .whitespacesAndNewlines)
        lastQuery = t
        isLoading = !t.isEmpty
        results = []
        completer.queryFragment = t
    }

    func clearResults() {
        results = []
        isLoading = false
    }

    // MARK: - MKLocalSearchCompleterDelegate

    func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        isLoading = false
        results = completer.results
    }

    func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
        isLoading = false
        results = []
    }

    // MARK: - Resolve to coordinates + link

    func resolve(_ completion: MKLocalSearchCompletion) async throws -> PickedLocation {
        let request = MKLocalSearch.Request(completion: completion)
        let search = MKLocalSearch(request: request)
        let response = try await search.start()

        guard let item = response.mapItems.first else {
            throw NSError(
                domain: "LocationSearchVM",
                code: 404,
                userInfo: [NSLocalizedDescriptionKey: "Location not found."]
            )
        }

        let coord = item.placemark.coordinate

        // Prefer official Maps URL if available; otherwise fall back to a coordinate URL
        let urlString: String? = item.url?.absoluteString
            ?? URL(string: "https://maps.apple.com/?ll=\(coord.latitude),\(coord.longitude)")?.absoluteString

        // Build a nicer label: "Name • Street, City, State"
        let name = (item.name ?? completion.title)
            .trimmingCharacters(in: .whitespacesAndNewlines)

        let pm = item.placemark
        let parts: [String] = [
            pm.thoroughfare,
            pm.locality,
            pm.administrativeArea
        ]
        .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { !$0.isEmpty }

        let address = parts.joined(separator: ", ")
        let label = name

        return PickedLocation(
            label: label,
            lat: coord.latitude,
            lng: coord.longitude,
            urlString: urlString
        )
    }
}


// MARK: - Reusable sheet view

struct LocationSearchSheet: View {
    let title: String
    let initialQuery: String
    let onPick: (PickedLocation) -> Void

    @Environment(\.dismiss) private var dismiss
    @StateObject private var vm = LocationSearchVM()
    @State private var query: String = ""
    @State private var isResolving = false
    @State private var errorText: String?

    init(
        title: String = "Pick location",
        initialQuery: String = "",
        onPick: @escaping (PickedLocation) -> Void
    ) {
        self.title = title
        self.initialQuery = initialQuery
        self.onPick = onPick
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    TextField("Search", text: $query)
                        .textInputAutocapitalization(.words)
                        .autocorrectionDisabled(false)
                        .onChange(of: query) { vm.updateQuery($0) }
                }

                if vm.isLoading {
                    Section {
                        HStack {
                            Spacer()
                            ProgressView().scaleEffect(0.9)
                            Spacer()
                        }
                    }
                }

                if let errorText {
                    Section {
                        Text(errorText).foregroundStyle(.red)
                    }
                }

                Section {
                    ForEach(vm.results, id: \.self) { item in
                        Button {
                            Task { await pick(item) }
                        } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(item.title).lineLimit(1)
                                if !item.subtitle.isEmpty {
                                    Text(item.subtitle)
                                        .font(.footnote)
                                        .foregroundStyle(.secondary)
                                        .lineLimit(1)
                                }
                            }
                        }
                        .disabled(isResolving)
                        .tint(Color.primary)
                    }
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Clear") {
                        query = ""
                        vm.updateQuery("")
                        errorText = nil
                    }
                    .disabled(query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .onAppear {
                query = initialQuery
                vm.updateQuery(initialQuery)
            }
        }
    }

    private func pick(_ item: MKLocalSearchCompletion) async {
        guard !isResolving else { return }
        isResolving = true
        defer { isResolving = false }

        do {
            let resolved = try await vm.resolve(item)
            let picked = PickedLocation(
                label: resolved.label,
                lat: resolved.lat,
                lng: resolved.lng,
                urlString: resolved.urlString
            )
            onPick(picked)
            dismiss()
        } catch {
            errorText = error.localizedDescription
        }
    }
}
