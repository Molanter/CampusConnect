//
//  CreateClubVM.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/27/26.
//


import Combine
import Foundation

@MainActor
final class CreateClubVM: ObservableObject {
    @Published var name: String = ""
    @Published var description: String = ""
    @Published var category: String = ""
    @Published var isPrivate: Bool = false

    @Published private(set) var isSubmitting: Bool = false
    @Published var errorMessage: String? = nil
    @Published var createdClubId: String? = nil

    private let service: ClubService

    init(service: ClubService = ClubServiceFS()) {
        self.service = service
    }

    func submit(campusId: String, createdBy: String) async {
        let trimmedCampus = campusId.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedCreator = createdBy.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !trimmedCampus.isEmpty else {
            errorMessage = "Campus id is missing."
            return
        }
        guard !trimmedCreator.isEmpty else {
            errorMessage = "User id is missing."
            return
        }
        guard !trimmedName.isEmpty else {
            errorMessage = "Club name is required."
            return
        }

        isSubmitting = true
        errorMessage = nil
        createdClubId = nil
        defer { isSubmitting = false }

        do {
            let id = try await service.createClub(
                campusId: trimmedCampus,
                createdBy: trimmedCreator,
                name: trimmedName,
                description: description.trimmingCharacters(in: .whitespacesAndNewlines),
                category: category.trimmingCharacters(in: .whitespacesAndNewlines),
                isPrivate: isPrivate
            )
            createdClubId = id
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
