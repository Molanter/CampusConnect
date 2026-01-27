//
//  TabBarVisibilityModifier.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/16/26.
//


import SwiftUI
import Combine
import UIKit

// MARK: - Public API

extension View {
    /// Hides the tab bar while this view is visible, restores previous state on disappear.
    func hideTabBar() -> some View { tabBarHidden(true) }

    /// Shows the tab bar while this view is visible, restores previous state on disappear.
    func showTabBar() -> some View { tabBarHidden(false) }

    /// Controls tab bar visibility for the lifetime of this view on screen.
    func tabBarHidden(_ hidden: Bool) -> some View {
        modifier(TabBarVisibilityModifier(hidden: hidden))
    }
}

// MARK: - Modifier

private struct TabBarVisibilityModifier: ViewModifier {
    let hidden: Bool
    @StateObject private var box = TabBarControllerBox()

    func body(content: Content) -> some View {
        content
            .background(
                TabBarControllerResolver { tabBarController in
                    // Capture once and apply state
                    if box.tabBarController == nil {
                        box.tabBarController = tabBarController
                        box.previousIsHidden = tabBarController.tabBar.isHidden
                    }
                    apply(hidden: hidden)
                }
                .frame(width: 0, height: 0)
            )
            .onAppear { apply(hidden: hidden) }
            .onDisappear { restorePreviousState() }
    }

    @MainActor
    private func apply(hidden: Bool) {
        guard let tbc = box.tabBarController else { return }
        if tbc.tabBar.isHidden != hidden {
            tbc.tabBar.isHidden = hidden
        }
    }

    @MainActor
    private func restorePreviousState() {
        guard let tbc = box.tabBarController else { return }
        if let prev = box.previousIsHidden {
            tbc.tabBar.isHidden = prev
        } else {
            tbc.tabBar.isHidden = false
        }
    }
}

private final class TabBarControllerBox: ObservableObject {
    weak var tabBarController: UITabBarController?
    var previousIsHidden: Bool?
}

// MARK: - UIKit Resolver

private struct TabBarControllerResolver: UIViewControllerRepresentable {
    let onResolve: (UITabBarController) -> Void

    func makeUIViewController(context: Context) -> ResolverViewController {
        ResolverViewController(onResolve: onResolve)
    }

    func updateUIViewController(_ uiViewController: ResolverViewController, context: Context) {
        uiViewController.onResolve = onResolve
        uiViewController.resolveIfPossible()
    }

    final class ResolverViewController: UIViewController {
        var onResolve: ((UITabBarController) -> Void)?

        init(onResolve: ((UITabBarController) -> Void)?) {
            self.onResolve = onResolve
            super.init(nibName: nil, bundle: nil)
        }

        required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

        override func viewDidAppear(_ animated: Bool) {
            super.viewDidAppear(animated)
            resolveIfPossible()
        }

        func resolveIfPossible() {
            guard let tbc = tabBarController else { return }
            onResolve?(tbc)
        }
    }
}



// .hideTabBar()
