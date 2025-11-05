# 「ひとこと」機能実装サマリー

## 🎯 コンセプト
**「歩数と記憶を結びつける」**
- 日々の歩数に加えて、その日の気分や出来事をひとことコメントとして記録
- カレンダーでコメントがある日を視覚的に確認
- 最近のひとことを振り返ることで、歩いた思い出がよみがえる

## ✅ 実装完了した機能

### 1. **データ管理層** ([src/utils/dayNotes.js](aruite-meshi/src/utils/dayNotes.js))

**実装内容:**
- MMKV（高速ローカルストレージ）を使用
- キーフォーマット: `daynote:YYYY-MM-DD`
- 主な関数:
  - `getDayNote(date)` - 指定日のコメント取得
  - `setDayNote(date, text)` - 指定日のコメント保存
  - `hasNote(date)` - コメント存在確認
  - `getRecentNotes()` - 最近3件取得
  - `getAllNotes(limit)` - 全コメント取得（日付降順）
  - `getRandomPresets()` - テンプレート候補3つをランダム取得

**テンプレート候補:**
```javascript
[
  '静かな一日',
  'よく動けた日',
  '忙しかった',
  '充実した1日',
  'のんびり過ごした',
  '疲れた〜',
  '楽しかった！',
  '頑張った',
  'リフレッシュできた',
  '人混み多かった😅',
  '天気良かった☀️',
  '雨だった☔',
]
```

### 2. **今日のひとことコンポーネント** ([src/components/TodayNote.js](aruite-meshi/src/components/TodayNote.js))

**機能:**
- 折りたたみ式UI
- コメントがない場合: 「＋ ひとことを追加」ボタン表示
- コメントがある場合: 「今日のひとこと「XXX」」表示
- タップで展開:
  - テキスト入力フィールド
  - ランダムなテンプレート候補3つ（ボタン押下で即反映）
  - キャンセル/保存ボタン

**UI仕様:**
```
┌───────────────────────┐
│ 今日のひとこと              │
│ 「人混み多かった😅」       │  ← タップで編集
└───────────────────────┘

展開時 ↓

┌───────────────────────┐
│ 今日のひとこと              │
│ ┌─────────────────┐   │
│ │ 今日の気分や出来事...  │   │  ← テキスト入力
│ └─────────────────┘   │
│                            │
│ テンプレート：              │
│ [静かな一日] [よく動けた日] [忙しかった] │
│                            │
│ [キャンセル]    [保存]      │
└───────────────────────┘
```

### 3. **最近のひとことコンポーネント** ([src/components/RecentNotes.js](aruite-meshi/src/components/RecentNotes.js))

**機能:**
- 最近のひとこと3件を日付降順で表示
- 各アイテム:
  - 日付（例: 11/3（月））
  - コメントテキスト（2行まで表示）
- タップでその日の詳細へジャンプ（親コンポーネントのコールバック経由）

**UI仕様:**
```
┌───────────────────────┐
│ 最近のひとこと             │
│───────────────────────│
│ 11/3（月）                │
│ 「人混み多かった😅」       │
│───────────────────────│
│ 11/2（日）                │
│ 「よく動けた日」          │
│───────────────────────│
│ 11/1（土）                │
│ 「静かな一日」            │
└───────────────────────┘
```

## 📦 追加された依存関係

```json
{
  "dependencies": {
    "react-native-mmkv": "^3.x.x"
  }
}
```

## 🔧 残りの統合作業

### 1. HomeScreenへの統合（保留中）

**必要な変更:**
- import追加:
  ```javascript
  import TodayNote from '../components/TodayNote';
  import RecentNotes from '../components/RecentNotes';
  ```

- 配置位置:
  ```javascript
  {/* 歩数/カロリー表示の下 */}

  {/* 今日のひとこと */}
  <TodayNote
    theme={theme}
    onNoteChange={(text) => {
      // コメント保存時の処理（必要に応じて）
      console.log('Note saved:', text);
    }}
  />

  {/* 食べ物リスト */}
  <DailyFoodGoal ... />

  {/* 最近のひとこと */}
  <RecentNotes
    theme={theme}
    onNotePress={(date) => {
      // その日の詳細へジャンプ
      const targetDate = new Date(date);
      setSelectedDate(targetDate);
    }}
  />
  ```

### 2. カレンダーへのインジケータ追加（保留中）

**HistoryScreenの修正:**
- カレンダーの日付セルレンダリング部分で `hasNote(date)` をチェック
- コメントがある日は右下に小さな●（黒丸）または💬を表示

```javascript
// カレンダー日セル例
<View style={styles.dayCell}>
  <Text>{day}</Text>
  {hasNote(dateString) && (
    <View style={styles.noteIndicator}>
      <View style={[styles.noteDot, { backgroundColor: theme.primary }]} />
    </View>
  )}
</View>
```

### 3. 今日の予定表示（追加検討）

**HomeScreenのヘッダー部分:**
```javascript
{/* 日付とカレンダーアイコンの下 */}
<View style={styles.eventsSummary}>
  <Text style={styles.eventsLabel}>今日の予定：</Text>
  <Text style={styles.eventsText}>
    {todayEvents.length > 0
      ? todayEvents.map(e => e.title).join(' / ')
      : '予定なし'}
  </Text>
</View>
```

## 💡 実装のポイント

### パフォーマンス
- ✅ MMKVは同期API - 高速で軽量
- ✅ コンポーネントは独立 - 再利用可能
- ✅ 最小限のre-render

### UX
- ✅ 折りたたみ式で邪魔にならない
- ✅ テンプレート候補で入力が簡単
- ✅ 最近のひとことで過去を振り返りやすい

### 拡張性
- ✅ 写真添付（将来的に可能）
- ✅ タグ付け（将来的に可能）
- ✅ エクスポート機能（将来的に可能）

## 🎨 デザイン仕様

### カラー
- カードの背景: `theme.cardBackground`
- テキスト: `theme.text` / `theme.textSecondary`
- プライマリ: `theme.primary`
- ボーダー: `theme.border`

### フォント
- ラベル: 12-13px
- テキスト: 14-15px
- タイトル: 16px

### スペーシング
- カード内padding: 12-16px
- カード間margin: 8px (vertical)
- カード側面margin: 16px (horizontal)

## 🔐 データプライバシー

- ✅ すべてのデータは端末ローカルに保存
- ✅ サーバーへの送信なし
- ✅ MMKVは暗号化可能（必要に応じて有効化）

## 📊 使用例

```javascript
import { getDayNote, setDayNote, hasNote, getRecentNotes } from '../utils/dayNotes';

// コメント保存
setDayNote('2025-11-03', '人混み多かった😅');

// コメント取得
const note = getDayNote('2025-11-03');
// => '人混み多かった😅'

// コメント存在確認
const has = hasNote('2025-11-03');
// => true

// 最近のひとこと
const recent = getRecentNotes();
// => [
//   { date: '2025-11-03', text: '人混み多かった😅', timestamp: ... },
//   { date: '2025-11-02', text: 'よく動けた日', timestamp: ... },
//   { date: '2025-11-01', text: '静かな一日', timestamp: ... },
// ]
```

## ✅ 次のステップ

1. **ユーザー確認** - 実装方針とUIデザインのレビュー
2. **HomeScreen統合** - コンポーネントを配置
3. **カレンダーインジケータ** - HistoryScreenに追加
4. **テスト** - 動作確認
5. **Build 14** - HealthKit修正とUI改善を含めてビルド
