// 報酬システム(攻略ランク・称号XP・技法バッジ・実会話メダル)。
// 原則: 報酬は「アプリを開くこと」ではなく学習上意味のある行動
// (別ルート探索・✕回避・技法の使用・実会話で試す)にだけ付ける(調査レポート§5)。
// すべて履歴から決定論的に再計算する(保存カウンタを持たない=移行問題が起きない)。

import type { Mood } from '../engine/types';
import type { HistoryEntry, ScenarioStats } from './storage';

// ---- 攻略ランク(提案2) ----

export type Rank = 'S' | 'A' | 'B' | 'C';

export const RANK_SCORE: Record<Rank, number> = { C: 1, B: 2, A: 3, S: 4 };

export const RANK_STYLES: Record<Rank, string> = {
  S: 'bg-yellow-400 text-yellow-950',
  A: 'bg-violet-500 text-white',
  B: 'bg-sky-500 text-white',
  C: 'bg-slate-400 text-white',
};

/**
 * C=プレイ済み / B=✕なしクリア / A=B+反応4種制覇 / S=A+全エンディング回収
 */
export function computeRank(stats?: ScenarioStats): Rank | null {
  if (!stats || stats.plays === 0) return null;
  const clean = stats.cleanClears > 0;
  const cats = stats.categoriesSeen.length >= 4;
  const moods = stats.moodsSeen.length >= 3;
  if (clean && cats && moods) return 'S';
  if (clean && cats) return 'A';
  if (clean) return 'B';
  return 'C';
}

/** 全シナリオの攻略度(0〜100%)。Sで満点、未プレイは0 */
export function completionPercent(statsMap: Map<string, ScenarioStats>, scenarioIds: string[]): number {
  if (scenarioIds.length === 0) return 0;
  let score = 0;
  for (const id of scenarioIds) {
    const rank = computeRank(statsMap.get(id));
    if (rank) score += RANK_SCORE[rank];
  }
  return Math.round((score / (scenarioIds.length * 4)) * 100);
}

export const ALL_MOODS: Mood[] = ['good', 'neutral', 'awkward'];

// ---- 称号XP(提案3) ----

/**
 * XPの内訳(1プレイあたり):
 * 基礎5 + ◎×3 + ○×1 + ✕なしボーナス5
 * 初回ボーナス: 新シナリオ+10 / シナリオ×反応カテゴリ初体験+4 / シナリオ×エンディング初回収+4
 * 実会話メダル: 1個+20(最上位の報酬)
 */
export function computeXp(history: HistoryEntry[], medalCount: number): number {
  let xp = medalCount * 20;
  const seenScenario = new Set<string>();
  const seenCategory = new Set<string>();
  const seenMood = new Set<string>();
  // 履歴は新しい順に保存されているため、古い順に走査して初回ボーナスを判定する
  for (const entry of [...history].reverse()) {
    xp += 5 + entry.counts.best * 3 + entry.counts.ok;
    if (entry.counts.ng === 0) xp += 5;
    if (!seenScenario.has(entry.scenarioId)) {
      seenScenario.add(entry.scenarioId);
      xp += 10;
    }
    for (const c of entry.choices) {
      if (c.context === 'opener') continue;
      const key = `${entry.scenarioId}:${c.context}`;
      if (!seenCategory.has(key)) {
        seenCategory.add(key);
        xp += 4;
      }
    }
    const moodKey = `${entry.scenarioId}:${entry.mood}`;
    if (!seenMood.has(moodKey)) {
      seenMood.add(moodKey);
      xp += 4;
    }
  }
  return xp;
}

export interface Title {
  xp: number;
  name: string;
}

export const TITLES: Title[] = [
  { xp: 0, name: '雑談見習い' },
  { xp: 60, name: '声をかける人' },
  { xp: 180, name: '沈黙を破る人' },
  { xp: 400, name: '場をつなぐ人' },
  { xp: 700, name: '立て直せる人' },
  { xp: 1100, name: '切り上げ上手' },
  { xp: 1600, name: '雑談の人' },
];

export function currentTitle(xp: number): Title {
  let current = TITLES[0];
  for (const t of TITLES) if (xp >= t.xp) current = t;
  return current;
}

export function nextTitle(xp: number): Title | null {
  return TITLES.find((t) => t.xp > xp) ?? null;
}

