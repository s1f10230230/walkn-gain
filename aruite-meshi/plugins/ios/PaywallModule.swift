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
    let rootController: UIViewController?
    if let root = root {
      rootController = root
    } else {
      rootController = UIApplication.shared.connectedScenes
        .compactMap { $0 as? UIWindowScene }
        .flatMap { $0.windows }
        .first { $0.isKeyWindow }?.rootViewController
    }

    if let navigation = rootController as? UINavigationController {
      return topViewController(navigation.visibleViewController)
    }

    if let tab = rootController as? UITabBarController {
      return topViewController(tab.selectedViewController)
    }

    if let presented = rootController?.presentedViewController {
      return topViewController(presented)
    }

    return rootController
  }
}
