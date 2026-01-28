//
//  ReportPostSheet.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/20/26.
//


import SwiftUI

@MainActor
struct ReportPostSheet: View {
    let postId: String
    var onSubmitted: (() -> Void)? = nil

    @Environment(\.dismiss) private var dismiss

    @State private var selectedReason: ReportReason? = nil
    @State private var details: String = ""
    @State private var isSubmitting = false
    @State private var errorText: String? = nil
    @State private var showSuccess = false

    private let service = PostReportService()
    private let maxChars = 500

    var body: some View {
        NavigationStack {
            Form {
                Section("Reason") {
                    ForEach(ReportReason.allCases) { reason in
                        Button {
                            selectedReason = reason
                            errorText = nil
                        } label: {
                            HStack {
                                Text(reason.label)
                                Spacer()
                                if selectedReason == reason {
                                    Image(systemName: "checkmark")
                                        .font(.body.weight(.semibold))
                                        .foregroundStyle(K.Colors.primary)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }

                Section("Details (optional)") {
                    TextEditor(text: Binding(
                        get: { details },
                        set: { details = String($0.prefix(maxChars)) }
                    ))
                    .frame(minHeight: 110)

                    HStack {
                        Spacer()
                        Text("\(details.count)/\(maxChars)")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }

                if let errorText {
                    Section {
                        Text(errorText)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Report Post")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                        .disabled(isSubmitting)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(isSubmitting ? "Submitting…" : "Submit") {
                        Task { await submit() }
                    }
                    .disabled(isSubmitting || selectedReason == nil)
                    .tint(K.Colors.primary)
                }
            }
        }
    }

    private func submit() async {
        guard let reason = selectedReason else {
            errorText = "Please select a reason."
            return
        }

        isSubmitting = true
        errorText = nil

        do {
            try await service.submitReport(postId: postId, reason: reason, details: details)
            showSuccess = true
            onSubmitted?()

            Toast.shared.present(
                title: "Report submitted",
                symbol: "flag.fill",
                tint: .green,
                isUserInteractionEnabled: true,
                timing: .long
            )

            try? await Task.sleep(nanoseconds: 1_500_000_000)
            dismiss()
        } catch {
            errorText = "Failed to submit report. Please try again."
            Toast.shared.present(
                title: errorText!,
                symbol: "exclamationmark",
                tint: .red,
                isUserInteractionEnabled: true,
                timing: .long
            )
        }
        
        isSubmitting = false
    }
}
