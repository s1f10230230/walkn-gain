import SwiftUI
import UIKit
import RevenueCat

struct PaywallView: View {
    @Environment(\.dismiss) var dismiss
    @State private var packages: [Package] = []
    @State private var isLoading = false
    @State private var selectedPackage: Package?
    @State private var isPurchasing = false
    @State private var showFeatureSheet = false
    var trialEligible: Bool = true

    var onDismiss: (() -> Void)?
    var onPurchaseSuccess: (() -> Void)?

    // カラー定義（アプリのテーマに合わせた暖色ベース）
    private let primaryColor = Color(red: 1.0, green: 107/255, blue: 53/255) // Coral Orange
    private let accentTeal = Color(red: 0, green: 168/255, blue: 150/255)    // Teal
    private let paperBackground = Color(red: 248/255, green: 244/255, blue: 227/255)
    private let cardBackground = Color(red: 255/255, green: 253/255, blue: 249/255)
    private let textDark = Color(red: 45/255, green: 49/255, blue: 66/255)
    private let textGray = Color(red: 156/255, green: 165/255, blue: 181/255)
    private let isJa = Locale.preferredLanguages.first?.hasPrefix("ja") ?? true
    private let eulaURL = URL(string: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")!

    private func L(_ key: String) -> String {
        if isJa {
            switch key {
            case "title": return "Walkn Gain Pro"
            case "subtitle": return "AIとデータで、歩く毎日をフルブースト。"
            case "free": return "Free"
            case "pro": return "Pro"
            case "free_tracking": return "歩数 & 距離を自動記録"
            case "free_photo": return "写真: 1日1枚"
            case "free_history": return "履歴: 30日まで"
            case "free_import": return "歩数: 過去1年分を取得"
            case "pro_ai": return "AIインサイト: 日/週/月のヒントを提案"
            case "pro_goal": return "目標: あなたに合わせて目標と休む日を自動調整"
            case "pro_env": return "環境分析: 天気・気温から歩きやすいコンディションを提案"
            case "pro_history": return "履歴: 無制限"
            case "pro_photo": return "写真: 無制限"
            case "annual": return "年額プラン"
            case "monthly": return "月額プラン"
            case "popular": return "✨ 一番人気"
            case "trial3d": return "3日間無料で試せます"
            case "btn_start": return "Proを始める"
            case "btn_free": return "今は無料で続ける"
            case "btn_restore": return "購入を復元する"
            case "perYear": return "/年"
            case "perMonth": return "/月"
            case "perMonthAvg": return "(月あたり %@)"
            default: return key
            }
        } else {
            switch key {
            case "title": return "Walkn Gain Pro"
            case "subtitle": return "Boost every walk with AI and your data."
            case "free": return "Free"
            case "pro": return "Pro"
            case "free_tracking": return "Auto-track steps & distance"
            case "free_photo": return "Photos: 1/day"
            case "free_history": return "History: last 30 days"
            case "free_import": return "Steps: import past year"
            case "pro_ai": return "AI insights: daily/weekly/monthly tips"
            case "pro_goal": return "Goals: auto-adjusts targets and rest days"
            case "pro_env": return "Environment: suggests best conditions from weather/temp"
            case "pro_history": return "History: unlimited"
            case "pro_photo": return "Photos: unlimited"
            case "annual": return "Annual plan"
            case "monthly": return "Monthly plan"
            case "popular": return "✨ Most popular"
            case "trial3d": return "3-day free trial"
            case "btn_start": return "Start Pro"
            case "btn_free": return "Continue for free"
            case "btn_restore": return "Restore purchases"
            case "perYear": return "/year"
            case "perMonth": return "/mo"
            case "perMonthAvg": return "(≈ %@/mo)"
            default: return key
            }
        }
    }

    var body: some View {
        ZStack {
            paperBackground
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 0) {
                // ヘッダー画像
                Image("paywall_header")
                    .resizable()
                    .scaledToFit()
                    .frame(height: 200)
                    .padding(.top, 20)

                // タイトル
                VStack(spacing: 8) {
                    Text(L("title"))
                        .font(.system(size: 24, weight: .bold))
                        .foregroundColor(textDark)
                    Text(L("subtitle"))
                        .font(.system(size: 15, weight: .medium))
                        .foregroundColor(textGray)
                    Button(action: { showFeatureSheet = true }) {
                        Text(isJa ? "機能の詳細 ›" : "See feature details ›")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(primaryColor)
                    }
                }
                .padding(.top, 16)
                .padding(.bottom, 24)

                // Free vs Pro 比較
                HStack(alignment: .top, spacing: 20) {
                    // Free Column
                    VStack(spacing: 12) {
                        Text(L("free"))
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundColor(textDark)

                        FeatureRow(icon: "figure.walk", text: L("free_tracking"), isLocked: false, color: textGray)
                        FeatureRow(icon: "camera", text: L("free_photo"), isLocked: false, color: textGray)
                        FeatureRow(icon: "calendar", text: L("free_history"), isLocked: false, color: textGray)
                        FeatureRow(icon: "clock", text: L("free_import"), isLocked: false, color: textGray)
                    }
                    .frame(maxWidth: .infinity)

                    // Pro Column
                    VStack(spacing: 12) {
                        HStack(spacing: 4) {
                            Text(L("pro"))
                                .font(.system(size: 18, weight: .semibold))
                                .foregroundColor(textDark)
                            Image(systemName: "seal.fill")
                                .font(.system(size: 20))
                                .foregroundColor(.yellow)
                        }

                        FeatureRow(icon: "sparkles", text: L("pro_ai"), isChecked: true, color: accentTeal, checkmarkColor: primaryColor)
                        FeatureRow(icon: "brain.head.profile", text: L("pro_goal"), isChecked: true, color: accentTeal, checkmarkColor: primaryColor)
                        FeatureRow(icon: "cloud.sun.rain", text: L("pro_env"), isChecked: true, color: accentTeal, checkmarkColor: primaryColor)
                        FeatureRow(icon: "calendar", text: L("pro_history"), isChecked: true, color: accentTeal, checkmarkColor: primaryColor)
                        FeatureRow(icon: "camera.on.rectangle", text: L("pro_photo"), isChecked: true, color: accentTeal, checkmarkColor: primaryColor)
                    }
                    .frame(maxWidth: .infinity)
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 32)

                // 価格プラン
                if isLoading {
                    ProgressView()
                        .frame(height: 180)
                } else {
                    VStack(spacing: 12) {
                        // 年額プラン
                        if let yearlyPackage = packages.first(where: { $0.packageType == .annual }) {
                            PlanCard(
                                package: yearlyPackage,
                                isSelected: selectedPackage?.identifier == yearlyPackage.identifier,
                                isPopular: true,
                                highlightColor: primaryColor,
                                cardBackground: cardBackground,
                                onSelect: { selectedPackage = yearlyPackage },
                                isJa: isJa,
                                trialEligible: trialEligible,
                                L: L
                            )
                        }

                        // 月額プラン
                        if let monthlyPackage = packages.first(where: { $0.packageType == .monthly }) {
                            PlanCard(
                                package: monthlyPackage,
                                isSelected: selectedPackage?.identifier == monthlyPackage.identifier,
                                isPopular: false,
                                highlightColor: primaryColor,
                                cardBackground: cardBackground,
                                onSelect: { selectedPackage = monthlyPackage },
                                isJa: isJa,
                                trialEligible: trialEligible,
                                L: L
                            )
                        }
                    }
                    .padding(.horizontal, 24)
                }

                // 利用規約・プライバシーポリシー
                VStack(spacing: 6) {
                    Button(action: {
                        UIApplication.shared.open(eulaURL)
                    }) {
                        Text(isJa ? "利用規約 (EULA)" : "Terms of Use (EULA)")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(primaryColor)
                    }
                    Button(action: {
                        if let url = URL(string: "https://walk-app-privacypolicy.vercel.app/") {
                            UIApplication.shared.open(url)
                        }
                    }) {
                        Text(isJa ? "プライバシーポリシー" : "Privacy Policy")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(primaryColor)
                    }
                }
                .padding(.top, 8)

                // 購入ボタン
                Button(action: {
                    if let package = selectedPackage {
                        purchase(package: package)
                    }
                }) {
                    HStack {
                        if isPurchasing {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        } else {
                            Text(L("btn_start"))
                                .font(.system(size: 18, weight: .bold))
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(selectedPackage != nil ? primaryColor : Color.gray)
                    .foregroundColor(.white)
                    .cornerRadius(12)
                }
                .disabled(selectedPackage == nil || isPurchasing)
                .padding(.horizontal, 24)
                .padding(.top, 24)

                if let selected = selectedPackage {
                    Text(pricingDisclosureText(for: selected, trialEligible: trialEligible, isJa: isJa))
                        .font(.system(size: 12))
                        .foregroundColor(textGray)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 28)
                        .padding(.top, 8)
                }

                // 無料で続けるボタン
                Button(action: {
                    dismiss()
                    onDismiss?()
                }) {
                    Text(L("btn_free"))
                        .font(.system(size: 14))
                        .foregroundColor(textGray)
                }
                .padding(.top, 16)

                // 復元ボタン
                Button(action: restorePurchases) {
                    Text(L("btn_restore"))
                        .font(.system(size: 12))
                        .foregroundColor(textGray.opacity(0.7))
                }
                .padding(.top, 12)
                .padding(.bottom, 40)
                }
                .frame(maxWidth: .infinity, alignment: .top)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .sheet(isPresented: $showFeatureSheet) {
            if #available(iOS 16.0, *) {
                FeatureDetailSheet(isJa: isJa, primaryColor: primaryColor, textDark: textDark, textGray: textGray)
                    .presentationDetents([.medium, .large])
            } else {
                FeatureDetailSheet(isJa: isJa, primaryColor: primaryColor, textDark: textDark, textGray: textGray)
            }
        }
        .onAppear {
            fetchOfferings()
        }
    }

    // MARK: - Functions

    func fetchOfferings() {
        isLoading = true
        Purchases.shared.getOfferings { offerings, error in
            isLoading = false
            if let packages = offerings?.current?.availablePackages {
                self.packages = packages
                // デフォルトで年額プランを選択
                if let yearly = packages.first(where: { $0.packageType == .annual }) {
                    self.selectedPackage = yearly
                } else {
                    self.selectedPackage = packages.first
                }
            }
        }
    }

    func purchase(package: Package) {
        isPurchasing = true
        Purchases.shared.purchase(package: package) { transaction, customerInfo, error, userCancelled in
            isPurchasing = false

            if let error = error {
                print("購入エラー: \(error.localizedDescription)")
            } else if userCancelled {
                print("購入がキャンセルされました")
            } else {
                // 購入成功
                if customerInfo?.entitlements["Walk'n Gain Pro"]?.isActive == true {
                    dismiss()
                    onPurchaseSuccess?()
                }
            }
        }
    }

    func restorePurchases() {
        isPurchasing = true
        Purchases.shared.restorePurchases { customerInfo, error in
            isPurchasing = false
            if customerInfo?.entitlements["Walk'n Gain Pro"]?.isActive == true {
                dismiss()
                onPurchaseSuccess?()
            }
        }
    }
}

// MARK: - FeatureRow

struct FeatureRow: View {
    let icon: String
    let text: String
    var isLocked: Bool = false
    var isChecked: Bool = false
    let color: Color
    var checkmarkColor: Color = .green

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundColor(color)
                .frame(width: 20)

