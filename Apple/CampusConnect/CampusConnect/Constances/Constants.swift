//
//  k.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/11/26.
//

import SwiftUI

import SwiftUI

struct K {

    // MARK: - Colors
    struct Colors {
        @AppStorage("appPrimaryHex") private static var primaryHex = "FFB200"

        static var primary: Color {
            Color(hex: primaryHex)
        }

        static func setPrimary(_ hex: String) {
            primaryHex = hex
        }
    }

    // MARK: - Layout
    struct Layout {

        // Base (Apple-like defaults)
        private static let baseCornerRadius: CGFloat = 24
        private static let basePadding: CGFloat = 16
        private static let baseButtonHeight: CGFloat = 52

        // User adjustments
        @AppStorage("cornerRadiusDelta") private static var cornerRadiusDelta: Double = 0
        @AppStorage("paddingDelta") private static var paddingDelta: Double = 0
        @AppStorage("buttonHeightDelta") private static var buttonHeightDelta: Double = 0

        // Effective values
        static var cornerRadius: CGFloat {
            baseCornerRadius + CGFloat(cornerRadiusDelta)
        }

        static var padding: CGFloat {
            basePadding + CGFloat(paddingDelta)
        }

        static var buttonHeight: CGFloat {
            baseButtonHeight + CGFloat(buttonHeightDelta)
        }
    }
}


extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)

        let a, r, g, b: UInt64
        switch hex.count {
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 255)
        }

        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
