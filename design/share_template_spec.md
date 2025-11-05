# Share Image Template Spec (MVP+)

目的: SNSで「保存→共有」したくなる見やすい1枚。数字が主役、情報は最小限、読みやすさ最優先。

出力:
- 9:16（1080×1920 PNG）
- 1:1（1080×1080 PNG）
- 余白: 9:16は72px、1:1は64pxのセーフマージン
- フォント: iOS SF Pro / Android Roboto（Fallback: Noto Sans JP）。桁は等幅タブ設定。
- グリッド: 8px ベースライン

動的テキストトークン:
- {steps_formatted} 例: "12,345"
- {goal_formatted}  例: "10,000"
- {streak_days}     例: 5
- {date_iso}        例: "2025-10-28"
- {badge_text}      例: "今日の目標達成"
- {app_mark}        例: "WalkingApp"（透かし）
// Nike Run参照の“ストイックさ”を補助
- {consistency}     例: 6   （今週の達成日数）
// Meshi Flavor用
- {food_emoji}      例: "🍜"
- {food_amount}     例: "0.8"
- {food_unit}       例: "杯"

数値書式:
- 桁区切りオン（ロケールに従う）
- 単位は原則非表示（歩は数値のみ）。補助行に「歩」「目標」など付与。

要素の並び（9:16）:
1) ヘッダー: {date_iso}（小） / {app_mark}（右下透かし）
2) メイン: {steps_formatted}（超大・中央）
3) サブ: 「ストリーク {streak_days} 日」チップ + 「目標 {goal_formatted}」
4) バッジ: {badge_text}（達成時のみ表示）
5) Meshi行（任意）: 「今日の換算：{food_emoji} {food_amount}{food_unit}」

要素の並び（1:1）:
1) メイン: {steps_formatted}
2) サブ: ストリーク・目標行
3) バッジ
4) 右下透かし: {app_mark}

推奨文字サイズ（px基準・実装時はdpに換算）
- 9:16: steps 192 / サブ 40 / バッジ 36 / 日付 28 / 透かし 24 / Meshi 28
- 1:1 : steps 160 / サブ 36 / バッジ 32 / 日付 26 / 透かし 22 / Meshi 24

アクセシビリティ:
- 本文コントラスト AA 準拠（大きなテキストは AAA 目標）。
- タップ領域は不要（静的画像）だが、要素間隔は 16–24px を確保。

---

## テンプレート（3種）

Nike Runの“ストイック感”を参考につつ、地図/ルートは使わない方針。

### 1) Stoic Minimal（最小・白黒基調）
- メイン: 黒文字の特大ステップ、装飾なし
- サブ: StreakとConsistency（今週達成日数/7）だけ表示
- バッジ: 達成時のみ、彩度低め（グレー/グリーン）

### 2) Calm Statement（定番・落ち着き）
- 現行Calmを基準。数字はティール/達成時はグリーン
- サブ: Streak + 目標。必要ならConsistencyを小さく追加

### 3) Meshi Flavor（本アプリらしさ）
- Calmに「今日の換算」行を追加。絵文字1つ、温かい雰囲気
- 色は落ち着き（Warm/Accent最小）

既存のテーマ例（参考値）
#### Sporty Minimal（明度高・鮮やかアクセント）
- bg: #FFFFFF
- text.primary: #0F172A
- text.muted: #475569
- accent.blue: #2563EB
- accent.orange: #F97316
- ring.track: #E2E8F0
- ring.fill: accent.*

印象: キビキビ・スポーティ。数字が映える。やや派手。

#### Calm Classic（柔らかめ・落ち着き）
- bg: #F7FAFC
- text.primary: #1A202C
- text.muted: #64748B
- accent.teal: #0EA5A3
- accent.green: #16A34A
- divider: #E5E7EB

印象: 上品・視認性高い・疲れにくい。対象層と親和性高。

---

## レイアウト詳細（9:16）

```
┌──────────────────────────────────────────┐
│ 2025-10-28                                   │ 28px
│                                              │
│                12,345                         │ 192px, Bold, 等幅タブ
│                                              │
│  [ストリーク 5 日]    目標 10,000            │ 40px / 40px
│                                              │
│     今日の目標達成                            │ 36px（達成時のみ）
│                                              │
│                         WalkingApp            │ 24px, 右下 透かし 30%
└──────────────────────────────────────────┘
```

リング（任意）:
- 背景リング: ring.track / 12px
- 進捗リング: ring.fill / 12px（角丸）。中心に {steps_formatted}

---

## 出力仕様
- 形式: PNG（非可逆圧縮なし）
- 背景: 不透過（単色）
- 余白: セーフマージン内に重要要素を収める（SNS UIの被り対策）
- ファイル名: `share_{date_iso}_{steps}.png`

---

## 生成API用コンフィグ例（端末内ローカル）

```json
{
  "theme": "calm",             
  "aspect": "9:16",            
  "date_iso": "2025-10-28",
  "steps": 12345,
  "goal": 10000,
  "streak_days": 5,
  "badge_text": "今日の目標達成",
  "accent_variant": "teal"     
}
```

実装メモ:
- 数字は `tabular-nums`（iOS: `UIFontDescriptorFeatureSettingsAttribute`/Android: 等幅Tab設定）
- ロケールごとの桁区切りに対応（Intl.NumberFormat）
- 1:1 では行間を詰め、バッジを要素下に移動

---

## 文言候補（短く前向き）
- 今日の目標達成
- 積み上げ中（ストリーク {streak_days} 日）
- あと {remaining_steps} 歩で目標