            Text(text)
                .font(.system(size: 13))
                .foregroundColor(color)

            Spacer()

            if isChecked {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 16))
                    .foregroundColor(checkmarkColor)
            }
        }
    }
}

// MARK: - Feature Detail Sheet
struct FeatureDetailSheet: View {
    let isJa: Bool
    let primaryColor: Color
    let textDark: Color
    let textGray: Color
    @State private var selection: Int = 0

    struct Slide: Identifiable {
        let id = UUID()
        let imageName: String
        let icon: String
        let title: String
        let desc: String
    }

    var features: [Slide] {
        if isJa {
            return [
                Slide(imageName: "feature_ai", icon: "sparkles", title: "AIインサイト", desc: "日/週/月でヒントを提案。目標と休む日も自動で調整。"),
                Slide(imageName: "feature_env", icon: "cloud.sun.rain", title: "環境分析", desc: "天気・気温と歩数の相性から歩きやすい時間帯を教えてくれる。"),
                Slide(imageName: "feature_history", icon: "calendar", title: "履歴・グラフ無制限", desc: "時間帯グラフや週/月比較、ランキングまでフルで見放題。"),
                Slide(imageName: "feature_photos", icon: "camera.on.rectangle", title: "写真は無制限", desc: "1日の思い出を制限なく保存。1枚目はカード用、以降はそのまま追加。"),
            ]
        } else {
            return [
                Slide(imageName: "feature_ai", icon: "sparkles", title: "AI insights", desc: "Daily/weekly/monthly tips; targets and rest days adapt to you."),
                Slide(imageName: "feature_env", icon: "cloud.sun.rain", title: "Environment insights", desc: "Suggests the best conditions from weather & temperature."),
                Slide(imageName: "feature_history", icon: "calendar", title: "Unlimited history & charts", desc: "All time-of-day graphs, weekly/monthly comparisons, rankings."),
                Slide(imageName: "feature_photos", icon: "camera.on.rectangle", title: "Photos unlimited", desc: "Save unlimited memories; first is for the card, others as-is."),
            ]
        }
    }

