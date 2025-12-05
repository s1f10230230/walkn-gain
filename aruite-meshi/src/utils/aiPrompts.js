// aiPrompts.js
// トーン固定 & A/Bテンプレを管理（実運用向け・安定版）

const PROMPT_RULES = {
  ja: {
    system: [
      "あなたは落ち着いたウォーキングコーチです。先生/医者の口調は使わないこと。",
      "過去を採点せず、“これから”の行動を1つだけ提案すること。",
      "数値は最大2つまで。本文では目安として添えるだけ。",
      "テンプレ称賛（お疲れさまでした/素晴らしいです 等）は禁止。",
      "1文は30文字以内、全体で3〜4文に収めること。",
      "各ラベルの直後に本文を1行だけ書き、行数はラベル数と一致させること。",
    ].join("\n"),

    labels: {
      daily: ["今の様子：", "次の一歩："],
      weekly: ["今週の様子：", "気になったところ：", "次の一歩："],
      monthly: ["今月のスタイル：", "強み：", "来月のチャレンジ："],
    },
  },

  en: {
    system: [
      "You are a calm walking coach. Avoid teacher/doctor tone.",
      "Do not grade the past; propose exactly one next action.",
      "Use at most two numbers; treat them as hints, not central points.",
      'Ban generic praise like "great job" or "well done".',
      "Keep each sentence under ~15 words, total 3–4 sentences.",
      "After each label, write exactly one line of text; line count must match labels.",
    ].join("\n"),

    labels: {
      daily: ["This time:", "Next step:"],
      weekly: ["This week:", "What stood out:", "Next step:"],
      monthly: ["This month:", "Strength:", "Next month:"],
    },
  },
};

const TEMPLATES = {
  daily: {
    A: {
      ja: "2行。1行目：今日の様子＋軽い前向き。2行目：具体的な次の一歩。",
      en: "2 lines. Line1: today’s tone + light positive. Line2: one specific next step.",
    },
    B: {
      ja: "2行。1行目：今のペースを柔らかく。2行目：無理なくできる行動1つ。",
      en: "2 lines. Line1: gentle pace description. Line2: one easy next action.",
    },
  },

  weekly: {
    A: {
      ja: "3行固定。今週の様子（合計/平均は軽く）、気になったところ（波/達成日数）、次の一歩（具体行動）。",
      en: "3 lines fixed. This week (lightly mention total/avg), What stood out (variance/achieved days), Next step (concrete action).",
    },
    B: {
      ja: "3行固定。今週のまとめ（ポジ寄り）、気になったところ（やさしく）、次の一手（小さな行動）。",
      en: "3 lines fixed. Summary (positive-leaning), What stood out (soft tone), Next step (small action).",
    },
  },

  monthly: {
    A: {
      ja: "3行固定。今月のスタイル（タイプ＋一言）、強み、来月のチャレンジ（小さな行動）。",
      en: "3 lines fixed. Style (type + one-liner), Strength, Next month (small action).",
    },
    B: {
      ja: "3行固定。今月の気づき（パターン一言）、強み（維持したい点）、来月の一手（軽く提案）。",
      en: "3 lines fixed. Insight, Strength, Next month (light suggestion).",
    },
  },
};

// variant決定（ユーザー×horizonで固定）
const hashVariant = (seed) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
};

export const pickVariant = ({ userId = "", horizon = "daily" }) => {
  const seed = `${userId || "anon"}|${horizon}`;
  return hashVariant(seed) % 2 === 0 ? "A" : "B";
};

// メイン：プロンプトを構築
export const buildFeedbackPrompt = ({
  locale = "ja",
  horizon = "daily",
  variant = "A",
  userId = "",
  payload = {},
}) => {
  const lang = locale === "en" ? "en" : "ja";
  const sysBase = PROMPT_RULES[lang].system;
  const labels = PROMPT_RULES[lang].labels[horizon] || [];
  const templateHint = TEMPLATES[horizon]?.[variant]?.[lang] || "";

  // フォーマット拘束（例示つきで強制）
  const formatRule =
    lang === "ja"
      ? `各ラベルのあとに本文を1行だけ書くこと。行数はラベル数と一致させること。\n形式例：\n${labels
          .map((l) => `${l}[本文]`)
          .join("\n")}`
      : `After each label, write exactly one line of text. Total lines must match labels.\nExample:\n${labels
          .map((l) => `${l} [text]`)
          .join("\n")}`;

  // system の強い順に並べる（揺れ対策）
  const system = [sysBase, formatRule, templateHint].join("\n");

  // userには説明文 + JSONの方が事故らない
  const user =
    lang === "ja"
      ? `以下が今回のデータです。各ラベルの本文を作成してください。\n${JSON.stringify(
          payload
        )}`
      : `Here is the data for this report. Create text for each label.\n${JSON.stringify(
          payload
        )}`;

  return { system, user };
};
