# リリースガイド - 歩いてメシ

このガイドでは、「歩いてメシ」をApp StoreとGoogle Play Storeにリリースする手順を説明します。

---

## 📋 事前準備チェックリスト

### 必須項目
- [ ] Apple Developer Program アカウント（iOS用、年間99USD）
- [ ] Google Play Developer アカウント（Android用、登録料25USD）
- [ ] Expo アカウント
- [ ] アプリアイコン（1024x1024px）
- [ ] スクリーンショット（最低5枚）
- [ ] プライバシーポリシーURL
- [ ] サポートURL

---

## 🔧 ステップ1: EAS Buildのセットアップ

### 1.1 Expo CLIのインストール

```bash
npm install -g eas-cli
```

### 1.2 Expoアカウントでログイン

```bash
eas login
```

### 1.3 プロジェクトの初期化

```bash
cd aruite-meshi
eas build:configure
```

これにより`eas.json`が作成されます（すでに作成済み）。

---

## 🍎 ステップ2: iOS版のビルド（App Store）

### 2.1 アプリIDとプロビジョニングの設定

1. [Apple Developer](https://developer.apple.com/)にログイン
2. **Certificates, Identifiers & Profiles**に移動
3. **Identifiers** > **+** ボタン
4. **App IDs**を選択
5. Bundle ID: `com.yourcompany.aruitemeshi`
6. **Capabilities**で以下を有効化：
   - ✅ HealthKit
   - ✅ Push Notifications

### 2.2 app.jsonの更新

`app.json`の`ios.bundleIdentifier`を実際のBundle IDに更新：

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.yourcompany.aruitemeshi"
    }
  }
}
```

### 2.3 ビルドの実行

```bash
eas build --platform ios --profile production
```

- Apple IDとパスワードを入力
- 2ファクタ認証コードを入力
- ビルドが完了するまで待機（10-20分）

### 2.4 IPA ファイルのダウンロード

ビルドが完了したら、Expo ダッシュボードから`.ipa`ファイルをダウンロード。

---

## 🤖 ステップ3: Android版のビルド（Google Play）

### 3.1 app.jsonの更新

`app.json`の`android.package`を実際のパッケージ名に更新：

```json
{
  "expo": {
    "android": {
      "package": "com.yourcompany.aruitemeshi"
    }
  }
}
```

### 3.2 キーストアの生成

```bash
eas credentials
```

- **Android**を選択
- **Set up a new keystore**を選択
- 自動的に生成されます

### 3.3 ビルドの実行

```bash
eas build --platform android --profile production
```

- ビルドが完了するまで待機（10-20分）

### 3.4 AAB ファイルのダウンロード

ビルドが完了したら、Expo ダッシュボードから`.aab`ファイルをダウンロード。

---

## 📱 ステップ4: App Store Connect（iOS）

### 4.1 App Store Connectにログイン

https://appstoreconnect.apple.com/

### 4.2 新規アプリの作成

1. **マイApp** > **+** ボタン > **新規App**
2. 以下を入力：
   - **プラットフォーム**: iOS
   - **名前**: 歩いてメシ
   - **プライマリ言語**: 日本語
   - **バンドルID**: com.yourcompany.aruitemeshi
   - **SKU**: aruite-meshi-001

### 4.3 アプリ情報の入力

#### 基本情報
- **名前**: 歩いてメシ
- **サブタイトル**: 歩数を食べ物で可視化する歩数計
- **カテゴリ**: ヘルスケア＆フィットネス

#### 説明文
STORE.mdの「ストア説明文」をコピー＆ペースト

#### キーワード
```
歩数計,万歩計,ダイエット,健康,フィットネス,カロリー,ヘルスケア
```

#### スクリーンショット
- iPhone 6.7" Display: 5-10枚
- iPhone 6.5" Display: 5-10枚（推奨）

#### プライバシーポリシーURL
```
https://github.com/yourcompany/aruite-meshi/blob/main/PRIVACY.md
```

#### サポートURL
```
https://github.com/yourcompany/aruite-meshi
```

### 4.4 App Privacy（プライバシーの詳細）

1. **データの収集**
   - **ヘルスとフィットネス**: はい
     - 歩数
     - 消費カロリー
     - 移動距離
   - **位置情報**: はい（任意）
     - 天気取得のための概算位置
   - **購入情報**: はい
     - サブスクリプション状態
   - **使用目的**: アプリの機能
   - **第三者との共有**: 天気/AI/購入のために必要最小限

2. **データの種類**
   - 基本データはデバイス内に保存
   - 外部送信: Open-Meteo / OpenAI / RevenueCat

### 4.5 ビルドのアップロード

```bash
eas submit --platform ios
```

または、Xcodeから手動アップロード。

### 4.6 審査のリクエスト

1. **バージョン情報** > **審査に提出**
2. 輸出コンプライアンス: **いいえ**（暗号化なし）
3. **提出**をクリック

---

## 🤖 ステップ5: Google Play Console（Android）

### 5.1 Google Play Consoleにログイン

https://play.google.com/console/

### 5.2 新規アプリの作成

1. **アプリを作成**
2. 以下を入力：
   - **アプリ名**: 歩いてメシ
   - **デフォルトの言語**: 日本語
   - **アプリまたはゲーム**: アプリ
   - **無料または有料**: 無料

### 5.3 ストアの掲載情報

#### アプリの詳細
- **簡単な説明**（80文字）:
  ```
  歩数を食べ物で可視化。ラーメン0.8杯分歩いた！楽しく続く歩数計アプリ。
  ```

- **詳しい説明**（4000文字）:
  STORE.mdの「ストア説明文」をコピー＆ペースト

#### グラフィック
- **アプリアイコン**: 512x512px（PNG）
- **フィーチャーグラフィック**: 1024x500px（必須）
- **スクリーンショット**:
  - 携帯電話: 2-8枚（1080x1920推奨）
  - 7インチタブレット: 2-8枚（オプション）

#### カテゴリ
- **カテゴリ**: 健康＆フィットネス
- **タグ**: 歩数計, ダイエット, 健康

#### 連絡先の詳細
- **メールアドレス**: your-email@example.com
- **ウェブサイト**: https://github.com/yourcompany/aruite-meshi
- **プライバシーポリシー**: https://github.com/yourcompany/aruite-meshi/blob/main/PRIVACY.md

### 5.4 アプリのコンテンツ

#### データの安全性
1. **データの収集と共有**
   - 収集: 健康とフィットネス（歩数、カロリー、距離）、位置情報（任意）、購入情報
   - 共有: 天気/AI/購入のために必要最小限
   - 暗号化: はい（デバイス内）
   - 削除リクエスト: アプリ内で可能

#### 広告
- **広告を含む**: いいえ

#### コンテンツレーティング
- PEGI 3（全年齢）
- ESRB Everyone

#### ターゲットユーザーと内容
- **ターゲット年齢**: すべて
- **ストアの掲載**: すべての国

### 5.5 リリースの作成

1. **製品版** > **新しいリリースを作成**
2. AABファイルをアップロード
3. **リリース名**: 1.0.0
4. **リリースノート**:
   ```
   初回リリース！
   - リアルタイム歩数計測
   - 100種類以上の食べ物換算
   - ヘルスケア連携（高精度）
   - 統計とグラフ
   - 完全無料・広告なし
   ```
5. **審査のために送信**

---

## 📸 ステップ6: スクリーンショットの作成

### 推奨ツール
- **iOS Simulator**（Xcode）
- **Android Emulator**（Android Studio）
- **Figma** または **Sketch**（デザインツール）

### 必要なスクリーンショット（各5枚）

1. **ホーム画面**
   - 大きな円形プログレス
   - 歩数表示
   - 食べ物換算カード

2. **食べ物換算**
   - 横スクロールの食べ物カード
   - ラーメン、おにぎり、ビール

3. **履歴画面**
   - グラフ表示
   - 週間/月間切り替え
   - 日別データ

4. **食べ物一覧**
   - カテゴリ別表示
   - カスタム追加ボタン
   - お気に入り機能

5. **設定画面**
   - ヘルスケア連携
   - 目標設定
   - 通知設定

### スクリーンショットのサイズ

#### iOS
- iPhone 6.7" (Pro Max): 1290 x 2796
- iPhone 6.5": 1242 x 2688

#### Android
- 縦長: 1080 x 1920
- 横長: 1920 x 1080（オプション）

### デザインのヒント
- 明るい背景で撮影
- 実際のデータを入力（8,234歩など）
- テキストオーバーレイで機能を説明

---

## 🎨 ステップ7: アプリアイコンの作成

### デザイン要件
- サイズ: 1024x1024px
- フォーマット: PNG（透過なし）
- 角丸: なし（iOSが自動適用）

### デザイン案
STORE.mdの「アプリアイコンデザイン指示」を参照

### 推奨ツール
- **Figma**: https://figma.com
- **Canva**: https://canva.com
- **Adobe Illustrator**

### カラー
- オレンジ: #FF7043
- 白: #FFFFFF

---

## ✅ ステップ8: 審査前のチェックリスト

### 機能テスト
- [ ] 歩数計測が動作する
- [ ] 食べ物換算が正確
- [ ] ヘルスケア連携が動作する
- [ ] 通知が送信される
- [ ] 履歴が表示される
- [ ] 設定が保存される

### コンテンツ
- [ ] スクリーンショットが鮮明
- [ ] 説明文に誤字脱字がない
- [ ] プライバシーポリシーURLが有効
- [ ] サポートURLが有効

### コンプライアンス
- [ ] 広告ID使用なし
- [ ] データ収集の開示
- [ ] 子どものプライバシー保護
- [ ] GDPR/CCPA準拠

---

## 🚀 ステップ9: リリース！

### iOSの審査時間
- 通常: 24-48時間
- 初回: 最大7日間

### Androidの審査時間
- 通常: 数時間-3日間
- 初回: 最大7日間

### 審査承認後
1. **段階的リリース**（推奨）
   - 最初は10%のユーザー
   - 問題がなければ50%、100%と拡大

2. **全ユーザーにリリース**
   - 即座にすべてのユーザーに配信

---

## 📊 ステップ10: リリース後

### モニタリング
- [ ] クラッシュレポートの確認
- [ ] レビューの返信
- [ ] ユーザーフィードバックの収集

### マーケティング
- [ ] SNSで告知（Twitter, Instagram）
- [ ] プレスリリース配信
- [ ] App Store / Google Play最適化（ASO）

### アップデート計画
- バグ修正: 随時
- 新機能: 月1回
- メジャーアップデート: 3-6ヶ月

---

## 🛠️ トラブルシューティング

### ビルドエラー
```bash
# キャッシュをクリア
npm cache clean --force
rm -rf node_modules
npm install

# EASビルドを再試行
eas build --platform ios --clear-cache
```

### 審査リジェクト（iOS）
- **HealthKitの使用説明不足**: `NSHealthShareUsageDescription`を明確に
- **プライバシーポリシー不足**: URLが有効か確認

### 審査リジェクト（Android）
- **権限の説明不足**: `android.permissions`の説明を追加
- **コンテンツレーティング**: 適切な年齢設定

---

## 📞 サポート

### Expo
- ドキュメント: https://docs.expo.dev/
- フォーラム: https://forums.expo.dev/

### Apple
- Developer Support: https://developer.apple.com/support/
- App Store Connect: https://developer.apple.com/app-store-connect/

### Google
- Play Console Help: https://support.google.com/googleplay/android-developer/

---

## 🎉 おめでとうございます！

「歩いてメシ」のリリース、おめでとうございます！

健康的で楽しいアプリをユーザーに届けましょう！🍜👟✨

---

**次のステップ**: アップデート計画、ユーザーフィードバックの収集、機能拡張を検討しましょう。
