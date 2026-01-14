import Foundation
import SwiftUI
import React

@objc(PaywallModule)
class PaywallModule: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool {
    return true
  }

  @objc(showPaywall:resolver:rejecter:)
  func showPaywall(
    _ trialEligible: Bool,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    presentPaywall(trialEligible: trialEligible, asSheet: false, resolver: resolve, rejecter: reject)
  }

  @objc(showPaywallSheet:resolver:rejecter:)
  func showPaywallSheet(
    _ trialEligible: Bool,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    presentPaywall(trialEligible: trialEligible, asSheet: true, resolver: resolve, rejecter: reject)
  }

  private func presentPaywall(
    trialEligible: Bool,
    asSheet: Bool,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      guard let root = self.topViewController() else {
        reject("E_NO_ROOT", "Unable to find root view controller", nil)
        return
      }

      var resolved = false
      let resolveOnce: (String) -> Void = { action in
        guard !resolved else { return }
        resolved = true
        resolve(["action": action])
      }

      let paywallView = PaywallView(
        trialEligible: trialEligible,
        onDismiss: { resolveOnce("dismissed") },
        onPurchaseSuccess: { resolveOnce("purchased") }
      )

      let hostingController = UIHostingController(rootView: paywallView)
      hostingController.modalPresentationStyle = asSheet ? .pageSheet : .fullScreen
      root.present(hostingController, animated: true)
    }
  }

  private func topViewController(_ root: UIViewController? = nil) -> UIViewController? {
    let rootController = root ?? activeRootViewController()
    guard let controller = rootController else { return nil }

    if let navigation = controller as? UINavigationController {
      return topViewController(navigation.visibleViewController)
    }

    if let tab = controller as? UITabBarController {
      return topViewController(tab.selectedViewController)
    }

    if let presented = controller.presentedViewController,
       presented.view.window != nil {
      return topViewController(presented)
    }

    if controller.view.window == nil,
       let presenting = controller.presentingViewController {
      return topViewController(presenting)
    }

    return controller
  }

  private func activeRootViewController() -> UIViewController? {
    let scenes = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
    let windows = scenes.flatMap { $0.windows }
    if let keyWindow = windows.first(where: { $0.isKeyWindow }) {
      return keyWindow.rootViewController
    }
    if let visibleWindow = windows.first(where: { !$0.isHidden }) {
      return visibleWindow.rootViewController
    }
    return windows.first?.rootViewController
  }
}
