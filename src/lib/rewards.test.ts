import { describe, expect, it } from 'vitest';
import { getScenario, scenarios } from '../content';
import { applyChoice, createSession } from '../engine/engine';
import {
  BADGES,
  buildRewardAgg,
  completionPercent,
  computeRank,
  computeXp,
  currentTitle,
  nextTitle,
  techniqueCounts,
  titleProgress,
} from './rewards';
import { buildHistoryEntry, scenarioStats, type HistoryEntry, type ScenarioStats } from './storage';

function stats(over: Partial<ScenarioStats>): ScenarioStats {
  return { plays: 1, lastAt: null, categoriesSeen: [], moodsSeen: [], cleanClears: 0, ...over };
}

function entry(over: Partial<HistoryEntry>): HistoryEntry {
  return {
    scenarioId: 's1',
    endedAt: '2026-07-06T10:00:00Z',
    mood: 'neutral',
    counts: { best: 1, ok: 1, ng: 0 },
    choices: [
      { context: 'opener', quality: 'best' },
      { context: 'expand', quality: 'ok' },
    ],
    techniques: ['オウム返し'],
    ...over,
  };
}

describe('computeRank', () => {
  it('未プレイは null、プレイのみは C', () => {
    expect(computeRank(undefined)).toBeNull();
    expect(computeRank(stats({ plays: 1 }))).toBe('C');
  });
  it('✕なしクリアで B、+4カテゴリで A、+全ムードで S', () => {
    expect(computeRank(stats({ cleanClears: 1 }))).toBe('B');
    expect(computeRank(stats({ cleanClears: 1, categoriesSeen: ['expand', 'counter', 'short', 'flat'] }))).toBe('A');
    expect(
      computeRank(
        stats({
          cleanClears: 1,
          categoriesSeen: ['expand', 'counter', 'short', 'flat'],
          moodsSeen: ['good', 'neutral', 'awkward'],
        }),
      ),
    ).toBe('S');
  });
  it('カテゴリ4種でも✕なしクリアがなければ C', () => {
    expect(computeRank(stats({ categoriesSeen: ['expand', 'counter', 'short', 'flat'] }))).toBe('C');
  });
});

describe('completionPercent', () => {
  it('全Sで100%、未プレイのみで0%', () => {
    const s = stats({
      cleanClears: 1,
      categoriesSeen: ['expand', 'counter', 'short', 'flat'],
      moodsSeen: ['good', 'neutral', 'awkward'],
    });
    expect(completionPercent(new Map([['a', s]]), ['a'])).toBe(100);
    expect(completionPercent(new Map(), ['a', 'b'])).toBe(0);
  });
});

describe('computeXp / 称号', () => {
  it('決定論的で、プレイが増えると単調増加する', () => {
    const h1 = [entry({})];
    const h2 = [entry({ endedAt: '2026-07-06T11:00:00Z' }), ...h1];
    const xp1 = computeXp(h1, 0);
    expect(computeXp(h1, 0)).toBe(xp1);
    expect(computeXp(h2, 0)).toBeGreaterThan(xp1);
  });
  it('初回ボーナスは2回目のプレイでは付かない(差分が小さくなる)', () => {
    const first = computeXp([entry({})], 0);
    const second = computeXp([entry({ endedAt: '2026-07-06T11:00:00Z' }), entry({})], 0) - first;
    expect(second).toBeLessThan(first);
  });
  it('メダルは1個+20', () => {
    expect(computeXp([], 3)).toBe(60);
  });
  it('称号は閾値で切り替わり、進捗が0〜1で出る', () => {
    expect(currentTitle(0).name).toBe('雑談見習い');
    expect(currentTitle(60).name).toBe('声をかける人');
    expect(nextTitle(0)?.xp).toBe(60);
    expect(nextTitle(999999)).toBeNull();
    expect(titleProgress(999999)).toBe(1);
    expect(titleProgress(30)).toBeCloseTo(0.5);
  });
});

describe('バッジ', () => {
  it('技法使用回数を集計してバッジ判定できる', () => {
    const history = [
      entry({ techniques: ['オウム返し', 'オウム返し'] }),
      entry({ techniques: ['オウム返し', 'リカバリ'] }),
    ];
    const counts = techniqueCounts(history);
    expect(counts.get('オウム返し')).toBe(3);
    const agg = buildRewardAgg(history, scenarioStats(history), ['s1'], 0);
    const echo = BADGES.find((b) => b.id === 'echo')!;
    expect(echo.achieved(agg)).toBe(true);
    const recover = BADGES.find((b) => b.id === 'recover')!;
    expect(recover.achieved(agg)).toBe(false);
  });
  it('実会話メダルと全場面踏破のバッジ', () => {
    const history = [entry({})];
    const agg = buildRewardAgg(history, scenarioStats(history), ['s1'], 1);
    expect(BADGES.find((b) => b.id === 'firstmedal')!.achieved(agg)).toBe(true);
    expect(BADGES.find((b) => b.id === 'alltopics')!.achieved(agg)).toBe(true);
  });
});

describe('buildHistoryEntry の技法記録', () => {
  it('選んだ選択肢の技法タグが記録される', () => {
    const scenario = getScenario('fashion-first_casual-01');
    let session = createSession(scenario);
    let guard = 0;
    while (!session.finished && guard++ < 12) {
      const node = scenario.nodes[session.currentNodeId];
      if (node.type !== 'player_choice') throw new Error('unexpected');
      const best = node.choices.findIndex((c) => c.quality === 'best');
      session = applyChoice(scenario, session, Math.max(best, 0), () => 0);
    }
    const historyEntry = buildHistoryEntry(scenario, session, '2026-07-06T10:00:00Z');
    expect(historyEntry.techniques!.length).toBeGreaterThan(0);
  });
  it('実シナリオ全体で completionPercent が計算できる', () => {
    expect(completionPercent(new Map(), scenarios.map((s) => s.id))).toBe(0);
  });
});