    var body: some View {
        NavigationView {
            VStack {
                TabView(selection: $selection) {
                    ForEach(Array(features.enumerated()), id: \.element.id) { idx, feature in
                        VStack(spacing: 16) {
                            if let image = UIImage(named: feature.imageName) {
                                Image(uiImage: image)
                                    .resizable()
                                    .scaledToFit()
                                    .frame(maxHeight: 260)
                                    .cornerRadius(12)
                                    .shadow(radius: 6)
                            } else {
                                ZStack {
                                    RoundedRectangle(cornerRadius: 12)
                                        .fill(Color.gray.opacity(0.1))
                                        .frame(height: 200)
                                    Image(systemName: feature.icon)
                                        .font(.system(size: 40, weight: .semibold))
                                        .foregroundColor(primaryColor)
                                }
                            }

                            HStack(alignment: .top, spacing: 12) {
                                Image(systemName: feature.icon)
                                    .foregroundColor(primaryColor)
                                    .font(.system(size: 20, weight: .semibold))
                                    .frame(width: 28)
                                VStack(alignment: .leading, spacing: 6) {
                                    Text(feature.title)
                                        .font(.system(size: 16, weight: .bold))
                                        .foregroundColor(textDark)
                                    Text(feature.desc)
                                        .font(.system(size: 14))
                                        .foregroundColor(textGray)
                                }
                            }
                        }
                        .padding(20)
                        .tag(idx)
                    }
                }
                .tabViewStyle(PageTabViewStyle(indexDisplayMode: .automatic))
            }
            .navigationTitle(isJa ? "Proの詳細" : "Pro features")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(isJa ? "閉じる" : "Done") {
                        // auto dismiss
                    }
                    .foregroundColor(primaryColor)
                }
            }
        }
    }
}

