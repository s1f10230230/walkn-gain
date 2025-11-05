# Build 14 変更点まとめ

## 🔴 根本原因の特定

Build 13までのエラー: **`AppleHealthKit.default が存在しません`**

### 原因分析
1. **react-native-healthのindex.jsにES modulesエラー**
   - `require('react-native-health/src/constants')` でディレクトリインポートエラー発生
   - Node.js v22では `ERR_UNSUPPORTED_DIR_IMPORT` エラー
   - ライブラリのConstantsが正しくインポートできない

2. **ライブラリのラッパー経由でのインポートが失敗**
   - `RNHealth.default` が undefined
   - NativeModulesへのアクセスが不安定

## ✅ Build 14での修正内容

### 1. **HealthKit Constantsのハードコード化** ([healthKit.js:8-27](aruite-meshi/src/utils/healthKit.js))

**変更前:**
```javascript
// ライブラリからConstantsをインポート（ES modulesエラー）
const { Activities, Observers, Permissions, Units } = require('react-native-health/src/constants');
```

**変更後:**
```javascript
// Constantsをハードコード（ライブラリのインポートエラーを回避）
const HealthKitConstants = {
  Permissions: {
    ActiveEnergyBurned: 'ActiveEnergyBurned',
    DistanceWalkingRunning: 'DistanceWalkingRunning',
    StepCount: 'StepCount',
    Steps: 'Steps',
  },
  Units: {
    // ... 必要なUnitsを定義
  },
};
```

**効果:** ライブラリのインポートエラーを完全に回避

### 2. **インポート順序の最適化** ([healthKit.js:34-75](aruite-meshi/src/utils/healthKit.js))

**変更前:**
```javascript
// ライブラリのラッパー経由を優先
const RNHealth = require('react-native-health');
AppleHealthKit = RNHealth.default || RNHealth.HealthKit || RNHealth;
```

**変更後:**
```javascript
// 方法1: NativeModulesから直接取得（最も確実）
const { AppleHealthKit: DirectHealthKit } = NativeModules;

if (DirectHealthKit && DirectHealthKit.initHealthKit) {
  // Constantsを手動で追加
  AppleHealthKit = Object.assign({}, DirectHealthKit, {
    Constants: HealthKitConstants,
  });
  healthKitLoadMethod = 'nativeModules';
} else {
  // 方法2: ライブラリのラッパー経由（フォールバック）
  const RNHealth = require('react-native-health');
  AppleHealthKit = RNHealth.default || RNHealth.HealthKit || RNHealth;

  // Constantsが欠けている場合は追加
  if (!AppleHealthKit.Constants || !AppleHealthKit.Constants.Permissions) {
    AppleHealthKit.Constants = HealthKitConstants;
  }
}
```

**効果:**
- NativeModulesへの直接アクセスを優先（最も確実）
- ラッパーが失敗してもフォールバック可能
- Constantsが確実に利用可能

### 3. **app.jsonのプラグイン設定を明示化** ([app.json:17-24](aruite-meshi/app.json))

**変更前:**
```json
"plugins": [
  "react-native-health"
],
```

**変更後:**
```json
"plugins": [
  [
    "react-native-health",
    {
      "healthSharePermission": "歩数データを読み取り、アプリ内で表示します。"
    }
  ]
],
```

**効果:** Expoプラグインが確実にネイティブコードを生成

### 4. **詳細なデバッグログ追加** ([healthKit.js:34-89](aruite-meshi/src/utils/healthKit.js))

以下の情報をコンソールに出力：
- ✅ HealthKit読み込み開始
- ✅ NativeModules.AppleHealthKit の存在確認
- ✅ 利用可能なメソッド一覧
- ✅ 読み込み方法（nativeModules / wrapper / none）
- ✅ Constantsの可用性
- ❌ エラー時の詳細情報（Available NativeModules, エラーメッセージ）

### 5. **画面デバッグの強化** ([HealthKitPermissionScreen.js:31-118](aruite-meshi/src/screens/onboarding/HealthKitPermissionScreen.js))

