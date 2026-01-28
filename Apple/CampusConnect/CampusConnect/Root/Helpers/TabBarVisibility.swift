//
//  TabBarVisibility.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/15/26.
//


import SwiftUI

struct TabBarVisibility: UIViewControllerRepresentable {
    let hidden: Bool

    func makeUIViewController(context: Context) -> UIViewController {
        Controller(hidden: hidden)
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {
        (uiViewController as? Controller)?.hidden = hidden
    }

    final class Controller: UIViewController {
        var hidden: Bool { didSet { apply() } }

        init(hidden: Bool) {
            self.hidden = hidden
            super.init(nibName: nil, bundle: nil)
        }
        required init?(coder: NSCoder) { fatalError() }

        override func viewDidAppear(_ animated: Bool) {
            super.viewDidAppear(animated)
            apply()
        }

        private func apply() {
            tabBarController?.tabBar.isHidden = hidden
        }
    }
}