// MARK: - PlanCard

struct PlanCard: View {
    let package: Package
    let isSelected: Bool
    let isPopular: Bool
    let highlightColor: Color
    let cardBackground: Color
    let onSelect: () -> Void
    let isJa: Bool
    let trialEligible: Bool
    let L: (String) -> String

    private var priceString: String {
        package.storeProduct.localizedPriceString
    }

    private var periodString: String {
        switch package.packageType {
        case .annual:
            return isJa ? "/年" : "/year"
        case .monthly:
            return isJa ? "/月" : "/mo"
        default:
            return ""
        }
    }

    private var titleString: String {
        switch package.packageType {
        case .annual:
            return isJa ? "年額プラン" : "Annual plan"
        case .monthly:
            return isJa ? "月額プラン" : "Monthly plan"
        default:
            return package.storeProduct.localizedTitle
        }
    }

    private var monthlyPrice: String? {
        if package.packageType == .annual {
            let price = package.storeProduct.price as Decimal
            let monthly = price / 12
            let formatter = NumberFormatter()
            formatter.numberStyle = .currency
            formatter.locale = Locale.current
            formatter.maximumFractionDigits = 0
            return formatter.string(from: monthly as NSDecimalNumber)
        }
        return nil
    }

    var body: some View {
        Button(action: onSelect) {
            VStack(spacing: 0) {
                if isPopular {
                    Text(L("popular"))
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 4)
                        .background(highlightColor)
                        .cornerRadius(10, corners: [.topLeft, .topRight])
                }

                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(titleString)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(isSelected ? highlightColor : .black)

                        HStack(alignment: .firstTextBaseline, spacing: 2) {
                            Text(priceString)
                                .font(.system(size: 32, weight: .bold))
                                .foregroundColor(isSelected ? highlightColor : .black)
                            Text(isJa ? periodString : (package.packageType == .annual ? "/year" : "/mo"))
                                .font(.system(size: 14))
                                .foregroundColor(.gray)
                        }

                        if let monthly = monthlyPrice {
                            Text(isJa ? "(月あたり \(monthly))" : "(≈ \(monthly)/mo)")
                                .font(.system(size: 12))
                                .foregroundColor(.gray)
                        }
                        if let trial = trialLineText(for: package, trialEligible: trialEligible, isJa: isJa) {
                            Text(trial)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(highlightColor)
                        }
                        if let afterTrial = afterTrialLineText(for: package, trialEligible: trialEligible, isJa: isJa) {
                            Text(afterTrial)
                                .font(.system(size: 12))
                                .foregroundColor(.gray)
                        } else {
                            Text(autoRenewLineText(for: package, isJa: isJa))
                                .font(.system(size: 12))
                                .foregroundColor(.gray)
                        }
                    }

                    Spacer()

                    Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                        .font(.system(size: 24))
                        .foregroundColor(isSelected ? highlightColor : .gray.opacity(0.3))
                }
                .padding(16)
            }
            .background(cardBackground)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? highlightColor : Color.gray.opacity(0.2), lineWidth: isSelected ? 2 : 1)
            )
            .cornerRadius(12)
        }
    }
}

