# HealthKit デバッグプラン

## 現在の状況（Build 13まで）

### 問題
TestFlightでHealthKitの権限ダイアログが表示されない
- エラー: `AppleHealthKit.default が存在しません`
- ライブラリは読み込めている: `react-native-health: loaded`

### 実施した対策

#### Build 13での修正内容
1. **複数のインポート方法を試す** ([healthKit.js:14-39](aruite-meshi/src/utils/healthKit.js))
   - 方法1: ライブラリのラッパー経由 (`RNHealth.default || RNHealth.HealthKit || RNHealth`)
   - 方法2: NativeModulesから直接取得して、Constantsを手動で追加

2. **詳細なデバッグログ追加** ([healthKit.js:14-73](aruite-meshi/src/utils/healthKit.js))
   - ライブラリの読み込み状態
   - NativeModulesの確認
   - 利用可能なHealthKit関連モジュールのリスト
   - 最終的な読み込み方法（wrapper / direct / none）

3. **画面デバッグの強化** ([HealthKitPermissionScreen.js:31-118](aruite-meshi/src/screens/onboarding/HealthKitPermissionScreen.js))
   - NativeModules.AppleHealthKitの存在確認
   - すべてのNativeModulesのリスト表示
   - 各メソッドの存在確認
   - エラースタックトレース表示

## もしBuild 13でも同じエラーが出た場合の次のステップ

### ステップ1: デバッグ情報の確認
TestFlightで表示される詳細なデバッグ情報から以下を確認：

1. **NativeModules.AppleHealthKit が存在するか？**
   - ✅ 存在する → ライブラリのラッパーの問題（下記「ケースA」へ）
   - ❌ 存在しない → ネイティブモジュールのリンク問題（下記「ケースB」へ）

2. **Total NativeModules の数**
   - 通常は50以上
   - 極端に少ない場合はビルド全体の問題

3. **Health-related modules のリスト**
   - 何か表示される場合は、その名前を確認

### ケースA: NativeModules.AppleHealthKit は存在するがラッパーが機能しない

#### 原因
- react-native-healthのindex.jsでの再エクスポートの問題
- CommonJS/ES6 modulesの互換性問題

#### 対策
`healthKit.js`を以下のように変更：

```javascript
// NativeModulesから直接インポート（ラッパーを完全にバイパス）
import { NativeModules } from 'react-native';
const { AppleHealthKit: NativeHealthKit } = NativeModules;

// Constantsだけライブラリから取得
const { Activities, Observers, Permissions, Units } = require('react-native-health/src/constants');

const AppleHealthKit = Object.assign({}, NativeHealthKit, {
  Constants: {
    Activities,
    Observers,
    Permissions,
    Units,
  },
});

export default AppleHealthKit;
```

### ケースB: NativeModules.AppleHealthKit が存在しない

#### 考えられる原因
1. Expoプラグインがネイティブコードを正しく生成していない
2. ビルド時にreact-native-healthのiOSネイティブコードがリンクされていない
3. app.jsonのplugins設定が反映されていない

#### 対策1: プラグイン設定の明示化
`app.json`のplugins部分を詳細に設定：

```json
{
  "plugins": [
    [
      "react-native-health",
      {
        "healthSharePermission": "歩数データを読み取り、アプリ内で表示します。",
        "healthUpdatePermission": "歩数データを記録します。",
        "isClinicalDataEnabled": false
      }
    ]
  ]
}
```

#### 対策2: eas.jsonでのprebuildスクリプト
`eas.json`に以下を追加して、ビルド前にネイティブコードを確実に生成：

```json
{
  "build": {
    "production": {
      "distribution": "store",
      "channel": "production",
      "ios": {
        "autoIncrement": "buildNumber"
      },
      "prebuildCommand": "npx expo prebuild --clean"
    }
  }
}
```

#### 対策3: package.jsonの依存関係確認
react-native-healthのpeerDependenciesを確認：

```bash
npm list react-native
```

react-nativeのバージョンが0.67.3以上であることを確認。

#### 対策4: キャッシュクリアとクリーンビルド
ローカルで以下を実行後に再ビルド：

```bash
rm -rf node_modules
rm -rf .expo
npm install
npx expo prebuild --clean
```

### ケースC: 別の名前でモジュールが登録されている

#### 確認方法
デバッグ情報の「Sample modules」を確認し、Health関連で異なる名前がないか探す

#### 対策
もし `RCTAppleHealthKit` や `RNHealthKit` などの名前が見つかった場合：

```javascript
const { AppleHealthKit, RCTAppleHealthKit, RNHealthKit } = NativeModules;
const NativeHealthKit = AppleHealthKit || RCTAppleHealthKit || RNHealthKit;
```

## 最終手段: react-native-healthの代替

もし上記すべてが失敗した場合、以下の代替手段を検討：

### オプション1: expo-health
Expoの公式HealthKitラッパー（将来的にリリース予定の可能性）

### オプション2: 別のライブラリ
- `@kingstinct/react-native-healthkit` - TypeScript対応の代替ライブラリ
- ただし、Expoプラグインの互換性確認が必要

### オプション3: カスタムExpo Module
独自のExpo Moduleを作成してHealthKitに直接アクセス
- 最も確実だが、実装コストが高い
- 参考: https://docs.expo.dev/modules/overview/

## 補足情報

### 現在の設定確認済み項目
- ✅ app.json: HealthKitプラグイン設定済み
- ✅ app.json: entitlements設定済み
- ✅ app.json: NSHealthShareUsageDescription設定済み
- ✅ Apple Developer: HealthKit capability有効
- ✅ react-native-health: v1.19.0 (最新)
- ✅ プラグイン: app.plugin.js存在確認済み

### EASビルドの残り回数
今月残り: **1回** (Build 14が最後)
- 次のビルドは確実に動作する変更のみを含める
- TestFlightでのデバッグ情報を徹底的に分析してから実行

## 次のアクション

1. **Build 13をTestFlightでテスト**
   - デバッグ情報をスクリーンショットで保存
   - 特に以下の情報に注目：
     - `NativeModules.AppleHealthKit: exists` or `NOT FOUND`
     - `Total NativeModules: XX`
     - `Health-related modules: XXX`
     - `Native methods: XXX`

2. **デバッグ情報に基づいて判断**
   - 上記の「ケースA」「ケースB」「ケースC」のいずれかに該当するか判定
   - 該当するケースの対策を実装

3. **Build 14（最後のビルド）を実行**
   - 最も可能性の高い修正のみを含める
   - テスト前に全コードをレビュー
