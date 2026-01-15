//
//  ProfileSetupView.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/12/26.
//

import SwiftUI
import FirebaseAuth
import Combine

struct ProfileSetupView: View {
    @EnvironmentObject private var authVM: AuthViewModel
    @StateObject private var vm = ProfileSetupViewModel()

    var body: some View {
        NavigationStack {
            Form {
                Section("Username (required)") {
                    TextField("@username", text: $vm.username)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }

                Section("Campus (required)") {
                    if vm.campuses.isEmpty {
                        ProgressView()
                    } else {
                        Picker("Campus", selection: $vm.selectedCampusId) {
                            Text("Select campus").tag("")
                            ForEach(vm.campuses) { c in
                                Text(c.name).tag(c.id)
                            }
                        }
                    }
                }

                Section("Primary Role (required)") {
                    Picker("Role", selection: $vm.role) {
                        ForEach(UserRole.allCases, id: \.self) { r in
                            // nicer label, still saves rawValue via tag(r)
                            Text(vm.roleLabel(r)).tag(r)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                if vm.shouldRequireDorm {
                    Section("Dorm / Residence (required)") {
                        Picker("Dorm", selection: $vm.dorm) {
                            Text("Select dorm").tag("")
                            ForEach(vm.selectedCampus?.dorms ?? [], id: \.self) { d in
                                Text(d).tag(d)
                            }
                        }
                    }
                } else if vm.role == .student {
                    Section("Dorm / Residence") {
                        TextField("Optional", text: $vm.dorm)
                    }
                }

                if vm.role == .student {
                    Section("Major") {
                        TextField("Optional", text: $vm.major)
                    }
                    Section("Year of Study") {
                        TextField("Optional", text: $vm.yearOfStudy)
                    }
                }

                if let msg = vm.errorMessage {
                    Section {
                        Text(msg).foregroundStyle(.red)
                    }
                }

                Section {
                    Button {
                        Task { await vm.save() }
                    } label: {
                        HStack {
                            Spacer()
                            if vm.isSaving {
                                ProgressView()
                            } else {
                                Text("Save Profile").fontWeight(.semibold)
                            }
                            Spacer()
                        }
                    }
                    .disabled(vm.isSaving)
                }
            }
            .navigationTitle("Finish Profile")
            .navigationBarTitleDisplayMode(.inline)
            .task { await vm.loadInitial() }
        }
    }
}

@MainActor
final class ProfileSetupViewModel: ObservableObject {
    @Published var campuses: [Campus] = []
    @Published var selectedCampusId: String = ""
    @Published var role: UserRole = .student

    @Published var username: String = ""
    @Published var dorm: String = ""
    @Published var major: String = ""
    @Published var yearOfStudy: String = ""

    @Published var isSaving: Bool = false
    @Published var errorMessage: String?

    private var uid: String? { Auth.auth().currentUser?.uid }
    private var previousCampusId: String?

    var selectedCampus: Campus? {
        campuses.first(where: { $0.id == selectedCampusId })
    }

    // ✅ dorm required for students on university campuses
    var shouldRequireDorm: Bool {
        role == .student && (selectedCampus?.isUniversity ?? false)
    }

    func roleLabel(_ r: UserRole) -> String {
        switch r {
        case .student: return "Student"
        case .faculty: return "Faculty"
        case .staff: return "Staff"
        }
    }

    func loadInitial() async {
        errorMessage = nil
        do {
            campuses = try await CampusServiceFS.fetchCampuses()

            guard let uid else { return }
            let profile = try await ProfileService.fetchProfile(uid: uid)

            username = profile?.username ?? ""
            role = profile?.role ?? .student

            let existingCampusId = profile?.campusId ?? ""
            selectedCampusId = existingCampusId
            previousCampusId = existingCampusId

            dorm = profile?.dorm ?? ""
            major = profile?.major ?? ""
            yearOfStudy = profile?.yearOfStudy ?? ""

            // If dorm is required but current value is not in list, reset
            if shouldRequireDorm,
               !dorm.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
               let dorms = selectedCampus?.dorms,
               !dorms.isEmpty,
               !dorms.contains(dorm) {
                dorm = ""
            }
        } catch {
            errorMessage = "Failed to load setup form."
        }
    }

    func save() async {
        errorMessage = nil
        isSaving = true
        defer { isSaving = false }

        guard let uid else {
            errorMessage = ProfileSetupError.notSignedIn.localizedDescription
            return
        }

        guard let campus = selectedCampus else {
            errorMessage = ProfileSetupError.missingRequired("Campus").localizedDescription
            return
        }

        // Ensure dorm is chosen if required
        if shouldRequireDorm {
            let d = dorm.trimmingCharacters(in: .whitespacesAndNewlines)
            if d.isEmpty {
                errorMessage = ProfileSetupError.dormRequired.localizedDescription
                return
            }
        }

        do {
            try await ProfileService.saveProfile(
                uid: uid,
                displayName: Auth.auth().currentUser?.displayName,
                username: username,
                campus: campus,
                role: role,
                dorm: dorm.trimmingCharacters(in: .whitespacesAndNewlines),
                major: major.trimmingCharacters(in: .whitespacesAndNewlines),
                yearOfStudy: yearOfStudy.trimmingCharacters(in: .whitespacesAndNewlines),
                previousCampusId: previousCampusId
            )
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? "Failed to save."
        }
    }
}
