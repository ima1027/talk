import { describe, expect, it } from 'vitest';
import { scenarios } from '../content';
import type { Scenario } from '../engine/types';
import { categoryCoverage, recommendDaily } from './recommend';
import type { HistoryEntry } from './storage';

const NOW = new Date('2026-07-05T12:00:00Z');

function makeScenario(id: string, flatBranches: number): Scenario {
  const nodes: Scenario['nodes'] = {
    n1: {
      type: 'player_choice',
      choices: [
        { text: 'a', quality: 'best', explanation: 'e', next: 'p1' },
        { text: 'b', quality: 'ok', explanation: 'e', next: 'p1' },
      ],
    },
    p1: {
      type: 'partner_response',
      branches: [
        { category: 'expand', weight: 1, text: 't', next: 'end1' },
        ...Array.from({ length: flatBranches }, (_, i) => ({
          category: 'flat' as const,
          weight: 1,
          text: `f${i}`,
          next: 'end1',
        })),
      ],
    },
    end1: { type: 'end', text: 'x', mood: 'neutral' },
  };
  return { id, topic: 't', scene: 'first_casual', title: id, situation: 's', guide: 'g', entry: 'n1', nodes };
}

function ngHistory(context: 'flat', count: number): HistoryEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    scenarioId: 'x',
    endedAt: `2026-07-0${(i % 5) + 1}T10:00:00Z`,
    mood: 'awkward' as const,
    counts: { best: 0, ok: 0, ng: 1 },
    choices: [{ context, quality: 'ng' as const }],
  }));
}

describe('recommendDaily', () => {
  const pool = [makeScenario('s-few', 1), makeScenario('s-many', 3), makeScenario('s-none', 0)];

  it('履歴がなければ日替わり(決定論的)', () => {
    const a = recommendDaily(pool, [], '2026-7-5', NOW);
    const b = recommendDaily(pool, [], '2026-7-5', NOW);
    expect(a.reason).toBe('daily');
    expect(a.scenarioId).toBe(b.scenarioId);
  });

  it('flatへの対処にNGが集中していたら、flat分岐の多いシナリオを推す', () => {
    const rec = recommendDaily(pool, ngHistory('flat', 3), '2026-7-5', NOW);
    expect(rec.reason).toBe('weakness');
    expect(rec.scenarioId).toBe('s-many');
    expect(rec.insight?.context).toBe('flat');
  });

  it('最近やったシナリオより、やっていないシナリオを優先する(鮮度ボーナス)', () => {
    const twins = [makeScenario('s-a', 2), makeScenario('s-b', 2)];
    const history: HistoryEntry[] = [
      ...ngHistory('flat', 3),
      {
        scenarioId: 's-a',
        endedAt: NOW.toISOString(), // s-a は直前にプレイ済み
        mood: 'neutral',
        counts: { best: 1, ok: 0, ng: 0 },
        choices: [{ context: 'expand', quality: 'best' }],
      },
    ];
    const rec = recommendDaily(twins, history, '2026-7-5', NOW);
    expect(rec.scenarioId).toBe('s-b');
  });

  it('同点なら日付で決定論的に選ぶ', () => {
    const twins = [makeScenario('s-a', 2), makeScenario('s-b', 2)];
    const history = ngHistory('flat', 3);
    const a = recommendDaily(twins, history, '2026-7-5', NOW);
    const b = recommendDaily(twins, history, '2026-7-5', NOW);
    expect(a.scenarioId).toBe(b.scenarioId);
  });

  it('同梱シナリオ全体に対しても有効なIDを返す', () => {
    const rec = recommendDaily(scenarios, ngHistory('flat', 3), '2026-7-6', NOW);
    expect(scenarios.some((s) => s.id === rec.scenarioId)).toBe(true);
    expect(rec.reason).toBe('weakness');
  });
});

describe('categoryCoverage', () => {
  it('カテゴリごとの分岐数を数える', () => {
    expect(categoryCoverage(makeScenario('x', 3), 'flat')).toBe(3);
    expect(categoryCoverage(makeScenario('x', 3), 'expand')).toBe(1);
    expect(categoryCoverage(makeScenario('x', 0), 'flat')).toBe(0);
  });
});
