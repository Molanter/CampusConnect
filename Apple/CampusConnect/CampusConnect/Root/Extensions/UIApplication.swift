//
//  UIApplication.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/11/26.
//

import UIKit

extension UIApplication {
    @MainActor
    func topMostViewController() -> UIViewController? {
        guard let scene = connectedScenes.first as? UIWindowScene else { return nil }
        guard let root = scene.windows.first(where: { $0.isKeyWindow })?.rootViewController else { return nil }

        var top = root
        while let presented = top.presentedViewController {
            top = presented
        }
        return top
    }
}
