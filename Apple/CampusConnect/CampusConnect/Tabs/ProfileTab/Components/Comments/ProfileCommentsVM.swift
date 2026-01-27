//
//  ProfileCommentsVM.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/24/26.
//


import Foundation
import Combine

@MainActor
final class ProfileCommentsVM: ObservableObject {
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    func loadIfNeeded(uid: String) async {
        // TODO: implement when comments model/query is ready
    }

    func refresh(uid: String) async {
        // TODO
    }
}
