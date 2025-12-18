// aiFeedback.js
// buildFeedbackPrompt を使って、日次/週次/月次の生成を完全統一する

import Constants from 'expo-constants';
import { buildFeedbackPrompt, pickVariant } from './aiPrompts';
import { ensureTrialStart } from './trial';

const OPENAI_MODEL = 'gpt-4o-mini';

// Base URL ---------------------
const getBaseUrl = () => {
  const fromEnv = process.env.OPENAI_BASE_URL || process.env.EXPO_PUBLIC_OPENAI_BASE_URL;
  const fromExpo = Constants.expoConfig?.extra?.OPENAI_BASE_URL;
  const fromManifest = Constants.manifest?.extra?.OPENAI_BASE_URL;
  return fromEnv || fromExpo || fromManifest || 'https://api.openai.com/v1';
};

const OPENAI_URL = `${String(getBaseUrl()).replace(/\/$/, '')}/chat/completions`;

// API Key ---------------------
const getApiKey = () => {
  const fromExpo = Constants.expoConfig?.extra?.OPENAI_API_KEY;
  const fromManifest = Constants.manifest?.extra?.OPENAI_API_KEY;
  const fromPublic = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  return process.env.OPENAI_API_KEY || fromPublic || fromExpo || fromManifest || null;
};

// Utility ---------------------
const parseBulletLines = (text) => {
  if (!text) return null;
  return text
    .split('\n')
    .map((line) => line.trim().replace(/^[-•・\s]+/, ''))
    .filter((line) => line.length > 0);
};

// ---------------------------------------------------------
// 共通: OpenAI リクエスト
// ---------------------------------------------------------
const callOpenAI = async ({ system, user, temperature = 0.4, maxTokens = 200 }) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[aiFeedback] OPENAI_API_KEY not found');
    return null;
  }

  try {
    const body = {
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature,
      max_tokens: maxTokens,
    };

    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.warn('[aiFeedback] OpenAI error', res.status, await res.text());
      return null;
    }

    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content || '';
    return parseBulletLines(content);
  } catch (e) {
    console.error('[aiFeedback] failed', e);
    return null;
  }
};

// ---------------------------------------------------------
// 日次：generateDailyAIFeedback
// ---------------------------------------------------------
export const generateDailyAIFeedback = async ({
  date,
  locale = 'ja',
  plan,
  currentGoal,
  steps,
  detail = 'short', // 'short' | 'long'
  userId,
}) => {
  // トライアル開始を保証（初回アクセス時に走らせる）
  ensureTrialStart().catch(() => {});
  const variant = pickVariant({ userId, horizon: 'daily' });
  const payload = {
    date,
    currentGoal,
    recommendedGoal: plan?.recommendedGoal,
    goalDeltaPercent: plan?.goalDeltaPercent,
    restDay: plan?.restDay,
    reasonCodes: plan?.reasonCodes || [],
    stepsToday: steps || 0,
  };
  const { system, user } = buildFeedbackPrompt({
    locale,
    horizon: 'daily',
    variant,
    detail,
    userId,
    payload,
  });

  console.log('[aiFeedback] daily variant:', variant, 'locale:', locale, 'date:', date, 'goal:', currentGoal, 'steps:', steps);
  return await callOpenAI({ system, user, maxTokens: detail === 'long' ? 260 : 180 });
};

// ---------------------------------------------------------
// 週次：generateWeeklyAIInsight
// ---------------------------------------------------------
export const generateWeeklyAIInsight = async ({
  locale = 'ja',
  summary,
  detail = 'short',
  userId,
}) => {
  const variant = pickVariant({ userId, horizon: 'weekly' });
  const { system, user } = buildFeedbackPrompt({
    locale,
    horizon: 'weekly',
    variant,
    detail,
    userId,
    payload: summary,
  });
  console.log('[aiFeedback] weekly variant:', variant, 'locale:', locale);
  return await callOpenAI({ system, user, maxTokens: detail === 'long' ? 320 : 220 });
};

// ---------------------------------------------------------
// 月次：generateMonthlyAIStyle
// ---------------------------------------------------------
export const generateMonthlyAIStyle = async ({
  locale = 'ja',
  summary,
  detail = 'short',
  userId,
}) => {
  const variant = pickVariant({ userId, horizon: 'monthly' });
  const { system, user } = buildFeedbackPrompt({
    locale,
    horizon: 'monthly',
    variant,
    detail,
    userId,
    payload: summary,
  });
  console.log('[aiFeedback] monthly variant:', variant, 'locale:', locale);
  return await callOpenAI({ system, user, maxTokens: detail === 'long' ? 320 : 220 });
};
