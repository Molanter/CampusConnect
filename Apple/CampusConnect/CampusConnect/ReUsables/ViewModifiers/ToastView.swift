//
//  ToastView.swift
//  CampusConnect
//
//  Created by Edgars Yarmolatiy on 1/20/26.
//



import SwiftUI

/// Root View for Creating Overlay Window
struct ToastRootView<Content: View>: View {
    @ViewBuilder var content: Content
    /// View Properties
    @State private var overlayWindow: UIWindow?
    var body: some View {
        content
            .onAppear {
                if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene, overlayWindow == nil {
                    let window = PassthroughWindow(windowScene: windowScene)
                    window.backgroundColor = .clear
                    /// View Controller
                    let rootController = UIHostingController(rootView: ToastGroup())
                    rootController.view.frame = windowScene.keyWindow?.frame ?? .zero
                    rootController.view.backgroundColor = .clear
                    window.rootViewController = rootController
                    window.isHidden = false
                    window.isUserInteractionEnabled = true
                    window.tag = 1009
                    
                    overlayWindow = window
                }
            }
    }
}

fileprivate class PassthroughWindow: UIWindow {
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard let hitView = super.hitTest(point, with: event),
              let rootView = rootViewController?.view
        else { return nil }
        
        if #available(iOS 26, *) {
            if rootView.layer.hitTest(point)?.name == nil {
                return rootView
            } else {
                return nil
            }
        } else {
            if #available(iOS 18, *) {
                for subview in rootView.subviews.reversed() {
                    /// Finding if any of rootview's is receving hit test
                    let pointInSubView = subview.convert(point, from: rootView)
                    if subview.hitTest(pointInSubView, with: event) != nil {
                        return hitView
                    }
                }
                
                return nil
            } else {
                return hitView == rootView ? nil : hitView
            }
        }
    }
}

@Observable
class Toast {
    static let shared = Toast()
    fileprivate var toasts: [ToastItem] = []
    
    func present(title: String, symbol: String?, tint: Color = .primary, isUserInteractionEnabled: Bool = false, timing: ToastTime = .medium) {
        
        withAnimation(.snappy) {
            toasts.append(
                .init(
                    title: title,
                    symbol: symbol,
                    tint: tint,
                    isUserInteractionEnabled: isUserInteractionEnabled,
                    timing: timing
                )
            )
        }
    }
}

fileprivate struct ToastItem: Identifiable {
    let id: UUID = .init()
    /// Custom Properties
    var title: String
    var symbol: String?
    var tint: Color
    var isUserInteractionEnabled: Bool
    /// Timing
    var timing: ToastTime = .medium
}

enum ToastTime: CGFloat {
    case short = 1.0
    case medium = 3.0
    case long = 5.0
}

fileprivate struct ToastGroup: View {
    var model = Toast.shared
    var body: some View {
        GeometryReader {
            let size = $0.size
            let safeArea = $0.safeAreaInsets

            let topPadding: CGFloat = {
                if safeArea.top == .zero { return 4 }
                return max(2, safeArea.top - 100)
            }()

            ZStack {
                ForEach(model.toasts) { toast in
                    ToastView(size: size, item: toast)
                        .scaleEffect(scale(toast))
                        .offset(y: -offsetY(toast))
                        .zIndex(Double(model.toasts.firstIndex(where: { $0.id == toast.id }) ?? 0))
                }
            }
            .padding(.top, topPadding)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
    }
    
    func offsetY(_ item: ToastItem) -> CGFloat {
        let index = CGFloat(model.toasts.firstIndex(where: { $0.id == item.id }) ?? 0)
        let total = CGFloat(model.toasts.count) - 1
        let distanceFromNewest = total - index   // 0 for newest, 1 for older, ...

        let step: CGFloat = 8                    // tweak: 6–12
        let capped = min(distanceFromNewest, 3)  // cap stacking push (optional)

        return capped * step
    }
    
    func scale(_ item: ToastItem) -> CGFloat {
        let index = CGFloat(model.toasts.firstIndex(where: { $0.id == item.id }) ?? 0)
        let totalCount = CGFloat(model.toasts.count) - 1
        return 1.0 - ((totalCount - index) >= 2 ? 0.2 : ((totalCount - index) * 0.1))
    }
}

fileprivate struct ToastView: View {
    var size: CGSize
    var item: ToastItem
    /// View Properties
    @State private var delayTask: DispatchWorkItem?
    @State private var trigger = 0

    var body: some View {
        HStack(spacing: 0) {
            if let symbol = item.symbol {
                Image(systemName: symbol)
                    .font(.title3)
                    .foregroundStyle(item.tint)
                    .padding(.trailing, 10)
                    .symbolEffect(.bounce, value: trigger)
                    .task {
                        try? await Task.sleep(nanoseconds: 250_000_000)
                        trigger += 1
                    }
            }
            
            Text(item.title)
                .lineLimit(1)
            
        }
        .padding(.horizontal, 15)
        .padding(.vertical, 8)
        .background {
            LiquidGlassCapsuleBackground()
        }
        
        .gesture(
            DragGesture(minimumDistance: 0)
                .onEnded({ value in
                    guard item.isUserInteractionEnabled else { return }
                    let endY = value.translation.height
                    let velocityY = value.velocity.height
                    
                    if (endY + velocityY) > 100 {
                        /// Removing Toast
                        removeToast()
                    }
                })
        )
        .onAppear {
            guard delayTask == nil else { return }
            delayTask = .init(block: {
                removeToast()
            })
            
            if let delayTask {
                DispatchQueue.main.asyncAfter(deadline: .now() + item.timing.rawValue, execute: delayTask)
            }
        }
        /// Limiting Size
        .frame(maxWidth: size.width * 0.7)
        .transition(.offset(y: -200))
    }
    
    func removeToast() {
        if let delayTask {
            delayTask.cancel()
        }
        
        withAnimation(.snappy) {
            Toast.shared.toasts.removeAll(where: { $0.id == item.id })
        }
    }
}



struct LiquidGlassCapsuleBackground: View {
    var body: some View {
        Group {
            if #available(iOS 26.0, *) {
                let shape = Capsule(style: .continuous)
                        shape
                            .glassEffect(.regular, in: shape)
                            .clipShape(shape)
            } else {
                Capsule(style: .continuous)
                    .fill(.ultraThinMaterial)
                    .overlay {
                        Capsule(style: .continuous)
                            .strokeBorder(.white.opacity(0.14), lineWidth: 1)
                    }
            }
        }
    }
}

#Preview {
    ToastRootView {
        VStack {
            Button("Present Toast") {
                Toast.shared.present(
                    title: "AirPods Pro",
                    symbol: "airpodspro",
                    tint: .blue,
                    isUserInteractionEnabled: true,
                    timing: .long
                )
            }
        }
        .padding()
    }
}
