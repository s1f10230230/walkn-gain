# Walk'n Life

AIとデータで、歩く毎日をフルブーストする歩数・ライフログアプリです。

Walk'n Life は、日々の歩数、消費カロリー、距離、天気、日記、写真をまとめて記録し、歩く習慣を続けやすくする React Native / Expo アプリです。AIインサイト、履歴レポート、プレミアム機能を通じて、毎日の歩行データを振り返りやすくします。

## Features

- 歩数、消費カロリー、距離、時間帯別歩数の記録
- 今日のメモ、気分、写真つき日記
- 週間・月間の履歴、レポート、グラフ表示
- 天気や予定を使った歩きやすさの把握
- オンボーディングでの言語、プロフィール、目標歩数、権限設定
- HealthKit 連携による iOS の歩数データ取得
- RevenueCat を使った Pro サブスクリプション
- Pro 向けの AIインサイト、自動目標チューニング、環境分析、月次スタイル診断

## Tech Stack

- React 19
- React Native 0.81
- Expo SDK 54
- React Navigation
- HealthKit via `@kingstinct/react-native-healthkit`
- RevenueCat via `react-native-purchases`
- Local storage via AsyncStorage / MMKV
- Charts via `react-native-chart-kit` and `react-native-svg`

## Project Structure

```text
aruite-meshi/
├── App.js
├── app.json
├── app.config.js
├── assets/
├── ios/
│   └── WalknLife/
├── modules/
│   └── healthkit-swift/
├── plugins/
│   └── with-paywall-module.js
└── src/
    ├── components/
    ├── contexts/
    ├── data/
    ├── i18n/
    ├── navigation/
    ├── screens/
    │   ├── onboarding/
    │   └── upgrade/
    ├── tasks/
    └── utils/
```

## Requirements

- Node.js 18 以上
- npm
- Xcode
- iOS Simulator または iOS 実機
- Expo CLI / EAS CLI

歩数計測や HealthKit はシミュレータでは制限があります。歩数・ヘルスケア周りの確認は実機で行ってください。

## Setup

```bash
npm install
```

必要に応じて `.env` を作成します。

```bash
OPENAI_API_KEY=
REVENUECAT_API_KEY=
```

`REVENUECAT_API_KEY` は `EXPO_PUBLIC_REVENUECAT_API_KEY` でも読み込めます。

## Development

```bash
# Expo 開発サーバー
npm start

# iOS
npm run ios

# Android
npm run android

# Web
npm run web
```

## App Configuration

現在の Expo 設定:

- App name: `Walk'n Life`
- Slug: `aruite-meshi`
- iOS bundle id: `com.walkngain.app`
- Android package: `com.walkngain.app`
- Version: `1.0.2`
- iOS build number: `55`

`app.config.js` では、ネイティブの Paywall module plugin と環境変数を追加しています。

## Main Screens

- Home: 今日の歩数、達成率、メモ、写真
- History: 日別履歴、カレンダー、過去データ
- Report: 週間・月間の振り返り、グラフ、スタイル診断
- Settings: プロフィール、通知、共有、Pro、規約
- Upgrade: Pro プラン、RevenueCat 購入、復元、EULA
- Onboarding: 言語、プロフィール、目標、権限、Pro紹介

## Notes

- このアプリは iOS の HealthKit 権限を使用します。
- 天気、カレンダー、写真、カメラ、位置情報は機能ごとに権限説明を `app.json` で管理しています。
- Pro 購入処理は RevenueCat の offerings / packages を参照します。
- Web では歩数計測や一部ネイティブ機能は利用できません。

## License

MIT License
