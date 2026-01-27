//
//  AnnouncementMarkerWebText.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/16/26.
//
//  Uses: https://github.com/gonzalezreal/swift-markdown-ui
// You're on an older/newer MarkdownUI API where `markdownBlockStyle` expects a *WritableKeyPath*,
// and `\.document` is not available (or not a block style in your version).
//
// Fix: don't style `document`. Wrap the whole Markdown view in a single background instead,
// and only use block styles that exist in your version (paragraph/heading/listItem/etc).

import SwiftUI
import MarkdownUI

struct PostBodyMarkdown: View {
    let text: String
    let isAnnouncement: Bool
    let markerColor: Color
    let overrideTextColor: Color?

    @Environment(\.colorScheme) private var colorScheme

    private var resolvedTextColor: Color {
        overrideTextColor ?? (colorScheme == .dark ? .white : .black)
    }

    private var announcementAlpha: CGFloat {
        colorScheme == .dark ? 0.28 : 0.20
    }

    private var codeBg: Color {
        Color.secondary.opacity(colorScheme == .dark ? 0.20 : 0.12)
    }

    // ✅ highlight ONLY when the announcement is "plain" (title + normal text only)
    // If you already compute this elsewhere, pass it in instead.
    private var shouldHighlightPlainAnnouncement: Bool {
        guard isAnnouncement else { return false }
        return isPlainAnnouncementMarkdown(text)
    }

    var body: some View {
        let md = Markdown(MarkdownContent(text))
            .markdownMargin(top: 0, bottom: 0)
            .frame(maxWidth: .infinity, alignment: .leading)
            .fixedSize(horizontal: false, vertical: true)
            .postBodyTextStyles(resolvedTextColor: resolvedTextColor, codeBg: codeBg)
            .postBodyBlockStyles(markerColor: markerColor, codeBg: codeBg, colorScheme: colorScheme)
            // tighten internal spacing so it looks like one card
            .padding(.vertical, shouldHighlightPlainAnnouncement ? 8 : 0)
            .padding(.horizontal, shouldHighlightPlainAnnouncement ? 10 : 0)
            .background {
                if shouldHighlightPlainAnnouncement {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(markerColor.opacity(announcementAlpha))
                }
            }

        return md
    }
}

// MARK: - Style helpers

private extension View {
    func postBodyTextStyles(resolvedTextColor: Color, codeBg: Color) -> some View {
        self
            .markdownTextStyle {
                FontFamily(.system())
                FontSize(15)
                ForegroundColor(resolvedTextColor)
            }
            .markdownTextStyle(\.code) {
                FontFamilyVariant(.monospaced)
                FontSize(.em(0.90))
                ForegroundColor(resolvedTextColor)
                BackgroundColor(codeBg)
            }
            .markdownTextStyle(\.link) {
                ForegroundColor(K.Colors.primary)
                UnderlineStyle(.single)
            }
    }

    func postBodyBlockStyles(markerColor: Color, codeBg: Color, colorScheme: ColorScheme) -> some View {
        self
            .markdownBlockStyle(\.paragraph) { cfg in
                cfg.label
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .markdownMargin(top: 0, bottom: 0)
            }
            .markdownBlockStyle(\.heading1) { cfg in
                cfg.label
                    .markdownTextStyle {
                        FontSize(.em(1.45))
                        FontWeight(.semibold)
                    }
                    .markdownMargin(top: 0, bottom: 8)
            }
            .markdownBlockStyle(\.heading2) { cfg in
                cfg.label
                    .markdownTextStyle {
                        FontSize(.em(1.25))
                        FontWeight(.semibold)
                    }
                    .markdownMargin(top: 0, bottom: 6)
            }
            .markdownBlockStyle(\.heading3) { cfg in
                cfg.label
                    .markdownTextStyle {
                        FontSize(.em(1.10))
                        FontWeight(.semibold)
                    }
                    .markdownMargin(top: 0, bottom: 6)
            }
            .markdownBlockStyle(\.listItem) { cfg in
                cfg.label
                    .markdownMargin(top: .em(0.15), bottom: .em(0.15))
            }
            .markdownBlockStyle(\.blockquote) { cfg in
                cfg.label
                    .padding(.vertical, 6)
                    .padding(.horizontal, 10)
                    .overlay(alignment: .leading) {
                        Rectangle()
                            .fill(markerColor.opacity(colorScheme == .dark ? 0.55 : 0.45))
                            .frame(width: 3)
                    }
                    .background(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .fill(Color.secondary.opacity(colorScheme == .dark ? 0.14 : 0.10))
                    )
                    .markdownMargin(top: 6, bottom: 6)
            }
            .markdownBlockStyle(\.codeBlock) { cfg in
                cfg.label
                    .padding(10)
                    .background(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .fill(codeBg)
                    )
                    .markdownMargin(top: 6, bottom: 6)
            }
            // In your version, thematicBreak takes 0-arg closure
            .markdownBlockStyle(\.thematicBreak) {
                Rectangle()
                    .fill(Color.secondary.opacity(colorScheme == .dark ? 0.28 : 0.20))
                    .frame(height: 1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 10)
            }
    }
}

// MARK: - "Plain announcement" detection
// Rules:
// - allow: normal text + heading lines (#, ##, ###...) + whitespace/newlines
// - disallow if it contains typical markdown for bold/italic/code/lists/quotes/links/images/hr/etc.

private func isPlainAnnouncementMarkdown(_ s: String) -> Bool {
    let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !t.isEmpty else { return true }

    // Disallow common markdown constructs beyond headings/plain text
    let bannedPatterns: [String] = [
        #"(^|\s)([*_]{1,2}).+?\2"#,          // *italic* or **bold** (basic)
        #"`"#,                               // inline/backtick code
        #"(^|\n)\s*[-*+]\s+"#,               // bullet list
        #"(^|\n)\s*\d+\.\s+"#,               // numbered list
        #"(^|\n)\s*>\s+"#,                   // blockquote
        #"$begin:math:display$\.\+\?$end:math:display$$begin:math:text$\.\+\?$end:math:text$"#,                  // links
        #"!$begin:math:display$\.\*\?$end:math:display$$begin:math:text$\.\+\?$end:math:text$"#,                 // images
        #"(^|\n)\s*---\s*(\n|$)"#,           // thematic break
        #"\|\s*.+\s*\|"#                     // tables (rough)
    ]

    for p in bannedPatterns {
        if t.range(of: p, options: [.regularExpression]) != nil {
            return false
        }
    }
    return true
}