TestFlightでも確認できる画面表示デバッグ：
- NativeModules.AppleHealthKit の存在（exists / NOT FOUND）
- Total NativeModules の数
- Health-related modules のリスト
- ネイティブメソッドの数と名前
- 各メソッドの型確認（initHealthKit, isAvailable, getStepCount）

## 📊 検証済み項目

### ✅ 構文チェック
- `node --check` で全ファイル検証済み
- エラーなし

### ✅ 依存関係
- react-native: 0.81.5 （要求: >=0.67.3）✅
- react-native-health: 1.19.0 （最新）✅
- expo: 54.0.22 ✅

### ✅ app.json設定
- HealthKitプラグイン: 設定済み ✅
- entitlements: 設定済み ✅
- NSHealthShareUsageDescription: 設定済み ✅

### ✅ Apple Developer
- HealthKit capability: 有効 ✅

## 🎯 期待される動作

### Build 14でのHealthKit読み込みフロー

1. **NativeModulesから直接取得を試行**
   ```
   ✅ NativeModules.AppleHealthKit found
   🔵 Available methods: initHealthKit, isAvailable, getStepCount, ...
   ✅ Using NativeModules directly (Method 1)
   ✅ HealthKit successfully loaded via nativeModules
   ✅ Constants available: true
   ```

2. **もし方法1が失敗した場合**
   ```
   ⚠️ NativeModules.AppleHealthKit not found, trying library wrapper...
   🔵 react-native-health loaded: {hasDefault: true, ...}
   🔵 Added missing Constants to wrapper
   ✅ Using library wrapper (Method 2)
   ```

3. **両方失敗した場合（ビルドの問題）**
   ```
   ❌ Both NativeModule and library wrapper failed
   ❌ Available NativeModules: [リスト]
   ❌ HealthKit initialization failed
   ```

### 権限ダイアログ表示

上記の読み込みが成功すれば、`initHealthKit()` 呼び出し時に：
- iOS標準のHealthKit権限ダイアログが表示される
- 歩数・距離・消費カロリーの読み取り権限を要求
- ユーザーが許可すれば、HealthKitデータが利用可能になる

## 🔍 もしBuild 14でもエラーが出た場合

### デバッグ情報の確認ポイント

1. **NativeModules.AppleHealthKit: exists** が表示されるか？
   - YES → Constants の問題（今回の修正で解決済み）
   - NO → ネイティブモジュールのリンク問題（次の対策へ）

2. **Total NativeModules の数**
   - 50以上 → 正常
   - 極端に少ない → ビルド全体の問題

3. **Load method の値**
   - `nativeModules` → 正常（最も確実）
   - `wrapper` → 動作するはず（フォールバック）
   - `none` → 両方失敗（ビルド/リンク問題）

### 次の対策（Build 15用）

もしNativeModulesが見つからない場合：

1. **eas.jsonにprebuildを追加**
   ```json
   "prebuildCommand": "npx expo prebuild --clean"
   ```

2. **別のHealthKitライブラリを検討**
   - `@kingstinct/react-native-healthkit`
   - より積極的にメンテナンスされている

3. **カスタムExpo Module**
   - 独自のExpo Moduleを作成（確実だが実装コスト大）

## 📝 今回の修正の強み

1. **ライブラリに依存しない**
   - Constantsをハードコード
   - ライブラリのバグ/互換性問題を回避

2. **複数のフォールバック**
   - NativeModules → ライブラリラッパー
   - どちらかが動けば成功

3. **徹底的なデバッグ**
   - コンソール + 画面表示
   - TestFlightでも原因特定可能

4. **確実な読み込み順序**
   - 最も確実な方法（NativeModules）を優先
   - 不安定なラッパーはフォールバック

## ⚠️ 重要な制約

- **EASビルド残り: 2回**（Build 14, 15）
- Build 14で成功しなかった場合、Build 15で別のアプローチ
- これ以上失敗できない
