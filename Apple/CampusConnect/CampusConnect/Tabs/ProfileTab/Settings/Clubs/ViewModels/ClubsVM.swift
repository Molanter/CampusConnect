//
//  ClubsVM.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/27/26.
//


import Combine
import Foundation

@MainActor
final class ClubsVM: ObservableObject {
    @Published private(set) var clubs: [Club] = []
    @Published private(set) var isLoading: Bool = false
    @Published var errorMessage: String? = nil

    private let service: ClubService
    private var task: Task<Void, Never>?

    init(service: ClubService = ClubServiceFS()) {
        self.service = service
    }

    func start(campusId: String) {
        task?.cancel()
        task = Task { [weak self] in
            await self?.load(campusId: campusId)
        }
    }

    func refresh(campusId: String) async {
        await load(campusId: campusId)
    }

    private func load(campusId: String) async {
        let trimmed = campusId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            clubs = []
            errorMessage = nil
            return
        }

        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let result = try await service.fetchClubs(campusId: trimmed, limit: 200)
            if Task.isCancelled { return }
            clubs = result
        } catch {
            if Task.isCancelled { return }
            errorMessage = error.localizedDescription
        }
    }
}
