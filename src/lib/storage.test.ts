import { describe, expect, it } from 'vitest';
import { getScenario, scenarios } from '../content';
import { applyChoice, createSession } from '../engine/engine';
import {
  addHistoryEntry,
  buildHistoryEntry,
  collectFromSession,
  computeInsight,
  loadHistory,
  loadZukan,
  zukanUniverse,
  type HistoryEntry,
} from './storage';

function playBestPath(id: string) {
  const scenario = getScenario(id);
  let session = createSession(scenario);
  let guard = 0;
  while (!session.finished && guard++ < 30) {
    const node = scenario.nodes[session.currentNodeId];
    if (node.type !== 'player_choice') throw new Error('unexpected');
    const best = node.choices.findIndex((c) => c.quality === 'best');
    session = applyChoice(scenario, session, Math.max(best, 0), () => 0);
  }
  return { scenario, session };
}

describe('履歴 (F6)', () => {
  it('buildHistoryEntry が品質と文脈(対処カテゴリ)を記録する', () => {
    const { scenario, session } = playBestPath('fashion-first_casual-01');
    const entry = buildHistoryEntry(scenario, session, '2026-07-05T12:00:00Z');
    expect(entry.scenarioId).toBe('fashion-first_casual-01');
    expect(entry.choices[0].context).toBe('opener');
    expect(entry.choices.length).toBeGreaterThanOrEqual(3);
    expect(entry.counts.best).toBe(entry.choices.length); // bestのみ選んだ
    expect(entry.choices.slice(1).every((c) => c.context !== 'opener')).toBe(true);
  });

  it('addHistoryEntry で永続化され loadHistory で読める', () => {
    const { scenario, session } = playBestPath('food-senior_known-01');
    const before = loadHistory().length;
    addHistoryEntry(buildHistoryEntry(scenario, session, '2026-07-05T12:01:00Z'));
    expect(loadHistory().length).toBe(before + 1);
    expect(loadHistory()[0].scenarioId).toBe('food-senior_known-01');
  });

  it('computeInsight は NG が集中した文脈を検出する', () => {
    const mk = (context: 'flat' | 'expand', quality: 'best' | 'ng'): HistoryEntry => ({
      scenarioId: 'x',
      endedAt: '2026-07-05T12:00:00Z',
      mood: 'neutral',
      counts: { best: quality === 'best' ? 1 : 0, ok: 0, ng: quality === 'ng' ? 1 : 0 },
      choices: [{ context, quality }],
    });
    const history = [mk('flat', 'ng'), mk('flat', 'ng'), mk('flat', 'best'), mk('expand', 'best'), mk('expand', 'best'), mk('expand', 'best')];
    const insight = computeInsight(history);
    expect(insight?.context).toBe('flat');
    expect(insight?.message).toContain('そっけない');
  });

  it('標本が少ない・NG率が低い場合は null', () => {
    expect(computeInsight([])).toBeNull();
  });
});

describe('パターン図鑑 (F5)', () => {
  it('zukanUniverse は技法つき選択肢を全シナリオから列挙する', () => {
    const universe = zukanUniverse(scenarios);
    expect(universe.length).toBeGreaterThan(30);
    expect(universe.every((i) => i.choice.techniques && i.choice.techniques.length > 0)).toBe(true);
    // キーはユニーク
    expect(new Set(universe.map((i) => i.key)).size).toBe(universe.length);
  });

  it('collectFromSession で選んだフレーズと技法が図鑑に入る', () => {
    const { scenario, session } = playBestPath('hobby-first_casual-01');
    const state = collectFromSession(scenario, session);
    expect(state.phrases.length).toBeGreaterThanOrEqual(3);
    expect(state.techniques).toContain('ハマってるもの型');
    // 再読込しても残る
    expect(loadZukan().phrases.length).toBe(state.phrases.length);
    // 同じセッションをもう一度収集しても重複しない
    const again = collectFromSession(scenario, session);
    expect(again.phrases.length).toBe(state.phrases.length);
  });
});