// MARK: - Pricing Copy Helpers

fileprivate func trialLineText(for package: Package, trialEligible: Bool, isJa: Bool) -> String? {
    guard trialEligible,
          let intro = package.storeProduct.introductoryDiscount,
          intro.paymentMode == .freeTrial else {
        return nil
    }
    let periodText = formatTrialPeriod(intro.subscriptionPeriod, isJa: isJa)
    return isJa ? "\(periodText)無料トライアル" : "\(periodText) free trial"
}

fileprivate func afterTrialLineText(for package: Package, trialEligible: Bool, isJa: Bool) -> String? {
    guard trialLineText(for: package, trialEligible: trialEligible, isJa: isJa) != nil else {
        return nil
    }
    let price = package.storeProduct.localizedPriceString
    let period = periodSuffix(for: package, isJa: isJa)
    if isJa {
        return "終了後は\(price)\(period)で自動更新"
    }
    return "Then \(price)\(period), auto-renews."
}

fileprivate func autoRenewLineText(for package: Package, isJa: Bool) -> String {
    let price = package.storeProduct.localizedPriceString
    let period = periodSuffix(for: package, isJa: isJa)
    if isJa {
        return "\(price)\(period)で自動更新"
    }
    return "\(price)\(period), auto-renews."
}

fileprivate func pricingDisclosureText(for package: Package, trialEligible: Bool, isJa: Bool) -> String {
    let price = package.storeProduct.localizedPriceString
    let period = periodSuffix(for: package, isJa: isJa)
    if let trial = trialLineText(for: package, trialEligible: trialEligible, isJa: isJa) {
        if isJa {
            return "\(trial)。終了後は\(price)\(period)で自動更新されます（いつでもキャンセル可）"
        }
        return "\(trial). Then \(price)\(period), auto-renews until canceled."
    }
    if isJa {
        return "\(price)\(period)で自動更新されます（いつでもキャンセル可）"
    }
    return "\(price)\(period), auto-renews until canceled."
}

fileprivate func formatTrialPeriod(_ period: SubscriptionPeriod, isJa: Bool) -> String {
    let value = period.value
    if isJa {
        let unit: String
        switch period.unit {
        case .day: unit = "日間"
        case .week: unit = "週間"
        case .month: unit = "ヶ月"
        case .year: unit = "年"
        @unknown default: unit = ""
        }
        return "\(value)\(unit)"
    }
    let unit: String
    switch period.unit {
    case .day: unit = "day"
    case .week: unit = "week"
    case .month: unit = "month"
    case .year: unit = "year"
    @unknown default: unit = "period"
    }
    return "\(value)-\(unit)"
}

fileprivate func periodSuffix(for package: Package, isJa: Bool) -> String {
    switch package.packageType {
    case .annual: return isJa ? "/年" : "/year"
    case .sixMonth: return isJa ? "/6ヶ月" : "/6 mo"
    case .threeMonth: return isJa ? "/3ヶ月" : "/3 mo"
    case .twoMonth: return isJa ? "/2ヶ月" : "/2 mo"
    case .monthly: return isJa ? "/月" : "/mo"
    case .weekly: return isJa ? "/週" : "/wk"
    default: return ""
    }
}

// MARK: - Corner Radius Extension

extension View {
    func cornerRadius(_ radius: CGFloat, corners: UIRectCorner) -> some View {
        clipShape(RoundedCorner(radius: radius, corners: corners))
    }
}

struct RoundedCorner: Shape {
    var radius: CGFloat = .infinity
    var corners: UIRectCorner = .allCorners

    func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(
            roundedRect: rect,
            byRoundingCorners: corners,
            cornerRadii: CGSize(width: radius, height: radius)
        )
        return Path(path.cgPath)
    }
}

// MARK: - Preview

#Preview {
    PaywallView()
}