/** 次の称号までの進捗(0〜1)。最高位なら1 */
export function titleProgress(xp: number): number {
  const cur = currentTitle(xp);
  const next = nextTitle(xp);
  if (!next) return 1;
  return Math.min(1, (xp - cur.xp) / (next.xp - cur.xp));
}

// ---- 技法バッジ(提案3) ----

export function techniqueCounts(history: HistoryEntry[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of history) {
    for (const t of entry.techniques ?? []) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return counts;
}

export interface RewardAgg {
  techniqueCounts: Map<string, number>;
  scenariosPlayed: number;
  totalScenarios: number;
  medals: number;
  sRanks: number;
  /** 続編を1話以上解禁したキャラクター数(関係性の報酬) */
  sequelsUnlocked: number;
  /** 「気安い仲」(関係レベル最大)まで育てたキャラクター数 */
  maxedRelationships: number;
}

/** キャラクター関係の集計(呼び出し側で relationship.ts から算出して渡す) */
export interface RelationshipAgg {
  sequelsUnlocked: number;
  maxedRelationships: number;
}

export function buildRewardAgg(
  history: HistoryEntry[],
  statsMap: Map<string, ScenarioStats>,
  scenarioIds: string[],
  medalCount: number,
  relationship: RelationshipAgg = { sequelsUnlocked: 0, maxedRelationships: 0 },
): RewardAgg {
  let sRanks = 0;
  for (const id of scenarioIds) if (computeRank(statsMap.get(id)) === 'S') sRanks++;
  return {
    techniqueCounts: techniqueCounts(history),
    scenariosPlayed: [...statsMap.keys()].filter((id) => scenarioIds.includes(id)).length,
    totalScenarios: scenarioIds.length,
    medals: medalCount,
    sRanks,
    sequelsUnlocked: relationship.sequelsUnlocked,
    maxedRelationships: relationship.maxedRelationships,
  };
}

export interface BadgeDef {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  achieved: (agg: RewardAgg) => boolean;
}

const tech = (name: string, n: number) => (agg: RewardAgg) => (agg.techniqueCounts.get(name) ?? 0) >= n;

export const BADGES: BadgeDef[] = [
  { id: 'echo', emoji: '🦜', name: 'オウム返しの人', desc: '「オウム返し」を3回使う', achieved: tech('オウム返し', 3) },
  { id: 'onetwo', emoji: '🏓', name: '一問二答の使い手', desc: '「一問二答」を5回使う', achieved: tech('一問二答', 5) },
  { id: 'closer', emoji: '👋', name: 'きれいに終わる人', desc: '「切り上げ」を5回使う', achieved: tech('切り上げ', 5) },
  { id: 'recover', emoji: '🩹', name: '立て直しの名人', desc: '「リカバリ」を3回使う', achieved: tech('リカバリ', 3) },
  { id: 'pivot', emoji: '🔀', name: '引き際の人', desc: '「撤退・話題転換」を3回使う', achieved: tech('撤退・話題転換', 3) },
  { id: 'local', emoji: '📍', name: 'その場の話題で戦う人', desc: '「場の共通話題」を5回使う', achieved: tech('場の共通話題', 5) },
  { id: 'rephrase', emoji: '🎯', name: '聞き方を変えられる人', desc: '「ハマってるもの型」を2回使う', achieved: tech('ハマってるもの型', 2) },
  { id: 'open', emoji: '🪟', name: '先に開く人', desc: '「自己開示」を3回使う', achieved: tech('自己開示', 3) },
  {
    id: 'alltopics',
    emoji: '🗺️',
    name: '全場面踏破',
    desc: '全シナリオを1回以上プレイ',
    achieved: (a) => a.totalScenarios > 0 && a.scenariosPlayed >= a.totalScenarios,
  },
  { id: 'firstmedal', emoji: '🏅', name: '現場デビュー', desc: '実会話メダルを1つ獲得', achieved: (a) => a.medals >= 1 },
  { id: 'srank', emoji: '👑', name: '完全攻略', desc: 'Sランクのシナリオを1つ作る', achieved: (a) => a.sRanks >= 1 },
  {
    id: 'sequel',
    emoji: '🔓',
    name: '続きがある人',
    desc: '同じ相手の続編を1つ解禁',
    achieved: (a) => a.sequelsUnlocked >= 1,
  },
  {
    id: 'bond',
    emoji: '💗',
    name: '気を許される人',
    desc: '誰か1人と「気安い仲」になる',
    achieved: (a) => a.maxedRelationships >= 1,
  },
];
