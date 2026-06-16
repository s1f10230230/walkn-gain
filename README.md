# Walk'n Life

AIとデータで、歩く毎日をフルブーストする歩数・ライフログアプリです。

このリポジトリは、個人開発アプリ `Walk'n Life` の開発記録とポートフォリオ用のコードベースです。日々の歩数、消費カロリー、距離、天気、日記、写真をまとめて記録し、歩く習慣を振り返りやすくすることを目的にしています。

## Overview

Walk'n Life は React Native / Expo で構築したモバイルアプリです。HealthKit 連携による歩数データ取得、日記・写真記録、履歴レポート、AIインサイト、Proサブスクリプション機能を備えています。

## Main Features

- 歩数、消費カロリー、距離、時間帯別歩数の記録
- 今日のメモ、気分、写真つき日記
- 週間・月間の履歴、レポート、グラフ表示
- 天気や予定を使った歩きやすさの把握
- HealthKit 連携による iOS の歩数データ取得
- RevenueCat を使った Pro サブスクリプション
- Pro 向けの AIインサイト、自動目標チューニング、環境分析、月次スタイル診断

## Tech Stack

- React Native / Expo
- React Navigation
- HealthKit
- AsyncStorage / MMKV
- RevenueCat
- react-native-chart-kit / react-native-svg

## Repository

```text
walkn-gain/
└── aruite-meshi/
    ├── App.js
    ├── app.json
    ├── app.config.js
    ├── ios/
    └── src/
```

詳細な実装メモは [aruite-meshi/README.md](./aruite-meshi/README.md) にまとめています。

## Purpose

個人のプロダクト開発力を示すため、企画、UI、ヘルスケア連携、課金導線、データ可視化、アプリ構成を一つのモバイルアプリとして実装しています。
